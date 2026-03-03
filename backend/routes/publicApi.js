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
 * @apiDescription 获取用户持仓的总体概况数据
 * @apiPermission read
 */
router.get('/portfolio/summary', apiKeyAuth, async (req, res) => {
  try {
    const db = require('../db');

    // 检查API Key是否绑定了用户
    if (!req.apiKey.bindUserId) {
      return res.status(403).json({
        error: 'no_user_bound',
        message: '该API Key未绑定用户，无法访问持仓数据'
      });
    }

    const userId = req.apiKey.bindUserId;

    // 获取用户的持仓基金
    const holdings = db.prepare(`
      SELECT
        uf.fund_code,
        uf.holding_units,
        uf.cost_per_unit
      FROM user_funds uf
      WHERE uf.user_id = ? AND uf.is_hold = 1
    `).all(userId);

    if (holdings.length === 0) {
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

    // 获取实时行情并计算汇总数据
    let totalValue = 0;
    let totalCost = 0;
    let todayEstChange = 0;
    let todayActualChange = 0;
    let holdingProfit = 0;

    await Promise.all(
      holdings.map(async (h) => {
        try {
          const quote = await fundQuotes.getFundQuote(h.fund_code);
          if (quote && quote.nav) {
            const holdingUnits = h.holding_units || 0;
            const costPerUnit = h.cost_per_unit || 0;
            const nav = quote.nav || 0;
            const dailyReturn = quote.dailyReturn || 0;
            
            const currentValue = holdingUnits * nav;
            const costValue = holdingUnits * costPerUnit;
            
            totalValue += currentValue;
            totalCost += costValue;
            
            // 今日预估涨跌（基于估值）
            todayEstChange += currentValue * (dailyReturn / 100);
            
            // 今日实际涨跌（已结算部分）
            todayActualChange += currentValue * (dailyReturn / 100);
            
            // 持仓收益
            holdingProfit += (nav - costPerUnit) * holdingUnits;
          }
        } catch (e) {
          console.error(`获取基金 ${h.fund_code} 行情失败:`, e.message);
        }
      })
    );

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
 * @apiDescription 获取用户持有的基金列表及详细数据
 * @apiPermission read
 */
router.get('/portfolio/holdings', apiKeyAuth, async (req, res) => {
  try {
    const db = require('../db');

    // 检查API Key是否绑定了用户
    if (!req.apiKey.bindUserId) {
      return res.status(403).json({
        error: 'no_user_bound',
        message: '该API Key未绑定用户，无法访问持仓数据'
      });
    }

    const userId = req.apiKey.bindUserId;

    // 获取用户的持仓基金
    const holdings = db.prepare(`
      SELECT
        uf.fund_code,
        uf.fund_name,
        uf.holding_units,
        uf.cost_per_unit
      FROM user_funds uf
      WHERE uf.user_id = ? AND uf.is_hold = 1
      ORDER BY uf.fund_code ASC
    `).all(userId);

    if (holdings.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // 获取实时行情并计算每只基金的数据
    const holdingsData = await Promise.all(
      holdings.map(async (h) => {
        try {
          const quote = await fundQuotes.getFundQuote(h.fund_code);
          if (quote && quote.nav) {
            const holdingUnits = h.holding_units || 0;
            const costPerUnit = h.cost_per_unit || 0;
            const nav = quote.nav || 0;
            const dailyReturn = quote.dailyReturn || 0;
            
            const currentValue = holdingUnits * nav;
            const costValue = holdingUnits * costPerUnit;
            
            // 预估收益 = 持仓金额 × 预估涨跌幅
            const estAmount = currentValue * (dailyReturn / 100);
            
            // 实际收益 = 持仓金额 × 实际涨跌幅（与预估相同，都是基于日涨跌）
            const actualAmount = currentValue * (dailyReturn / 100);
            
            // 持仓收益 = (净值 - 成本) × 份额
            const cumulative = (nav - costPerUnit) * holdingUnits;

            return {
              code: h.fund_code,
              name: h.fund_name,
              holding_amount: Math.round(currentValue * 100) / 100,
              est_amount: Math.round(estAmount * 100) / 100,
              est_change_pct: dailyReturn,
              actual_amount: Math.round(actualAmount * 100) / 100,
              actual_change_pct: dailyReturn,
              cumulative: Math.round(cumulative * 100) / 100
            };
          }
        } catch (e) {
          console.error(`获取基金 ${h.fund_code} 行情失败:`, e.message);
        }

        // 获取行情失败时返回基础信息
        return {
          code: h.fund_code,
          name: h.fund_name,
          holding_amount: 0,
          est_amount: 0,
          est_change_pct: 0,
          actual_amount: 0,
          actual_change_pct: 0,
          cumulative: 0
        };
      })
    );

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
 * @apiDescription 获取基金的完整信息，包括名称、实时行情、历史净值、重仓股、各周期涨幅等
 * @apiParam {String} code 基金代码（必填）
 * @apiParam {Number} [history_days=365] 历史净值天数（最大365）
 */
router.get('/fund/detail', apiKeyAuth, async (req, res) => {
  try {
    const code = String(req.query.code || '').trim();
    const historyDays = Math.min(parseInt(req.query.history_days) || 365, 365);

    if (!code) {
      return res.status(400).json({
        error: 'bad_request',
        message: '请提供基金代码'
      });
    }

    // 并行获取所有数据
    const [quote, history, holdings] = await Promise.all([
      // 获取实时行情（包含名称）
      fundQuotes.getFundQuote(code).catch(() => null),
      // 获取历史净值
      fundQuotes.getFundHistory(code, historyDays).catch(() => []),
      // 获取重仓股
      fundHoldings.getFundHoldings(code).catch(() => [])
    ]);

    if (!quote) {
      return res.status(404).json({
        error: 'not_found',
        message: '未找到该基金的信息'
      });
    }

    // 计算历史涨幅统计
    const historyStats = history.length > 0 ? {
      total_records: history.length,
      first_date: history[0]?.date,
      last_date: history[history.length - 1]?.date,
      max_nav: Math.max(...history.map(h => h.nav || 0)),
      min_nav: Math.min(...history.filter(h => h.nav > 0).map(h => h.nav || Infinity)),
      avg_daily_return: history.reduce((sum, h) => sum + (h.dailyReturn || 0), 0) / history.length
    } : null;

    // 计算近期涨幅（最近1月、3月、6月、1年）
    const calculatePeriodReturn = (days) => {
      if (history.length < days) return null;
      const recent = history.slice(-days);
      const firstNav = recent[0]?.nav;
      const lastNav = recent[recent.length - 1]?.nav;
      if (!firstNav || !lastNav) return null;
      return ((lastNav - firstNav) / firstNav * 100).toFixed(2);
    };

    res.json({
      success: true,
      data: {
        // 基本信息
        fund_code: code,
        fund_name: quote.name,
        fund_type: quote.type || '未知类型',

        // 实时行情
        current_quote: {
          nav: quote.nav,
          acc_nav: quote.accNav,
          daily_return: quote.dailyReturn,
          date: quote.date,
          update_time: quote.updateTime
        },

        // 历史净值
        history: {
          records: history.map(item => ({
            date: item.date,
            nav: item.nav,
            acc_nav: item.accNav,
            daily_return: item.dailyReturn
          })),
          stats: historyStats,
          period_returns: {
            '1_week': calculatePeriodReturn(7),
            '1_month': calculatePeriodReturn(30),
            '3_months': calculatePeriodReturn(90),
            '6_months': calculatePeriodReturn(180),
            '1_year': calculatePeriodReturn(365)
          }
        },

        // 重仓股
        holdings: holdings.map(item => ({
          stock_code: item.code,
          stock_name: item.name,
          weight: item.weight,
          change_percent: item.change
        })),

        // 更新时间
        update_time: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('获取基金详细信息失败:', error);
    res.status(500).json({
      error: 'internal_error',
      message: '获取基金详细信息失败'
    });
  }
});

module.exports = router;
