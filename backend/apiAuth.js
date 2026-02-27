/**
 * API Key 认证与限流中间件
 * 用于第三方应用接入公开 API
 */
const crypto = require('crypto');
const db = require('./db');

// 内存中的请求计数器（用于限流）
const rateLimitCache = new Map();

// 清理过期的限流记录（每5分钟执行一次）
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitCache.entries()) {
    if (now - data.resetTime > 60000) {
      rateLimitCache.delete(key);
    }
  }
}, 300000);

/**
 * 生成新的 API Key
 */
function generateApiKey() {
  return 'ak_' + crypto.randomBytes(32).toString('hex');
}

/**
 * 验证 API Key
 */
function verifyApiKey(apiKey) {
  if (!apiKey || !apiKey.startsWith('ak_')) {
    return null;
  }
  
  const row = db.prepare(
    `SELECT id, key, name, permissions, rate_limit, active, expires_at 
     FROM api_keys 
     WHERE key = ? AND active = 1`
  ).get(apiKey);
  
  if (!row) return null;
  
  // 检查是否过期
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return null;
  }
  
  return row;
}

/**
 * 更新 API Key 最后使用时间
 */
function updateLastUsed(apiKeyId) {
  try {
    db.prepare(
      'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(apiKeyId);
  } catch (e) {
    console.warn('更新 API Key 使用时间失败:', e.message);
  }
}

/**
 * 记录 API 调用日志
 */
function logApiCall(apiKeyId, endpoint, method, ipAddress, statusCode, responseTime, errorMessage) {
  try {
    db.prepare(
      `INSERT INTO api_logs (api_key_id, endpoint, method, ip_address, status_code, response_time, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(apiKeyId, endpoint, method, ipAddress, statusCode, responseTime, errorMessage);
  } catch (e) {
    console.warn('记录 API 日志失败:', e.message);
  }
}

/**
 * 检查限流
 */
function checkRateLimit(apiKeyId, rateLimit) {
  const now = Date.now();
  const key = `ratelimit_${apiKeyId}`;
  let data = rateLimitCache.get(key);
  
  if (!data || now > data.resetTime) {
    // 新建或重置计数器
    data = {
      count: 1,
      resetTime: now + 60000 // 1分钟后重置
    };
    rateLimitCache.set(key, data);
    return { allowed: true, remaining: rateLimit - 1, resetTime: data.resetTime };
  }
  
  if (data.count >= rateLimit) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetTime: data.resetTime,
      retryAfter: Math.ceil((data.resetTime - now) / 1000)
    };
  }
  
  data.count++;
  return { allowed: true, remaining: rateLimit - data.count, resetTime: data.resetTime };
}

/**
 * API Key 认证中间件
 */
function apiKeyAuth(req, res, next) {
  const startTime = Date.now();
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  if (!apiKey) {
    logApiCall(null, req.path, req.method, req.ip, 401, Date.now() - startTime, 'Missing API Key');
    return res.status(401).json({
      error: 'unauthorized',
      message: '缺少 API Key，请在请求头中添加 X-API-Key 或在查询参数中添加 api_key'
    });
  }
  
  const keyData = verifyApiKey(apiKey);
  
  if (!keyData) {
    logApiCall(null, req.path, req.method, req.ip, 401, Date.now() - startTime, 'Invalid API Key');
    return res.status(401).json({
      error: 'unauthorized',
      message: '无效的 API Key'
    });
  }
  
  // 检查限流
  const rateCheck = checkRateLimit(keyData.id, keyData.rate_limit);
  
  if (!rateCheck.allowed) {
    logApiCall(keyData.id, req.path, req.method, req.ip, 429, Date.now() - startTime, 'Rate limit exceeded');
    res.setHeader('Retry-After', rateCheck.retryAfter);
    return res.status(429).json({
      error: 'rate_limit_exceeded',
      message: `请求过于频繁，请 ${rateCheck.retryAfter} 秒后再试`,
      retry_after: rateCheck.retryAfter
    });
  }
  
  // 设置限流响应头
  res.setHeader('X-RateLimit-Limit', keyData.rate_limit);
  res.setHeader('X-RateLimit-Remaining', rateCheck.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(rateCheck.resetTime / 1000));
  
  // 将 API Key 信息附加到请求对象
  req.apiClient = {
    id: keyData.id,
    name: keyData.name,
    permissions: keyData.permissions.split(',')
  };
  
  // 更新最后使用时间
  updateLastUsed(keyData.id);
  
  // 记录成功日志（在响应完成后）
  res.on('finish', () => {
    logApiCall(
      keyData.id,
      req.path,
      req.method,
      req.ip,
      res.statusCode,
      Date.now() - startTime,
      null
    );
  });
  
  next();
}

/**
 * 权限检查中间件工厂
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.apiClient || !req.apiClient.permissions.includes(permission)) {
      return res.status(403).json({
        error: 'forbidden',
        message: `需要 ${permission} 权限才能访问此接口`
      });
    }
    next();
  };
}

/**
 * 创建新的 API Key（管理员使用）
 */
function createApiKey(name, description, userId, permissions = 'read', rateLimit = 100, expiresAt = null) {
  const key = generateApiKey();
  
  db.prepare(
    `INSERT INTO api_keys (key, name, description, user_id, permissions, rate_limit, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(key, name, description, userId, permissions, rateLimit, expiresAt);
  
  return key;
}

/**
 * 获取 API Key 列表
 */
function getApiKeys(page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(
    `SELECT id, name, description, permissions, rate_limit, active, 
            last_used_at, created_at, expires_at
     FROM api_keys
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  ).all(pageSize, offset);
  
  const total = db.prepare('SELECT COUNT(*) as count FROM api_keys').get().count;
  
  return { rows, total, page, pageSize };
}

/**
 * 获取 API Key 统计信息
 */
function getApiKeyStats(apiKeyId, days = 7) {
  const stats = db.prepare(
    `SELECT 
      COUNT(*) as total_calls,
      COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_calls,
      AVG(response_time) as avg_response_time
     FROM api_logs
     WHERE api_key_id = ? AND created_at >= datetime('now', '-${days} days')`
  ).get(apiKeyId);
  
  const dailyStats = db.prepare(
    `SELECT 
      date(created_at) as date,
      COUNT(*) as calls,
      COUNT(CASE WHEN status_code >= 400 THEN 1 END) as errors
     FROM api_logs
     WHERE api_key_id = ? AND created_at >= datetime('now', '-${days} days')
     GROUP BY date(created_at)
     ORDER BY date DESC`
  ).all(apiKeyId);
  
  return { summary: stats, daily: dailyStats };
}

/**
 * 禁用/启用 API Key
 */
function toggleApiKey(apiKeyId, active) {
  db.prepare('UPDATE api_keys SET active = ? WHERE id = ?').run(active ? 1 : 0, apiKeyId);
}

/**
 * 删除 API Key
 */
function deleteApiKey(apiKeyId) {
  db.prepare('DELETE FROM api_keys WHERE id = ?').run(apiKeyId);
}

module.exports = {
  apiKeyAuth,
  requirePermission,
  createApiKey,
  getApiKeys,
  getApiKeyStats,
  toggleApiKey,
  deleteApiKey,
  verifyApiKey
};
