/**
 * 认证中间件与工具
 */
const bcrypt = require('bcryptjs');
const db = require('./db');

function verifyPassword(username, password) {
  const row = db.prepare('SELECT id, password_hash FROM users WHERE username = ?').get(username);
  if (!row) return { success: false, userId: null };
  const ok = bcrypt.compareSync(password, row.password_hash);
  return { success: ok, userId: ok ? row.id : null };
}

function getUserById(userId) {
  return db.prepare('SELECT id, username, is_admin FROM users WHERE id = ?').get(userId);
}

function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function loginRequired(req, res, next) {
  if (req.session && req.session.user_id) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  return res.redirect('/login');
}

function getCurrentUserId(req) {
  return (req.session && req.session.user_id) || null;
}

function getCurrentUsername(req) {
  return (req.session && req.session.username) || '';
}

function adminRequired(req, res, next) {
  if (!req.session || !req.session.user_id) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    return res.redirect('/login');
  }
  if (!req.session.is_admin) {
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({ error: 'forbidden', message: '需要管理员权限' });
    }
    return res.redirect('/portfolio');
  }
  return next();
}

module.exports = {
  verifyPassword,
  getUserById,
  getUserByUsername,
  loginRequired,
  adminRequired,
  getCurrentUserId,
  getCurrentUsername,
};
