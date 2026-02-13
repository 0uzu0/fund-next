/**
 * 基金相关 API，与 Flask api_routes 保持一致
 * 行情/估值由 Node 服务 fund123 + fundQuotes 提供
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const bcrypt = require('bcryptjs');
const { getCurrentUserId, getCurrentUsername, loginRequired, adminRequired } = require('../auth');
const fundQuotes = require('../services/fundQuotes');
const tiantianFund = require('../services/tiantianFund');
const fund123 = require('../services/fund123');
const sectorEastMoney = require('../services/sectorEastMoney');
const preciousMetals = require('../services/preciousMetals');
const marketIndices = require('../services/marketIndices');
const fundHoldings = require('../services/fundHoldings');
const cache = require('../cache');
const axios = require('axios');

const upload = multer({ dest: path.join(__dirname, '../tmp') });

// 解析 fund_codes JSON 数组或字符串
function parseFundCodes(codes) {
  if (Array.isArray(codes)) return codes.map(String).filter(Boolean);
  if (typeof codes === 'string') return codes.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
  return [];
}

// ---------- 基金联想搜索（东方财富 suggest，参考 real-time-fund）----------
router.get('/api/fund/suggest', async (req, res) => {
  const key = String(req.query.key || '').trim();
  if (!key) return res.json({ success: true, list: [] });
  const callbackName = '__fund_suggest_' + Date.now();
  const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(key)}&callback=${callbackName}&_=${Date.now()}`;
  try {
    const { data: raw } = await axios.get(url, { timeout: 8000, responseType: 'text' });
    const start = raw.indexOf('(');
    const end = raw.lastIndexOf(')');
    const jsonStr = start >= 0 && end > start ? raw.slice(start + 1, end) : raw;
    const data = JSON.parse(jsonStr);
    let list = (data && data.Datas) ? data.Datas : [];
    list = list
      .filter((d) => d.CATEGORY === 700 || d.CATEGORY === '700' || (d.CATEGORYDESC && d.CATEGORYDESC.includes('基金')))
      .map((d) => ({ code: String(d.CODE || d.code || ''), name: String(d.NAME || d.SHORTNAME || d.name || '') }))
      .filter((d) => d.code && d.name)
      .slice(0, 20);
    return res.json({ success: true, list });
  } catch (e) {
    console.error('基金联想接口失败:', e.message);
    return res.json({ success: false, list: [], message: e.message });
  }
});

// ---------- 天天基金接口连通性自检（无需登录，用于排查数据源不可用）----------
router.get('/api/fund/tiantian-test', async (req, res) => {
  const code = String(req.query.code || '000001').trim();
  const start = Date.now();
  try {
    const data = await tiantianFund.fetchFundGz(code);
    const durationMs = Date.now() - start;
    if (data) {
      return res.json({ ok: true, code, data, durationMs });
    }
    return res.json({ ok: false, code, durationMs, message: '接口未返回有效数据（超时或解析失败）' });
  } catch (e) {
    const durationMs = Date.now() - start;
    return res.json({ ok: false, code, durationMs, message: String(e.message), error: e.code });
  }
});

// ---------- 基金数据（与原项目 database.get_user_funds 一致）----------
router.get('/api/fund/data', loginRequired, (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    const rows = db.prepare('SELECT * FROM user_funds WHERE user_id = ?').all(userId);
    const colNames = rows.length && typeof rows[0] === 'object' ? Object.keys(rows[0]) : [];
    const hasHoldingUnits = colNames.includes('holding_units');
    const hasCostPerUnit = colNames.includes('cost_per_unit');

    const fundMap = {};
    for (const row of rows) {
      const fundCode = row.fund_code;
      const sectors = row.sectors ? (typeof row.sectors === 'string' ? JSON.parse(row.sectors) : row.sectors) : [];
      const sharesRaw = Number(row.shares) || 0;

      let holdingUnits = null;
      let costPerUnit = null;
      if (hasHoldingUnits && row.holding_units != null && row.holding_units !== '') {
        holdingUnits = Number(row.holding_units);
      }
      if (hasCostPerUnit && row.cost_per_unit != null && row.cost_per_unit !== '') {
        costPerUnit = Number(row.cost_per_unit);
      }

      let shares;
      if (holdingUnits != null && costPerUnit != null && !Number.isNaN(holdingUnits) && !Number.isNaN(costPerUnit)) {
        shares = holdingUnits * costPerUnit;
      } else {
        shares = sharesRaw;
        holdingUnits = sharesRaw;
        costPerUnit = 1;
      }

      fundMap[fundCode] = {
        fund_key: row.fund_key != null ? String(row.fund_key) : fundCode,
        fund_name: row.fund_name != null ? String(row.fund_name) : `基金${fundCode}`,
        is_hold: Boolean(row.is_hold),
        shares: Number(shares),
        holding_units: Number(holdingUnits),
        cost_per_unit: Number(costPerUnit),
        sectors: Array.isArray(sectors) ? sectors : [],
      };
    }
    res.json(fundMap);
  } catch (e) {
    console.error('获取基金数据失败:', e);
    res.status(500).json({ error: String(e) });
  }
});

// ---------- 添加/删除基金 ----------
router.post('/api/fund/add', loginRequired, async (req, res) => {
  try {
    const codes = parseFundCodes(req.body.codes);
    if (!codes.length) return res.status(400).json({ success: false, message: '请提供基金代码' });
    const userId = getCurrentUserId(req);
    for (const code of codes) {
      let key = code;
      let name = req.body[`name_${code}`] || `基金${code}`;
      try {
        const info = await fund123.searchFund(code);
        if (info) {
          key = info.fund_key;
          name = info.fund_name;
        }
      } catch (_) {}
      db.prepare(
        `INSERT OR REPLACE INTO user_funds (user_id, fund_code, fund_key, fund_name, is_hold, shares, sectors, holding_units, cost_per_unit)
         VALUES (?, ?, ?, ?, 0, 0, '[]', 0, 1)`
      ).run(userId, code, key, name);
    }
    res.json({ success: true, message: `已添加基金: ${codes.join(', ')}` });
  } catch (e) {
    res.status(500).json({ success: false, message: String(e) });
  }
});

router.post('/api/fund/delete', loginRequired, (req, res) => {
  try {
    const codes = parseFundCodes(req.body.codes);
    if (!codes.length) return res.status(400).json({ success: false, message: '请提供基金代码' });
    const userId = getCurrentUserId(req);
    const stmt = db.prepare('DELETE FROM user_funds WHERE user_id = ? AND fund_code = ?');
    for (const code of codes) {
      stmt.run(userId, code);
    }
    res.json({ success: true, message: `已删除基金: ${codes.join(', ')}` });
  } catch (e) {
    res.status(500).json({ success: false, message: String(e) });
  }
});

// ---------- 行业板块标注（与原项目 api_fund_sector / api_fund_sector_remove 一致）----------
router.post('/api/fund/sector', loginRequired, (req, res) => {
  try {
    const codes = parseFundCodes(req.body.codes);
    const sectors = Array.isArray(req.body.sectors) ? req.body.sectors.map(String).filter(Boolean) : [];
    if (!codes.length) return res.status(400).json({ success: false, message: '请提供基金代码' });
    if (!sectors.length) return res.status(400).json({ success: false, message: '请选择板块' });
    const userId = getCurrentUserId(req);
    const stmt = db.prepare('UPDATE user_funds SET sectors = ? WHERE user_id = ? AND fund_code = ?');
    for (const code of codes) {
      stmt.run(JSON.stringify(sectors), userId, code);
    }
    res.json({ success: true, message: `已标注板块: ${codes.join(', ')} → ${sectors.join(', ')}` });
  } catch (e) {
    res.status(500).json({ success: false, message: String(e) });
  }
});

router.post('/api/fund/sector/remove', loginRequired, (req, res) => {
  try {
    const codes = parseFundCodes(req.body.codes);
    if (!codes.length) return res.status(400).json({ success: false, message: '请提供基金代码' });
    const userId = getCurrentUserId(req);
    const stmt = db.prepare('UPDATE user_funds SET sectors = ? WHERE user_id = ? AND fund_code = ?');
    for (const code of codes) {
      stmt.run('[]', userId, code);
    }
    res.json({ success: true, message: `已删除板块标记: ${codes.join(', ')}` });
  } catch (e) {
    res.status(500).json({ success: false, message: String(e) });
  }
});

// ---------- 导入/导出 ----------
router.post('/api/fund/upload', loginRequired, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: '未找到上传文件' });
    const filePath = req.file.path;
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
      content = fs.readFileSync(filePath, 'utf16le');
    }
    fs.unlinkSync(filePath);
    if (!req.file.originalname || !req.file.originalname.toLowerCase().endsWith('.json')) {
      return res.status(400).json({ success: false, message: '只支持JSON文件' });
    }
    const fundMap = JSON.parse(content);
    if (typeof fundMap !== 'object' || fundMap === null) {
      return res.status(400).json({ success: false, message: '文件格式错误：应为JSON对象' });
    }
    const userId = getCurrentUserId(req);
    const insert = db.prepare(
      `INSERT OR REPLACE INTO user_funds (user_id, fund_code, fund_key, fund_name, is_hold, shares, sectors, holding_units, cost_per_unit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const [code, data] of Object.entries(fundMap)) {
      if (!data || typeof data !== 'object' || !data.fund_key || !data.fund_name) {
        return res.status(400).json({ success: false, message: `基金${code}缺少必要字段` });
      }
      const holdingUnits = data.holding_units != null ? data.holding_units : (data.shares || 0);
      const costPerUnit = data.cost_per_unit != null ? data.cost_per_unit : 1;
      const shares = holdingUnits * costPerUnit;
      insert.run(
        userId,
        code,
        data.fund_key,
        data.fund_name,
        data.is_hold ? 1 : 0,
        shares,
        JSON.stringify(data.sectors || []),
        holdingUnits,
        costPerUnit
      );
    }
    const defaultGroup = db.prepare(
      'SELECT id FROM fund_groups WHERE user_id = ? AND sort_order = 0 LIMIT 1'
    ).get(userId);
    if (defaultGroup) {
      const codes = Object.keys(fundMap);
      db.prepare('UPDATE fund_groups SET fund_codes = ? WHERE id = ?').run(JSON.stringify(codes), defaultGroup.id);
    }
    res.json({ success: true, message: `成功导入${Object.keys(fundMap).length}个基金` });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || '上传失败' });
  }
});

router.get('/api/fund/download', loginRequired, (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    const rows = db.prepare('SELECT * FROM user_funds WHERE user_id = ?').all(userId);
    const fundMap = {};
    for (const row of rows) {
      const holdingUnits = row.holding_units != null ? row.holding_units : row.shares;
      const costPerUnit = row.cost_per_unit != null ? row.cost_per_unit : 1;
      fundMap[row.fund_code] = {
        fund_key: row.fund_key,
        fund_name: row.fund_name,
        is_hold: !!row.is_hold,
        shares: holdingUnits * costPerUnit,
        holding_units: holdingUnits,
        cost_per_unit: costPerUnit,
        sectors: row.sectors ? JSON.parse(row.sectors) : [],
      };
    }
    res.setHeader('Content-Disposition', 'attachment; filename=fund_map.json');
    res.setHeader('Content-Type', 'application/json');
    res.send(Buffer.from(JSON.stringify(fundMap, null, 2), 'utf8'));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ---------- 持仓份额（加减仓时写入 position_records，与原项目一致）----------
router.post('/api/fund/shares', loginRequired, (req, res) => {
  try {
    const { code, holding_units, cost_per_unit, shares, record_op, amount, units, trade_date, period, fund_name } = req.body || {};
    const c = String(code || '').trim();
    if (!c) return res.status(400).json({ success: false, message: '请提供基金代码' });
    const userId = getCurrentUserId(req);
    let holdingUnits, costPerUnit;
    if (holding_units != null && cost_per_unit != null) {
      holdingUnits = Number(holding_units);
      costPerUnit = Number(cost_per_unit);
      if (holdingUnits < 0 || costPerUnit < 0) {
        return res.status(400).json({ success: false, message: '持有份额与持仓成本不能为负数' });
      }
    } else {
      const s = Number(shares);
      if (isNaN(s) || s < 0) return res.status(400).json({ success: false, message: '份额不能为负数' });
      holdingUnits = s;
      costPerUnit = 1;
    }
    const prevRow = db.prepare('SELECT id, holding_units, cost_per_unit, fund_name FROM user_funds WHERE user_id = ? AND fund_code = ?').get(userId, c);
    if (!prevRow) return res.status(400).json({ success: false, message: '更新失败，基金不存在' });
    const prevHoldingUnits = Number(prevRow.holding_units) || 0;
    const prevCostPerUnit = Number(prevRow.cost_per_unit) || 1;
    const prevFundName = (prevRow.fund_name || fund_name || '').trim() || String(fund_name || '');

    const isHold = holdingUnits > 0 ? 1 : 0;
    db.prepare(
      'UPDATE user_funds SET holding_units = ?, cost_per_unit = ?, shares = ?, is_hold = ? WHERE user_id = ? AND fund_code = ?'
    ).run(holdingUnits, costPerUnit, holdingUnits * costPerUnit, isHold, userId, c);

    if (record_op === 'add' || record_op === 'reduce') {
      const amt = amount != null ? Number(amount) : NaN;
      const unitsValue = units != null ? Number(units) : null;
      const tDate = (trade_date && String(trade_date).trim()) || '';
      if (Number.isFinite(amt) && tDate) {
        try {
          // 检查是否有units字段，如果没有则添加
          try {
            db.prepare('SELECT units FROM position_records LIMIT 1').get();
          } catch (e) {
            // 字段不存在，添加字段
            db.exec('ALTER TABLE position_records ADD COLUMN units REAL');
          }
          
          db.prepare(
            `INSERT INTO position_records (user_id, fund_code, fund_name, op, amount, units, trade_date, period, prev_holding_units, prev_cost_per_unit, new_holding_units, new_cost_per_unit)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(userId, c, prevFundName, record_op, amt, unitsValue, tDate, (period && String(period).trim()) || '', prevHoldingUnits, prevCostPerUnit, holdingUnits, costPerUnit);
        } catch (err) {
          console.warn('Insert position record failed:', err);
        }
      }
    }

    res.json({
      success: true,
      message: '已更新持仓金额',
      shares: holdingUnits * costPerUnit,
      holding_units: holdingUnits,
      cost_per_unit: costPerUnit,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: String(e) });
  }
});

// 判断持仓记录是否仍可撤销（当日15:00前操作须在当日15:00前撤销，当日15:00后须在次日15:00前撤销）
function checkPositionRecordUndoDeadline(record) {
  const tradeDate = (record.trade_date || '').trim();
  if (!tradeDate) return true;
  const period = (record.period || '').trim().toLowerCase();
  let deadline;
  try {
    const d = new Date(tradeDate + 'T12:00:00');
    if (period === 'after15') {
      d.setDate(d.getDate() + 1);
      d.setHours(15, 0, 0, 0);
    } else {
      d.setHours(15, 0, 0, 0);
    }
    deadline = d.getTime();
  } catch (e) {
    return false;
  }
  return Date.now() < deadline;
}

// ---------- 持仓记录列表（加减仓记录）----------
router.get('/api/fund/position-records', loginRequired, (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    // 检查是否有units字段，如果没有则添加
    try {
      db.prepare('SELECT units FROM position_records LIMIT 1').get();
    } catch (e) {
      // 字段不存在，添加字段
      db.exec('ALTER TABLE position_records ADD COLUMN units REAL');
    }
    
    const rows = db.prepare(
      `SELECT id, fund_code, fund_name, op, amount, units, trade_date, period, prev_holding_units, prev_cost_per_unit, new_holding_units, new_cost_per_unit, created_at
       FROM position_records WHERE user_id = ? ORDER BY created_at DESC`
    ).all(userId);
    const records = rows.map((r) => ({
      id: r.id,
      fund_code: r.fund_code,
      fund_name: r.fund_name,
      op: r.op,
      amount: r.amount,
      units: r.units != null ? r.units : null,
      trade_date: r.trade_date,
      period: r.period,
      prev_holding_units: r.prev_holding_units,
      prev_cost_per_unit: r.prev_cost_per_unit,
      new_holding_units: r.new_holding_units,
      new_cost_per_unit: r.new_cost_per_unit,
      created_at: r.created_at,
      can_undo: checkPositionRecordUndoDeadline(r),
    }));
    res.json({ success: true, records });
  } catch (e) {
    res.status(500).json({ success: false, message: String(e) });
  }
});

// ---------- 撤销持仓记录（恢复当时持仓并删除记录，与原项目一致）----------
router.delete('/api/fund/position-records/:id', loginRequired, (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    const recordId = parseInt(req.params.id, 10);
    if (!Number.isInteger(recordId) || recordId < 1) {
      return res.status(400).json({ success: false, message: '无效的记录 ID' });
    }
    const rec = db.prepare('SELECT * FROM position_records WHERE id = ? AND user_id = ?').get(recordId, userId);
    if (!rec) {
      return res.status(404).json({ success: false, message: '记录不存在或无权操作' });
    }
    if (!checkPositionRecordUndoDeadline(rec)) {
      return res.status(400).json({
        success: false,
        message: '已过撤销截止时间（当日15:00前操作须在当日15:00前撤销，当日15:00后操作须在次日15:00前撤销），无法撤销',
      });
    }
    const prevUnits = Number(rec.prev_holding_units) || 0;
    const prevCost = Number(rec.prev_cost_per_unit) || 1;
    const shares = prevUnits * prevCost;
    const fundCode = rec.fund_code;
    const up = db.prepare(
      'UPDATE user_funds SET holding_units = ?, cost_per_unit = ?, shares = ? WHERE user_id = ? AND fund_code = ?'
    ).run(prevUnits, prevCost, shares, userId, fundCode);
    if (up.changes === 0) {
      return res.status(400).json({ success: false, message: '基金不存在，无法恢复' });
    }
    db.prepare('DELETE FROM position_records WHERE id = ?').run(recordId);
    res.json({ success: true, message: '已撤销并恢复持仓' });
  } catch (e) {
    res.status(500).json({ success: false, message: String(e) });
  }
});

// ---------- 分组 ----------
router.get('/api/fund/groups', loginRequired, (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    const rows = db.prepare('SELECT id, name, fund_codes, sort_order FROM fund_groups WHERE user_id = ? ORDER BY sort_order, id').all(userId);
    const groups = rows.map(r => ({
      id: r.id,
      name: r.name,
      fund_codes: r.fund_codes ? JSON.parse(r.fund_codes) : [],
      sort_order: r.sort_order,
    }));
    res.setHeader('Cache-Control', 'private, max-age=60'); // 1 分钟，变更分组后前端会 clearCache
    res.json({ success: true, groups });
  } catch (e) {
    res.status(500).json({ success: false, message: String(e) });
  }
});

router.post('/api/fund/groups', loginRequired, (req, res) => {
  try {
    const name = String((req.body.name || '').trim());
    if (!name) return res.status(400).json({ success: false, message: '请提供分组名称' });
    const userId = getCurrentUserId(req);
    getOrCreateDefaultGroup(userId);
    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM fund_groups WHERE user_id = ?').get(userId);
    const result = db.prepare('INSERT INTO fund_groups (user_id, name, fund_codes, sort_order) VALUES (?, ?, ?, ?)').run(userId, name, '[]', maxOrder.n);
    const groupId = result.lastInsertRowid;
    res.json({ success: true, message: '已创建分组', group_id: groupId });
  } catch (e) {
    res.status(500).json({ success: false, message: String(e) });
  }
});

function getOrCreateDefaultGroup(userId) {
  let row = db.prepare('SELECT id, name, fund_codes, sort_order FROM fund_groups WHERE user_id = ? AND sort_order = 0 LIMIT 1').get(userId);
  if (!row) {
    db.prepare('INSERT INTO fund_groups (user_id, name, fund_codes, sort_order) VALUES (?, ?, ?, 0)').run(userId, '默认', '[]');
    row = db.prepare('SELECT id, name, fund_codes, sort_order FROM fund_groups WHERE user_id = ? AND sort_order = 0 LIMIT 1').get(userId);
  }
  if (!row) return null;
  return { id: row.id, name: row.name, fund_codes: row.fund_codes, sort_order: row.sort_order };
}

/** 从分组对象取 fund_codes 数组（兼容 DB 字符串与已解析的数组） */
function groupFundCodes(g) {
  if (!g) return [];
  if (Array.isArray(g.fund_codes)) return g.fund_codes;
  if (typeof g.fund_codes === 'string') return g.fund_codes ? JSON.parse(g.fund_codes) : [];
  return [];
}

router.get('/api/fund/groups/:id', loginRequired, (req, res) => {
  const userId = getCurrentUserId(req);
  const row = db.prepare('SELECT id, name, fund_codes, sort_order FROM fund_groups WHERE user_id = ? AND id = ?').get(userId, req.params.id);
  if (!row) return res.status(404).json({ success: false, message: '分组不存在' });
  res.json({
    success: true,
    group: {
      id: row.id,
      name: row.name,
      fund_codes: row.fund_codes ? JSON.parse(row.fund_codes) : [],
      sort_order: row.sort_order,
    },
  });
});

router.put('/api/fund/groups/:id', loginRequired, (req, res) => {
  const userId = getCurrentUserId(req);
  const { name, fund_codes } = req.body || {};
  if (name === undefined && fund_codes === undefined) {
    return res.status(400).json({ success: false, message: '请提供 name 或 fund_codes' });
  }
  const row = db.prepare('SELECT id FROM fund_groups WHERE user_id = ? AND id = ?').get(userId, req.params.id);
  if (!row) return res.status(404).json({ success: false, message: '分组不存在' });
  if (name !== undefined) db.prepare('UPDATE fund_groups SET name = ? WHERE id = ?').run(String(name).trim(), req.params.id);
  if (fund_codes !== undefined) db.prepare('UPDATE fund_groups SET fund_codes = ? WHERE id = ?').run(JSON.stringify(fund_codes), req.params.id);
  res.json({ success: true, message: '已更新' });
});

router.delete('/api/fund/groups/:id', loginRequired, (req, res) => {
  const userId = getCurrentUserId(req);
  const row = db.prepare('SELECT id, sort_order FROM fund_groups WHERE user_id = ? AND id = ?').get(userId, req.params.id);
  if (!row) return res.status(400).json({ success: false, message: '分组不存在' });
  if (Number(row.sort_order) === 0) return res.status(400).json({ success: false, message: '默认分组不能删除' });
  db.prepare('DELETE FROM fund_groups WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: '已删除' });
});

router.post('/api/fund/groups/:id/funds', loginRequired, async (req, res) => {
  try {
    const code = String((req.body.code || req.body.fund_code || '').trim());
    if (!code) return res.status(400).json({ success: false, message: '请提供基金代码' });
    const userId = getCurrentUserId(req);
    getOrCreateDefaultGroup(userId);
    const existing = db.prepare('SELECT fund_code FROM user_funds WHERE user_id = ? AND fund_code = ?').get(userId, code);
    if (!existing) {
      let key = code;
      let name = `基金${code}`;
      const info = await fund123.searchFund(code);
      if (info) {
        if (info.fund_key != null && String(info.fund_key).trim() !== '') key = String(info.fund_key).trim();
        if (info.fund_name != null && String(info.fund_name).trim() !== '') name = String(info.fund_name).trim();
      }
      db.prepare(
        `INSERT INTO user_funds (user_id, fund_code, fund_key, fund_name, is_hold, shares, sectors, holding_units, cost_per_unit) VALUES (?, ?, ?, ?, 0, 0, '[]', 0, 1)`
      ).run(userId, code, key, name);
    }
    const gid = req.params.id;
    const group = db.prepare('SELECT id, fund_codes, sort_order FROM fund_groups WHERE user_id = ? AND id = ?').get(userId, gid);
    if (!group) return res.status(404).json({ success: false, message: '分组不存在' });
    const codes = group.fund_codes ? JSON.parse(group.fund_codes) : [];
    if (codes.includes(code)) return res.json({ success: true, message: '已在分组中' });
    codes.push(code);
    db.prepare('UPDATE fund_groups SET fund_codes = ? WHERE id = ?').run(JSON.stringify(codes), gid);
    const defaultGroup = getOrCreateDefaultGroup(userId);
    if (defaultGroup && String(defaultGroup.id) !== String(gid)) {
      const def = db.prepare('SELECT fund_codes FROM fund_groups WHERE id = ?').get(defaultGroup.id);
      const defCodes = def.fund_codes ? JSON.parse(def.fund_codes) : [];
      if (!defCodes.includes(code)) {
        defCodes.push(code);
        db.prepare('UPDATE fund_groups SET fund_codes = ? WHERE id = ?').run(JSON.stringify(defCodes), defaultGroup.id);
      }
    }
    res.json({ success: true, message: '已添加' });
  } catch (e) {
    res.status(500).json({ success: false, message: e && e.message ? e.message : String(e) });
  }
});

router.delete('/api/fund/groups/:id/funds/:code', loginRequired, (req, res) => {
  const userId = getCurrentUserId(req);
  const code = req.params.code;
  const group = db.prepare('SELECT id, fund_codes FROM fund_groups WHERE user_id = ? AND id = ?').get(userId, req.params.id);
  if (!group) return res.status(404).json({ success: false, message: '分组不存在' });
  const codes = (group.fund_codes ? JSON.parse(group.fund_codes) : []).filter(c => c !== code);
  db.prepare('UPDATE fund_groups SET fund_codes = ? WHERE id = ?').run(JSON.stringify(codes), req.params.id);
  const defaultGroup = getOrCreateDefaultGroup(userId);
  if (defaultGroup && String(defaultGroup.id) !== String(req.params.id)) {
    const def = db.prepare('SELECT fund_codes FROM fund_groups WHERE id = ?').get(defaultGroup.id);
    const defCodes = (def.fund_codes ? JSON.parse(def.fund_codes) : []).filter(c => c !== code);
    db.prepare('UPDATE fund_groups SET fund_codes = ? WHERE id = ?').run(JSON.stringify(defCodes), defaultGroup.id);
  }
  res.json({ success: true, message: '已移除' });
});

// ---------- 持仓表格（默认分组并集，拉取实时行情后合并持仓；holdOnly=1 时仅返回持有份额>0的基金）----------
router.get('/api/portfolio/table', loginRequired, async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    const holdOnly = req.query.holdOnly === '1' || req.query.holdOnly === true;
    const defaultGroup = getOrCreateDefaultGroup(userId);
    const groups = db.prepare('SELECT id, name, fund_codes, sort_order FROM fund_groups WHERE user_id = ? ORDER BY sort_order, id').all(userId);
    const ordered = defaultGroup ? [defaultGroup, ...groups.filter(g => g.id !== defaultGroup.id)] : groups;
    const groupParam = req.query.group;
    let codes = new Set();
    const defaultGid = defaultGroup ? defaultGroup.id : null;

    if (holdOnly) {
      // 持有基金：仅包含修改过持仓且持有份额>0的基金，自选添加不自动进入
      const holdingRows = db.prepare('SELECT fund_code, holding_units FROM user_funds WHERE user_id = ?').all(userId);
      for (const r of holdingRows) {
        const u = r.holding_units != null ? Number(r.holding_units) : 0;
        if (u > 0) codes.add(String(r.fund_code));
      }
    } else if (groupParam === undefined || groupParam === '' || String(groupParam) === String(defaultGid)) {
      for (const g of ordered) {
        groupFundCodes(g).forEach(c => codes.add(String(c)));
      }
      if (codes.size === 0) {
        const allRows = db.prepare('SELECT fund_code FROM user_funds WHERE user_id = ?').all(userId);
        allRows.forEach(r => codes.add(r.fund_code));
      }
    } else {
      const g = ordered.find(gg => String(gg.id) === String(groupParam));
      if (g) codes = new Set(groupFundCodes(g).map(String));
    }
    const fundRows = db.prepare('SELECT fund_code, fund_key, fund_name, sectors, shares, holding_units, cost_per_unit FROM user_funds WHERE user_id = ?').all(userId);
    const fundMapForSearch = {};
    const fundMapForHolding = {};
    for (const r of fundRows) {
      if (!codes.has(r.fund_code)) continue;
      const sectors = r.sectors ? JSON.parse(r.sectors) : [];
      const holdingUnits = r.holding_units != null ? r.holding_units : r.shares;
      const costPerUnit = r.cost_per_unit != null ? r.cost_per_unit : 1;
      fundMapForSearch[r.fund_code] = {
        fund_key: r.fund_key,
        fund_name: r.fund_name,
        sectors,
      };
      fundMapForHolding[r.fund_code] = {
        shares: (holdingUnits || 0) * (costPerUnit || 1),
        holding_units: holdingUnits || 0,
        cost_per_unit: costPerUnit || 1,
      };
    }
    function buildFallbackRows() {
      const list = [];
      for (const [code, r] of Object.entries(fundMapForHolding)) {
        const meta = fundRows.find(x => x.fund_code === code);
        const holding = (r.holding_units || 0) * (r.cost_per_unit || 1);
        list.push({
          code: String(code),
          name: meta ? String(meta.fund_name) : `基金${code}`,
          holding: Number(holding),
          estAmount: 0,
          estPct: 0,
          actualAmount: 0,
          actualPct: 0,
          cumulative: 0,
          netValue: '—',
          nowTime: '—',
          dayOfGrowth: '—',
          consecutiveInfo: '—',
          monthlyInfo: '—',
          holding_units: Number(r.holding_units) || 0,
          cost_per_unit: Number(r.cost_per_unit) || 1,
        });
      }
      return list;
    }

    const source = String(req.query.source || 'fund123').toLowerCase();
    // 一主一备：实际收益、实际涨跌、昨日涨幅、连涨/跌、近30天 以 fund123 为主、天天为备；切换数据源时仅更新 预估收益、预估涨跌、今日涨幅
    let rows = [];
    try {
      const [resultRows123, resultRowsTiantian] = await Promise.all([
        fundQuotes.searchCode(fundMapForSearch).catch(() => []),
        tiantianFund.searchCodeTiantian(fundMapForSearch).catch(() => []),
      ]);
      const byCode123 = new Map(resultRows123.map((r) => [r[0], r]));
      const byCodeTT = new Map(resultRowsTiantian.map((r) => [r[0], r]));
      const merged = [];
      for (const code of Object.keys(fundMapForSearch)) {
        const r123 = byCode123.get(code);
        const rTT = byCodeTT.get(code);
        // [code, name, nowTime, netValue, forecastGrowth, dayOfGrowth, consecutiveInfo, monthlyInfo]
        const name = (r123 && r123[1]) || (rTT && rTT[1]) || (fundMapForSearch[code] && fundMapForSearch[code].fund_name) || `基金${code}`;
        // 当前数据源优先；当天天无有效数据时用 fund123 回填，不显示 "—"/"N/A"
        const liveFromTT = source === 'tiantian' ? rTT : null;
        const liveFrom123 = r123;
        const nowTimeVal = (liveFromTT && liveFromTT[2] && String(liveFromTT[2]).trim() !== '—') ? liveFromTT[2] : (liveFrom123 && liveFrom123[2] && String(liveFrom123[2]).trim() !== '—' ? liveFrom123[2] : null);
        const nowTime = nowTimeVal || '—';
        const forecastVal = (liveFromTT && liveFromTT[4] && String(liveFromTT[4]).trim() !== 'N/A') ? liveFromTT[4] : (liveFrom123 && liveFrom123[4] && String(liveFrom123[4]).trim() !== 'N/A' ? liveFrom123[4] : null);
        const forecastGrowth = forecastVal || 'N/A';
        const netValuePrimary = r123 && r123[3] && String(r123[3]).trim() !== '—' ? r123[3] : null;
        const netValueBackup = rTT && rTT[3] && String(rTT[3]).trim() !== '—' ? rTT[3] : null;
        let netValue = netValuePrimary || netValueBackup || '—';
        // 仅天天有数据时用 估值(今日) 作为净值，使 实际收益/实际涨跌 能按今日估值显示
        if (!r123 && rTT && rTT[8] && String(rTT[8]).trim()) netValue = rTT[8];
        const dayGrowthPrimary = r123 && r123[5] && String(r123[5]).trim() !== '—' ? r123[5] : null;
        const dayGrowthBackup = rTT && rTT[5] && String(rTT[5]).trim() !== '—' ? rTT[5] : null;
        const dayOfGrowth = dayGrowthPrimary || dayGrowthBackup || '—';
        const consecutiveInfo = (r123 && r123[6] && String(r123[6]).trim() !== '—' ? r123[6] : null) || '—';
        const monthlyInfo = (r123 && r123[7] && String(r123[7]).trim() !== '—' ? r123[7] : null) || '—';
        merged.push([code, name, nowTime, netValue, forecastGrowth, dayOfGrowth, consecutiveInfo, monthlyInfo]);
      }
      merged.sort((a, b) => {
        const pctA = a[4] === 'N/A' ? -99 : parseFloat(String(a[4]).replace('%', ''));
        const pctB = b[4] === 'N/A' ? -99 : parseFloat(String(b[4]).replace('%', ''));
        return pctB - pctA;
      });
      rows = fundQuotes.buildPositionRows(merged, fundMapForHolding);
      if (rows.length === 0 && Object.keys(fundMapForHolding).length > 0) {
        rows = buildFallbackRows();
      }
    } catch (err) {
      if (Object.keys(fundMapForHolding).length > 0) {
        rows = buildFallbackRows();
      }
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ success: true, rows, total: rows.length });
  } catch (e) {
    res.status(500).json({ success: false, message: String(e) });
  }
});

router.get('/api/portfolio/fund-list', loginRequired, (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    const defaultGroup = getOrCreateDefaultGroup(userId);
    const groups = db.prepare('SELECT fund_codes FROM fund_groups WHERE user_id = ?').all(userId);
    const codes = new Set();
    for (const g of groups) {
      (g.fund_codes ? JSON.parse(g.fund_codes) : []).forEach(c => codes.add(c));
    }
    const fundMap = {};
    const rows = db.prepare('SELECT fund_code, fund_name FROM user_funds WHERE user_id = ?').all(userId);
    for (const r of rows) {
      if (codes.has(r.fund_code)) fundMap[r.fund_code] = r.fund_name || `基金${r.fund_code}`;
    }
    const funds = [...codes].sort().map(code => ({ code, name: fundMap[code] || `基金${code}` }));
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.json({ success: true, funds });
  } catch (e) {
    res.status(500).json({ success: false, message: String(e) });
  }
});

// ---------- 基金前10重仓（东方财富+腾讯行情，参考 hzm0321/real-time-fund）----------
router.get('/api/fund/holdings', loginRequired, async (req, res) => {
  try {
    const code = String(req.query.code || '').trim();
    if (!code) return res.status(400).json({ success: false, message: '请提供基金代码' });
    const list = await fundHoldings.getFundHoldings(code);
    res.setHeader('Cache-Control', 'private, max-age=120'); // 重仓变动不频繁，2 分钟
    res.json({ success: true, holdings: list });
  } catch (e) {
    res.status(500).json({ success: false, message: String(e) });
  }
});

// ---------- 图表数据（实时估值分时，优先从数据库读取，提高响应速度）----------
// ---------- 预加载所有持仓基金的图表数据（优化性能）----------
router.get('/api/fund/chart-data/preload', loginRequired, async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    const today = new Date().toISOString().slice(0, 10);
    
    // 获取用户所有持仓基金（holding_units > 0）
    const holdingFunds = db.prepare(
      `SELECT DISTINCT fund_code, fund_key, fund_name 
       FROM user_funds 
       WHERE user_id = ? AND holding_units > 0`
    ).all(userId);
    
    console.log(`[预加载API] 用户 ${userId} 有 ${holdingFunds.length} 只持仓基金`);
    
    if (holdingFunds.length === 0) {
      return res.json({
        success: true,
        chart_data_map: {},
      });
    }
    
    // 优化：批量查询，一次性获取所有数据，而不是循环查询
    const fundCodes = holdingFunds.map(f => f.fund_code);
    const placeholders = fundCodes.map(() => '?').join(',');
    
    const cachedRows = db.prepare(
      `SELECT fund_code, chart_data FROM fund_chart_data 
       WHERE fund_code IN (${placeholders}) AND date = ?`
    ).all(...fundCodes, today);
    
    // 创建基金代码到数据的映射
    const chartDataMap = {};
    const rowMap = new Map(cachedRows.map(row => [row.fund_code, row]));
    
    // 处理数据
    for (const fund of holdingFunds) {
      const cachedRow = rowMap.get(fund.fund_code);
      if (cachedRow && cachedRow.chart_data) {
        try {
          const chart_data = JSON.parse(cachedRow.chart_data);
          // 确保数据格式正确：只包含 labels, growth, net_values
          if (chart_data.labels && chart_data.growth && chart_data.labels.length > 0) {
            // 优化：压缩数据格式，减少传输大小
            chartDataMap[fund.fund_code] = {
              l: chart_data.labels || [],      // labels 简写
              g: chart_data.growth || [],      // growth 简写
              n: chart_data.net_values || [], // net_values 简写
            };
          }
        } catch (e) {
          console.warn(`[预加载API] 解析基金 ${fund.fund_code} 数据失败:`, e.message);
        }
      }
    }
    
    console.log(`[预加载API] 成功加载 ${Object.keys(chartDataMap).length} 只基金的图表数据`);
    
    // 设置缓存头
    res.set({
      'Cache-Control': 'private, max-age=300', // 5分钟缓存
      'Content-Type': 'application/json',
    });
    
    res.json({
      success: true,
      chart_data_map: chartDataMap,
    });
  } catch (e) {
    console.error('[预加载API] 预加载图表数据失败:', e);
    res.json({
      success: false,
      chart_data_map: {},
      error: String(e),
    });
  }
});

router.get('/api/fund/chart-data', loginRequired, async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: 'Missing fund code' });
  const userId = getCurrentUserId(req);
  const row = db.prepare('SELECT fund_key, fund_name FROM user_funds WHERE user_id = ? AND fund_code = ?').get(userId, code);
  if (!row) return res.status(400).json({ error: 'Fund not in user list' });
  const fundData = { fund_key: row.fund_key, fund_name: row.fund_name };
  
  // 获取今天的日期
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  
  // 检查数据库中是否有今天的数据
  const cachedRow = db.prepare(
    `SELECT chart_data, updated_at FROM fund_chart_data 
     WHERE fund_code = ? AND date = ?`
  ).get(code, todayStr);
  
  // 如果有数据，直接返回（定时任务会定期更新，不需要再从API获取）
  if (cachedRow && cachedRow.chart_data) {
    try {
      const chart_data = JSON.parse(cachedRow.chart_data);
      if (chart_data.labels && chart_data.labels.length > 0) {
        // 优化：压缩数据格式，减少传输大小
        const compressed = {
          l: chart_data.labels || [],
          g: chart_data.growth || [],
          n: chart_data.net_values || [],
        };
        
        // 设置缓存头
        const etag = `"${code}-${todayStr}-${cachedRow.updated_at}"`;
        res.set({
          'Cache-Control': 'private, max-age=300', // 5分钟缓存
          'ETag': etag,
          'Content-Type': 'application/json',
        });
        
        // 检查客户端缓存
        if (req.headers['if-none-match'] === etag) {
          return res.status(304).end();
        }
        
        return res.json({
          chart_data: compressed,
          fund_info: { code, name: row.fund_name },
        });
      }
    } catch (e) {
      // JSON解析失败，继续从API获取
    }
  }
  
  // 数据库中没有数据（可能是非交易时间或首次请求），从API获取
  try {
    const chart_data = await fundQuotes.getFundChartData(code, fundData);
    
    // 保存到数据库
    if (chart_data.labels && chart_data.labels.length > 0) {
      try {
        const chartDataJson = JSON.stringify(chart_data);
        db.prepare(
          `INSERT OR REPLACE INTO fund_chart_data (fund_code, fund_key, date, chart_data, updated_at)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).run(code, row.fund_key, todayStr, chartDataJson);
      } catch (dbErr) {
        console.warn('保存图表数据到数据库失败:', dbErr);
      }
    }
    
    // 优化：压缩数据格式
    const compressed = {
      l: chart_data.labels || [],
      g: chart_data.growth || [],
      n: chart_data.net_values || [],
    };
    
    res.set({
      'Cache-Control': 'private, max-age=300',
      'Content-Type': 'application/json',
    });
    
    res.json({
      chart_data: compressed,
      fund_info: { code, name: row.fund_name },
    });
  } catch (e) {
    res.json({
      chart_data: { l: [], g: [], n: [] },
      fund_info: { code, name: row.fund_name },
    });
  }
});

router.post('/api/fund/chart-default', loginRequired, (req, res) => {
  const fundCode = req.body && req.body.fund_code;
  if (!fundCode) return res.status(400).json({ error: 'Missing fund code' });
  const userId = getCurrentUserId(req);
  db.prepare('UPDATE user_funds SET chart_default = 0 WHERE user_id = ?').run(userId);
  db.prepare('UPDATE user_funds SET chart_default = 1 WHERE user_id = ? AND fund_code = ?').run(userId, fundCode);
  res.json({ success: true });
});

// ---------- 行业板块（与原项目 api_sectors / api_sector/:id 一致）----------
router.get('/api/sectors', loginRequired, async (req, res) => {
  try {
    const sectors = await sectorEastMoney.fetchSectorsList();
    res.json({ success: true, data: sectors });
  } catch (e) {
    console.error('获取行业板块失败:', e.message);
    res.status(500).json({ success: false, message: '数据加载失败', data: [] });
  }
});

router.get('/api/sector-list', loginRequired, (req, res) => {
  try {
    res.json({ success: true, list: sectorEastMoney.bkList });
  } catch (e) {
    res.status(500).json({ success: false, message: String(e.message), list: [] });
  }
});

router.get('/api/sector/:sector_id', loginRequired, async (req, res) => {
  try {
    const sectorId = req.params.sector_id;
    const bkCode = sectorEastMoney.getBkCode(sectorId);
    if (!bkCode) {
      return res.status(400).json({ success: false, message: '无效的板块ID或名称', data: [] });
    }
    const bkName = sectorEastMoney.getBkName(sectorId);
    const { results } = await sectorEastMoney.fetchSectorFunds(bkCode);
    res.json({
      success: true,
      data: results.map((row) => ({
        code: row[0],
        name: row[1],
        net_value: row[4],
        day_growth: row[5],
        estimated_growth: row[5],
      })),
      bk_name: bkName,
    });
  } catch (e) {
    console.error('获取板块基金失败:', e.message);
    res.status(500).json({ success: false, message: String(e.message), data: [] });
  }
});

// ---------- 市场指数（与原项目 api_indices_global 一致）----------
router.get('/api/indices/global', loginRequired, async (req, res) => {
  try {
    const data = await marketIndices.fetchGlobalIndices();
    res.json({ success: true, data });
  } catch (e) {
    console.error('获取全球指数失败:', e.message);
    res.status(500).json({ success: false, message: '数据加载失败', data: [] });
  }
});

router.get('/api/timing', loginRequired, async (req, res) => {
  try {
    const data = await marketIndices.fetchTimingChartData();
    if (data.prices && data.prices.length > 0) {
      data.current_price = data.prices[data.prices.length - 1];
      data.change = data.change_amounts && data.change_amounts.length > 0 ? data.change_amounts[data.change_amounts.length - 1] : 0;
      data.change_pct = data.change_pcts && data.change_pcts.length > 0 ? data.change_pcts[data.change_pcts.length - 1] : 0;
    }
    res.json({ success: true, data });
  } catch (e) {
    console.error('获取上证分时失败:', e.message);
    res.status(500).json({ success: false, message: '数据加载失败', data: {} });
  }
});

// ---------- 贵金属行情（与原项目 api_gold_realtime / api_gold_history 一致）----------
router.get('/api/gold/real-time', loginRequired, async (req, res) => {
  try {
    const gold_data = await preciousMetals.fetchRealTimeGold();
    res.json({ success: true, data: gold_data });
  } catch (e) {
    console.error('获取实时金价失败:', e.message);
    res.status(500).json({ success: false, message: '数据加载失败', data: [] });
  }
});

router.get('/api/gold/history', loginRequired, async (req, res) => {
  try {
    const gold_history = await preciousMetals.fetchGoldHistory();
    res.json({ success: true, data: gold_history });
  } catch (e) {
    console.error('获取历史金价失败:', e.message);
    res.status(500).json({ success: false, message: '数据加载失败', data: [] });
  }
});

router.get('/api/gold/one-day', loginRequired, async (req, res) => {
  try {
    const data = await preciousMetals.fetchGoldOneDay();
    res.json({ success: true, data });
  } catch (e) {
    console.error('获取分时金价失败:', e.message);
    res.status(500).json({ success: false, message: '数据加载失败', data: [] });
  }
});

// ---------- 用户管理（仅管理员，与原项目 admin_bp 一致）----------
router.get('/api/admin/users', loginRequired, adminRequired, (req, res) => {
  try {
    const rows = db.prepare('SELECT id, username, is_admin, created_at FROM users ORDER BY id ASC').all();
    const users = rows.map((u) => ({
      id: u.id,
      username: u.username,
      is_admin: Boolean(u.is_admin),
      created_at: u.created_at || '',
    }));
    res.json({ users });
  } catch (e) {
    console.error('获取用户列表失败:', e.message);
    res.status(500).json({ error: String(e.message) });
  }
});

router.post('/api/admin/add-user', loginRequired, adminRequired, (req, res) => {
  try {
    const { username: rawUsername = '', password = '' } = req.body || {};
    const username = String(rawUsername).trim();
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '请输入用户名和密码' });
    }
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ success: false, message: '用户名长度应为 3–20 个字符' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: '密码长度至少为 6 个字符' });
    }
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (exists) {
      return res.status(400).json({ success: false, message: '用户名已存在' });
    }
    const password_hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 0)').run(username, password_hash);
    const user_id = result && result.lastInsertRowid != null ? result.lastInsertRowid : 0;
    res.json({ success: true, message: `用户 ${username} 已创建`, user_id });
  } catch (e) {
    console.error('创建用户失败:', e.message);
    res.status(500).json({ success: false, message: String(e.message) });
  }
});

router.post('/api/admin/delete-user', loginRequired, adminRequired, (req, res) => {
  try {
    const data = req.body || {};
    const user_id = data.user_id != null ? Number(data.user_id) : null;
    const username = (data.username || '').trim() || null;
    const currentId = getCurrentUserId(req);
    if (user_id == null && !username) {
      return res.status(400).json({ success: false, message: '请提供 user_id 或 username' });
    }
    const target = user_id != null
      ? db.prepare('SELECT id, username, is_admin FROM users WHERE id = ?').get(user_id)
      : db.prepare('SELECT id, username, is_admin FROM users WHERE username = ?').get(username);
    if (!target) {
      return res.status(400).json({ success: false, message: '用户不存在' });
    }
    if (Number(target.id) === currentId) {
      return res.status(400).json({ success: false, message: '不能删除当前登录账号' });
    }
    if (target.is_admin) {
      return res.status(400).json({ success: false, message: '不能删除管理员账号' });
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
    res.json({ success: true, message: `已删除用户 ${target.username}` });
  } catch (e) {
    console.error('删除用户失败:', e.message);
    res.status(500).json({ success: false, message: String(e.message) });
  }
});

router.post('/api/admin/update-profile', loginRequired, adminRequired, (req, res) => {
  try {
    const { new_username: rawNewUsername, new_password: new_password_raw } = req.body || {};
    const new_username = rawNewUsername != null ? String(rawNewUsername).trim() || null : null;
    const new_password = new_password_raw != null && String(new_password_raw).length > 0 ? String(new_password_raw) : null;
    const user_id = getCurrentUserId(req);
    if (!new_username && !new_password) {
      return res.status(400).json({ success: false, message: '请提供新用户名或新密码' });
    }
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(user_id);
    if (!user) {
      return res.status(400).json({ success: false, message: '用户不存在' });
    }
    if (new_username) {
      if (new_username.length < 3 || new_username.length > 20) {
        return res.status(400).json({ success: false, message: '用户名长度应为 3–20 个字符' });
      }
      const taken = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(new_username, user_id);
      if (taken) {
        return res.status(400).json({ success: false, message: '该用户名已被使用' });
      }
      db.prepare('UPDATE users SET username = ? WHERE id = ?').run(new_username, user_id);
      req.session.username = new_username;
    }
    if (new_password) {
      if (new_password.length < 6) {
        return res.status(400).json({ success: false, message: '密码长度至少为 6 个字符' });
      }
      const password_hash = bcrypt.hashSync(new_password, 10);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, user_id);
    }
    res.json({ success: true, message: '修改成功' });
  } catch (e) {
    console.error('修改资料失败:', e.message);
    res.status(500).json({ success: false, message: String(e.message) });
  }
});

// ---------- 市场行情：7*24 快讯（与原项目 fund.kx / kx_html 一致，数据源百度财经）----------
router.get('/api/market/kx', loginRequired, async (req, res) => {
  const count = Math.min(Number(req.query.count) || 20, 50);
  const pn = Number(req.query.pn) || 0;
  const cacheKey = cache.keyMarketKx(count, pn);
  const cached = cache.get(cacheKey, cache.DEFAULT_TTL_MS.marketKx);
  if (cached && Array.isArray(cached)) {
    return res.json({ success: true, list: cached });
  }
  try {
    const { data } = await axios.get(
      `https://finance.pae.baidu.com/selfselect/expressnews`,
      {
        params: { rn: count, pn, tag: 'A股', finClientType: 'pc' },
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36' },
        validateStatus: () => true,
      }
    );
    if (!data || data.ResultCode !== '0' || !data.Result?.content?.list) {
      return res.json({ success: true, list: [] });
    }
    const list = data.Result.content.list.map((v) => {
      const publish_time = v.publish_time;
      const timeStr = publish_time
        ? new Date(publish_time * 1000).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '';
      const title = v.title || (v.content?.items?.[0]?.data) || '';
      const evaluate = v.evaluate || '';
      const entity = (v.entity || []).map((x) => `${(x.code || '').trim()}-${(x.name || '').trim()} ${(x.ratio || '').trim()}`).filter(Boolean).join(', ');
      return { time: timeStr, evaluate, title, entity };
    });
    cache.set(cacheKey, list);
    res.json({ success: true, list });
  } catch (e) {
    console.error('7*24快讯获取失败:', e.message);
    res.json({ success: false, message: '加载失败', list: [] });
  }
});

// ---------- 北京时间 ----------
router.get('/api/time/beijing', (req, res) => {
  const now = new Date();
  const cn = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const hour = cn.getHours();
  const minute = cn.getMinutes();
  res.json({
    datetime: cn.toISOString(),
    date: cn.toISOString().slice(0, 10),
    time: cn.toTimeString().slice(0, 8),
    hour,
    minute,
    is_before_930: hour < 9 || (hour === 9 && minute < 30),
  });
});

// ---------- 根据交易规则获取净值（三点前用当日净值，三点后用次日净值）----------
router.get('/api/fund/net-value', loginRequired, async (req, res) => {
  try {
    const { code, trade_date, period } = req.query;
    if (!code || !trade_date) {
      return res.status(400).json({ success: false, message: '请提供基金代码和交易日期' });
    }
    
    const userId = getCurrentUserId(req);
    const fundRow = db.prepare('SELECT fund_key FROM user_funds WHERE user_id = ? AND fund_code = ?').get(userId, code);
    if (!fundRow) {
      return res.status(404).json({ success: false, message: '基金不存在' });
    }
    
    const fundKey = fundRow.fund_key || code;
    const isAfter15 = period === 'after15';
    
    // 根据交易规则确定需要获取的净值日期
    // 三点前：使用当日净值
    // 三点后：使用次日净值
    let targetDate = trade_date;
    if (isAfter15) {
      // 三点后，需要次日净值
      const date = new Date(trade_date);
      date.setDate(date.getDate() + 1);
      targetDate = date.toISOString().slice(0, 10);
    }
    
    // 获取历史曲线数据
    const curves = await fund123.queryFundQuotationCurves(fundKey);
    
    // 查找目标日期的净值
    // 历史曲线数据格式：{ date: '2024-02-12', rate: 1.2345, ... }
    let netValue = null;
    const targetDateStr = targetDate.replace(/-/g, '');
    
    // 尝试从历史曲线中查找
    for (const point of curves) {
      let pointDate = null;
      if (point.date) {
        // 日期格式可能是 '2024-02-12' 或 '20240212'
        pointDate = String(point.date).replace(/-/g, '');
      }
      if (pointDate === targetDateStr) {
        // 如果有 netValue 字段，使用它；否则尝试从 rate 计算
        if (point.netValue != null) {
          netValue = parseFloat(point.netValue);
        } else if (point.rate != null) {
          // rate 可能是涨跌幅，需要结合基准值计算
          // 这里先尝试直接使用 rate，如果不行再尝试其他方法
          netValue = parseFloat(point.rate);
        }
        if (netValue != null && !isNaN(netValue) && netValue > 0) {
          break;
        }
      }
    }
    
    // 如果历史数据中没有找到，尝试获取最新净值
    if (netValue == null || isNaN(netValue) || netValue <= 0) {
      const matiaria = await fund123.getMatiaria(code);
      if (matiaria && matiaria.netValueNum != null && matiaria.netValueNum > 0) {
        netValue = matiaria.netValueNum;
      }
    }
    
    if (netValue == null || isNaN(netValue) || netValue <= 0) {
      return res.status(404).json({ success: false, message: '无法获取该日期的净值，请稍后重试' });
    }
    
    res.setHeader('Cache-Control', 'private, max-age=86400'); // 历史净值不变，缓存 24 小时
    res.json({
      success: true,
      netValue: netValue,
      tradeDate: trade_date,
      targetDate: targetDate,
      period: period || 'before15',
    });
  } catch (e) {
    console.error('获取净值失败:', e);
    res.status(500).json({ success: false, message: String(e) });
  }
});

module.exports = router;
