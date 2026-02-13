/**
 * 市场指数：与 0uzu0/fund 项目一致，数据源百度股市通 (gushitong.baidu.com / finance.pae.baidu.com)
 * - 上证分时：fund.py get_timing_chart_data() → getquotation code=000001
 * - 成交量趋势：fund.py get_volume_chart_data() → sapi metrictrend
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

/**
 * 成交量趋势备用：东方财富日K线接口，上证+深证成指近7日成交额（亿）
 * kline 返回 f51=日期,f52-f55=开收高低,f56=成交量,f57=成交额(元)
 */
async function fetchVolumeChartDataEastmoney() {
  try {
    const [shRes, szRes] = await Promise.all([
      axios.get('https://push2his.eastmoney.com/api/qt/stock/kline/get', {
        params: { secid: '1.000001', klt: 101, fqt: 0, lmt: 8, fields1: 'f1,f2,f3', fields2: 'f51,f57' },
        headers: { 'User-Agent': UA, Referer: 'https://quote.eastmoney.com/' },
        timeout: 10000,
        validateStatus: () => true,
      }),
      axios.get('https://push2his.eastmoney.com/api/qt/stock/kline/get', {
        params: { secid: '0.399001', klt: 101, fqt: 0, lmt: 8, fields1: 'f1,f2,f3', fields2: 'f51,f57' },
        headers: { 'User-Agent': UA, Referer: 'https://quote.eastmoney.com/' },
        timeout: 10000,
        validateStatus: () => true,
      }),
    ]);
    const shKlines = shRes.data?.data?.klines || [];
    const szKlines = szRes.data?.data?.klines || [];
    const dateToSh = {};
    const dateToSz = {};
    for (const s of shKlines) {
      const p = String(s).split(',');
      if (p.length >= 2) {
        const date = p[0].slice(0, 10);
        const amt = p.length >= 7 ? parseFloat(p[6]) || 0 : parseFloat(p[1]) || 0;
        dateToSh[date] = Math.round((amt / 100000000) * 100) / 100;
      }
    }
    for (const s of szKlines) {
      const p = String(s).split(',');
      if (p.length >= 2) {
        const date = p[0].slice(0, 10);
        const amt = p.length >= 7 ? parseFloat(p[6]) || 0 : parseFloat(p[1]) || 0;
        dateToSz[date] = Math.round((amt / 100000000) * 100) / 100;
      }
    }
    const allDates = [...new Set([...Object.keys(dateToSh), ...Object.keys(dateToSz)])].sort();
    const labels = [];
    const total = [];
    const sh = [];
    const sz = [];
    const bj = [];
    for (const d of allDates) {
      const shVal = dateToSh[d] || 0;
      const szVal = dateToSz[d] || 0;
      if (shVal || szVal) {
        labels.push(d);
        sh.push(shVal);
        sz.push(szVal);
        total.push(Math.round((shVal + szVal) * 100) / 100);
        bj.push(0);
      }
    }
    if (labels.length === 0) return null;
    return { labels, total, sh, sz, bj };
  } catch (e) {
    console.warn('fetchVolumeChartDataEastmoney error:', e.message);
    return null;
  }
}

/**
 * 成交量趋势（与 fund.py get_volume_chart_data / seven_A(True) 一致）
 * 优先百度 metrictrend，失败或无数据时用东方财富日K线（上证+深证成指）备用
 * 返回: { labels, total, sh, sz, bj } 单位亿
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
      headers: BAIDU_HEADERS,
      timeout: 10000,
      validateStatus: () => true,
    });
    if (data && data.ResultCode === '0' && data.Result?.trend) {
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
      if (labels.length > 0) return { labels, total, sh, sz, bj };
    }
  } catch (e) {
    console.warn('fetchVolumeChartData (baidu) error:', e.message);
  }
  const fallback = await fetchVolumeChartDataEastmoney();
  if (fallback && fallback.labels.length > 0) return fallback;
  return { labels: [], total: [], sh: [], sz: [], bj: [] };
}

module.exports = {
  fetchGlobalIndices,
  fetchTimingChartData,
  fetchVolumeChartData,
};
