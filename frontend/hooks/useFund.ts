/**
 * 基金相关业务 Hooks
 * 封装基金数据的获取、缓存、状态管理
 */
import { useCallback, useState } from 'react';
import { useApi, usePollingApi, useOptimistic } from './useApi';
import { api } from '../services/api';
import type {
  FundDataMap,
  FundDetail,
  FundSearchResult,
  UpdateSharesRequest,
  ChartDataResponse,
  PreloadChartDataResponse,
  PositionRecordsResponse,
  PositionRecord,
} from '../types';

// ==================== 基金数据 Hook ====================

/**
 * 获取用户基金数据
 */
export function useFunds() {
  const { data, error, isLoading, refresh } = useApi<{ success: boolean; data?: FundDataMap }>(
    '/api/fund/data',
    { cache: { ttl: 5 * 60 * 1000 } }
  );

  const funds = data?.data || {};
  const fundList: FundDetail[] = Object.entries(funds).map(([code, detail]) => ({
    code,
    fund_key: detail.fund_key,
    name: detail.fund_name,
    is_hold: detail.is_hold,
    shares: detail.shares,
    holding_units: detail.holding_units,
    cost_per_unit: detail.cost_per_unit,
    sectors: detail.sectors,
    holding_profit: detail.holding_profit,
    chart_default: detail.chart_default,
  }));

  return {
    funds,
    fundList,
    error,
    isLoading,
    refresh,
  };
}

// ==================== 基金搜索 Hook ====================

/**
 * 基金搜索 Hook
 */
export function useFundSearch() {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<FundSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (kw: string) => {
    if (!kw.trim()) {
      setResults([]);
      return;
    }

    setKeyword(kw);
    setLoading(true);
    setError(null);

    try {
      const response = await api.fund.suggest(kw);
      if (response.success && response.data) {
        setResults(response.data);
      } else {
        setResults([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setKeyword('');
    setResults([]);
    setError(null);
  }, []);

  return {
    keyword,
    results,
    loading,
    error,
    search,
    clear,
  };
}

// ==================== 图表数据 Hook ====================

/**
 * 图表数据 Hook
 */
export function useChartData(code: string | null) {
  const { data, error, isLoading, refresh } = useApi<ChartDataResponse>(
    code ? `/api/fund/chart-data?code=${code}` : null,
    { cache: { ttl: 5 * 60 * 1000 } }
  );

  // 解压图表数据
  const chartData = data?.chart_data ? {
    labels: data.chart_data.l || [],
    growth: data.chart_data.g || [],
    net_values: data.chart_data.n || [],
  } : null;

  return {
    chartData,
    fundInfo: data?.fund_info,
    error,
    isLoading,
    refresh,
  };
}

/**
 * 预加载图表数据 Hook
 */
export function usePreloadChartData() {
  const { data, error, isLoading, refresh } = useApi<PreloadChartDataResponse>(
    '/api/fund/chart-data/preload',
    { cache: { ttl: 5 * 60 * 1000 } }
  );

  // 解压所有图表数据
  const chartDataMap: Record<string, { labels: string[]; growth: number[]; net_values?: number[] }> = {};
  if (data?.chart_data_map) {
    for (const [code, compressed] of Object.entries(data.chart_data_map)) {
      chartDataMap[code] = {
        labels: compressed.l || [],
        growth: compressed.g || [],
        net_values: compressed.n || [],
      };
    }
  }

  return {
    chartDataMap,
    error,
    isLoading,
    refresh,
  };
}

// ==================== 持仓记录 Hook ====================

/**
 * 持仓记录 Hook
 */
export function usePositionRecords() {
  const { data, error, isLoading, refresh } = useApi<PositionRecordsResponse>(
    '/api/fund/position-records',
    { cache: { ttl: 60 * 1000 } }
  );

  const records: PositionRecord[] = data?.records || [];

  // 撤销持仓记录
  const undoRecord = useCallback(async (id: number) => {
    const response = await api.fund.undoPositionRecord(id);
    if (response.success) {
      refresh();
    }
    return response;
  }, [refresh]);

  return {
    records,
    error,
    isLoading,
    refresh,
    undoRecord,
  };
}

// ==================== 份额更新 Hook ====================

/**
 * 份额更新 Hook
 */
export function useUpdateShares() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateShares = useCallback(async (data: UpdateSharesRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.fund.updateShares(data);
      if (!response.success) {
        setError(response.message || '更新失败');
      }
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : '更新失败';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    updateShares,
    loading,
    error,
    clearError: () => setError(null),
  };
}

// ==================== 基金增删 Hook ====================

/**
 * 基金增删 Hook
 */
export function useFundOperations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFunds = useCallback(async (codes: string[], names?: Record<string, string>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.fund.add(codes, names);
      if (response.success) {
        api.cache.clearFundCache();
      } else {
        setError(response.message || '添加失败');
      }
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : '添加失败';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteFunds = useCallback(async (codes: string[]) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.fund.delete(codes);
      if (response.success) {
        // 清除所有相关缓存
        api.cache.clearFundCache();
        api.cache.clearPortfolioCache();
        // 清除 sessionStorage 中的图表数据
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('fund_chart_preload_data');
          sessionStorage.removeItem('fund_chart_preload_timestamp');
        }
      } else {
        setError(response.message || '删除失败');
      }
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除失败';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    addFunds,
    deleteFunds,
    loading,
    error,
    clearError: () => setError(null),
  };
}

// ==================== 板块标注 Hook ====================

/**
 * 板块标注 Hook
 */
export function useSectorTagging() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setSectors = useCallback(async (codes: string[], sectors: string[]) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.fund.setSectors(codes, sectors);
      if (response.success) {
        api.cache.clearFundCache();
      } else {
        setError(response.message || '标注失败');
      }
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : '标注失败';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, []);

  const removeSectors = useCallback(async (codes: string[]) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.fund.removeSectors(codes);
      if (response.success) {
        api.cache.clearFundCache();
      } else {
        setError(response.message || '移除失败');
      }
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
    setSectors,
    removeSectors,
    loading,
    error,
    clearError: () => setError(null),
  };
}

// ==================== 导出 ====================

export default {
  useFunds,
  useFundSearch,
  useChartData,
  usePreloadChartData,
  usePositionRecords,
  useUpdateShares,
  useFundOperations,
  useSectorTagging,
};