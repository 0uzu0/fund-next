require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const { initDb } = require('./db');
const cache = require('./cache');
const authRoutes = require('./routes/auth');
const fundApi = require('./routes/fundApi');
const { loginRequired } = require('./auth');
const chartDataScheduler = require('./services/chartDataScheduler');

const PORT = process.env.PORT || 8311;
const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'luobobo',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

// 健康检查端点（无需认证）
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(authRoutes);
app.use(fundApi);

// 前端静态与 SPA 回退（由 Next 构建输出）
const frontendBuild = path.join(__dirname, '../frontend/out');
const frontendPublic = path.join(__dirname, '../frontend/public');
app.use(express.static(frontendBuild));
app.use(express.static(frontendPublic));

// 未登录访问 /portfolio 等重定向到登录（仅对 HTML 页面）
app.get(['/', '/fund', '/portfolio', '/market', '/market-indices', '/precious-metals', '/sectors', '/position-records'], (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  if (!req.session || !req.session.user_id) {
    if (req.path === '/login' || req.path === '/') return next();
    return res.redirect('/login');
  }
  next();
});

// Next 静态导出：优先返回对应 path 的 html 文件，否则 index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/_next')) return next();
  const fs = require('fs');
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
