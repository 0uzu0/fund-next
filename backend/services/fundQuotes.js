/**
 * 行情/估值业务层：与 Python LanFund.get_fund_chart_data / search_code 一致
 */
const {
  getMatiaria,
  queryFundQuotationCurves,
  queryFundEstimateIntraday,
} = require('./fund123');

/**
 * 获取基金当日估值分时数据（图表用）
 * @param {string} fundCode
 * @param {{ fund_key: string, fund_name: string }} fundData
 * @returns {{ labels: string[], growth: number[], net_values: number[] }}
 */
async function getFundChartData(fundCode, fundData) {
  const fundKey = fundData && fundData.fund_key;
  if (!fundKey) return { labels: [], growth: [], net_values: [] };

  const list = await queryFundEstimateIntraday(fundKey);
  if (!list.length) return { labels: [], growth: [], net_values: [] };

  return {
    labels: list.map((p) => {
      const d = new Date(p.time);
      const h = d.getHours();
      const m = d.getMinutes();
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }),
    growth: list.map((p) => Math.round(parseFloat(p.forecastGrowth) * 100 * 100) / 100),
    net_values: list.map((p) => parseFloat(p.forecastNetValue)),
  };
}

/**
 * 单只基金一行数据：从 matiaria + 曲线 + 分时 拼出 [code, name, time, netValue, forecastGrowth, dayOfGrowth, consecutive_info, monthly_info]
 */
async function searchOneCode(fund, fundData, sectors = []) {
  const fundKey = fundData.fund_key;
  const fundName = fundData.fund_name || '';

  const [matiariaRes, points, intradayList] = await Promise.all([
    getMatiaria(fund),
    queryFundQuotationCurves(fundKey),
    queryFundEstimateIntraday(fundKey),
  ]);

  let dayOfGrowth = '0%';
  let netValue = '--';
  if (matiariaRes) {
    dayOfGrowth = matiariaRes.dayOfGrowth;
    netValue = matiariaRes.netValue;
  }

  let nowTime = 'N/A';
  let forecastGrowth = 'N/A';
  let estimateDate = '';
  if (intradayList && intradayList.length > 0) {
    const last = intradayList[intradayList.length - 1];
    const d = new Date(last.time);
    nowTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    forecastGrowth = (Math.round(parseFloat(last.forecastGrowth) * 100 * 100) / 100) + '%';
    estimateDate = d.toISOString().slice(0, 10);
  }

  let consecutiveCount = 0;
  let consecutiveGrowth = '0%';
  let montlyGrowthDay = '0';
  let montlyGrowthDayCount = '0';
  let montlyGrowthRate = '0%';

  if (points && points.length > 0) {
    let lastRate = null;
    const montlyGrowth = [];
    for (const point of points) {
      const nowRate = point.rate;
      if (lastRate === null) {
        lastRate = nowRate;
        continue;
      }
      montlyGrowth.push(nowRate >= lastRate ? `涨,${nowRate}` : `跌,${nowRate}`);
      lastRate = nowRate;
    }
    montlyGrowth.reverse();
    const upDays = montlyGrowth.filter((x) => x.startsWith('涨')).length;
    montlyGrowthDayCount = String(montlyGrowth.length);
    montlyGrowthDay = String(upDays);
    const startRate = parseFloat(montlyGrowth[0].split(',')[1]);
    montlyGrowthRate = (Math.round(startRate * 100 * 100) / 100) + '%';

    let endRate = 0;
    let sameCount = 1;
    for (let i = 1; i < montlyGrowth.length; i++) {
      if (montlyGrowth[i][0] === montlyGrowth[0][0]) {
        sameCount++;
      } else {
        endRate = parseFloat(montlyGrowth[i].split(',')[1]);
        break;
      }
    }
    consecutiveCount = montlyGrowth[0][0] === '跌' ? -sameCount : sameCount;
    consecutiveGrowth = (Math.round((startRate - endRate) * 100 * 100) / 100) + '%';
  }

  const consecutiveInfo = `${consecutiveCount}天 ${consecutiveGrowth}`;
  const monthlyInfo = `${montlyGrowthDay}/${montlyGrowthDayCount} ${montlyGrowthRate}`;

  let name = fundName;
  if (sectors.length) name = name + ` 🏷️ ${sectors.join(', ')}`;

  return [
    fund,
    name,
    nowTime,
    netValue,
    forecastGrowth,
    dayOfGrowth,
    consecutiveInfo,
    monthlyInfo,
    estimateDate,
  ];
}

/**
 * 批量查询基金行情并排序（按估值涨幅降序）
 * @param {Record<string, { fund_key: string, fund_name: string, sectors?: string[] }>} fundMap
 * @returns {Promise<Array<[string, string, string, string, string, string, string, string]>>}
 */
async function searchCode(fundMap) {
  const entries = Object.entries(fundMap || {});
  const rows = await Promise.all(
    entries.map(([code, data]) =>
      searchOneCode(code, data, data.sectors || []).catch(() => [
        code,
        (data && data.fund_name) || `基金${code}`,
        '—',
        '—',
        'N/A',
        '—',
        '—',
        '—',
        '',
      ])
    )
  );
  const valid = rows.filter(Boolean);
  valid.sort((a, b) => {
    const pctA = a[4] === 'N/A' ? -99 : parseFloat(String(a[4]).replace('%', ''));
    const pctB = b[4] === 'N/A' ? -99 : parseFloat(String(b[4]).replace('%', ''));
    return pctB - pctA;
  });
  return valid;
}

/**
 * 将 searchCode 结果与用户持仓合并，得到带持仓金额、预估收益、持仓收益的行
 * @param {Array<[string, string, string, string, string, string, string, string, string?]>} resultRows - searchCode 返回，第9项为估值日期 YYYY-MM-DD
 * @param {Record<string, { shares?: number, holding_units?: number, cost_per_unit?: number, holding_profit?: number }>} fundMap - 用户基金与份额
 * @returns {Array<{ code: string, name: string, holding: number, estAmount: number, estPct: number, actualAmount: number, actualPct: number, cumulative: number }>}
 */
function buildPositionRows(resultRows, fundMap) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = [];

  for (const row of resultRows) {
    const [code, name, nowTime, netValueStr, estimatedGrowthStr, dayGrowthStr, consecutiveInfo, monthlyInfo, estimateDateRaw] = row;
    const estimateDate = (typeof estimateDateRaw === 'string' && estimateDateRaw.trim()) ? estimateDateRaw.trim() : '';
    const cache = fundMap[code] || {};
    let shares = cache.shares || 0;
    let holdingUnits = cache.holding_units;
    let costPerUnit = cache.cost_per_unit;
    let holdingProfit = cache.holding_profit || 0;
    if (holdingUnits == null) holdingUnits = shares;
    if (costPerUnit == null) costPerUnit = 1;
    holdingUnits = Number(holdingUnits) || 0;
    costPerUnit = Number(costPerUnit) || 1;
    holdingProfit = Number(holdingProfit) || 0;
    // 不再跳过 0 持仓，使新添加的自选基金也能出现在列表中

    let netValue = 0;
    let netValueDate = '';
    let netValueValid = false;
    try {
      const parts = String(netValueStr).split('(');
      const numStr = (parts[0] || '').trim();
      const parsed = parseFloat(numStr);
      if (Number.isFinite(parsed) && numStr !== '' && numStr !== '—' && numStr !== 'N/A') {
        netValue = parsed;
        netValueValid = true;
      }
      netValueDate = (parts[1] || '').replace(')', '').trim();
      if (netValueDate.length === 5) netValueDate = new Date().getFullYear() + '-' + netValueDate;
    } catch (e) {
      // 解析异常时跳过该行（与原项目一致）
      continue;
    }

    let estimatedGrowth = 0;
    if (estimatedGrowthStr !== 'N/A') {
      estimatedGrowth = parseFloat(String(estimatedGrowthStr).replace(/[\s%]/g, '')) || 0;
    }
    let dayGrowth = 0;
    if (dayGrowthStr !== 'N/A') {
      dayGrowth = parseFloat(String(dayGrowthStr).replace(/[\s%]/g, '')) || 0;
    }

    const positionValue = holdingUnits * netValue;
    const estAmount = (positionValue * estimatedGrowth) / 100;
    // 实际收益和涨跌显示持续到次日9:30前：只要净值日期是今天或昨天就显示
    const isActualValid = netValueDate === today || netValueDate === getYesterdayStr();
    const actualAmount = isActualValid ? (positionValue * dayGrowth) / 100 : 0;
    const actualPct = isActualValid ? dayGrowth : 0;
    // 持仓收益 = holding_profit（手动填写或清仓时记录的历史收益）
    // 始终使用数据库中的 holding_profit，即使份额为0也保留历史收益
    const cumulative = holdingProfit;

    rows.push({
      code: String(code),
      name: name.replace(/<[^>]+>/g, '').trim(),
      holding: Number(positionValue),
      estAmount: Number(estAmount),
      estPct: Number(estimatedGrowth),
      actualAmount: Number(actualAmount),
      actualPct: Number(actualPct),
      cumulative: Number(cumulative),
      netValue: String(netValueStr || '').trim() || '—',
      nowTime: String(nowTime || '').trim() || '—',
      dayOfGrowth: String(dayGrowthStr || '').trim() || '—',
      consecutiveInfo: String(consecutiveInfo || '').trim() || '—',
      monthlyInfo: String(monthlyInfo || '').trim() || '—',
      holding_units: Number(holdingUnits),
      cost_per_unit: Number(costPerUnit),
      holding_profit: Number(holdingProfit),
      estimateDate,
      netValueDate: netValueDate || '',
    });
  }

  return rows;
}

/** 获取昨天的日期字符串 YYYY-MM-DD */
function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  getFundChartData,
  searchOneCode,
  searchCode,
  buildPositionRows,
};
