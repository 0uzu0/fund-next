/**
 * 基金前10重仓股（参考 hzm0321/real-time-fund）
 * 重仓：东方财富 FundArchivesDatas.aspx；股票涨跌幅：腾讯 qt.gtimg.cn
 */
const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 东方财富 - 基金重仓持股 HTML，解析为 { code, name, weight }[]
 */
async function fetchFundHoldingsEastmoney(fundCode) {
  try {
    const { data: raw } = await axios.get(
      'https://fundf10.eastmoney.com/FundArchivesDatas.aspx',
      {
        params: {
          type: 'jjcc',
          code: String(fundCode).trim(),
          topline: 10,
          year: '',
          month: '',
          _: Date.now(),
        },
        headers: { 'User-Agent': UA, Referer: 'https://fundf10.eastmoney.com/' },
        timeout: 12000,
        validateStatus: () => true,
      }
    );
    const str = typeof raw === 'string' ? raw : '';
    const m = str.match(/var\s+apidata\s*=\s*\{\s*content\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*arryear/);
    if (!m) return [];
    const content = m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    const firstTable = content.split(/\n####\s+/)[0];
    const rows = (firstTable.match(/<tr>[\s\S]*?<\/tr>/gi) || []).slice(1);
    const result = [];
    // 东方财富返回表格中为 markdown 链接 [文字](url) 或 HTML <a>；代码为 6 位数字，名称为非数字
    const linkRegex = /\[([^\]]+)\]\([^)]+\)/g;
    const aTextRegex = /<a[^>]*>([^<]+)<\/a>/g;
    for (const row of rows) {
      const linkTexts = [];
      linkRegex.lastIndex = 0;
      let linkMatch;
      while ((linkMatch = linkRegex.exec(row)) !== null) linkTexts.push(linkMatch[1].trim());
      if (linkTexts.length === 0 && row.includes('<a')) {
        aTextRegex.lastIndex = 0;
        let aMatch;
        while ((aMatch = aTextRegex.exec(row)) !== null) linkTexts.push(aMatch[1].trim());
      }
      const code = linkTexts.find((t) => /^\d{6}$/.test(t)) || (row.match(/\[(\d{6})\]/) || [])[1] || '';
      const name = linkTexts.find((t) => t && !/^\d{6}$/.test(t)) || '';
      const pctMatch = row.match(/(\d+(?:\.\d+)?)\s*%/);
      const weight = pctMatch ? pctMatch[1] + '%' : '';
      if (code || name || weight) result.push({ code, name, weight, change: null });
    }
    return result.slice(0, 10);
  } catch (_) {
    return [];
  }
}

/**
 * 腾讯行情 - 批量 A 股涨跌幅，返回 Map<code, changePercent>
 */
function tencentCodePrefix(code) {
  const c = String(code);
  if (/^6|^9/.test(c)) return 's_sh' + c;
  if (/^0|^3/.test(c)) return 's_sz' + c;
  if (/^4|^8/.test(c)) return 's_bj' + c;
  return 's_sh' + c;
}

async function fetchStockChangesTencent(codes) {
  const list = codes.filter((c) => /^\d{6}$/.test(c));
  if (!list.length) return new Map();
  const q = list.map(tencentCodePrefix).join(',');
  try {
    const { data: raw } = await axios.get('https://qt.gtimg.cn/q=' + q, {
      headers: { 'User-Agent': UA },
      timeout: 8000,
      validateStatus: () => true,
    });
    const str = typeof raw === 'string' ? raw : '';
    const re = /v_s_(?:sh|sz|bj)(\d{6})="([^"]*)"/g;
    const out = new Map();
    let match;
    while ((match = re.exec(str))) {
      const code = match[1];
      const parts = match[2].split('~');
      const change = parts.length > 5 ? parseFloat(parts[5]) : null;
      if (!Number.isNaN(change)) out.set(code, change);
    }
    return out;
  } catch (_) {
    return new Map();
  }
}

/**
 * 获取基金前10重仓，并附当日涨跌幅（腾讯）
 * @returns {Promise<{ code: string, name: string, weight: string, change: number | null }[]>}
 */
async function getFundHoldings(fundCode) {
  const holdings = await fetchFundHoldingsEastmoney(fundCode);
  const codes = holdings.map((h) => h.code).filter(Boolean);
  const changeMap = await fetchStockChangesTencent(codes);
  return holdings.map((h) => ({
    ...h,
    change: changeMap.has(h.code) ? changeMap.get(h.code) : null,
  }));
}

module.exports = {
  getFundHoldings,
  fetchFundHoldingsEastmoney,
  fetchStockChangesTencent,
};
