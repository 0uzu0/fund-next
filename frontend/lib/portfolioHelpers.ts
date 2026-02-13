/**
 * 持仓页工具函数：净值解析、日期、待加仓/待减仓本地存储等
 */

export function parseNetValue(s: string | undefined): number {
  if (s == null || s === '' || s === '—') return 0;
  const parts = String(s).split('(');
  const n = parseFloat(parts[0]);
  return Number.isFinite(n) ? n : 0;
}

export function addDaysToDate(ymd: string, days: number): string {
  const d = new Date(ymd + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 从输入中解析基金代码（支持 "123456" 或 "123456 - 名称"） */
export function parseCodeFromInput(val: string): string {
  const t = val.trim();
  if (/^\d{6}$/.test(t)) return t;
  const m = t.match(/^(\d{6})\s*[-–—]\s*/);
  if (m) return m[1];
  return t;
}

export const PENDING_ADD_KEY = 'lan_fund_pending_adds';
export const PENDING_REDUCE_KEY = 'lan_fund_pending_reduces';

export interface PendingItem {
  fundCode: string;
  amount: number;
  settlementDate: string;
}

export function loadPendingAdds(): PendingItem[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(PENDING_ADD_KEY) : null;
    const list: PendingItem[] = raw ? JSON.parse(raw) : [];
    const today = getTodayStr();
    const still = list.filter((p) => (p.settlementDate || '') > today);
    if (still.length !== list.length && typeof window !== 'undefined') {
      localStorage.setItem(PENDING_ADD_KEY, JSON.stringify(still));
    }
    return still;
  } catch {
    return [];
  }
}

export function loadPendingReduces(): PendingItem[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(PENDING_REDUCE_KEY) : null;
    const list: PendingItem[] = raw ? JSON.parse(raw) : [];
    const today = getTodayStr();
    const still = list.filter((p) => (p.settlementDate || '') > today);
    if (still.length !== list.length && typeof window !== 'undefined') {
      localStorage.setItem(PENDING_REDUCE_KEY, JSON.stringify(still));
    }
    return still;
  } catch {
    return [];
  }
}
