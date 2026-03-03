/**
 * 持仓页工具函数：净值解析、日期计算、待加仓/待减仓 localStorage 读写
 * 供 portfolio、EditHoldingModal、加仓减仓等复用
 */

// 2024-2026年A股节假日（日期格式：YYYY-MM-DD）
// 来源：沪深交易所公告
const HOLIDAYS_2024 = [
  '2024-01-01', // 元旦
  '2024-02-09', '2024-02-10', '2024-02-11', '2024-02-12', '2024-02-13', '2024-02-14', '2024-02-15', '2024-02-16', '2024-02-17', // 春节
  '2024-04-04', '2024-04-05', '2024-04-06', // 清明
  '2024-05-01', '2024-05-02', '2024-05-03', '2024-05-04', '2024-05-05', // 劳动节
  '2024-06-08', '2024-06-09', '2024-06-10', // 端午
  '2024-09-15', '2024-09-16', '2024-09-17', // 中秋
  '2024-10-01', '2024-10-02', '2024-10-03', '2024-10-04', '2024-10-05', '2024-10-06', '2024-10-07', // 国庆
];

const HOLIDAYS_2025 = [
  '2025-01-01', // 元旦
  '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04', // 春节
  '2025-04-04', '2025-04-05', '2025-04-06', // 清明
  '2025-05-01', '2025-05-02', '2025-05-03', '2025-05-04', '2025-05-05', // 劳动节
  '2025-05-31', '2025-06-01', '2025-06-02', // 端午
  '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04', '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08', // 国庆+中秋
];

const HOLIDAYS_2026 = [
  '2026-01-01', '2026-01-02', '2026-01-03', // 元旦
  '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22', // 春节
  '2026-04-05', '2026-04-06', '2026-04-07', // 清明
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05', // 劳动节
  '2026-05-31', '2026-06-01', '2026-06-02', // 端午
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', // 国庆+中秋
];

const ALL_HOLIDAYS = new Set([...HOLIDAYS_2024, ...HOLIDAYS_2025, ...HOLIDAYS_2026]);

/** 判断某日期是否为交易日（排除周末和节假日） */
export function isTradingDay(date: Date = new Date()): boolean {
  const day = date.getDay();
  // 0=周日, 6=周六
  if (day === 0 || day === 6) return false;
  const dateStr = date.toISOString().slice(0, 10);
  if (ALL_HOLIDAYS.has(dateStr)) return false;
  return true;
}

/** 判断当前是否处于交易时段（9:30-15:00，交易日） */
export function isInTradingHours(): boolean {
  if (!isTradingDay()) return false;
  const now = new Date();
  const hour = now.getHours();
  const min = now.getMinutes();
  const timeNum = hour * 100 + min;
  // 9:30-11:30, 13:00-15:00
  return (timeNum >= 930 && timeNum <= 1130) || (timeNum >= 1300 && timeNum <= 1500);
}

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
 * 是否应隐藏预估数据
 * 规则：
 * 1. 非交易日（周末/节假日）时隐藏
 * 2. 交易日 0:00-9:30 尚未开盘，隐藏
 * 3. 交易日 9:30-24:00 显示（若估值日期为今天）
 */
export function isEstimateStale(estimateDate: string | undefined): boolean {
  // 非交易日（周末/节假日）时隐藏预估数据
  if (!isTradingDay()) return true;

  const now = new Date();
  const today = getTodayStr();
  const hour = now.getHours();
  const min = now.getMinutes();
  const afterCutoff = hour > 9 || (hour === 9 && min >= 30);

  // 交易日 0:00-9:30 尚未开盘，隐藏预估数据
  if (!afterCutoff) return true;

  // 交易日 9:30-24:00，估值日期为空或早于今天则隐藏
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
 * 判断当前是否在交易日的9:30之后
 * 周末不算交易日
 */
function isAfterMarketOpen(): boolean {
  const now = new Date();
  const day = now.getDay();
  // 周末不是交易日
  if (day === 0 || day === 6) return false;
  
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeNum = hours * 100 + minutes;
  // 9:30 之后
  return timeNum >= 930;
}

/**
 * 是否应显示实际收益/涨跌数据
 * 
 * 显示规则：
 * - 净值日期是今天：显示（今天净值已发布）
 * - 净值日期是昨天：
 *   - 交易日9:30之前：显示（昨天净值，今天还没开盘）
 *   - 交易日9:30之后：不显示（等今天净值发布，期间显示"—"）
 * - 非交易日：显示昨天的净值
 * 
 * @param netValueDate 净值日期字符串（格式：YYYY-MM-DD 或 MM-DD）
 */
export function shouldShowActualData(netValueDate: string | undefined): boolean {
  if (!netValueDate || String(netValueDate).trim() === '' || netValueDate === '—') return false;
  
  const today = getTodayStr();
  const yesterday = getYesterdayStr();
  const dateStr = String(netValueDate).trim();
  
  // 解析日期，支持 YYYY-MM-DD 或 MM-DD 格式
  let normalizedDate = dateStr;
  if (/^\d{2}-\d{2}$/.test(dateStr)) {
    const currentYear = new Date().getFullYear();
    normalizedDate = `${currentYear}-${dateStr}`;
  }
  
  // 净值日期是今天：说明今天净值已发布，显示
  if (normalizedDate === today) return true;
  
  // 净值日期是昨天：
  // - 交易日9:30前：显示昨天的净值
  // - 交易日9:30后：不显示（等今天净值）
  if (normalizedDate === yesterday) {
    // 如果是交易日且已过9:30，不显示昨天的数据
    if (isAfterMarketOpen()) {
      return false;
    }
    return true;
  }
  
  // 净值日期既不是今天也不是昨天：不显示
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