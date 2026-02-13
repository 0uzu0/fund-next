/**
 * 天天基金数据源（参考 hzm0321/real-time-fund）
 * 接口：fundgz.1234567.com.cn/js/{code}.js（JSONP），返回实时估值 dwjz/gsz/gszzl 等
 */
const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const GZ_BASE = 'https://fundgz.1234567.com.cn';

/**
 * 请求单只基金估值（JSONP 响应，服务端用正则取 JSON）
 * @param {string} code 基金代码
 * @returns {Promise<{ fundcode, name, dwjz, gsz, gztime, jzrq, gszzl } | null>}
 */
async function fetchFundGz(code) {
  try {
    const { data: raw } = await axios.get(`${GZ_BASE}/js/${String(code).trim()}.js`, {
      params: { rt: Date.now() },
      headers: { 'User-Agent': UA },
      timeout: 8000,
      validateStatus: () => true,
    });
    if (!raw || typeof raw !== 'string') return null;
    const start = raw.indexOf('jsonpgz(');
    if (start === -1) return null;
    const braceStart = raw.indexOf('{', start);
    const braceEnd = raw.lastIndexOf('}');
    if (braceStart === -1 || braceEnd <= braceStart) return null;
    const json = JSON.parse(raw.slice(braceStart, braceEnd + 1));
    if (!json || !json.fundcode) return null;
    return json;
  } catch (_) {
    return null;
  }
}

/**
 * 天天基金版 searchCode：返回与 fundQuotes.searchCode 相同格式的行数组
 * [code, name, nowTime, netValue, forecastGrowth, dayOfGrowth, consecutiveInfo, monthlyInfo]
 * 连涨/跌、近30天天天接口无，填 '—'
 * @param {Record<string, { fund_key: string, fund_name: string, sectors?: string[] }>} fundMap
 * @returns {Promise<Array<[string, string, string, string, string, string, string, string]>>}
 */
async function searchCodeTiantian(fundMap) {
  const entries = Object.entries(fundMap || {});
  const rows = await Promise.all(
    entries.map(async ([code, data]) => {
      const gz = await fetchFundGz(code);
      const fundName = (data && data.fund_name) || `基金${code}`;
      const sectors = data.sectors || [];
      let name = fundName;
      if (sectors.length) name = name + ` 🏷️ ${sectors.join(', ')}`;

      if (!gz) {
        return [code, name, '—', '—', 'N/A', '—', '—', '—'];
      }

      const dwjz = gz.dwjz != null ? String(gz.dwjz).trim() : '';
      const jzrq = (gz.jzrq && String(gz.jzrq).trim()) || '';
      const netValueStr = dwjz ? `${dwjz}(${jzrq})` : '—';
      const gszzlNum = parseFloat(gz.gszzl);
      const forecastGrowth = Number.isFinite(gszzlNum) ? (Math.round(gszzlNum * 100) / 100) + '%' : 'N/A';
      const nowTime = (gz.gztime && String(gz.gztime).trim()) || '—';
      const dayOfGrowth = Number.isFinite(gszzlNum) ? forecastGrowth : '—';

      return [
        code,
        name,
        nowTime,
        netValueStr,
        forecastGrowth,
        dayOfGrowth,
        '—',
        '—',
      ];
    })
  );
  const valid = rows.filter(Boolean);
  valid.sort((a, b) => {
    const pctA = a[4] === 'N/A' ? -99 : parseFloat(String(a[4]).replace('%', ''));
    const pctB = b[4] === 'N/A' ? -99 : parseFloat(String(b[4]).replace('%', ''));
    return pctB - pctA;
  });
  return valid;
}

module.exports = {
  fetchFundGz,
  searchCodeTiantian,
};
