/**
 * 持仓页工具函数：净值解析、日期计算、待加仓/待减仓 localStorage 读写
 * 供 portfolio、EditHoldingModal、加仓减仓等复用
 */

/** 从展示字符串（如 "1.2345(02-15)"）解析出净值数字 */
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

/**
 * 是否“次日9:30之后估值数据未更新”：当前时间已过当日 9:30 且估值日期早于当日则视为未更新，应显示 "-"
 */
export function isEstimateStale(estimateDate: string | undefined): boolean {
  const now = new Date();
  const today = getTodayStr();
  const hour = now.getHours();
  const min = now.getMinutes();
  const afterCutoff = hour > 9 || (hour === 9 && min >= 30);
  if (!afterCutoff) return false;
  if (!estimateDate || String(estimateDate).trim() === '') return true;
  return String(estimateDate).trim() < today;
}

/**
 * 获取昨天的日期字符串 YYYY-MM-DD
 */
export function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * 是否应显示实际收益/涨跌数据
 * 规则：净值日期为今天或昨天时显示，持续到次日9:30前
 * @param netValueDate 净值日期字符串（格式：YYYY-MM-DD 或 MM-DD）
 */
export function shouldShowActualData(netValueDate: string | undefined): boolean {
  if (!netValueDate || String(netValueDate).trim() === '' || netValueDate === '—') return false;
  const today = getTodayStr();
  const yesterday = getYesterdayStr();
  const dateStr = String(netValueDate).trim();
  // 支持 YYYY-MM-DD 或 MM-DD 格式
  if (dateStr === today || dateStr === yesterday) return true;
  // 如果是 MM-DD 格式，补全年份后比较
  if (/^\d{2}-\d{2}$/.test(dateStr)) {
    const currentYear = new Date().getFullYear();
    const fullDate = `${currentYear}-${dateStr}`;
    if (fullDate === today || fullDate === yesterday) return true;
  }
  return false;
}

/** 从输入中解析基金代码（支持 "123456" 或 "123456 - 名称"） */
export function parseCodeFromInput(val: string): string {
  const t = val.trim();
  // 匹配5-6位数字的基金代码
  if (/^\d{5,6}$/.test(t)) return t;
  const m = t.match(/^(\d{5,6})\s*[-–—]\s*/);
  if (m) return m[1];
  return t;
}

/** 从输入中解析基金名称（支持 "123456" 或 "123456 - 名称"） */
export function parseNameFromInput(val: string): string | null {
  const t = val.trim();
  // 匹配 "123456 - 名称" 或 "001001 - 华夏债券A/B" 格式
  // 基金代码可能是5-6位数字
  const m = t.match(/^\d{5,6}\s*[-–—]\s*(.+)$/);
  if (m) return m[1].trim();
  return null;
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
