const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');
const { verifyPassword, getUserById } = require('../auth');

router.post('/api/auth/login', (req, res) => {
  const { username = '', password = '', remember_me } = req.body || {};
  const u = String(username).trim();
  if (!u || !password) {
    return res.status(400).json({ success: false, message: '请输入用户名和密码' });
  }
  const { success, userId } = verifyPassword(u, password);
  if (!success) {
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }
  const user = getUserById(userId);
  req.session.user_id = userId;
  req.session.username = user.username;
  req.session.is_admin = user.is_admin ? true : false;
  res.json({
    success: true,
    username: user.username,
    is_admin: !!user.is_admin,
  });
});

router.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {});
  res.clearCookie('connect.sid');
  res.json({ success: true });
});

router.get('/api/auth/me', (req, res) => {
  if (!req.session || !req.session.user_id) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  res.json({
    user_id: req.session.user_id,
    username: req.session.username || '',
    is_admin: !!req.session.is_admin,
  });
});

module.exports = router;
