/**
 * 公开 API 路由
 * 供第三方应用接入使用，需要 API Key 认证
 */
const express = require('express');
const router = express.Router();
const { apiKeyAuth, requirePermission } = require('../apiAuth');
const fundQuotes = require('../services/fundQuotes');
const sectorEastMoney = require('../services/sectorEastMoney');
const marketIndices = require('../services/marketIndices');
const preciousMetals = require('../services/preciousMetals');
const tiantianFund = require('../services/tiantianFund');

/**
 * @api {get} /api/v1/public/fund/search 搜索基金
 * @apiDescription 根据关键词搜索基金代码和名称
 * @apiParam {String} keyword 搜索关键词（基金代码或名称）
 * @apiParam {Number} [limit=10] 返回结果数量限制
 */
router.get('/api/v1/public/fund/search', apiKeyAuth, async (req, res) => {
  try {
    const { keyword, limit = 10 } = req.query;
    
    if (!keyword || keyword.length < 2) {
      return res.status(400).json({
        error: 'bad_request',
        message: '搜索关键词至少需要2个字符'
      });
    }
    
    const results = await tiantianFund.searchFund(keyword, parseInt(limit));
    
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
 * @api {get} /api/v1/public/fund/quote 获取基金实时行情
 * @apiDescription 获取基金的最新净值、涨跌幅等实时数据
 * @apiParam {String} code 基金代码（多个用逗号分隔，最多10个）
 */
router.get('/api/v1/public/fund/quote', apiKeyAuth, async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({
        error: 'bad_request',
        message: '请提供基金代码'
      });
    }
    
    const codes = code.split(',').map(c => c.trim()).slice(0, 10);
    const quotes = [];
    
    for (const fundCode of codes) {
      try {
        const quote = await fundQuotes.getFundQuote(fundCode);
        if (quote) {
          quotes.push({
            code: fundCode,
            name: quote.name,
            nav: quote.nav,
            acc_nav: quote.accNav,
            daily_return: quote.dailyReturn,
            date: quote.date,
            update_time: quote.updateTime
          });
        }
      } catch (e) {
        quotes.push({
          code: fundCode,
          error: '获取失败'
        });
      }
    }
    
    res.json({
      success: true,
      data: quotes,
      total: quotes.length
    });
  } catch (error) {
    console.error('获取基金行情失败:', error);
    res.status(500).json({
      error: 'internal_error',
      message: '行情服务暂时不可用'
    });
  }
});

/**
 * @api {get} /api/v1/public/fund/history 获取基金历史净值
 * @apiDescription 获取基金的历史净值数据
 * @apiParam {String} code 基金代码
 * @apiParam {Number} [days=30] 获取天数（最大365）
 */
router.get('/api/v1/public/fund/history', apiKeyAuth, async (req, res) => {
  try {
    const { code, days = 30 } = req.query;
    
    if (!code) {
      return res.status(400).json({
        error: 'bad_request',
        message: '请提供基金代码'
      });
    }
    
    const dayCount = Math.min(parseInt(days) || 30, 365);
    const history = await fundQuotes.getFundHistory(code, dayCount);
    
    res.json({
      success: true,
      data: {
        code: code,
        records: history.map(item => ({
          date: item.date,
          nav: item.nav,
          acc_nav: item.accNav,
          daily_return: item.dailyReturn
        }))
      },
      total: history.length
    });
  } catch (error) {
    console.error('获取基金历史数据失败:', error);
    res.status(500).json({
      error: 'internal_error',
      message: '历史数据服务暂时不可用'
    });
  }
});

/**
 * @api {get} /api/v1/public/market/sectors 获取行业板块数据
 * @apiDescription 获取各行业板块的涨跌幅情况
 */
router.get('/api/v1/public/market/sectors', apiKeyAuth, async (req, res) => {
  try {
    const sectors = await sectorEastMoney.getSectorData();
    
    res.json({
      success: true,
      data: sectors.map(item => ({
        name: item.name,
        change_percent: item.changePercent,
        leading_stock: item.leadingStock,
        volume: item.volume
      })),
      total: sectors.length,
      update_time: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取板块数据失败:', error);
    res.status(500).json({
      error: 'internal_error',
      message: '板块数据服务暂时不可用'
    });
  }
});

/**
 * @api {get} /api/v1/public/market/indices 获取全球指数
 * @apiDescription 获取主要市场指数的实时行情
 */
router.get('/api/v1/public/market/indices', apiKeyAuth, async (req, res) => {
  try {
    const indices = await marketIndices.getGlobalIndices();
    
    res.json({
      success: true,
      data: indices.map(item => ({
        name: item.name,
        symbol: item.symbol,
        price: item.price,
        change: item.change,
        change_percent: item.changePercent,
        market: item.market
      })),
      total: indices.length,
      update_time: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取指数数据失败:', error);
    res.status(500).json({
      error: 'internal_error',
      message: '指数数据服务暂时不可用'
    });
  }
});

/**
 * @api {get} /api/v1/public/market/precious-metals 获取贵金属价格
 * @apiDescription 获取黄金、白银等贵金属的实时价格
 */
router.get('/api/v1/public/market/precious-metals', apiKeyAuth, async (req, res) => {
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
 * @api {get} /api/v1/public/time/beijing 获取北京时间
 * @apiDescription 获取当前北京时间（无需权限）
 */
router.get('/api/v1/public/time/beijing', apiKeyAuth, (req, res) => {
  const now = new Date();
  const beijingTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  
  res.json({
    success: true,
    data: {
      timestamp: beijingTime.getTime(),
      iso: beijingTime.toISOString(),
      formatted: beijingTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
    }
  });
});

/**
 * @api {get} /api/v1/public/quota 查询配额使用情况
 * @apiDescription 查询当前 API Key 的配额使用情况
 */
router.get('/api/v1/public/quota', apiKeyAuth, (req, res) => {
  // 从限流中间件获取的信息
  const rateLimit = res.getHeader('X-RateLimit-Limit');
  const remaining = res.getHeader('X-RateLimit-Remaining');
  const reset = res.getHeader('X-RateLimit-Reset');
  
  res.json({
    success: true,
    data: {
      client_name: req.apiKey.name,
      permissions: req.apiKey.permissions,
      bind_user: req.apiKey.bindUsername || null,
      rate_limit: parseInt(rateLimit),
      remaining: parseInt(remaining),
      reset_at: new Date(parseInt(reset) * 1000).toISOString()
    }
  });
});

/**
 * @api {get} /api/v1/public/user/portfolio 获取用户持仓数据
 * @apiDescription 获取API Key绑定的用户的基金持仓数据（需要该Key绑定用户）
 * @apiPermission read
 */
router.get('/api/v1/public/user/portfolio', apiKeyAuth, async (req, res) => {
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
        uf.shares,
        uf.holding_units,
        uf.cost_per_unit,
        uf.holding_profit,
        uf.is_hold,
        uf.chart_default
      FROM user_funds uf
      WHERE uf.user_id = ? AND uf.is_hold = 1
      ORDER BY uf.fund_code ASC
    `).all(userId);
    
    if (holdings.length === 0) {
      return res.json({
        success: true,
        data: {
          user_id: userId,
          username: req.apiKey.bindUsername,
          holdings: [],
          summary: {
            total_funds: 0,
            total_value: 0,
            total_cost: 0,
            total_profit: 0,
            profit_rate: 0
          }
        }
      });
    }
    
    // 获取实时行情
    const holdingsWithQuotes = await Promise.all(
      holdings.map(async (h) => {
        try {
          const quote = await fundQuotes.getFundQuote(h.fund_code);
          if (quote) {
            const currentValue = (h.holding_units || 0) * (quote.nav || 0);
            const costValue = (h.holding_units || 0) * (h.cost_per_unit || 0);
            const profit = currentValue - costValue;
            
            return {
              code: h.fund_code,
              name: h.fund_name,
              shares: h.shares,
              holding_units: h.holding_units,
              cost_per_unit: h.cost_per_unit,
              stored_holding_profit: h.holding_profit,
              is_hold: !!h.is_hold,
              chart_default: !!h.chart_default,
              quote: {
                nav: quote.nav,
                acc_nav: quote.accNav,
                daily_return: quote.dailyReturn,
                date: quote.date,
                update_time: quote.updateTime
              },
              calculated: {
                current_value: Math.round(currentValue * 100) / 100,
                cost_value: Math.round(costValue * 100) / 100,
                profit: Math.round(profit * 100) / 100,
                profit_rate: costValue > 0 ? Math.round((profit / costValue) * 10000) / 100 : 0
              }
            };
          }
        } catch (e) {
          console.error(`获取基金 ${h.fund_code} 行情失败:`, e.message);
        }
        
        // 如果获取行情失败，返回基础信息
        return {
          code: h.fund_code,
          name: h.fund_name,
          shares: h.shares,
          holding_units: h.holding_units,
          cost_per_unit: h.cost_per_unit,
          stored_holding_profit: h.holding_profit,
          is_hold: !!h.is_hold,
          chart_default: !!h.chart_default,
          quote: null,
          calculated: null
        };
      })
    );
    
    // 计算汇总数据
    const validHoldings = holdingsWithQuotes.filter(h => h.calculated !== null);
    const totalValue = validHoldings.reduce((sum, h) => sum + (h.calculated?.current_value || 0), 0);
    const totalCost = validHoldings.reduce((sum, h) => sum + (h.calculated?.cost_value || 0), 0);
    const totalProfit = totalValue - totalCost;
    
    res.json({
      success: true,
      data: {
        user_id: userId,
        username: req.apiKey.bindUsername,
        holdings: holdingsWithQuotes,
        summary: {
          total_funds: holdings.length,
          valid_quotes: validHoldings.length,
          total_value: Math.round(totalValue * 100) / 100,
          total_cost: Math.round(totalCost * 100) / 100,
          total_profit: Math.round(totalProfit * 100) / 100,
          profit_rate: totalCost > 0 ? Math.round((totalProfit / totalCost) * 10000) / 100 : 0
        }
      }
    });
  } catch (error) {
    console.error('获取用户持仓失败:', error);
    res.status(500).json({
      error: 'internal_error',
      message: '获取持仓数据失败'
    });
  }
});

/**
 * @api {get} /api/v1/public/user/position-records 获取用户交易记录
 * @apiDescription 获取API Key绑定的用户的基金交易记录（需要该Key绑定用户）
 * @apiPermission read
 * @apiParam {Number} [limit=50] 返回记录数量限制
 * @apiParam {Number} [offset=0] 分页偏移量
 */
router.get('/api/v1/public/user/position-records', apiKeyAuth, async (req, res) => {
  try {
    const db = require('../db');
    
    // 检查API Key是否绑定了用户
    if (!req.apiKey.bindUserId) {
      return res.status(403).json({
        error: 'no_user_bound',
        message: '该API Key未绑定用户，无法访问交易记录'
      });
    }
    
    const userId = req.apiKey.bindUserId;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    
    // 获取交易记录
    const records = db.prepare(`
      SELECT 
        pr.id,
        pr.fund_code,
        pr.fund_name,
        pr.op as operation,
        pr.amount,
        pr.units,
        pr.trade_date,
        pr.period,
        pr.prev_holding_units,
        pr.prev_cost_per_unit,
        pr.new_holding_units,
        pr.new_cost_per_unit,
        pr.created_at
      FROM position_records pr
      WHERE pr.user_id = ?
      ORDER BY pr.trade_date DESC, pr.created_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset);
    
    // 获取总数
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM position_records WHERE user_id = ?
    `).get(userId);
    
    res.json({
      success: true,
      data: {
        user_id: userId,
        username: req.apiKey.bindUsername,
        records: records.map(r => ({
          id: r.id,
          fund_code: r.fund_code,
          fund_name: r.fund_name,
          operation: r.operation,
          amount: r.amount,
          units: r.units,
          trade_date: r.trade_date,
          period: r.period,
          holding_before: {
            units: r.prev_holding_units,
            cost_per_unit: r.prev_cost_per_unit
          },
          holding_after: {
            units: r.new_holding_units,
            cost_per_unit: r.new_cost_per_unit
          },
          created_at: r.created_at
        })),
        pagination: {
          total: countResult.total,
          limit,
          offset,
          has_more: offset + records.length < countResult.total
        }
      }
    });
  } catch (error) {
    console.error('获取交易记录失败:', error);
    res.status(500).json({
      error: 'internal_error',
      message: '获取交易记录失败'
    });
  }
});

module.exports = router;
