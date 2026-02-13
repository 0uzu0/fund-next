/**
 * 数值与金额格式化工具（持仓页等复用）
 */

export function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(n: number): string {
  const x = toNum(n);
  const s = x >= 0 ? `+¥${x.toFixed(2)}` : `-¥${Math.abs(x).toFixed(2)}`;
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatPct(n: number): string {
  const x = toNum(n);
  return x >= 0 ? `+${x.toFixed(2)}%` : `${x.toFixed(2)}%`;
}

export function formatYuan(n: number): string {
  const x = toNum(n);
  return '¥' + x.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
