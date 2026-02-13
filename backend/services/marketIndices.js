/**
 * 市场指数：与 0uzu0/fund 项目一致，数据源百度股市通 (gushitong.baidu.com / finance.pae.baidu.com)
 * - 上证分时：fund.py get_timing_chart_data() → getquotation code=000001
 * 请求头与原项目保持一致，便于百度接口正常返回；失败时使用东方财富备用。
 */
const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

/** 百度股市通 API 请求头（与 fund 项目 baidu_session 一致） */
const BAIDU_HEADERS = {
  'User-Agent': UA,
  'Accept': 'application/vnd.finance-web.v1+json',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  'Origin': 'https://gushitong.baidu.com',
  'Referer': 'https://gushitong.baidu.com/',
};

/**
 * 全球指数（亚洲+美洲 getbanner，创业板指 getquotation），与 get_market_info(is_return=True) 一致
 * 返回: [ { name, value, change, change_pct }, ... ]
 */
async function fetchGlobalIndices() {
  const result = [];
  try {
    for (const market of ['asia', 'america']) {
      const { data } = await axios.get('https://finance.pae.baidu.com/api/getbanner', {
        params: { market, finClientType: 'pc' },
        headers: BAIDU_HEADERS,
        timeout: 10000,
        validateStatus: () => true,
      });
      if (data && data.ResultCode === '0' && data.Result && Array.isArray(data.Result.list)) {
        for (const item of data.Result.list) {
          const ratio = (item.ratio || '0').replace(/\x1b\[[0-9;]+m/g, '').trim();
          result.push({
            name: item.name || '',
            value: item.lastPrice != null ? String(item.lastPrice) : '',
            change: ratio.indexOf('%') >= 0 ? ratio : ratio + '%',
            change_pct: parseFloat(String(ratio).replace('%', '')) || 0,
          });
        }
      }
    }

    // 创业板指插入到第 3 位（index 2），与原项目一致
    const { data: qData } = await axios.get('https://finance.pae.baidu.com/vapi/v1/getquotation', {
      params: {
        srcid: '5353',
        all: '1',
        pointType: 'string',
        group: 'quotation_index_minute',
        query: '399006',
        code: '399006',
        market_type: 'ab',
        newFormat: '1',
        name: '创业板指',
        finClientType: 'pc',
      },
      headers: BAIDU_HEADERS,
      timeout: 10000,
      validateStatus: () => true,
    });
    if (qData && qData.ResultCode === '0' && qData.Result && qData.Result.cur) {
      const cur = qData.Result.cur;
      const ratio = (cur.ratio || '0').replace(/\x1b\[[0-9;]+m/g, '').trim();
      const item = {
        name: '创业板指',
        value: cur.price != null ? String(cur.price) : '',
        change: ratio.indexOf('%') >= 0 ? ratio : ratio + '%',
        change_pct: parseFloat(String(ratio).replace('%', '')) || 0,
      };
      result.splice(2, 0, item);
    }
  } catch (e) {
    console.warn('fetchGlobalIndices error:', e.message);
  }
  return result;
}

/**
 * 东方财富上证分时备用（百度不可用时）
 * push2his.eastmoney.com trends2，secid=1.000001，trends 每条: "时间,?,最新价,均价,成交量,成交额,..."
 */
async function fetchTimingChartDataEastmoney() {
  try {
    const { data } = await axios.get('https://push2his.eastmoney.com/api/qt/stock/trends2/get', {
      params: {
        fields1: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13',
        fields2: 'f51,f52,f53,f54,f55,f56,f57,f58',
        ut: '7eea3edcaed734bea9cbfc24409ed989',
        ndays: 1,
        iscr: 0,
        secid: '1.000001',
      },
      headers: { 'User-Agent': UA, Referer: 'https://quote.eastmoney.com/' },
      timeout: 10000,
      validateStatus: () => true,
    });
    if (!data || data.data == null || !Array.isArray(data.data.trends) || data.data.trends.length === 0) {
      return null;
    }
    const trends = data.data.trends;
    const labels = [];
    const prices = [];
    const change_pcts = [];
    const change_amounts = [];
    const volumes = [];
    const amounts = [];
    let basePrice = NaN;
    for (const row of trends) {
      const parts = String(row).split(',');
      if (parts.length < 4) continue;
      const timePart = parts[0] || '';
      const price = parseFloat(parts[2]);
      if (Number.isFinite(price) && Number.isNaN(basePrice)) basePrice = price;
      const vol = parseFloat(parts[4]) || 0;
      const amt = parseFloat(parts[5]) || 0;
      labels.push(timePart);
      prices.push(price);
      const changeAmt = Number.isFinite(basePrice) ? price - basePrice : 0;
      const pct = Number.isFinite(basePrice) && basePrice !== 0 ? (changeAmt / basePrice) * 100 : 0;
      change_amounts.push(changeAmt);
      change_pcts.push(pct);
      volumes.push(Math.round((vol / 10000) * 100) / 100);
      amounts.push(Math.round((amt / 10000 / 10000) * 100) / 100);
    }
    if (prices.length === 0) return null;
    return { labels, prices, change_pcts, change_amounts, volumes, amounts };
  } catch (e) {
    console.warn('fetchTimingChartDataEastmoney error:', e.message);
    return null;
  }
}

/**
 * 上证分时图表数据（与 fund.py get_timing_chart_data / A(True) 一致）
 * 优先百度，失败或无数据时用东方财富备用
 * 返回: { labels, prices, change_pcts, change_amounts, volumes, amounts }
 */
async function fetchTimingChartData() {
  try {
    const { data } = await axios.get('https://finance.pae.baidu.com/vapi/v1/getquotation', {
      params: {
        srcid: '5353',
        all: '1',
        pointType: 'string',
        group: 'quotation_index_minute',
        query: '000001',
        code: '000001',
        market_type: 'ab',
        newFormat: '1',
        name: '上证指数',
        finClientType: 'pc',
      },
      headers: BAIDU_HEADERS,
      timeout: 10000,
      validateStatus: () => true,
    });
    if (data && data.ResultCode === '0' && data.Result?.newMarketData?.marketData?.[0]?.p) {
      const raw = data.Result.newMarketData.marketData[0].p;
      const rows = raw.split(';').filter(Boolean);
      const labels = [];
      const prices = [];
      const change_pcts = [];
      const change_amounts = [];
      const volumes = [];
      const amounts = [];
      for (const row of rows) {
        const parts = row.split(',');
        if (parts.length < 6) continue;
        const timePart = parts[0];
        const price = parseFloat(parts[1]);
        const changeAmt = parseFloat(parts[2]) || 0;
        const pctStr = (parts[3] || '0').replace('%', '');
        const pct = parseFloat(pctStr) || 0;
        const vol = parseFloat(parts[4]) || 0;
        const amt = parseFloat(parts[5]) || 0;
        labels.push(timePart);
        prices.push(price);
        change_amounts.push(changeAmt);
        change_pcts.push(pct);
        volumes.push(Math.round((vol / 10000) * 100) / 100);
        amounts.push(Math.round((amt / 10000 / 10000) * 100) / 100);
      }
      if (prices.length > 0) {
        return { labels, prices, change_pcts, change_amounts, volumes, amounts };
      }
    }
  } catch (e) {
    console.warn('fetchTimingChartData (baidu) error:', e.message);
  }
  const fallback = await fetchTimingChartDataEastmoney();
  if (fallback && fallback.prices.length > 0) {
    return fallback;
  }
  return { labels: [], prices: [], change_pcts: [], change_amounts: [], volumes: [], amounts: [] };
}

module.exports = {
  fetchGlobalIndices,
  fetchTimingChartData,
};
