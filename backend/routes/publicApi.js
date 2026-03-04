/**
 * 公开 API 路由
 * 供第三方应用接入使用，需要 API Key 认证
 */
const express = require('express');
const router = express.Router();
const { apiKeyAuth } = require('../apiAuth');
const fundQuotes = require('../services/fundQuotes');
const preciousMetals = require('../services/preciousMetals');
const fundHoldings = require('../services/fundHoldings');
const { searchFundByKeyword } = require('../services/fundSearch');

// 调试中间件：记录所有进入 publicApi 的请求
router.use((req, res, next) => {
  console.log(`[PublicApi] ${req.method} ${req.path}`);
  next();
});

/**
 * @api {get} /api/v1/public/fund/search 搜索基金
 * @apiDescription 根据关键词搜索基金代码和名称
 * @apiParam {String} keyword 搜索关键词（基金代码或名称）
 * @apiParam {Number} [limit=10] 返回结果数量限制
 */
router.get('/fund/search', apiKeyAuth, async (req, res) => {
  try {
    const { keyword, limit = 10 } = req.query;

    if (!keyword || keyword.length < 2) {
      return res.status(400).json({
        error: 'bad_request',
        message: '搜索关键词至少需要2个字符'
      });
    }

    const results = await searchFundByKeyword(keyword, parseInt(limit));

    res.json({
      success: true,
      data: results.map(item => ({
        code: item.code,
        name: item.name,
        type: item.type || '未知类型'
      })),
      total: results.length
    });
  } catch (error) {
    console.error('基金搜索失败:', error);
    res.status(500).json({
      error: 'internal_error',
      message: '搜索服务暂时不可用'
    });
  }
});

/**
 * @api {get} /api/v1/public/market/precious-metals 获取贵金属价格
 * @apiDescription 获取黄金、白银等贵金属的实时价格
 */
router.get('/market/precious-metals', apiKeyAuth, async (req, res) => {
  try {
    const metals = await preciousMetals.getRealTimePrices();

    res.json({
      success: true,
      data: metals.map(item => ({
        name: item.name,
        symbol: item.symbol,
        price: item.price,
        unit: item.unit,
        change: item.change,
        change_percent: item.changePercent
      })),
      total: metals.length,
      update_time: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取贵金属数据失败:', error);
    res.status(500).json({
      error: 'internal_error',
      message: '贵金属数据服务暂时不可用'
    });
  }
});

/**
 * @api {get} /api/v1/public/portfolio/summary 获取持仓总览
 * @apiDescription 获取用户持仓的总体概况数据，数据与前端页面实时同步
 * @apiPermission read
 */
router.get('/portfolio/summary', apiKeyAuth, async (req, res) => {
  try {
    const db = require('../db');
    const tiantianFund = require('../services/tiantianFund');

    // 检查API Key是否绑定了用户
    if (!req.apiKey.bindUserId) {
      return res.status(403).json({
        error: 'no_user_bound',
        message: '该API Key未绑定用户，无法访问持仓数据'
      });
    }

    const userId = req.apiKey.bindUserId;

    // 获取用户的持仓基金（与 /api/portfolio/table 保持一致）
    const fundRows = db.prepare(`
      SELECT
        fund_code,
        fund_key,
        fund_name,
        sectors,
        shares,
        holding_units,
        cost_per_unit,
        holding_profit
      FROM user_funds
      WHERE user_id = ? AND is_hold = 1
    `).all(userId);

    if (fundRows.length === 0) {
      return res.json({
        success: true,
        data: {
          total_value: 0,
          today_est_change: 0,
          today_actual_change: 0,
          holding_profit: 0,
          cumulative_profit: 0
        }
      });
    }

    // 构建 fundMap（与前端保持一致）
    const fundMapForSearch = {};
    const fundMapForHolding = {};
    for (const r of fundRows) {
      const sectors = r.sectors ? JSON.parse(r.sectors) : [];
      const holdingUnits = r.holding_units != null ? r.holding_units : r.shares;
      const costPerUnit = r.cost_per_unit != null ? r.cost_per_unit : 1;
      const holdingProfit = r.holding_profit != null ? r.holding_profit : 0;
      fundMapForSearch[r.fund_code] = {
        fund_key: r.fund_key,
        fund_name: r.fund_name,
        sectors,
      };
      fundMapForHolding[r.fund_code] = {
        shares: (holdingUnits || 0) * (costPerUnit || 1),
        holding_units: holdingUnits || 0,
        cost_per_unit: costPerUnit || 1,
        holding_profit: holdingProfit || 0,
      };
    }

    // 同时获取 fund123 和天天基金数据（一主一备，与前端保持一致）
    let rows = [];
    try {
      const [resultRows123, resultRowsTiantian] = await Promise.all([
        fundQuotes.searchCode(fundMapForSearch).catch(() => []),
        tiantianFund.searchCodeTiantian(fundMapForSearch).catch(() => []),
      ]);
      const byCode123 = new Map(resultRows123.map((r) => [r[0], r]));
      const byCodeTT = new Map(resultRowsTiantian.map((r) => [r[0], r]));
      const merged = [];
      for (const code of Object.keys(fundMapForSearch)) {
        const r123 = byCode123.get(code);
        const rTT = byCodeTT.get(code);
        // [code, name, nowTime, netValue, forecastGrowth, dayOfGrowth, consecutiveInfo, monthlyInfo]
        const name = (r123 && r123[1]) || (rTT && rTT[1]) || (fundMapForSearch[code] && fundMapForSearch[code].fund_name) || `基金${code}`;
        // fund123 为主、天天为备
        const netValuePrimary = r123 && r123[3] && String(r123[3]).trim() !== '—' ? r123[3] : null;
        const netValueBackup = rTT && rTT[3] && String(rTT[3]).trim() !== '—' ? rTT[3] : null;
        let netValue = netValuePrimary || netValueBackup || '—';
        // 仅天天有数据时用 估值(今日) 作为净值
        if (!r123 && rTT && rTT[8] && String(rTT[8]).trim()) netValue = rTT[8];
        const nowTimeVal = (r123 && r123[2] && String(r123[2]).trim() !== '—') ? r123[2] : (rTT && rTT[2] && String(rTT[2]).trim() !== '—' ? rTT[2] : null);
        const nowTime = nowTimeVal || '—';
        const forecastVal = (r123 && r123[4] && String(r123[4]).trim() !== 'N/A') ? r123[4] : (rTT && rTT[4] && String(rTT[4]).trim() !== 'N/A' ? rTT[4] : null);
        const forecastGrowth = forecastVal || 'N/A';
        const dayGrowthPrimary = r123 && r123[5] && String(r123[5]).trim() !== '—' ? r123[5] : null;
        const dayGrowthBackup = rTT && rTT[5] && String(rTT[5]).trim() !== '—' ? rTT[5] : null;
        const dayOfGrowth = dayGrowthPrimary || dayGrowthBackup || '—';
        const consecutiveInfo = (r123 && r123[6] && String(r123[6]).trim() !== '—' ? r123[6] : null) || '—';
        const monthlyInfo = (r123 && r123[7] && String(r123[7]).trim() !== '—' ? r123[7] : null) || '—';
        const estimateDate = (r123 && r123[8] && String(r123[8]).trim()) ? String(r123[8]).trim() : '';
        merged.push([code, name, nowTime, netValue, forecastGrowth, dayOfGrowth, consecutiveInfo, monthlyInfo, estimateDate]);
      }
      rows = fundQuotes.buildPositionRows(merged, fundMapForHolding);
    } catch (err) {
      console.error('获取基金行情失败:', err);
    }

    // 汇总计算
    let totalValue = 0;
    let todayEstChange = 0;
    let todayActualChange = 0;
    let holdingProfit = 0;

    for (const row of rows) {
      totalValue += row.holding || 0;
      todayEstChange += row.estAmount || 0;
      todayActualChange += row.actualAmount || 0;
      holdingProfit += row.cumulative || 0;
    }

    // 计算清仓基金的历史收益
    let clearedProfit = 0;
    try {
      const clearedRows = db.prepare('SELECT holding_profit FROM user_funds WHERE user_id = ? AND (holding_units IS NULL OR holding_units = 0) AND holding_profit IS NOT NULL AND holding_profit != 0').all(userId);
      for (const r of clearedRows) {
        clearedProfit += Number(r.holding_profit) || 0;
      }
    } catch (e) {}

    // 累计收益 = 持仓收益 + 清仓基金历史收益
    const cumulativeProfit = holdingProfit + clearedProfit;

    res.json({
      success: true,
      data: {
        total_value: Math.round(totalValue * 100) / 100,
        today_est_change: Math.round(todayEstChange * 100) / 100,
        today_actual_change: Math.round(todayActualChange * 100) / 100,
        holding_profit: Math.round(holdingProfit * 100) / 100,
        cumulative_profit: Math.round(cumulativeProfit * 100) / 100
      }
    });
  } catch (error) {
    console.error('获取持仓总览失败:', error);
    res.status(500).json({
      error: 'internal_error',
      message: '获取持仓数据失败'
    });
  }
});

/**
 * @api {get} /api/v1/public/portfolio/holdings 获取持仓基金列表
 * @apiDescription 获取用户持有的基金列表及详细数据，数据与前端页面实时同步
 * @apiPermission read
 */
router.get('/portfolio/holdings', apiKeyAuth, async (req, res) => {
  try {
    const db = require('../db');
    const tiantianFund = require('../services/tiantianFund');

    // 检查API Key是否绑定了用户
    if (!req.apiKey.bindUserId) {
      return res.status(403).json({
        error: 'no_user_bound',
        message: '该API Key未绑定用户，无法访问持仓数据'
      });
    }

    const userId = req.apiKey.bindUserId;

    // 获取用户的持仓基金（与 /api/portfolio/table 保持一致）
    const fundRows = db.prepare(`
      SELECT
        fund_code,
        fund_key,
        fund_name,
        sectors,
        shares,
        holding_units,
        cost_per_unit,
        holding_profit
      FROM user_funds
      WHERE user_id = ? AND is_hold = 1
    `).all(userId);

    if (fundRows.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // 构建 fundMap（与前端保持一致）
    const fundMapForSearch = {};
    const fundMapForHolding = {};
    for (const r of fundRows) {
      const sectors = r.sectors ? JSON.parse(r.sectors) : [];
      const holdingUnits = r.holding_units != null ? r.holding_units : r.shares;
      const costPerUnit = r.cost_per_unit != null ? r.cost_per_unit : 1;
      const holdingProfit = r.holding_profit != null ? r.holding_profit : 0;
      fundMapForSearch[r.fund_code] = {
        fund_key: r.fund_key,
        fund_name: r.fund_name,
        sectors,
      };
      fundMapForHolding[r.fund_code] = {
        shares: (holdingUnits || 0) * (costPerUnit || 1),
        holding_units: holdingUnits || 0,
        cost_per_unit: costPerUnit || 1,
        holding_profit: holdingProfit || 0,
      };
    }

    // 同时获取 fund123 和天天基金数据（一主一备，与前端保持一致）
    let rows = [];
    try {
      const [resultRows123, resultRowsTiantian] = await Promise.all([
        fundQuotes.searchCode(fundMapForSearch).catch(() => []),
        tiantianFund.searchCodeTiantian(fundMapForSearch).catch(() => []),
      ]);
      const byCode123 = new Map(resultRows123.map((r) => [r[0], r]));
      const byCodeTT = new Map(resultRowsTiantian.map((r) => [r[0], r]));
      const merged = [];
      for (const code of Object.keys(fundMapForSearch)) {
        const r123 = byCode123.get(code);
        const rTT = byCodeTT.get(code);
        // [code, name, nowTime, netValue, forecastGrowth, dayOfGrowth, consecutiveInfo, monthlyInfo]
        const name = (r123 && r123[1]) || (rTT && rTT[1]) || (fundMapForSearch[code] && fundMapForSearch[code].fund_name) || `基金${code}`;
        // fund123 为主、天天为备
        const netValuePrimary = r123 && r123[3] && String(r123[3]).trim() !== '—' ? r123[3] : null;
        const netValueBackup = rTT && rTT[3] && String(rTT[3]).trim() !== '—' ? rTT[3] : null;
        let netValue = netValuePrimary || netValueBackup || '—';
        // 仅天天有数据时用 估值(今日) 作为净值
        if (!r123 && rTT && rTT[8] && String(rTT[8]).trim()) netValue = rTT[8];
        const nowTimeVal = (r123 && r123[2] && String(r123[2]).trim() !== '—') ? r123[2] : (rTT && rTT[2] && String(rTT[2]).trim() !== '—' ? rTT[2] : null);
        const nowTime = nowTimeVal || '—';
        const forecastVal = (r123 && r123[4] && String(r123[4]).trim() !== 'N/A') ? r123[4] : (rTT && rTT[4] && String(rTT[4]).trim() !== 'N/A' ? rTT[4] : null);
        const forecastGrowth = forecastVal || 'N/A';
        const dayGrowthPrimary = r123 && r123[5] && String(r123[5]).trim() !== '—' ? r123[5] : null;
        const dayGrowthBackup = rTT && rTT[5] && String(rTT[5]).trim() !== '—' ? rTT[5] : null;
        const dayOfGrowth = dayGrowthPrimary || dayGrowthBackup || '—';
        const consecutiveInfo = (r123 && r123[6] && String(r123[6]).trim() !== '—' ? r123[6] : null) || '—';
        const monthlyInfo = (r123 && r123[7] && String(r123[7]).trim() !== '—' ? r123[7] : null) || '—';
        const estimateDate = (r123 && r123[8] && String(r123[8]).trim()) ? String(r123[8]).trim() : '';
        merged.push([code, name, nowTime, netValue, forecastGrowth, dayOfGrowth, consecutiveInfo, monthlyInfo, estimateDate]);
      }
      // 按估值涨幅降序排序
      merged.sort((a, b) => {
        const pctA = a[4] === 'N/A' ? -99 : parseFloat(String(a[4]).replace('%', ''));
        const pctB = b[4] === 'N/A' ? -99 : parseFloat(String(b[4]).replace('%', ''));
        return pctB - pctA;
      });
      rows = fundQuotes.buildPositionRows(merged, fundMapForHolding);
    } catch (err) {
      console.error('获取基金行情失败:', err);
    }

    // 转换为 API 响应格式
    const holdingsData = rows.map(row => ({
      code: row.code,
      name: row.name,
      holding_amount: row.holding,
      est_amount: row.estAmount,
      est_change_pct: row.estPct,
      actual_amount: row.actualAmount,
      actual_change_pct: row.actualPct,
      cumulative: row.cumulative,
      // 额外字段供参考
      net_value: row.netValue,
      update_time: row.nowTime,
      day_growth: row.dayOfGrowth,
      holding_units: row.holding_units,
      cost_per_unit: row.cost_per_unit,
      estimate_date: row.estimateDate,
      net_value_date: row.netValueDate
    }));

    res.json({
      success: true,
      data: holdingsData
    });
  } catch (error) {
    console.error('获取持仓基金列表失败:', error);
    res.status(500).json({
      error: 'internal_error',
      message: '获取持仓数据失败'
    });
  }
});

/**
 * @api {get} /api/v1/public/fund/detail 获取基金详细信息
 * @apiDescription 获取基金的实时行情和基本信息
 * @apiParam {String} code 基金代码（必填）
 */
router.get('/fund/detail', apiKeyAuth, async (req, res) => {
  try {
    const code = String(req.query.code || '').trim();

    if (!code) {
      return res.status(400).json({
        error: 'bad_request',
        message: '请提供基金代码'
      });
    }

    // 使用 searchOneCode 获取基金实时行情
    const fundData = { fund_key: code, fund_name: '' };
    const row = await fundQuotes.searchOneCode(code, fundData, []);

    if (!row || row[3] === '—') {
      return res.status(404).json({
        error: 'not_found',
        message: '未找到该基金的信息'
      });
    }

    // [code, name, nowTime, netValue, forecastGrowth, dayOfGrowth, consecutiveInfo, monthlyInfo, estimateDate]
    const [, name, nowTime, netValue, forecastGrowth, dayOfGrowth, consecutiveInfo, monthlyInfo, estimateDate] = row;

    // 解析净值
    let nav = null;
    let navDate = '';
    try {
      const parts = String(netValue).split('(');
      nav = parseFloat(parts[0]) || null;
      navDate = (parts[1] || '').replace(')', '').trim();
    } catch (e) {}

    // 解析涨跌幅
    let dailyReturn = null;
    try {
      dailyReturn = parseFloat(String(dayOfGrowth).replace('%', '')) || null;
    } catch (e) {}

    // 解析预估涨跌幅
    let estReturn = null;
    try {
      estReturn = parseFloat(String(forecastGrowth).replace('%', '')) || null;
    } catch (e) {}

    res.json({
      success: true,
      data: {
        fund_code: code,
        fund_name: name.replace(/<[^>]+>/g, '').trim(),

        // 实时行情
        current_quote: {
          nav: nav,
          nav_date: navDate,
          daily_return: dailyReturn,
          estimate_return: estReturn,
          update_time: nowTime,
          estimate_date: estimateDate
        },

        // 统计数据
        stats: {
          consecutive_info: consecutiveInfo,
          monthly_info: monthlyInfo
        },

        update_time: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('获取基金详情失败:', error);
    res.status(500).json({
      error: 'internal_error',
      message: '获取基金详情失败'
    });
  }
});

module.exports = router;
