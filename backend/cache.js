/**
 * 数据缓存层：将外部接口结果写入 SQLite cache_store，支持 TTL 读写
 * 用于基金行情/估值、图表分时、市场快讯等，减少重复请求、提高响应速度
 */
const db = require('./db');

/** 各业务默认 TTL（毫秒） */
const DEFAULT_TTL_MS = {
  fundMatiaria: 90 * 1000,       // 单只基金行情 90 秒
  fundCurves: 24 * 60 * 60 * 1000, // 近一月曲线 24 小时
  fundIntraday: 90 * 1000,        // 当日估值分时 90 秒
  marketKx: 2 * 60 * 1000,        // 7*24 快讯 2 分钟
};

/**
 * 读取缓存，过期则返回 null
 * @param {string} key 缓存键
 * @param {number} [ttlMs] 有效时长（毫秒），不传则永久有效
 * @returns {any|null} 解析后的 JSON 或 null
 */
function get(key, ttlMs) {
  try {
    const row = db.prepare('SELECT data, updated_at FROM cache_store WHERE cache_key = ?').get(key);
    if (!row || row.data == null) return null;
    if (ttlMs != null && ttlMs > 0) {
      const age = Date.now() - (row.updated_at || 0);
      if (age > ttlMs) return null;
    }
    return JSON.parse(row.data);
  } catch (e) {
    return null;
  }
}

/**
 * 写入缓存（INSERT OR REPLACE）
 * @param {string} key 缓存键
 * @param {any} value 可 JSON 序列化的值
 */
function set(key, value) {
  try {
    const data = JSON.stringify(value);
    const updated_at = Date.now();
    db.prepare(
      'INSERT OR REPLACE INTO cache_store (cache_key, data, updated_at) VALUES (?, ?, ?)'
    ).run(key, data, updated_at);
  } catch (e) {
    console.warn('Cache set failed:', key, e.message);
  }
}

/** 今日日期 YYYY-MM-DD，用于按日失效的 key */
function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** 基金行情页缓存 key */
function keyMatiaria(fundCode) {
  return 'matiaria:' + String(fundCode).trim() + ':' + todayKey();
}

/** 近一月曲线缓存 key */
function keyCurves(fundKey) {
  return 'curves:' + String(fundKey).trim() + ':' + todayKey();
}

/** 当日估值分时缓存 key */
function keyIntraday(fundKey) {
  return 'intraday:' + String(fundKey).trim() + ':' + todayKey();
}

/** 市场快讯缓存 key */
function keyMarketKx(count, pn) {
  return 'market:kx:' + (count || 20) + ':' + (pn || 0);
}

/** 删除过期缓存（默认保留 7 天内写入的），避免表无限增长 */
function prune(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  try {
    const cutoff = Date.now() - maxAgeMs;
    db.prepare('DELETE FROM cache_store WHERE updated_at < ?').run(cutoff);
  } catch (e) {
    console.warn('Cache prune failed:', e.message);
  }
}

module.exports = {
  get,
  set,
  prune,
  todayKey,
  DEFAULT_TTL_MS,
  keyMatiaria,
  keyCurves,
  keyIntraday,
  keyMarketKx,
};
