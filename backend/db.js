/**
 * SQLite 数据库层（sql.js，无需本地编译），与 Python Database 表结构一致
 */
const path = require('path');
const fs = require('fs');

const defaultDbPath = path.resolve(__dirname, process.env.DB_PATH || '../cache/fund_data.db');
const dbDir = path.dirname(defaultDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let _db = null;

function getDb() {
  if (!_db) throw new Error('Database not initialized. Call initDb() first.');
  return _db;
}

// 兼容 better-sqlite3 的 prepare().run/get/all 用法
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
      UNIQUE (user_id, fund_code)
    );
    CREATE TABLE IF NOT EXISTS position_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      fund_code TEXT NOT NULL,
      fund_name TEXT,
      op TEXT NOT NULL,
      amount REAL NOT NULL,
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
  `);

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
