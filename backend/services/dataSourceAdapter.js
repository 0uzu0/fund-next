/**
 * 数据源适配器抽象层
 * 提供统一的数据源接口，支持多种数据源切换和扩展
 */

/**
 * 数据源基类
 * 定义统一的数据源接口
 */
class DataSourceAdapter {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.priority = config.priority || 0; // 数据源优先级，数字越大优先级越高
  }

  /**
   * 获取基金信息
   * @param {string} code - 基金代码
   * @returns {Promise<FundInfo|null>}
   */
  async getFundInfo(code) {
    throw new Error('Method not implemented');
  }

  /**
   * 批量获取基金信息
   * @param {string[]} codes - 基金代码数组
   * @returns {Promise<Map<string, FundInfo>>}
   */
  async getFundInfoBatch(codes) {
    const results = new Map();
    for (const code of codes) {
      const info = await this.getFundInfo(code);
      if (info) results.set(code, info);
    }
    return results;
  }

  /**
   * 获取实时估值
   * @param {string} code - 基金代码
   * @returns {Promise<RealtimeEstimate|null>}
   */
  async getRealtimeEstimate(code) {
    throw new Error('Method not implemented');
  }

  /**
   * 获取净值数据
   * @param {string} code - 基金代码
   * @param {object} options - 查询选项
   * @returns {Promise<NetValueData|null>}
   */
  async getNetValueData(code, options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * 获取图表数据
   * @param {string} code - 基金代码
   * @param {object} options - 查询选项
   * @returns {Promise<ChartData|null>}
   */
  async getChartData(code, options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * 搜索基金
   * @param {string} keyword - 搜索关键词
   * @returns {Promise<FundSearchResult[]>}
   */
  async searchFund(keyword) {
    throw new Error('Method not implemented');
  }

  /**
   * 健康检查
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    return true;
  }

  /**
   * 获取数据源状态
   * @returns {Object}
   */
  getStatus() {
    return {
      name: this.name,
      priority: this.priority,
      available: true,
    };
  }
}

/**
 * 数据源管理器
 * 管理多个数据源，支持故障转移和负载均衡
 */
class DataSourceManager {
  constructor() {
    this.sources = new Map();
    this.defaultSource = null;
  }

  /**
   * 注册数据源
   * @param {DataSourceAdapter} source - 数据源实例
   * @param {boolean} isDefault - 是否为默认数据源
   */
  register(source, isDefault = false) {
    this.sources.set(source.name, source);
    if (isDefault || this.sources.size === 1) {
      this.defaultSource = source;
    }
  }

  /**
   * 获取数据源
   * @param {string} name - 数据源名称
   * @returns {DataSourceAdapter|null}
   */
  get(name) {
    return this.sources.get(name) || null;
  }

  /**
   * 获取默认数据源
   * @returns {DataSourceAdapter|null}
   */
  getDefault() {
    return this.defaultSource;
  }

  /**
   * 获取所有数据源
   * @returns {DataSourceAdapter[]}
   */
  getAll() {
    return Array.from(this.sources.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * 按优先级尝试获取数据
   * @param {Function} operation - 操作函数，接收数据源实例
   * @param {Object} options - 选项
   * @returns {Promise<any>}
   */
  async executeWithFallback(operation, options = {}) {
    const { preferredSource } = options;
    const errors = [];

    // 优先使用指定的数据源
    if (preferredSource) {
      const source = this.get(preferredSource);
      if (source) {
        try {
          const result = await operation(source);
          if (result !== null && result !== undefined) {
            return result;
          }
        } catch (err) {
          errors.push({ source: source.name, error: err.message });
        }
      }
    }

    // 按优先级尝试其他数据源
    const sources = this.getAll();
    for (const source of sources) {
      if (preferredSource && source.name === preferredSource) continue;
      
      try {
        const result = await operation(source);
        if (result !== null && result !== undefined) {
          return result;
        }
      } catch (err) {
        errors.push({ source: source.name, error: err.message });
      }
    }

    // 所有数据源都失败
    if (errors.length > 0) {
      console.warn('所有数据源都失败:', errors);
    }
    
    return null;
  }

  /**
   * 批量获取数据（从多个数据源合并结果）
   * @param {string[]} codes - 基金代码数组
   * @param {Function} operation - 操作函数
   * @returns {Promise<Map<string, any>>}
   */
  async fetchBatchWithMerge(codes, operation) {
    const results = new Map();
    const sources = this.getAll();

    for (const source of sources) {
      try {
        const batchResults = await operation(source, codes.filter(c => !results.has(c)));
        if (batchResults) {
          for (const [code, data] of batchResults) {
            if (!results.has(code)) {
              results.set(code, data);
            }
          }
        }
        
        // 如果已经获取了所有数据，提前退出
        if (results.size >= codes.length) break;
      } catch (err) {
        console.warn(`数据源 ${source.name} 批量获取失败:`, err.message);
      }
    }

    return results;
  }

  /**
   * 健康检查所有数据源
   * @returns {Promise<Object>}
   */
  async healthCheckAll() {
    const results = {};
    
    for (const [name, source] of this.sources) {
      try {
        const healthy = await source.healthCheck();
        results[name] = { healthy, ...source.getStatus() };
      } catch (err) {
        results[name] = { healthy: false, error: err.message, ...source.getStatus() };
      }
    }
    
    return results;
  }
}

/**
 * Fund123 数据源适配器
 */
class Fund123Adapter extends DataSourceAdapter {
  constructor(fund123Service, config = {}) {
    super('fund123', config);
    this.service = fund123Service;
    this.priority = 10; // 默认高优先级
  }

  async getFundInfo(code) {
    try {
      const info = await this.service.searchFund(code);
      return info ? {
        code,
        name: info.fund_name,
        fundKey: info.fund_key,
      } : null;
    } catch (err) {
      console.error(`[Fund123] 获取基金信息失败 ${code}:`, err.message);
      return null;
    }
  }

  async getRealtimeEstimate(code) {
    try {
      const data = await this.service.getMatiaria(code);
      if (!data) return null;
      
      return {
        code,
        name: data.fundName,
        netValue: data.netValueNum,
        estimateValue: data.estimateValue,
        estimateGrowth: data.estimateGrowth,
        estimateTime: data.estimateTime,
        dayGrowth: data.dayGrowth,
      };
    } catch (err) {
      console.error(`[Fund123] 获取实时估值失败 ${code}:`, err.message);
      return null;
    }
  }

  async getChartData(code, options = {}) {
    try {
      const fundKey = options.fundKey || code;
      const data = await this.service.queryFundQuotationCurves(fundKey);
      return data ? {
        labels: data.map(d => d.date),
        growth: data.map(d => d.rate),
        netValues: data.map(d => d.netValue),
      } : null;
    } catch (err) {
      console.error(`[Fund123] 获取图表数据失败 ${code}:`, err.message);
      return null;
    }
  }

  async searchFund(keyword) {
    try {
      const results = await this.service.searchFund(keyword);
      return Array.isArray(results) ? results.map(r => ({
        code: r.fund_code || r.code,
        name: r.fund_name || r.name,
        fundKey: r.fund_key,
      })) : [];
    } catch (err) {
      console.error(`[Fund123] 搜索基金失败 ${keyword}:`, err.message);
      return [];
    }
  }

  async healthCheck() {
    try {
      const result = await this.service.getMatiaria('000001');
      return result !== null;
    } catch {
      return false;
    }
  }
}

/**
 * 天天基金数据源适配器
 */
class TiantianFundAdapter extends DataSourceAdapter {
  constructor(tiantianFundService, config = {}) {
    super('tiantian', config);
    this.service = tiantianFundService;
    this.priority = 5; // 次优先级，作为备用
  }

  async getRealtimeEstimate(code) {
    try {
      const data = await this.service.fetchFundGz(code);
      if (!data) return null;
      
      return {
        code,
        name: data.name,
        estimateValue: data.estimateValue,
        estimateGrowth: data.estimateGrowth,
        estimateTime: data.estimateTime,
      };
    } catch (err) {
      console.error(`[天天基金] 获取实时估值失败 ${code}:`, err.message);
      return null;
    }
  }

  async searchFund(keyword) {
    try {
      const results = await this.service.searchFund(keyword);
      return Array.isArray(results) ? results.map(r => ({
        code: r.code,
        name: r.name,
      })) : [];
    } catch (err) {
      console.error(`[天天基金] 搜索基金失败 ${keyword}:`, err.message);
      return [];
    }
  }

  async healthCheck() {
    try {
      const result = await this.service.fetchFundGz('000001');
      return result !== null;
    } catch {
      return false;
    }
  }
}

// 全局数据源管理器实例
const dataSourceManager = new DataSourceManager();

/**
 * 初始化数据源
 */
function initDataSources() {
  // 延迟加载服务，避免循环依赖
  try {
    const fund123 = require('../services/fund123');
    const tiantianFund = require('../services/tiantianFund');
    
    dataSourceManager.register(new Fund123Adapter(fund123, { priority: 10 }), true);
    dataSourceManager.register(new TiantianFundAdapter(tiantianFund, { priority: 5 }));
    
    console.log('[数据源] 已初始化:', Array.from(dataSourceManager.sources.keys()));
  } catch (err) {
    console.error('[数据源] 初始化失败:', err.message);
  }
}

module.exports = {
  DataSourceAdapter,
  DataSourceManager,
  Fund123Adapter,
  TiantianFundAdapter,
  dataSourceManager,
  initDataSources,
};