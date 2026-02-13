/**
 * 持仓页相关类型定义
 */

export type FundRow = {
  code: string;
  name: string;
  holding: number;
  estAmount: number;
  estPct: number;
  actualAmount: number;
  actualPct: number;
  cumulative: number;
  netValue?: string;
  nowTime?: string;
  dayOfGrowth?: string;
  consecutiveInfo?: string;
  monthlyInfo?: string;
  holding_units?: number;
  cost_per_unit?: number;
};

export type Summary = {
  totalHolding: number;
  todayEstChange: number;
  todayEstPct: number;
  todayActualText: string;
  todayActual: number;
  cumulative: number;
};

export type Group = {
  id: number;
  name: string;
  fund_codes: string[];
  sort_order: number;
};

export type DataSourceOption = 'fund123' | 'tiantian';

/** 持有基金行（含展示用持仓金额） */
export type HoldingRow = FundRow & { displayHolding: number };
