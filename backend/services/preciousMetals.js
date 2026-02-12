/**
 * 贵金属行情：与 Python fund.py gold / real_time_gold 一致，数据源 api.jijinhao.com
 */
const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
const refererHistory = 'https://quote.cngold.org/gjs/swhj_zghj.html';
const refererRealtime = 'https://quote.cngold.org/gjs/gjhj.html';

// 完整的请求头，与原项目一致
const getRealtimeHeaders = () => ({
  'accept': '*/*',
  'accept-language': 'zh-CN,zh;q=0.9',
  'referer': refererRealtime,
  'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'script',
  'sec-fetch-mode': 'no-cors',
  'sec-fetch-site': 'cross-site',
  'sec-fetch-storage-access': 'active',
  'user-agent': UA,
});

const getHistoryHeaders = () => ({
  'accept': '*/*',
  'accept-language': 'zh-CN,zh;q=0.9',
  'referer': refererHistory,
  'sec-ch-ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'script',
  'sec-fetch-mode': 'no-cors',
  'sec-fetch-site': 'cross-site',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
});

/**
 * 历史金价（中国黄金基础金价 + 周大福金价），与 gold(is_return=True) 一致
 * 返回: [ { date, china_gold_price, chow_tai_fook_price, china_gold_change, chow_tai_fook_change }, ... ]
 */
async function fetchGoldHistory() {
  const ts = Date.now();
  const headers = getHistoryHeaders();
  const [res1, res2] = await Promise.all([
    axios.get('https://api.jijinhao.com/quoteCenter/history.htm', {
      params: { code: 'JO_52683', style: '3', pageSize: '10', needField: '128,129,70', currentPage: '1', _: ts },
      headers,
      timeout: 10000,
      validateStatus: () => true,
    }),
    axios.get('https://api.jijinhao.com/quoteCenter/history.htm', {
      params: { code: 'JO_42660', style: '3', pageSize: '10', needField: '128,129,70', currentPage: '1', _: ts },
      headers,
      timeout: 10000,
      validateStatus: () => true,
    }),
  ]);
  let data1 = [];
  let data2 = [];
  try {
    const text1 = typeof res1.data === 'string' ? res1.data : '';
    const text2 = typeof res2.data === 'string' ? res2.data : '';
    const json1 = JSON.parse(text1.replace(/^var quote_json\s*=\s*/, '').trim());
    const json2 = JSON.parse(text2.replace(/^var quote_json\s*=\s*/, '').trim());
    data1 = json1.data || [];
    data2 = json2.data || [];
  } catch (e) {
    return [];
  }
  const list = [];
  for (let i = 0; i < data1.length; i++) {
    const g = data1[i];
    // 时间戳处理：原项目使用 datetime.datetime.fromtimestamp(t / 1000)，说明时间戳是毫秒，需要除以1000转换为秒
    // 原项目：date = datetime.datetime.fromtimestamp(t / 1000).strftime("%Y-%m-%d")
    const timestamp = g.time / 1000; // 转换为秒级时间戳
    const dateObj = new Date(timestamp * 1000); // JavaScript Date 需要毫秒
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const date = `${year}-${month}-${day}`;
    const radio = String(g.q70 != null ? g.q70 : 'N/A');
    const g2 = data2[i] || {};
    // 注意：原项目第1729行有bug（用了gold.get("q70")而不是gold2.get("q70")），这里修复为正确的gold2
    const radio2 = String(g2.q70 != null ? g2.q70 : 'N/A');
    list.push({
      date,
      china_gold_price: g.q1,
      chow_tai_fook_price: g2.q1 != null ? g2.q1 : 'N/A',
      china_gold_change: radio,
      chow_tai_fook_change: radio2,
    });
  }
  return list.reverse();
}

/**
 * 实时贵金属（黄金9999、现货黄金、现货白银等），与 real_time_gold(is_return=True) 一致
 * 返回: 数组，每项为 { name, price, change_amount, change_pct, open_price, high_price, low_price, prev_close, update_time, unit }
 */
async function fetchRealTimeGold() {
  const ts = Date.now();
  const headers = getRealtimeHeaders();
  const res = await axios.get('https://api.jijinhao.com/quoteCenter/realTime.htm', {
    params: { codes: 'JO_71,JO_92233,JO_92232,JO_75', _: String(ts) },
    headers,
    timeout: 10000,
    validateStatus: () => true,
  });
  let data = null;
  try {
    const text = typeof res.data === 'string' ? res.data : '';
    data = JSON.parse(text.replace(/^var quote_json\s*=\s*/, '').trim());
  } catch (e) {
    return [];
  }
  const names = ['中国黄金', '周大福', '周生生'];
  const codes = ['JO_71', 'JO_92233', 'JO_92232'];
  const keys = ['showName', 'q63', 'q70', 'q80', 'q1', 'q3', 'q4', 'q2', 'time', 'unit'];
  const result = [];
  for (let i = 0; i < codes.length; i++) {
    const row = data[codes[i]];
    if (!row) continue;
    const values = [];
    for (const k of keys) {
      let v = row[k];
      if (k === 'time') {
        // 时间戳转换为 YYYY-MM-DD HH:MM:SS 格式，与原项目一致
        // 原项目：datetime.datetime.fromtimestamp(t / 1000)，说明时间戳是毫秒，需要除以1000
        if (v != null && typeof v === 'number' && !isNaN(v)) {
          // 确保时间戳是有效的数字
          // v 是毫秒级时间戳，需要除以1000转换为秒级，然后乘以1000给 Date（Date 需要毫秒）
          const timestampSeconds = v / 1000;
          const date = new Date(timestampSeconds * 1000);
          
          // 验证日期是否有效
          if (isNaN(date.getTime())) {
            console.warn(`Invalid timestamp for ${codes[i]}: ${v}`);
            v = 'N/A';
          } else {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            v = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
          }
        } else {
          v = 'N/A';
        }
        values.push(v != null ? String(v) : 'N/A');
      } else if (k === 'q80') {
        // q80 涨跌幅特殊处理：保留三位小数并添加 % 符号
        if (v != null && v !== undefined) {
          const pctValue = typeof v === 'number' ? v : parseFloat(String(v));
          if (!isNaN(pctValue) && isFinite(pctValue)) {
            values.push(pctValue.toFixed(3) + '%');
          } else {
            values.push(String(v) + '%');
          }
        } else {
          values.push('N/A');
        }
      } else if (typeof v === 'number') {
        // 保留2位小数，与原项目一致
        v = Math.round(v * 100) / 100;
        values.push(v != null ? String(v) : 'N/A');
      } else {
        values.push(v != null ? String(v) : 'N/A');
      }
    }
    result.push({
      name: values[0] || names[i],
      price: values[1] || '',
      change_amount: values[2] || '',
      change_pct: values[3] || '',
      open_price: values[4] || '',
      high_price: values[5] || '',
      low_price: values[6] || '',
      prev_close: values[7] || '',
      update_time: values[8] || '',
      unit: values[9] || '',
    });
  }
  return result;
}

/**
 * 分时黄金价格（今日走势），与 fund.py one_day_gold() 一致
 * api.jijinhao.com sQuoteCenter/todayMin.htm code=JO_92233
 * 返回: [ { date, price }, ... ]
 */
async function fetchGoldOneDay() {
  try {
    const headers = getRealtimeHeaders();
    const res = await axios.get('https://api.jijinhao.com/sQuoteCenter/todayMin.htm', {
      params: { code: 'JO_92233', isCalc: true },
      headers,
      timeout: 10000,
      validateStatus: () => true,
    });
    const text = typeof res.data === 'string' ? res.data : '';
    const jsonStr = text.replace(/^var\s+hq_str_ml\s*=\s*/, '').trim();
    const data = JSON.parse(jsonStr);
    const list = (data.data || []).filter((x) => x.price != null && x.price !== -1);
    return list.map((x) => {
      // 时间戳转换为日期时间字符串，与原项目一致
      const timestamp = x.date / 1000; // 转换为秒级时间戳
      const date = new Date(timestamp * 1000); // JavaScript Date 需要毫秒
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return {
        date: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`,
        price: Math.round(Number(x.price) * 100) / 100,
      };
    });
  } catch (e) {
    console.warn('fetchGoldOneDay error:', e.message);
    return [];
  }
}

module.exports = {
  fetchGoldHistory,
  fetchRealTimeGold,
  fetchGoldOneDay,
};
