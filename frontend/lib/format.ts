/**
 * 数值与金额格式化工具（持仓、自选、汇总栏等复用）
 * 统一 toNum 安全转数字，formatMoney/formatPct/formatYuan 用于展示
 */

/** 安全转为数字，非数字或 NaN 返回 0 */
export function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 带正负号的金额，如 +¥1,234.56 / -¥100.00 */
export function formatMoney(n: number): string {
  const x = toNum(n);
  const s = x >= 0 ? `+¥${x.toFixed(2)}` : `-¥${Math.abs(x).toFixed(2)}`;
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 百分比，如 +1.23% / -0.50% */
export function formatPct(n: number): string {
  const x = toNum(n);
  return x >= 0 ? `+${x.toFixed(2)}%` : `${x.toFixed(2)}%`;
}

/** 纯金额，如 ¥1,234.56（无正负号） */
export function formatYuan(n: number): string {
  const x = toNum(n);
  return '¥' + x.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
