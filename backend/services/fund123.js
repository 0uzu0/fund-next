/**
 * 基金行情/估值数据源：对接 fund123.cn，与 Python fund.py 行为一致
 * 必要数据写入数据库缓存，减少外部请求
 */
const https = require('https');
const http = require('http');
let cache = null;
try {
  cache = require('../cache');
} catch (e) {
  // 未初始化时忽略缓存
}

const BASE = 'https://www.fund123.cn';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';

const agent = new https.Agent({ rejectUnauthorized: false });

const cookieJar = [];
function saveCookies(setCookie) {
  if (!setCookie) return;
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const s of list) {
    const part = s.split(';')[0].trim();
    if (!part) continue;
    const eq = part.indexOf('=');
    const name = part.slice(0, eq);
    const value = part.slice(eq + 1);
    const i = cookieJar.findIndex((c) => c.name === name);
    if (i >= 0) cookieJar[i].value = value;
    else cookieJar.push({ name, value });
  }
}
function getCookieHeader() {
  return cookieJar.map((c) => c.name + '=' + c.value).join('; ');
}

function request(options) {
  return new Promise((resolve, reject) => {
    const url = new URL(options.url || options.uri);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const headers = {
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Connection': 'keep-alive',
      'User-Agent': UA,
      ...options.headers,
    };
    if (cookieJar.length) headers['Cookie'] = getCookieHeader();
    const opts = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers,
      agent: isHttps ? agent : undefined,
    };
    const req = lib.request(opts, (res) => {
      saveCookies(res.headers['set-cookie']);
      let data = '';
      res.on('data', (ch) => (data += ch));
      res.on('end', () => {
        if (options.json) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid JSON: ' + data.slice(0, 200)));
          }
        } else resolve(data);
      });
    });
    req.on('error', reject);
    if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    req.end();
  });
}

let csrfCache = null;
let csrfTime = 0;
const CSRF_TTL = 5 * 60 * 1000; // 5 分钟

/**
 * 从 fund 页获取 _csrf
 */
async function getCsrf() {
  if (csrfCache && Date.now() - csrfTime < CSRF_TTL) return csrfCache;
  const html = await request({
    url: BASE + '/fund',
    method: 'GET',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Referer: BASE + '/',
    },
  });
  const m = html.match(/"csrf":"([^"]+)"/);
  if (!m) throw new Error('Failed to get csrf from fund123');
  csrfCache = m[1];
  csrfTime = Date.now();
  return csrfCache;
}

/**
 * 根据基金代码搜索，返回 fund_key、fund_name（与 Python add_code 一致）
 * 对接 fund123 失败时返回 null，不抛出异常，便于添加基金接口仍可添加（使用默认名称）
 */
async function searchFund(fundCode) {
  try {
    const _csrf = await getCsrf();
    const res = await request({
      url: BASE + '/api/fund/searchFund?_csrf=' + encodeURIComponent(_csrf),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE,
        Referer: BASE + '/fund',
        'X-API-Key': 'foobar',
        accept: 'json',
      },
      body: { fundCode: String(fundCode).trim() },
      json: true,
    });
    if (!res.success || !res.fundInfo) return null;
    const info = res.fundInfo;
    const fundKey = info.key != null ? String(info.key) : String(fundCode).trim();
    const rawName = info.fundName ?? info.name ?? info.fund_name;
    const fundName =
      rawName != null && String(rawName).trim() !== ''
        ? String(rawName).replace(/<[^>]+>/g, '').trim()
        : null;
    return {
      fund_key: fundKey,
      fund_name: fundName || `基金${String(fundCode).trim()}`,
    };
  } catch (_) {
    return null;
  }
}

/**
 * 获取单只基金行情页 HTML，解析 dayOfGrowth、netValue、netValueDate
 */
async function getMatiaria(fundCode) {
  const cKey = cache && cache.keyMatiaria(fundCode);
  if (cKey) {
    const cached = cache.get(cKey, cache.DEFAULT_TTL_MS.fundMatiaria);
    if (cached !== null) return cached;
  }
  const html = await request({
    url: BASE + '/matiaria?fundCode=' + encodeURIComponent(fundCode),
    method: 'GET',
    headers: {
      Origin: BASE,
      Referer: BASE + '/fund',
      'X-API-Key': 'foobar',
      accept: 'json',
    },
  });
  const dayOfGrowth = html.match(/"dayOfGrowth":"([^"]+)"/);
  const netValue = html.match(/"netValue":"([^"]+)"/);
  const netValueDate = html.match(/"netValueDate":"([^"]+)"/);
  if (!netValue || !netValueDate) return null;
  const result = {
    dayOfGrowth: dayOfGrowth ? (parseFloat(dayOfGrowth[1]).toFixed(2) + '%') : '0%',
    netValue: netValue[1] + '(' + netValueDate[1] + ')',
    netValueDate: netValueDate[1],
    netValueNum: parseFloat(netValue[1]),
  };
  if (cache && cKey) cache.set(cKey, result);
  return result;
}

/**
 * 基金近一个月行情曲线（用于连涨/跌、近30天）
 */
async function queryFundQuotationCurves(fundKey) {
  const cKey = cache && cache.keyCurves(fundKey);
  if (cKey) {
    const cached = cache.get(cKey, cache.DEFAULT_TTL_MS.fundCurves);
    if (cached !== null) return cached;
  }
  const _csrf = await getCsrf();
  const res = await request({
    url: BASE + '/api/fund/queryFundQuotationCurves?_csrf=' + encodeURIComponent(_csrf),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: BASE,
      Referer: BASE + '/fund',
      'X-API-Key': 'foobar',
      accept: 'json',
    },
    body: { productId: fundKey, dateInterval: 'ONE_MONTH' },
    json: true,
  });
  if (!res.success || !Array.isArray(res.points)) return [];
  const list = res.points.filter((x) => x.type === 'fund');
  if (cache && cKey) cache.set(cKey, list);
  return list;
}

/**
 * 当日估值分时（用于图表与当前估值）
 */
async function queryFundEstimateIntraday(fundKey) {
  const cKey = cache && cache.keyIntraday(fundKey);
  if (cKey) {
    const cached = cache.get(cKey, cache.DEFAULT_TTL_MS.fundIntraday);
    if (cached !== null) return cached;
  }
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const startTime = `${y}-${m}-${d}`;
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const y2 = tomorrow.getFullYear();
  const m2 = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const d2 = String(tomorrow.getDate()).padStart(2, '0');
  const endTime = `${y2}-${m2}-${d2}`;

  const _csrf = await getCsrf();
  const res = await request({
    url: BASE + '/api/fund/queryFundEstimateIntraday?_csrf=' + encodeURIComponent(_csrf),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: BASE,
      Referer: BASE + '/fund',
      'X-API-Key': 'foobar',
      accept: 'json',
    },
    body: {
      startTime,
      endTime,
      limit: 200,
      productId: fundKey,
      format: true,
      source: 'WEALTHBFFWEB',
    },
    json: true,
  });
  if (!res.success || !Array.isArray(res.list)) return [];
  const list = res.list;
  if (cache && cKey) cache.set(cKey, list);
  return list;
}

module.exports = {
  getCsrf,
  searchFund,
  getMatiaria,
  queryFundQuotationCurves,
  queryFundEstimateIntraday,
};
