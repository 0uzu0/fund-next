/**
 * 行业板块：东方财富 API，与 Python fund.py select_fund / api_sectors 一致
 */
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const bkList = require('../config/bk_list_order.json');

// 与 bk_list_order.json 同序的东方财富板块代码（来自 fund.py bk_map）
const bkCodes = [
  'BK000651', 'BK000652', 'BK000641', 'BK000157', 'BK000176', 'BK000644', 'BK000051', 'BK000047', 'BK000049', 'BK000347',
  'BK000055', 'BK000313', 'BK000292', 'BK000642', 'BK000501', 'BK000601', 'BK000663', 'BK000161', 'BK000174', 'BK000058',
  'BK000147', 'BK000072', 'BK000228', 'BK000050', 'BK000649', 'BK000291', 'BK000387', 'BK000370', 'BK000053', 'BK000217',
  'BK000151', 'BK000054', 'BK000144', 'BK000331', 'BK000653', 'BK000248', 'BK000266', 'BK000152', 'BK000195', 'BK000059',
  'BK000388', 'BK000645', 'BK000353', 'BK000236', 'BK000391', 'BK000239', 'BK000561', 'BK000326', 'BK000581', 'BK000156',
  'BK000166', 'BK000393', 'BK000150', 'BK000441', 'BK000647', 'BK000096', 'BK000300', 'BK000251', 'BK000346', 'BK000298',
  'BK000143', 'BK000247', 'BK000148', 'BK000295', 'BK000149', 'BK000164', 'BK000299', 'BK000225', 'BK000061', 'BK000154',
  'BK000481', 'BK000521', 'BK000650', 'BK000325', 'BK000392', 'BK000305', 'BK000165', 'BK000369', 'BK000286', 'BK000162',
  'BK000226', 'BK000035', 'BK000293', 'BK000389', 'BK000279', 'BK000386', 'BK000301', 'BK000204', 'BK000216', 'BK000155',
  'BK000091', 'BK000681', 'BK000232', 'BK000254', 'BK000362', 'BK000321', 'BK000278', 'BK000133', 'BK000163', 'BK000234',
  'BK000146', 'BK000621', 'BK000484', 'BK000220', 'BK000043', 'BK000227', 'BK000208', 'BK000483', 'BK000200', 'BK000482',
  'BK000186', 'BK000194', 'BK000085', 'BK000367', 'BK000230', 'BK000129', 'BK000114', 'BK000309', 'BK000120', 'BK000158',
  'BK000461', 'BK000307', 'BK000088', 'BK000327', 'BK000184', 'BK000108', 'BK000090', 'BK000602', 'BK000258', 'BK000185',
  'BK000060', 'BK000280', 'BK000089', 'BK000056', 'BK000026', 'BK000081', 'BK000137', 'BK000093', 'BK000339', 'BK000127',
  'BK000256', 'BK000095', 'BK000303', 'BK000122', 'BK000203', 'BK000264', 'BK000066', 'BK000062', 'BK000199', 'BK000421',
  'BK000308', 'BK000032', 'BK000160', 'BK000115', 'BK000175', 'BK000121', 'BK000198', 'BK000106', 'BK000105', 'BK000209',
  'BK000180', 'BK000107', 'BK000101', 'BK000340', 'BK000128', 'BK000097', 'BK000177', 'BK000103', 'BK000178', 'BK000197',
  'BK000098', 'BK000124', 'BK000100', 'BK000390', 'BK000262', 'BK000123', 'BK000092', 'BK000074', 'BK000076'
];

const bkMap = {};
bkList.forEach((name, i) => { bkMap[name] = bkCodes[i] || ''; });

function getBkCode(sectorId) {
  const id = String(sectorId).trim();
  const num = parseInt(id, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= bkList.length) {
    return bkMap[bkList[num - 1]] || null;
  }
  return bkMap[id] || null;
}

function getBkName(sectorId) {
  const id = String(sectorId).trim();
  const num = parseInt(id, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= bkList.length) {
    return bkList[num - 1];
  }
  return bkList.includes(id) ? id : id;
}

/**
 * 东方财富 - 概念板块行情列表（与原 fund.py bk() 一致）
 * 参数 fs: 'm:90 t:3' 表示概念板块，t:2 表示行业板块
 */
async function fetchSectorsList() {
  const maxRetries = 3;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[板块] 开始请求东方财富 API (尝试 ${attempt}/${maxRetries})...`);
      
      const { data } = await axios.get('https://push2.eastmoney.com/api/qt/clist/get', {
        params: {
          cb: '',
          fid: 'f62',
          po: '1',
          pz: '100',
          pn: '1',
          np: '1',
          fltt: '2',
          invt: '2',
          ut: 'b2884a393a59ad64002292a3e90d46a5',
          fs: 'm:90 t:3', // t:3 = 概念板块，t:2 = 行业板块
          fields: 'f12,f14,f2,f3,f62,f184,f66,f69,f72,f75,f78,f81,f84,f87,f204,f205,f124,f1,f13',
        },
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://quote.eastmoney.com/center/',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      
      console.log('[板块] API 响应状态:', data ? '有数据' : '无数据');
      
      if (!data || !data.data || !data.data.diff) {
        console.error('概念板块数据格式异常:', JSON.stringify(data).substring(0, 500));
        lastError = new Error('数据格式异常');
        // 如果数据格式异常，等待后重试
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        return [];
      }
      
      console.log('[板块] 获取到', data.data.diff.length, '条数据');
      
      const sectors = data.data.diff.map((bk) => {
        const ratio = bk.f3 != null ? String(bk.f3) : '0';
        const addMarketCap = bk.f62 != null ? Math.round(bk.f62 / 100000000 * 100) / 100 : 0;
        const addMarketCap2 = bk.f84 != null ? Math.round(bk.f84 / 100000000 * 100) / 100 : 0;
        
        return {
          code: bk.f12,
          name: bk.f14,
          change: ratio + '%',
          main_inflow: String(addMarketCap) + '亿',
          main_inflow_pct: bk.f184 != null ? String(Math.round(bk.f184 * 100) / 100) + '%' : 'N/A',
          small_inflow: String(addMarketCap2) + '亿',
          small_inflow_pct: bk.f87 != null ? String(Math.round(bk.f87 * 100) / 100) + '%' : 'N/A',
        };
      });
      
      // 按涨跌幅排序
      sectors.sort((a, b) => {
        const pa = parseFloat(String(a.change).replace('%', '')) || -99;
        const pb = parseFloat(String(b.change).replace('%', '')) || -99;
        return pb - pa;
      });
      
      return sectors;
    } catch (e) {
      console.error(`[板块] 请求失败 (尝试 ${attempt}/${maxRetries}):`, e.message);
      lastError = e;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  console.error('[板块] 所有重试均失败:', lastError?.message);
  return [];
}

/**
 * 东方财富 - 按板块查基金（与原 select_fund(bk_id) 一致）
 */
async function fetchSectorFunds(bkCode) {
  try {
    const { data } = await axios.get('https://fund.eastmoney.com/data/FundGuideapi.aspx', {
      params: {
        dt: '4',
        sd: '',
        ed: '',
        tp: bkCode,
        sc: '1n',
        st: 'desc',
        pi: '1',
        pn: '1000',
        zf: 'diy',
        sh: 'list',
        rnd: Math.random(),
      },
      timeout: 30000,
      headers: {
        'Connection': 'keep-alive',
        'Referer': 'https://fund.eastmoney.com/daogou/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    });
    
    let text = typeof data === 'string' ? data : (data && data.data) || '';
    if (typeof text !== 'string') return { bk_name: '', results: [] };
    
    text = text.replace(/^var rankData\s*=\s*/, '').trim();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.error('解析板块基金数据失败:', e.message);
      return { bk_name: '', results: [] };
    }
    
    const datas = json.datas || [];
    const results = datas.map((row) => {
      const arr = (typeof row === 'string' ? row.split(',') : row) || [];
      return {
        code: arr[0] || '---',
        name: arr[1] || '---',
        type: arr[3] || '---',
        date: arr[15] || '---',
        net_value: arr[16] || '---',
        day_growth: (arr[17] || '---') + '%',
        week1: (arr[5] || '---') + '%',
        month1: (arr[6] || '---') + '%',
        month3: (arr[7] || '---') + '%',
        month6: (arr[8] || '---') + '%',
        year_this: (arr[4] || '---') + '%',
        year1: (arr[9] || '---') + '%',
        year2: (arr[10] || '---') + '%',
        year3: (arr[11] || '---') + '%',
        total: (arr[24] || '---') + '%',
      };
    });
    
    // 获取板块名称
    const bkName = Object.keys(bkMap).find(key => bkMap[key] === bkCode) || '';
    
    return { bk_name: bkName, results };
  } catch (e) {
    console.error('获取板块基金失败:', e.message);
    return { bk_name: '', results: [] };
  }
}

module.exports = {
  bkList,
  bkMap,
  getBkCode,
  getBkName,
  fetchSectorsList,
  fetchSectorFunds,
};