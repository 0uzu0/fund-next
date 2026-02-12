/**
 * 市场指数：与 Python fund.py get_market_info 一致，数据源百度财经
 */
const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';

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
        headers: { 'User-Agent': UA },
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
      headers: { 'User-Agent': UA },
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
 * 上证分时图表数据（与 fund.py get_timing_chart_data / A(True) 一致）
 * 百度 getquotation code=000001，newMarketData.marketData[0].p 格式: "时间,指数,涨跌额,涨跌幅,成交量,成交额;..."
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
      headers: { 'User-Agent': UA },
      timeout: 10000,
      validateStatus: () => true,
    });
    if (!data || data.ResultCode !== '0' || !data.Result?.newMarketData?.marketData?.[0]?.p) {
      return { labels: [], prices: [], change_pcts: [], change_amounts: [], volumes: [], amounts: [] };
    }
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
    return { labels, prices, change_pcts, change_amounts, volumes, amounts };
  } catch (e) {
    console.warn('fetchTimingChartData error:', e.message);
    return { labels: [], prices: [], change_pcts: [], change_amounts: [], volumes: [], amounts: [] };
  }
}

/**
 * 成交量趋势（与 fund.py get_volume_chart_data / seven_A(True) 一致）
 * 百度 sapi metrictrend，返回近7日 总/上交所/深交所/北交所 成交额
 * 返回: { labels, total, sh, sz, bj }
 */
async function fetchVolumeChartData() {
  try {
    const { data } = await axios.get('https://finance.pae.baidu.com/sapi/v1/metrictrend', {
      params: {
        financeType: 'index',
        market: 'ab',
        code: '000001',
        targetType: 'market',
        metric: 'amount',
        finClientType: 'pc',
      },
      headers: { 'User-Agent': UA },
      timeout: 10000,
      validateStatus: () => true,
    });
    if (!data || data.ResultCode !== '0' || !data.Result?.trend) {
      return { labels: [], total: [], sh: [], sz: [], bj: [] };
    }
    const trend = data.Result.trend;
    const totalArr = trend[0]?.content || [];
    const ssArr = trend[1]?.content || [];
    const szArr = trend[2]?.content || [];
    const bjArr = trend[3]?.content || [];
    const dateMap = {};
    const today = new Date();
    for (let i = 0; i < 8; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dateMap[key] = { total: 0, sh: 0, sz: 0, bj: 0 };
    }
    for (const x of totalArr) {
      if (dateMap[x.marketDate] != null) dateMap[x.marketDate].total = parseFloat(x.data?.amount || 0) || 0;
    }
    for (const x of ssArr) {
      if (dateMap[x.marketDate] != null) dateMap[x.marketDate].sh = parseFloat(x.data?.amount || 0) || 0;
    }
    for (const x of szArr) {
      if (dateMap[x.marketDate] != null) dateMap[x.marketDate].sz = parseFloat(x.data?.amount || 0) || 0;
    }
    for (const x of bjArr) {
      if (dateMap[x.marketDate] != null) dateMap[x.marketDate].bj = parseFloat(x.data?.amount || 0) || 0;
    }
    const labels = [];
    const total = [];
    const sh = [];
    const sz = [];
    const bj = [];
    const sortedDates = Object.keys(dateMap).sort();
    for (const key of sortedDates) {
      const v = dateMap[key];
      if (v.total || v.sh || v.sz || v.bj) {
        labels.push(key);
        total.push(v.total);
        sh.push(v.sh);
        sz.push(v.sz);
        bj.push(v.bj);
      }
    }
    return { labels, total, sh, sz, bj };
  } catch (e) {
    console.warn('fetchVolumeChartData error:', e.message);
    return { labels: [], total: [], sh: [], sz: [], bj: [] };
  }
}

module.exports = {
  fetchGlobalIndices,
  fetchTimingChartData,
  fetchVolumeChartData,
};
