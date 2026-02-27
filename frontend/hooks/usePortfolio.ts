/**
 * 持仓相关业务 Hooks
 * 封装持仓数据的获取、缓存、状态管理
 */
import { useCallback, useState, useMemo } from 'react';
import { useApi, usePollingApi } from './useApi';
import { api } from '../services/api';
import type {
  PortfolioRow,
  PortfolioTableResponse,
  PortfolioSummary,
  FundSearchResult,
  FundGroup,
  GroupsResponse,
} from '../types';

// ==================== 持仓表格 Hook ====================

/**
 * 持仓表格数据 Hook
 */
export function usePortfolioTable(options?: {
  group?: string;
  holdOnly?: boolean;
  source?: string;
}) {
  const params = new URLSearchParams();
  if (options?.group) params.set('group', options.group);
  if (options?.holdOnly) params.set('holdOnly', '1');
  if (options?.source) params.set('source', options.source);

  const endpoint = `/api/portfolio/table?${params.toString()}`;

  const { data, error, isLoading, refresh } = useApi<PortfolioTableResponse>(endpoint, {
    cache: { ttl: 2 * 60 * 1000 },
  });

  const rows: PortfolioRow[] = data?.rows || [];

  // 计算汇总数据
  const summary: PortfolioSummary = useMemo(() => {
    let totalHolding = 0;
    let totalEstAmount = 0;
    let totalActualAmount = 0;
    let totalCumulative = 0;

    for (const row of rows) {
      const holding = Number(row.holding) || 0;
      const estAmount = Number(row.estAmount) || 0;
      const actualAmount = Number(row.actualAmount) || 0;
      const cumulative = Number(row.cumulative) || 0;

      totalHolding += holding;
      totalEstAmount += estAmount;
      totalActualAmount += actualAmount;
      totalCumulative += cumulative;
    }

    const totalEstProfit = totalEstAmount - totalHolding;
    const totalActualProfit = totalActualAmount - totalHolding;
    const totalEstPct = totalHolding > 0 ? (totalEstProfit / totalHolding) * 100 : 0;
    const totalActualPct = totalHolding > 0 ? (totalActualProfit / totalHolding) * 100 : 0;

    return {
      totalHolding,
      totalEstAmount,
      totalEstProfit,
      totalEstPct,
      totalActualAmount,
      totalActualProfit,
      totalActualPct,
      totalCumulative,
    };
  }, [rows]);

  return {
    rows,
    summary,
    total: data?.total || 0,
    error,
    isLoading,
    refresh,
  };
}

/**
 * 轮询持仓表格数据 Hook
 */
export function usePollingPortfolioTable(
  options?: {
    group?: string;
    holdOnly?: boolean;
    source?: string;
  },
  interval: number = 60000
) {
  const params = new URLSearchParams();
  if (options?.group) params.set('group', options.group);
  if (options?.holdOnly) params.set('holdOnly', '1');
  if (options?.source) params.set('source', options.source);

  const endpoint = `/api/portfolio/table?${params.toString()}`;

  const { data, error, isLoading, refresh } = usePollingApi<PortfolioTableResponse>(
    endpoint,
    interval,
    { cache: { ttl: 2 * 60 * 1000 } }
  );

  const rows: PortfolioRow[] = data?.rows || [];

  const summary: PortfolioSummary = useMemo(() => {
    let totalHolding = 0;
    let totalEstAmount = 0;
    let totalActualAmount = 0;
    let totalCumulative = 0;

    for (const row of rows) {
      totalHolding += Number(row.holding) || 0;
      totalEstAmount += Number(row.estAmount) || 0;
      totalActualAmount += Number(row.actualAmount) || 0;
      totalCumulative += Number(row.cumulative) || 0;
    }

    return {
      totalHolding,
      totalEstAmount,
      totalEstProfit: totalEstAmount - totalHolding,
      totalEstPct: totalHolding > 0 ? ((totalEstAmount - totalHolding) / totalHolding) * 100 : 0,
      totalActualAmount,
      totalActualProfit: totalActualAmount - totalHolding,
      totalActualPct: totalHolding > 0 ? ((totalActualAmount - totalHolding) / totalHolding) * 100 : 0,
      totalCumulative,
    };
  }, [rows]);

  return {
    rows,
    summary,
    total: data?.total || 0,
    error,
    isLoading,
    refresh,
  };
}

// ==================== 基金列表 Hook ====================

/**
 * 基金列表 Hook（用于图表选择器）
 */
export function useFundList() {
  const { data, error, isLoading, refresh } = useApi<{ success: boolean; funds?: FundSearchResult[] }>(
    '/api/portfolio/fund-list',
    { cache: { ttl: 5 * 60 * 1000 } }
  );

  const funds: FundSearchResult[] = data?.funds || [];

  return {
    funds,
    error,
    isLoading,
    refresh,
  };
}

// ==================== 分组管理 Hook ====================

/**
 * 分组列表 Hook
 */
export function useGroups() {
  const { data, error, isLoading, refresh } = useApi<GroupsResponse>(
    '/api/fund/groups',
    { cache: { ttl: 10 * 60 * 1000 } }
  );

  const groups: FundGroup[] = data?.groups || [];

  return {
    groups,
    error,
    isLoading,
    refresh,
  };
}

/**
 * 分组操作 Hook
 */
export function useGroupOperations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createGroup = useCallback(async (name: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.group.create(name);
      if (!response.success) {
        setError(response.message || '创建失败');
      }
      // 清除分组缓存
      api.cache.clearFundCache();
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建失败';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, []);

  const updateGroup = useCallback(async (id: number, data: { name?: string; fund_codes?: string[] }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.group.update(id, data);
      if (!response.success) {
        setError(response.message || '更新失败');
      }
      api.cache.clearFundCache();
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : '更新失败';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteGroup = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.group.delete(id);
      if (!response.success) {
        setError(response.message || '删除失败');
      }
      api.cache.clearFundCache();
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除失败';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, []);

  const addFundToGroup = useCallback(async (groupId: number, code: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.group.addFund(groupId, code);
      if (!response.success) {
        setError(response.message || '添加失败');
      }
      api.cache.clearFundCache();
      api.cache.clearPortfolioCache();
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : '添加失败';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, []);

  const removeFundFromGroup = useCallback(async (groupId: number, code: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.group.removeFund(groupId, code);
      if (!response.success) {
        setError(response.message || '移除失败');
      }
      api.cache.clearFundCache();
      api.cache.clearPortfolioCache();
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : '移除失败';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    createGroup,
    updateGroup,
    deleteGroup,
    addFundToGroup,
    removeFundFromGroup,
    loading,
    error,
    clearError: () => setError(null),
  };
}

// ==================== 持仓计算 Hook ====================

/**
 * 持仓计算 Hook
 */
export function usePortfolioCalculations(rows: PortfolioRow[]) {
  // 按涨跌排序
  const sortedByEstPct = useMemo(() => {
    return [...rows].sort((a, b) => {
      const pctA = typeof a.estPct === 'number' ? a.estPct : parseFloat(String(a.estPct).replace('%', '')) || 0;
      const pctB = typeof b.estPct === 'number' ? b.estPct : parseFloat(String(b.estPct).replace('%', '')) || 0;
      return pctB - pctA;
    });
  }, [rows]);

  // 按持有金额排序
  const sortedByHolding = useMemo(() => {
    return [...rows].sort((a, b) => (Number(b.holding) || 0) - (Number(a.holding) || 0));
  }, [rows]);

  // 盈亏统计
  const profitStats = useMemo(() => {
    const profits = rows.filter(r => Number(r.cumulative) > 0);
    const losses = rows.filter(r => Number(r.cumulative) < 0);
    const neutrals = rows.filter(r => Number(r.cumulative) === 0);

    return {
      profitCount: profits.length,
      lossCount: losses.length,
      neutralCount: neutrals.length,
      totalProfit: profits.reduce((sum, r) => sum + (Number(r.cumulative) || 0), 0),
      totalLoss: losses.reduce((sum, r) => sum + (Number(r.cumulative) || 0), 0),
    };
  }, [rows]);

  // 涨跌统计
  const growthStats = useMemo(() => {
    const rising = rows.filter(r => {
      const pct = typeof r.estPct === 'number' ? r.estPct : parseFloat(String(r.estPct).replace('%', '')) || 0;
      return pct > 0;
    });
    const falling = rows.filter(r => {
      const pct = typeof r.estPct === 'number' ? r.estPct : parseFloat(String(r.estPct).replace('%', '')) || 0;
      return pct < 0;
    });

    return {
      risingCount: rising.length,
      fallingCount: falling.length,
      flatCount: rows.length - rising.length - falling.length,
    };
  }, [rows]);

  return {
    sortedByEstPct,
    sortedByHolding,
    profitStats,
    growthStats,
  };
}

// ==================== 导出 ====================

export default {
  usePortfolioTable,
  usePollingPortfolioTable,
  useFundList,
  useGroups,
  useGroupOperations,
  usePortfolioCalculations,
};