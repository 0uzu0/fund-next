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
const fundApi = require('./routes/fundApi');
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

// 健康检查端点（无需认证）
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(authRoutes);
app.use(fundApi);
app.use(aiRoutes);

// 前端静态与 SPA 回退（由 Next 构建输出）
// 支持开发环境（../frontend/out）和生产环境（./frontend/out）
const frontendBuild = fs.existsSync(path.join(__dirname, 'frontend/out'))
  ? path.join(__dirname, 'frontend/out')
  : path.join(__dirname, '../frontend/out');
const frontendPublic = fs.existsSync(path.join(__dirname, 'frontend/public'))
  ? path.join(__dirname, 'frontend/public')
  : path.join(__dirname, '../frontend/public');
app.use(express.static(frontendBuild));
app.use(express.static(frontendPublic));

// 未登录访问 /portfolio 等重定向到登录，并带上 return URL 便于登录后跳回
app.get(['/', '/fund', '/portfolio', '/market', '/market-indices', '/precious-metals', '/sectors', '/position-records'], (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  if (!req.session || !req.session.user_id) {
    if (req.path === '/login' || req.path === '/') return next();
    const redirect = encodeURIComponent(req.path);
    return res.redirect('/login?redirect=' + redirect);
  }
  next();
});

// Next 静态导出：优先返回对应 path 的 html 文件，否则 index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/_next')) return next();
  const hasExt = path.extname(req.path);
  if (hasExt) return next();
  const base = req.path === '/' ? 'index' : req.path.slice(1).replace(/\//g, path.sep);
  const htmlPath = path.join(frontendBuild, base + '.html');
  if (fs.existsSync(htmlPath)) return res.sendFile(htmlPath);
  const indexFile = path.join(frontendBuild, 'index.html');
  if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
  next();
});

initDb().then(() => {
  cache.prune();
  setInterval(() => cache.prune(), 60 * 60 * 1000);
  
  // 定期清理旧的图表数据（保留2天）
  const db = require('./db');
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
