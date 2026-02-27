/**
 * API Key 认证中间件
 * 用于第三方应用接入公开API的认证和限流控制
 */
const db = require('../db');
const crypto = require('crypto');

// 内存中的限流缓存（生产环境建议使用Redis）
const rateLimitCache = new Map();

/**
 * 创建新的API Key
 * @param {string} name - API Key名称
 * @param {string} description - 描述
 * @param {number} createdBy - 创建者用户ID
 * @param {string} permissions - 权限：read/write/admin
 * @param {number} rateLimit - 每分钟请求限制
 * @param {Date} expiresAt - 过期时间（可选）
 * @param {number} bindUserId - 绑定的目标用户ID（可选）
 * @returns {string} 生成的API Key字符串
 */
function createApiKey(name, description = '', createdBy = null, permissions = 'read', rateLimit = 100, expiresAt = null, bindUserId = null) {
  const key = 'ak_' + crypto.randomBytes(32).toString('hex');
  
  db.prepare(`
    INSERT INTO api_keys (key, name, description, user_id, permissions, rate_limit, expires_at, bind_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(key, name, description, createdBy, permissions, rateLimit, expiresAt ? expiresAt.toISOString() : null, bindUserId);
  
  return key;
}

/**
 * 验证API Key
 * @param {string} key - API Key字符串
 * @returns {Object|null} API Key信息或null
 */
function verifyApiKey(key) {
  const apiKey = db.prepare(`
    SELECT k.*, u.username as bind_username
    FROM api_keys k
    LEFT JOIN users u ON k.bind_user_id = u.id
    WHERE k.key = ? AND k.active = 1
  `).get(key);
  
  if (!apiKey) return null;
  
  // 检查是否过期
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return null;
  }
  
  return apiKey;
}

/**
 * 更新API Key最后使用时间
 * @param {number} apiKeyId - API Key ID
 */
function updateLastUsed(apiKeyId) {
  db.prepare(`
    UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(apiKeyId);
}

/**
 * 记录API调用日志
 * @param {number} apiKeyId - API Key ID
 * @param {string} endpoint - 请求端点
 * @param {string} method - HTTP方法
 * @param {string} ipAddress - IP地址
 * @param {number} statusCode - 状态码
 * @param {number} responseTime - 响应时间（毫秒）
 * @param {string} errorMessage - 错误信息（如果有）
 */
function logApiCall(apiKeyId, endpoint, method, ipAddress, statusCode, responseTime = null, errorMessage = null) {
  try {
    db.prepare(`
      INSERT INTO api_logs (api_key_id, endpoint, method, ip_address, status_code, response_time, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(apiKeyId, endpoint, method, ipAddress, statusCode, responseTime, errorMessage);
  } catch (e) {
    console.error('Failed to log API call:', e.message);
  }
}

/**
 * 检查限流
 * @param {number} apiKeyId - API Key ID
 * @param {number} limit - 限制次数（每分钟）
 * @returns {boolean} 是否超过限制
 */
function checkRateLimit(apiKeyId, limit) {
  const now = Date.now();
  const windowStart = now - 60000; // 1分钟窗口
  
  if (!rateLimitCache.has(apiKeyId)) {
    rateLimitCache.set(apiKeyId, []);
  }
  
  const requests = rateLimitCache.get(apiKeyId);
  
  // 清理过期的请求记录
  const validRequests = requests.filter(time => time > windowStart);
  
  if (validRequests.length >= limit) {
    return false; // 超过限制
  }
  
  validRequests.push(now);
  rateLimitCache.set(apiKeyId, validRequests);
  return true; // 未超过限制
}

/**
 * API Key认证中间件
 * 从请求头 X-API-Key 中读取API Key进行验证
 */
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const startTime = Date.now();
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'unauthorized',
      message: '缺少API Key，请在请求头中添加 X-API-Key'
    });
  }
  
  const keyInfo = verifyApiKey(apiKey);
  
  if (!keyInfo) {
    return res.status(401).json({
      error: 'unauthorized',
      message: '无效的API Key或已过期'
    });
  }
  
  // 检查限流
  if (!checkRateLimit(keyInfo.id, keyInfo.rate_limit)) {
    const responseTime = Date.now() - startTime;
    logApiCall(keyInfo.id, req.path, req.method, req.ip, 429, responseTime, 'Rate limit exceeded');
    
    return res.status(429).json({
      error: 'rate_limit_exceeded',
      message: `请求过于频繁，每分钟限制 ${keyInfo.rate_limit} 次请求`,
      retry_after: 60
    });
  }
  
  // 将API Key信息附加到请求对象
  req.apiKey = {
    id: keyInfo.id,
    name: keyInfo.name,
    permissions: keyInfo.permissions,
    bindUserId: keyInfo.bind_user_id,
    bindUsername: keyInfo.bind_username
  };
  
  // 更新最后使用时间
  updateLastUsed(keyInfo.id);
  
  // 记录响应时间的hook
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    logApiCall(keyInfo.id, req.path, req.method, req.ip, res.statusCode, responseTime);
  });
  
  next();
}

/**
 * 权限检查中间件工厂
 * @param {string} requiredPermission - 需要的权限级别
 * @returns {Function} Express中间件
 */
function requirePermission(requiredPermission) {
  const permissionLevels = {
    'read': 1,
    'write': 2,
    'admin': 3
  };
  
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({ error: 'unauthorized', message: '请先进行API Key认证' });
    }
    
    const currentLevel = permissionLevels[req.apiKey.permissions] || 0;
    const requiredLevel = permissionLevels[requiredPermission] || 1;
    
    if (currentLevel < requiredLevel) {
      return res.status(403).json({
        error: 'forbidden',
        message: `需要 ${requiredPermission} 权限，当前权限为 ${req.apiKey.permissions}`
      });
    }
    
    next();
  };
}

/**
 * 获取API Key列表（管理员用）
 * @param {number} page - 页码
 * @param {number} limit - 每页数量
 * @returns {Object} API Key列表和分页信息
 */
function getApiKeys(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  
  const keys = db.prepare(`
    SELECT 
      k.id, k.name, k.description, k.permissions, k.rate_limit,
      k.active, k.last_used_at, k.created_at, k.expires_at,
      u.username as created_by
    FROM api_keys k
    LEFT JOIN users u ON k.user_id = u.id
    ORDER BY k.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  
  const count = db.prepare('SELECT COUNT(*) as total FROM api_keys').get();
  
  return {
    data: keys,
    pagination: {
      page,
      limit,
      total: count.total,
      pages: Math.ceil(count.total / limit)
    }
  };
}

/**
 * 吊销API Key
 * @param {number} keyId - API Key ID
 * @returns {boolean} 是否成功
 */
function revokeApiKey(keyId) {
  const result = db.prepare(`
    UPDATE api_keys SET active = 0 WHERE id = ?
  `).run(keyId);
  
  return result.changes > 0;
}

/**
 * 删除API Key
 * @param {number} keyId - API Key ID
 * @returns {boolean} 是否成功
 */
function deleteApiKey(keyId) {
  const result = db.prepare(`
    DELETE FROM api_keys WHERE id = ?
  `).run(keyId);
  
  return result.changes > 0;
}

/**
 * 获取API调用统计
 * @param {number} days - 统计天数
 * @returns {Array} 统计数据
 */
function getApiStats(days = 7) {
  const stats = db.prepare(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as total_requests,
      COUNT(DISTINCT api_key_id) as unique_keys,
      AVG(response_time) as avg_response_time,
      SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
    FROM api_logs
    WHERE created_at >= datetime('now', '-${days} days')
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `).all();
  
  return stats;
}

module.exports = {
  apiKeyAuth,
  requirePermission,
  generateApiKey,
  verifyApiKey,
  getApiKeys,
  revokeApiKey,
  deleteApiKey,
  getApiStats,
  logApiCall
};
