/**
 * LanFund 后端入口：Express 服务、会话、静态资源与 SPA 回退
 * 依赖 initDb 与 chartDataScheduler，启动后提供 /api/* 与前端静态资源
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const cookieParser = require('cookie-parser');
const cors = require('cors');
const compression = require('compression');

const { initDb } = require('./db');
const cache = require('./cache');
const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');
const chartDataScheduler = require('./services/chartDataScheduler');

// 配置（生产环境必须设置 SESSION_SECRET）
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 8311;
const SESSION_SECRET = process.env.SESSION_SECRET;
const sessionDir = process.env.SESSION_PATH || path.join(__dirname, 'data', 'sessions');

if (isProduction && (!SESSION_SECRET || SESSION_SECRET.length < 16)) {
  console.error('生产环境必须设置 SESSION_SECRET 且长度不少于 16 字符');
  process.exit(1);
}

const app = express();

// 响应压缩（减少传输大小）
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024,
}));

// CORS：可配置 CORS_ORIGIN（多个用逗号分隔），未配置则允许任意来源
const corsOrigin = process.env.CORS_ORIGIN;
const corsOptions = {
  credentials: true,
  origin: !corsOrigin ? true : corsOrigin.includes(',') ? corsOrigin.split(',').map(s => s.trim()) : corsOrigin.trim(),
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (isProduction) {
  try { fs.mkdirSync(sessionDir, { recursive: true }); } catch (e) { /* 由 entrypoint 修复权限 */ }
}
app.use(
  session({
    secret: SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 },
    store: isProduction ? new FileStore({ path: sessionDir, ttl: 7 * 24 * 3600 }) : undefined,
  })
);

// 请求日志中间件
app.use((req, res, next) => {
  next();
});

// 前端构建路径配置
const frontendBuild = fs.existsSync(path.join(__dirname, 'frontend/out'))
  ? path.join(__dirname, 'frontend/out')
  : path.join(__dirname, '../frontend/out');

// 最先处理根路径和登录页面 - 避免被其他中间件拦截
app.get('/', (req, res) => {
  const filePath = path.join(frontendBuild, 'index.html');
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  res.status(500).send('Frontend not built');
});

app.get('/login', (req, res) => {
  const filePath = path.join(frontendBuild, 'login.html');
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  res.status(500).send('Frontend not built');
});

// 健康检查端点（无需认证）
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Key 诊断端点（无需认证，用于调试）
app.get('/api/debug/api-key', (req, res) => {
  const testKey = req.query.key;
  if (!testKey) {
    return res.status(400).json({ error: 'Missing key parameter' });
  }

  const db = require('./db');

  // 查询所有 API Keys
  const allKeys = db.prepare('SELECT id, key, name, active, expires_at FROM api_keys').all();

  // 查询指定的 API Key
  const row = db.prepare(
    `SELECT k.*, u.username as bind_username
     FROM api_keys k
     LEFT JOIN users u ON k.bind_user_id = u.id
     WHERE k.key = ?`
  ).get(testKey);

  res.json({
    tested_key: testKey.substring(0, 30) + '...',
    found: !!row,
    key_details: row ? {
      id: row.id,
      name: row.name,
      active: row.active,
      expires_at: row.expires_at,
      permissions: row.permissions,
      is_expired: row.expires_at && new Date(row.expires_at) < new Date()
    } : null,
    total_keys_in_db: allKeys.length,
    all_keys: allKeys.map(k => ({
      id: k.id,
      name: k.name,
      key_prefix: k.key.substring(0, 20) + '...',
      active: k.active
    }))
  });
});

// 加载 publicApi 路由并检查（放在其他路由之前）
const publicApiRouter = require('./routes/publicApi');
console.log('[Server] publicApi router loaded:', typeof publicApiRouter);
app.use('/api/v1/public', publicApiRouter);

// 测试端点：验证 /api/v1/public 路由是否工作
app.get('/api/v1/public/test', (req, res) => {
  res.json({ success: true, message: 'Public API route is working' });
});

// 静态文件服务（CSS、JS、图片等）- 必须在认证路由之前
const frontendPublic = fs.existsSync(path.join(__dirname, 'frontend/public'))
  ? path.join(__dirname, 'frontend/public')
  : path.join(__dirname, '../frontend/public');

const nextStaticPath = path.join(frontendBuild, '_next');
console.log(`[Server] Frontend public path: ${frontendPublic}`);
console.log(`[Server] _next static path: ${nextStaticPath}, exists: ${fs.existsSync(nextStaticPath)}`);

// 先处理 _next 静态文件（必须在认证路由之前）
app.use('/_next', express.static(nextStaticPath));
app.use(express.static(frontendPublic));
app.use(express.static(frontendBuild, { index: false }));

// 认证路由
app.use(authRoutes);
app.use(aiRoutes);
app.use(require('./routes/fundApi'));
app.use(require('./routes/apiAdmin'));

// 3. 认证保护的路由
app.get(['/portfolio', '/market', '/market-indices', '/precious-metals', '/sectors', '/admin/*'], (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  if (!req.session || !req.session.user_id) {
    const redirect = encodeURIComponent(req.path);
    return res.redirect('/login?redirect=' + redirect);
  }
  next();
});

// 4. 其他页面路由
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();

  const base = req.path.slice(1).replace(/\//g, path.sep);
  const htmlPath = path.join(frontendBuild, base + '.html');

  if (fs.existsSync(htmlPath)) {
    return res.sendFile(htmlPath);
  }
  next();
});

initDb().then(() => {
  const db = require('./db');

  cache.prune();
  setInterval(() => cache.prune(), 60 * 60 * 1000);

  // 初始化数据源适配器（支持多数据源切换和故障转移）
  try {
    const { initDataSources } = require('./services/dataSourceAdapter');
    initDataSources();
  } catch (e) {
    console.warn('[数据源] 适配器初始化失败，使用默认数据源:', e.message);
  }

  // 定期清理旧的图表数据（保留2天）
  const cleanupOldChartData = () => {
    try {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const cutoffDate = twoDaysAgo.toISOString().slice(0, 10);
      const result = db.prepare('DELETE FROM fund_chart_data WHERE date < ?').run(cutoffDate);
      if (result.changes > 0) {
        console.log(`清理了 ${result.changes} 条旧的图表数据（保留2天）`);
      }
    } catch (e) {
      console.warn('清理旧图表数据失败:', e.message);
    }
  };
  
  // 启动时清理一次
  cleanupOldChartData();
  // 每2天清理一次
  setInterval(cleanupOldChartData, 2 * 24 * 60 * 60 * 1000);
  
  // 启动图表数据定时更新任务（9点-15点，每分钟）
  chartDataScheduler.startScheduler();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Fund backend (Express) running at http://0.0.0.0:${PORT}`);
  });
}).catch((err) => {
  console.error('Database init failed:', err);
  process.exit(1);
});
