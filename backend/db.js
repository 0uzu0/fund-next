/**
 * SQLite 数据库层（基于 sql.js，纯 JS 无需本地编译）
 * 表结构与原 Python 版一致，用于用户、基金、分组、持仓记录、缓存、图表数据等
 * 部署：生产环境可设置 DB_PATH=/app/data/fund_data.db 并挂载 volume 持久化
 */
const path = require('path');
const fs = require('fs');

function getDefaultDbPath() {
  const envPath = process.env.DB_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(__dirname, envPath);
  }
  // 生产环境（如 Docker）默认使用 /app/data，便于挂载 volume 持久化
  if (process.env.NODE_ENV === 'production') {
    return '/app/data/fund_data.db';
  }
  return path.resolve(__dirname, '../cache/fund_data.db');
}

const defaultDbPath = getDefaultDbPath();
const dbDir = path.dirname(defaultDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let _db = null;

function getDb() {
  if (!_db) throw new Error('Database not initialized. Call initDb() first.');
  return _db;
}

/** 包装 sql.js 的 prepare，提供 run/get/all 以兼容 better-sqlite3 用法，便于迁移与复用 */
function wrapStmt(sql) {
  const db = getDb();
  return {
    run(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      stmt.step();
      stmt.free();
      const sel = db.prepare('SELECT last_insert_rowid() as id');
      const row = sel.step() ? sel.getAsObject() : null;
      sel.free();
      return { lastInsertRowid: row && row.id ? row.id : 0 };
    },
    get(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const row = stmt.step() ? stmt.getAsObject() : null;
      stmt.free();
      return row;
    },
    all(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },
  };
}

const wrapper = {
  prepare(sql) {
    return wrapStmt(sql);
  },
  exec(sql) {
    getDb().exec(sql);
  },
  get connection() {
    return getDb();
  },
};

async function initDb() {
  if (_db) return wrapper;
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  if (fs.existsSync(defaultDbPath)) {
    const buf = fs.readFileSync(defaultDbPath);
    _db = new SQL.Database(buf);
  } else {
    _db = new SQL.Database();
  }

  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_admin INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS user_funds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      fund_code TEXT NOT NULL,
      fund_key TEXT NOT NULL,
      fund_name TEXT NOT NULL,
      is_hold INTEGER DEFAULT 0,
      shares REAL DEFAULT 0,
      sectors TEXT,
      chart_default INTEGER DEFAULT 0,
      holding_units REAL DEFAULT 0,
      cost_per_unit REAL DEFAULT 1,
      holding_profit REAL DEFAULT 0,
      UNIQUE (user_id, fund_code)
    );
    CREATE TABLE IF NOT EXISTS position_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      fund_code TEXT NOT NULL,
      fund_name TEXT,
      op TEXT NOT NULL,
      amount REAL NOT NULL,
      units REAL,
      trade_date TEXT NOT NULL,
      period TEXT,
      prev_holding_units REAL NOT NULL,
      prev_cost_per_unit REAL NOT NULL,
      new_holding_units REAL NOT NULL,
      new_cost_per_unit REAL NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS fund_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      fund_codes TEXT NOT NULL DEFAULT '[]',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS cache_store (
      cache_key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cache_updated ON cache_store(updated_at);
    CREATE TABLE IF NOT EXISTS fund_chart_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fund_code TEXT NOT NULL,
      fund_key TEXT NOT NULL,
      date TEXT NOT NULL,
      chart_data TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (fund_code, date)
    );
    CREATE INDEX IF NOT EXISTS idx_fund_chart_date ON fund_chart_data(fund_code, date);
    CREATE INDEX IF NOT EXISTS idx_fund_chart_updated ON fund_chart_data(updated_at);
    
    -- API Key 管理表
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      user_id INTEGER,
      permissions TEXT DEFAULT 'read', -- read, write, admin
      rate_limit INTEGER DEFAULT 100, -- 每分钟请求限制
      active INTEGER DEFAULT 1,
      last_used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
    CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(active);
    
    -- API 调用日志表
    CREATE TABLE IF NOT EXISTS api_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key_id INTEGER,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      ip_address TEXT,
      status_code INTEGER,
      response_time INTEGER, -- 毫秒
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_api_logs_key_id ON api_logs(api_key_id);
    CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at);
  `);

  // 迁移：为已存在的 position_records 表补充 units 列（仅启动时执行一次，避免路由中重复检查）
  try {
    const info = wrapper.prepare('PRAGMA table_info(position_records)').all();
    const hasUnits = info.some((col) => col.name === 'units');
    if (!hasUnits) wrapper.exec('ALTER TABLE position_records ADD COLUMN units REAL');
  } catch (e) {
    /* 表不存在时忽略 */
  }

  // 迁移：为已存在的 position_records 表补充手续费相关字段
  try {
    const info = wrapper.prepare('PRAGMA table_info(position_records)').all();
    const hasFeeRate = info.some((col) => col.name === 'fee_rate');
    const hasFixedFee = info.some((col) => col.name === 'fixed_fee');
    const hasFeeType = info.some((col) => col.name === 'fee_type');
    if (!hasFeeRate) wrapper.exec('ALTER TABLE position_records ADD COLUMN fee_rate REAL DEFAULT 0');
    if (!hasFixedFee) wrapper.exec('ALTER TABLE position_records ADD COLUMN fixed_fee REAL DEFAULT 0');
    if (!hasFeeType) wrapper.exec("ALTER TABLE position_records ADD COLUMN fee_type TEXT DEFAULT 'rate'");
  } catch (e) {
    /* 表不存在时忽略 */
  }

  // 迁移：为已存在的 user_funds 表补充 holding_profit 列
  try {
    const info = wrapper.prepare('PRAGMA table_info(user_funds)').all();
    const hasHoldingProfit = info.some((col) => col.name === 'holding_profit');
    if (!hasHoldingProfit) wrapper.exec('ALTER TABLE user_funds ADD COLUMN holding_profit REAL DEFAULT 0');
  } catch (e) {
    /* 表不存在时忽略 */
  }

  // 迁移：为 api_keys 表添加 bind_user_id 字段
  try {
    const info = wrapper.prepare('PRAGMA table_info(api_keys)').all();
    const hasBindUserId = info.some((col) => col.name === 'bind_user_id');
    if (!hasBindUserId) wrapper.exec('ALTER TABLE api_keys ADD COLUMN bind_user_id INTEGER');
  } catch (e) {
    /* 表不存在时忽略 */
  }

  const bcrypt = require('bcryptjs');
  const adminHash = bcrypt.hashSync('admin', 10);
  const exists = wrapper.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!exists) {
    wrapper.prepare('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)').run('admin', adminHash);
  }

  // 定期保存到文件
  const save = () => {
    try {
      const data = _db.export();
      const buf = Buffer.from(data);
      fs.writeFileSync(defaultDbPath, buf);
    } catch (e) {
      console.warn('Db save failed:', e.message);
    }
  };
  setInterval(save, 30000);
  process.on('beforeExit', save);

  return wrapper;
}

module.exports = wrapper;
module.exports.initDb = initDb;
module.exports.getDb = getDb;
