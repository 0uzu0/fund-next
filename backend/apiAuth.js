/**
 * API Key 认证与限流中间件
 * 用于第三方应用接入公开 API
 */
const crypto = require('crypto');
const db = require('./db');

// 内存中的请求计数器（用于限流）
const rateLimitCache = new Map();

// 权限级别定义
const permissionLevels = {
  'read': 1,
  'write': 2,
  'admin': 3
};

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
 * @returns {string} 生成的 API Key 字符串
 */
function generateApiKey() {
  return 'ak_' + crypto.randomBytes(32).toString('hex');
}

/**
 * 验证 API Key
 * @param {string} apiKey - API Key 字符串
 * @returns {Object|null} API Key 信息或 null
 */
function verifyApiKey(apiKey) {
  if (!apiKey || !apiKey.startsWith('ak_')) {
    console.log(`[verifyApiKey] Invalid format: ${apiKey ? apiKey.substring(0, 20) : 'empty'}`);
    return null;
  }

  try {
    const row = db.prepare(
      `SELECT k.*, u.username as bind_username
       FROM api_keys k
       LEFT JOIN users u ON k.bind_user_id = u.id
       WHERE k.key = ? AND k.active = 1`
    ).get(apiKey);

    if (!row) {
      console.log(`[verifyApiKey] Key not found or inactive: ${apiKey.substring(0, 20)}...`);
      return null;
    }

    // 检查是否过期
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      console.log(`[verifyApiKey] Key expired: ${apiKey.substring(0, 20)}..., expires_at: ${row.expires_at}`);
      return null;
    }

    return row;
  } catch (error) {
    console.error(`[verifyApiKey] Database error:`, error.message);
    return null;
  }
}

/**
 * 更新 API Key 最后使用时间
 * @param {number} apiKeyId - API Key ID
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
 * @param {number} apiKeyId - API Key ID
 * @param {string} endpoint - 请求端点
 * @param {string} method - HTTP 方法
 * @param {string} ipAddress - IP 地址
 * @param {number} statusCode - 状态码
 * @param {number} responseTime - 响应时间（毫秒）
 * @param {string} errorMessage - 错误信息（如果有）
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
 * @param {number} apiKeyId - API Key ID
 * @param {number} rateLimit - 限制次数（每分钟）
 * @returns {Object} 限流检查结果 { allowed, remaining, resetTime, retryAfter? }
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
 * 从请求头 X-API-Key 中读取 API Key 进行验证
 */
function apiKeyAuth(req, res, next) {
  const startTime = Date.now();
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey) {
    console.log(`[API Auth] Missing API Key from IP: ${req.ip}, Path: ${req.path}`);
    logApiCall(null, req.path, req.method, req.ip, 401, Date.now() - startTime, 'Missing API Key');
    return res.status(401).json({
      error: 'unauthorized',
      message: '缺少 API Key，请在请求头中添加 X-API-Key 或在查询参数中添加 api_key'
    });
  }

  console.log(`[API Auth] Received API Key: ${apiKey.substring(0, 25)}... from IP: ${req.ip}`);

  const keyData = verifyApiKey(apiKey);

  if (!keyData) {
    console.log(`[API Auth] Invalid API Key: ${apiKey.substring(0, 20)}...`);
    logApiCall(null, req.path, req.method, req.ip, 401, Date.now() - startTime, 'Invalid API Key');
    return res.status(401).json({
      error: 'unauthorized',
      message: '无效的 API Key 或已过期'
    });
  }

  console.log(`[API Auth] Valid API Key: ${keyData.name} (ID: ${keyData.id})`);

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
  res.setHeader('X-RateLimit-Remaining', Math.max(0, rateCheck.remaining));
  res.setHeader('X-RateLimit-Reset', Math.ceil(rateCheck.resetTime / 1000));

  // 将 API Key 信息附加到请求对象
  req.apiKey = {
    id: keyData.id,
    name: keyData.name,
    permissions: keyData.permissions,
    bindUserId: keyData.bind_user_id || null,
    bindUsername: keyData.bind_username || null
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
 * @param {string} requiredPermission - 需要的权限级别（read/write/admin）
 * @returns {Function} Express 中间件
 */
function requirePermission(requiredPermission) {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({
        error: 'unauthorized',
        message: '请先进行 API Key 认证'
      });
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
 * 创建新的 API Key（管理员使用）
 * @param {string} name - API Key 名称
 * @param {string} description - 描述
 * @param {number} userId - 创建者用户 ID
 * @param {string} permissions - 权限：read/write/admin
 * @param {number} rateLimit - 每分钟请求限制
 * @param {Date|string} expiresAt - 过期时间（可选）
 * @param {number} bindUserId - 绑定的目标用户 ID（可选）
 * @returns {string} 生成的 API Key
 */
function createApiKey(name, description, userId, permissions = 'read', rateLimit = 100, expiresAt = null, bindUserId = null) {
  const key = generateApiKey();

  db.prepare(
    `INSERT INTO api_keys (key, name, description, user_id, permissions, rate_limit, expires_at, bind_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(key, name, description, userId, permissions, rateLimit, expiresAt, bindUserId);

  return key;
}

/**
 * 获取 API Key 列表（管理员用）
 * @param {number} page - 页码
 * @param {number} pageSize - 每页数量
 * @returns {Object} API Key 列表和分页信息
 */
function getApiKeys(page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;

  const rows = db.prepare(
    `SELECT k.id, k.name, k.description, k.permissions, k.rate_limit, k.active,
            k.last_used_at, k.created_at, k.expires_at, k.bind_user_id,
            u.username as bind_username
     FROM api_keys k
     LEFT JOIN users u ON k.bind_user_id = u.id
     ORDER BY k.created_at DESC
     LIMIT ? OFFSET ?`
  ).all(pageSize, offset);

  const total = db.prepare('SELECT COUNT(*) as count FROM api_keys').get().count;

  return {
    data: rows,
    pagination: {
      page,
      limit: pageSize,
      total,
      pages: Math.ceil(total / pageSize)
    }
  };
}

/**
 * 获取 API Key 统计信息
 * @param {number} apiKeyId - API Key ID
 * @param {number} days - 统计天数
 * @returns {Object} 统计数据
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
 * 获取 API 调用统计（全局）
 * @param {number} days - 统计天数
 * @returns {Array} 统计数据
 */
function getApiStats(days = 7) {
  const stats = db.prepare(
    `SELECT
      DATE(created_at) as date,
      COUNT(*) as total_requests,
      COUNT(DISTINCT api_key_id) as unique_keys,
      AVG(response_time) as avg_response_time,
      SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
     FROM api_logs
     WHERE created_at >= datetime('now', '-${days} days')
     GROUP BY DATE(created_at)
     ORDER BY date DESC`
  ).all();

  return stats;
}

/**
 * 启用/禁用 API Key
 * @param {number} apiKeyId - API Key ID
 * @param {boolean} active - 是否启用
 */
function toggleApiKey(apiKeyId, active) {
  db.prepare('UPDATE api_keys SET active = ? WHERE id = ?').run(active ? 1 : 0, apiKeyId);
}

/**
 * 吊销 API Key（等同于禁用）
 * @param {number} keyId - API Key ID
 * @returns {boolean} 是否成功
 */
function revokeApiKey(keyId) {
  const result = db.prepare('UPDATE api_keys SET active = 0 WHERE id = ?').run(keyId);
  return result.changes > 0;
}

/**
 * 删除 API Key
 * @param {number} apiKeyId - API Key ID
 */
function deleteApiKey(apiKeyId) {
  db.prepare('DELETE FROM api_keys WHERE id = ?').run(apiKeyId);
}

module.exports = {
  apiKeyAuth,
  requirePermission,
  generateApiKey,
  createApiKey,
  getApiKeys,
  getApiKeyStats,
  getApiStats,
  toggleApiKey,
  revokeApiKey,
  deleteApiKey,
  verifyApiKey,
  logApiCall
};
