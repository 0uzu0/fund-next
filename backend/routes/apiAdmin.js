/**
 * API Key 管理后台路由
 * 仅管理员可访问
 */
const express = require('express');
const router = express.Router();
const { loginRequired, adminRequired } = require('../auth');
const { 
  createApiKey, 
  getApiKeys, 
  getApiKeyStats, 
  toggleApiKey, 
  deleteApiKey 
} = require('../apiAuth');

// 所有接口都需要管理员权限
router.use(loginRequired, adminRequired);

/**
 * @api {get} /api/admin/api-keys 获取 API Key 列表
 */
router.get('/api/admin/api-keys', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    
    const result = getApiKeys(page, pageSize);
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: Math.ceil(result.total / result.pageSize)
      }
    });
  } catch (error) {
    console.error('获取 API Key 列表失败:', error);
    res.status(500).json({
      error: 'internal_error',
      message: '获取列表失败'
    });
  }
});

/**
 * @api {get} /api/admin/users 获取用户列表（用于绑定）
 */
router.get('/api/admin/users', (req, res) => {
  try {
    const db = require('../db');
    const rows = db.prepare(`
      SELECT id, username, is_admin, created_at 
      FROM users 
      ORDER BY id ASC
    `).all();
    
    const users = rows.map(u => ({
      id: u.id,
      username: u.username,
      is_admin: !!u.is_admin,
      created_at: u.created_at
    }));
    
    console.log('Returning users:', users); // 调试用
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户列表失败'
    });
  }
});

/**
 * @api {post} /api/admin/api-keys 创建新的 API Key
 */
router.post('/api/admin/api-keys', (req, res) => {
  try {
    const { name, description, permissions = 'read', rateLimit = 100, expiresAt, bindUserId } = req.body;
    
    if (!name) {
      return res.status(400).json({
        error: 'bad_request',
        message: '请提供 API Key 名称'
      });
    }
    
    // 验证权限格式
    const validPermissions = ['read', 'write', 'admin'];
    const permArray = permissions.split(',').map(p => p.trim());
    for (const perm of permArray) {
      if (!validPermissions.includes(perm)) {
        return res.status(400).json({
          error: 'bad_request',
          message: `无效的权限: ${perm}`
        });
      }
    }
    
    // 如果指定了绑定用户，验证用户是否存在
    let targetUserId = null;
    if (bindUserId) {
      const db = require('../db');
      const user = db.prepare('SELECT id FROM users WHERE id = ?').get(bindUserId);
      if (!user) {
        return res.status(400).json({
          error: 'bad_request',
          message: '绑定的用户不存在'
        });
      }
      targetUserId = parseInt(bindUserId);
    }
    
    const key = createApiKey(
      name,
      description,
      req.session.user_id,
      permissions,
      parseInt(rateLimit),
      expiresAt || null,
      targetUserId
    );
    
    res.json({
      success: true,
      message: 'API Key 创建成功',
      data: {
        api_key: key,
        name,
        permissions,
        rate_limit: parseInt(rateLimit),
        expires_at: expiresAt || null,
        bind_user_id: targetUserId
      }
    });
  } catch (error) {
    console.error('创建 API Key 失败:', error);
    res.status(500).json({
      error: 'internal_error',
      message: '创建失败'
    });
  }
});

/**
 * @api {put} /api/admin/api-keys/:id/toggle 启用/禁用 API Key
 */
router.put('/api/admin/api-keys/:id/toggle', (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    
    toggleApiKey(parseInt(id), active);
    
    res.json({
      success: true,
      message: active ? 'API Key 已启用' : 'API Key 已禁用'
    });
  } catch (error) {
    console.error('切换 API Key 状态失败:', error);
    res.status(500).json({
      error: 'internal_error',
      message: '操作失败'
    });
  }
});

/**
 * @api {delete} /api/admin/api-keys/:id 删除 API Key
 */
router.delete('/api/admin/api-keys/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    deleteApiKey(parseInt(id));
    
    res.json({
      success: true,
      message: 'API Key 已删除'
    });
  } catch (error) {
    console.error('删除 API Key 失败:', error);
    res.status(500).json({
      error: 'internal_error',
      message: '删除失败'
    });
  }
});

/**
 * @api {get} /api/admin/api-keys/:id/stats 获取 API Key 统计信息
 */
router.get('/api/admin/api-keys/:id/stats', (req, res) => {
  try {
    const { id } = req.params;
    const days = parseInt(req.query.days) || 7;
    
    const stats = getApiKeyStats(parseInt(id), days);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取 API Key 统计失败:', error);
    res.status(500).json({
      error: 'internal_error',
      message: '获取统计信息失败'
    });
  }
});

module.exports = router;
