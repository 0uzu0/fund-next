/**
 * 基金搜索服务
 * 支持关键词搜索基金代码和名称
 */
const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 从东方财富搜索基金（关键词搜索）
 * @param {string} keyword - 搜索关键词
 * @param {number} limit - 返回结果数量限制
 * @returns {Promise<Array<{code: string, name: string}>>}
 */
async function searchFundByKeyword(keyword, limit = 10) {
  if (!keyword || keyword.length < 2) {
    return [];
  }

  const callbackName = '__fund_suggest_' + Date.now();
  const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(keyword)}&callback=${callbackName}&_=${Date.now()}`;

  try {
    const { data: raw } = await axios.get(url, {
      timeout: 8000,
      responseType: 'text',
      headers: { 'User-Agent': UA }
    });

    const start = raw.indexOf('(');
    const end = raw.lastIndexOf(')');
    const jsonStr = start >= 0 && end > start ? raw.slice(start + 1, end) : raw;
    const data = JSON.parse(jsonStr);

    let list = (data && data.Datas) ? data.Datas : [];
    list = list
      .filter((d) => d.CATEGORY === 700 || d.CATEGORY === '700' || (d.CATEGORYDESC && d.CATEGORYDESC.includes('基金')))
      .map((d) => ({
        code: String(d.CODE || d.code || ''),
        name: String(d.NAME || d.SHORTNAME || d.name || ''),
        type: d.CATEGORYDESC || '未知类型'
      }))
      .filter((d) => d.code && d.name)
      .slice(0, limit);

    return list;
  } catch (error) {
    console.error('[基金搜索] 东方财富接口失败:', error.message);
    return [];
  }
}

module.exports = {
  searchFundByKeyword
};
