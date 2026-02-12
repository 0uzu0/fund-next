/**
 * 图表数据定时任务：9点-15点期间每5分钟获取涨幅数据并存储到数据库
 */
const db = require('../db');
const fundQuotes = require('./fundQuotes');

let schedulerInterval = null;
let isRunning = false;

/**
 * 检查当前时间是否在9点-15点之间
 */
function isTradingHours() {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 9 && hour < 15;
}

/**
 * 获取所有用户的持仓基金列表（去重，只获取 holding_units > 0 的基金）
 */
function getHoldingFunds() {
  try {
    const rows = db.prepare(
      `SELECT DISTINCT fund_code, fund_key, fund_name 
       FROM user_funds 
       WHERE holding_units > 0`
    ).all();
    return rows.map(row => ({
      code: row.fund_code,
      fund_key: row.fund_key || row.fund_code,
      fund_name: row.fund_name || `基金${row.fund_code}`,
    }));
  } catch (e) {
    console.error('获取持仓基金列表失败:', e);
    return [];
  }
}

/**
 * 更新单个基金的图表数据
 */
async function updateFundChartData(fund) {
  try {
    const fundData = { fund_key: fund.fund_key, fund_name: fund.fund_name };
    const chart_data = await fundQuotes.getFundChartData(fund.code, fundData);
    
    if (chart_data.labels && chart_data.labels.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const chartDataJson = JSON.stringify(chart_data);
      
      db.prepare(
        `INSERT OR REPLACE INTO fund_chart_data (fund_code, fund_key, date, chart_data, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
      ).run(fund.code, fund.fund_key, today, chartDataJson);
      
      return true;
    }
    return false;
  } catch (e) {
    console.warn(`更新基金 ${fund.code} 图表数据失败:`, e.message);
    return false;
  }
}

/**
 * 批量更新所有持仓基金的图表数据
 */
async function updateAllFundsChartData() {
  if (!isTradingHours()) {
    return;
  }
  
  const funds = getHoldingFunds();
  if (funds.length === 0) {
    return;
  }
  
  console.log(`[定时任务] 开始更新 ${funds.length} 只持仓基金的图表数据...`);
  let successCount = 0;
  let failCount = 0;
  
  // 并发更新，但限制并发数避免过载
  const concurrency = 5; // 每次最多5个并发请求
  for (let i = 0; i < funds.length; i += concurrency) {
    const batch = funds.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(fund => updateFundChartData(fund))
    );
    
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        successCount++;
      } else {
        failCount++;
      }
    });
    
    // 批次之间延迟100ms，避免过载
    if (i + concurrency < funds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`[定时任务] 更新完成: 成功 ${successCount}, 失败 ${failCount}`);
}

/**
 * 启动定时任务
 */
function startScheduler() {
  if (schedulerInterval) {
    return; // 已经启动
  }
  
  console.log('[定时任务] 启动图表数据定时更新任务（9点-15点，每5分钟）');
  
  // 立即执行一次（如果在交易时间内）
  if (isTradingHours()) {
    updateAllFundsChartData().catch(err => {
      console.error('[定时任务] 首次执行失败:', err);
    });
  }
  
  // 每5分钟检查一次
  schedulerInterval = setInterval(() => {
    if (isTradingHours() && !isRunning) {
      isRunning = true;
      updateAllFundsChartData()
        .catch(err => {
          console.error('[定时任务] 执行失败:', err);
        })
        .finally(() => {
          isRunning = false;
        });
    }
  }, 5 * 60 * 1000); // 每5分钟执行一次
}

/**
 * 停止定时任务
 */
function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[定时任务] 已停止图表数据定时更新任务');
  }
}

module.exports = {
  startScheduler,
  stopScheduler,
  updateAllFundsChartData,
  isTradingHours,
};
