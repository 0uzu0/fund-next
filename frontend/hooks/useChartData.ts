/**
 * 图表数据 Hook：预加载、缓存、按需拉取、sessionStorage 持久化
 * 与后端 /api/fund/chart-data 及 /api/fund/chart-data/preload 的压缩格式（l/g/n）对应
 */
import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { apiGet, API_BASE } from '../utils/apiClient';

const API = API_BASE;

export type ChartData = {
  labels: string[];
  growth: number[];
  net_values?: number[];
};

/** 后端返回的压缩格式（减少传输体积） */
type CompressedChartData = { l?: string[]; g?: number[]; n?: number[] };

const CHART_DATA_STORAGE_KEY = 'fund_chart_preload_data';
const CHART_DATA_TIMESTAMP_KEY = 'fund_chart_preload_timestamp';
const DATA_EXPIRY_MS = 30 * 60 * 1000; // 30 分钟

/** 将后端压缩格式 l/g/n 解压为 ChartData，供预加载与单基金请求复用 */
function decompressChartData(compressed: CompressedChartData | Record<string, unknown>): ChartData {
  const c = compressed as Record<string, unknown>;
  return {
    labels: (c.l as string[]) || (c.labels as string[]) || [],
    growth: (c.g as number[]) || (c.growth as number[]) || [],
    net_values: (c.n as number[] | undefined) ?? (c.net_values as number[] | undefined),
  };
}

export interface UseChartDataReturn {
  // 当前选中的基金
  chartFund: { code: string; name: string } | null;
  setChartFund: (fund: { code: string; name: string } | null) => void;
  
  // 当前图表的数据
  chartData: ChartData;
  chartLoading: boolean;
  
  // 预加载的数据映射
  preloadedChartData: Record<string, ChartData>;
  
  // 预加载所有持仓基金的图表数据
  preloadChartData: () => void;
  
  // 获取单个基金的图表数据
  fetchChartData: (code: string) => void;
  
  // 刷新当前图表数据
  refreshChartData: () => void;
}

export function useChartData(auth: { username: string } | null, dataSource?: string): UseChartDataReturn {
  // 当前选中的基金
  const [chartFund, setChartFund] = useState<{ code: string; name: string } | null>(null);

  // 当前图表的数据
  const [chartData, setChartData] = useState<ChartData>({ labels: [], growth: [] });
  const [chartLoading, setChartLoading] = useState(false);

  // 图表数据缓存（预加载的数据）
  const chartDataCache = useRef<Map<string, ChartData>>(new Map());

  // 预加载的图表数据映射
  const [preloadedChartData, setPreloadedChartData] = useState<Record<string, ChartData>>({});

  // 用于取消正在进行的图表请求
  const chartAbortControllerRef = useRef<AbortController | null>(null);

  // 从 sessionStorage 加载预加载的图表数据
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const timestampStr = sessionStorage.getItem(CHART_DATA_TIMESTAMP_KEY);
      const dataStr = sessionStorage.getItem(CHART_DATA_STORAGE_KEY);
      
      if (timestampStr && dataStr) {
        const timestamp = parseInt(timestampStr, 10);
        const now = Date.now();
        
        // 检查数据是否过期
        if (now - timestamp < DATA_EXPIRY_MS) {
          const compressedData = JSON.parse(dataStr);
          console.log('[sessionStorage] 从浏览器缓存加载', Object.keys(compressedData).length, '只基金的图表数据');
          const cachedData: Record<string, ChartData> = {};
          Object.entries(compressedData).forEach(([code, data]) => {
            const chartData = decompressChartData(data as CompressedChartData);
            cachedData[code] = chartData;
            chartDataCache.current.set(code, chartData);
          });
          
          // 更新状态
          startTransition(() => {
            setPreloadedChartData(cachedData);
          });
        } else {
          console.log('[sessionStorage] 缓存数据已过期，清除');
          sessionStorage.removeItem(CHART_DATA_STORAGE_KEY);
          sessionStorage.removeItem(CHART_DATA_TIMESTAMP_KEY);
        }
      }
    } catch (e) {
      console.warn('[sessionStorage] 读取缓存数据失败:', e);
      // 清除损坏的数据
      sessionStorage.removeItem(CHART_DATA_STORAGE_KEY);
      sessionStorage.removeItem(CHART_DATA_TIMESTAMP_KEY);
    }
  }, []);

  // 保存预加载数据到 sessionStorage（优化：压缩数据）
  /** 将预加载数据写入 sessionStorage（压缩格式 l/g/n），减少占用 */
  const savePreloadDataToStorage = useCallback((dataMap: Record<string, ChartData>) => {
    if (typeof window === 'undefined') return;
    try {
      const timestamp = Date.now();
      const compressedData: Record<string, { l: string[]; g: number[]; n?: number[] }> = {};
      Object.entries(dataMap).forEach(([code, data]) => {
        compressedData[code] = { l: data.labels, g: data.growth, n: data.net_values };
      });
      
      sessionStorage.setItem(CHART_DATA_STORAGE_KEY, JSON.stringify(compressedData));
      sessionStorage.setItem(CHART_DATA_TIMESTAMP_KEY, timestamp.toString());
      console.log('[sessionStorage] 已保存', Object.keys(dataMap).length, '只基金的图表数据到浏览器缓存');
    } catch (e) {
      console.warn('[sessionStorage] 保存缓存数据失败:', e);
      // 如果存储空间不足，尝试清除旧数据
      try {
        sessionStorage.removeItem(CHART_DATA_STORAGE_KEY);
        sessionStorage.removeItem(CHART_DATA_TIMESTAMP_KEY);
        const compressedData: Record<string, { l: string[]; g: number[]; n?: number[] }> = {};
        Object.entries(dataMap).forEach(([code, data]) => {
          compressedData[code] = { l: data.labels, g: data.growth, n: data.net_values };
        });
        sessionStorage.setItem(CHART_DATA_STORAGE_KEY, JSON.stringify(compressedData));
        sessionStorage.setItem(CHART_DATA_TIMESTAMP_KEY, Date.now().toString());
      } catch (e2) {
        console.error('[sessionStorage] 无法保存数据，存储空间可能不足:', e2);
      }
    }
  }, []);

  // 预加载所有持仓基金的图表数据
  const preloadChartData = useCallback(() => {
    // 检查是否已有缓存数据
    const hasCachedData = preloadedChartData && Object.keys(preloadedChartData).length > 0;
    
    if (hasCachedData) {
      console.log('[预加载] 使用已有缓存数据，跳过 API 请求');
      return;
    }
    
    // 异步预加载，不阻塞页面
    setTimeout(() => {
      // 使用 API 客户端，带缓存（30分钟）
      apiGet(`${API}/api/fund/chart-data/preload`, {
        cache: { ttl: 30 * 60 * 1000 }, // 30分钟缓存
      })
        .then((data) => {
          if (data.success && data.chart_data_map) {
            console.log('[预加载] 成功加载', Object.keys(data.chart_data_map).length, '只基金的图表数据');
            const decompressedData: Record<string, ChartData> = {};
            Object.entries(data.chart_data_map).forEach(([code, compressed]) => {
              const chartData = decompressChartData(compressed as CompressedChartData);
              decompressedData[code] = chartData;
              chartDataCache.current.set(code, chartData);
            });
            
            // 更新预加载数据状态
            startTransition(() => {
              setPreloadedChartData(decompressedData);
            });
            // 保存到 sessionStorage（会自动压缩）
            savePreloadDataToStorage(decompressedData);
          } else {
            console.warn('[预加载] 返回数据格式不正确:', data);
          }
        })
        .catch((err) => {
          console.warn('[预加载] 图表数据失败:', err);
        });
    }, 100); // 延迟100ms，确保页面先渲染
  }, [preloadedChartData, savePreloadDataToStorage]);

  // 获取单个基金的图表数据
  const fetchChartData = useCallback((code: string) => {
    if (!code) return;
    
    // 取消之前的请求
    if (chartAbortControllerRef.current) {
      chartAbortControllerRef.current.abort();
    }
    
    // 优先检查预加载的数据
    if (preloadedChartData[code]) {
      const preloaded = preloadedChartData[code];
      chartDataCache.current.set(code, preloaded);
      startTransition(() => {
        setChartData(preloaded);
        setChartLoading(false);
      });
      return;
    }
    
    // 检查缓存
    const cached = chartDataCache.current.get(code);
    if (cached) {
      // 使用 startTransition 更新缓存数据，不阻塞UI
      startTransition(() => {
        setChartData(cached);
        setChartLoading(false);
      });
      return;
    }
    
    // 创建新的 AbortController
    const abortController = new AbortController();
    chartAbortControllerRef.current = abortController;
    
    // 延迟执行fetch，确保页面先渲染和交互
    const executeFetch = () => {
      if (abortController.signal.aborted) return;
      
      // 延迟设置loading状态，不阻塞页面
      setTimeout(() => {
        if (abortController.signal.aborted) return;
        startTransition(() => {
          setChartLoading(true);
        });
      }, 100);
      
      // 使用 setTimeout 延迟执行 fetch，确保不阻塞主线程
      setTimeout(() => {
        if (abortController.signal.aborted) return;
        
        // fetch 请求本身是异步的，不会阻塞
        // 使用 API 客户端，带缓存（10分钟）
        apiGet(`${API}/api/fund/chart-data?code=${code}`, {
          cache: { ttl: 10 * 60 * 1000 }, // 10分钟缓存
          retry: 1, // 重试1次
          signal: abortController.signal, // 支持取消请求
        })
          .then((d) => {
            // 使用 setTimeout 延迟处理响应，确保不阻塞UI
            setTimeout(() => {
              if (abortController.signal.aborted) return;
              if (d.chart_data) {
                const data = decompressChartData(d.chart_data as CompressedChartData);
                // 缓存数据
                chartDataCache.current.set(code, data);
                // 更新预加载数据状态和 sessionStorage
                const updatedPreload = { ...preloadedChartData, [code]: data };
                startTransition(() => {
                  setPreloadedChartData(updatedPreload);
                });
                // 同步更新 sessionStorage
                savePreloadDataToStorage(updatedPreload);
                // 使用 startTransition 更新图表数据，不阻塞UI
                startTransition(() => {
                  setChartData(data);
                  setChartLoading(false);
                });
              } else {
                startTransition(() => {
                  setChartLoading(false);
                });
              }
            }, 0);
          })
          .catch((err) => {
            // 忽略取消请求的错误
            if (err.name === 'AbortError' || err.message === 'Aborted') {
              return;
            }
            setTimeout(() => {
              if (!abortController.signal.aborted) {
                startTransition(() => {
                  setChartData({ labels: [], growth: [] });
                  setChartLoading(false);
                });
              }
            }, 0);
          });
      }, 200); // 延迟200ms执行fetch，确保页面先渲染
    };
    
    // 使用 requestIdleCallback 或 setTimeout 延迟执行
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(executeFetch, { timeout: 1000 });
    } else {
      setTimeout(executeFetch, 500); // 延迟500ms执行，确保页面先渲染
    }
  }, [preloadedChartData, savePreloadDataToStorage]);

  // 刷新当前图表数据
  const refreshChartData = useCallback(() => {
    if (!chartFund?.code) return;
    fetchChartData(chartFund.code);
  }, [chartFund?.code, fetchChartData]);

  // 切换数据源时：清空图表缓存并重新拉取当前基金图表
  useEffect(() => {
    if (dataSource === undefined) return;
    chartDataCache.current.clear();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(CHART_DATA_STORAGE_KEY);
      sessionStorage.removeItem(CHART_DATA_TIMESTAMP_KEY);
    }
    startTransition(() => setPreloadedChartData({}));
    if (chartFund?.code) {
      setChartLoading(true);
      fetchChartData(chartFund.code);
    }
    // 仅随数据源切换清缓存并重拉，不随 chartFund/fetchChartData 变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource]);

  // 当 chartFund 变化时，加载对应的图表数据
  useEffect(() => {
    if (chartFund?.code) {
      // 优先使用预加载的数据初始化图表
      if (preloadedChartData[chartFund.code]) {
        const preloaded = preloadedChartData[chartFund.code];
        console.log('[图表] 使用预加载数据初始化:', chartFund.code, '数据点数:', preloaded.labels?.length || 0);
        chartDataCache.current.set(chartFund.code, preloaded);
        startTransition(() => {
          setChartData(preloaded);
          setChartLoading(false);
        });
        return;
      }
      
      // 检查缓存
      const cached = chartDataCache.current.get(chartFund.code);
      if (cached) {
        startTransition(() => {
          setChartData(cached);
          setChartLoading(false);
        });
        return;
      }
      
      // 延迟加载图表数据，确保页面其他内容先渲染，不阻塞用户操作
      const loadChart = () => {
        fetchChartData(chartFund.code);
      };
      
      let cleanup: (() => void) | null = null;
      
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        // 浏览器空闲时加载图表，超时时间设为3秒
        const idleCallbackId = (window as any).requestIdleCallback(loadChart, { timeout: 3000 });
        cleanup = () => {
          (window as any).cancelIdleCallback(idleCallbackId);
          if (chartAbortControllerRef.current) {
            chartAbortControllerRef.current.abort();
            chartAbortControllerRef.current = null;
          }
        };
      } else {
        // 降级方案：延迟1秒加载，确保页面完全渲染后再加载图表
        const timeoutId = setTimeout(loadChart, 1000);
        cleanup = () => {
          clearTimeout(timeoutId);
          if (chartAbortControllerRef.current) {
            chartAbortControllerRef.current.abort();
            chartAbortControllerRef.current = null;
          }
        };
      }
      
      return cleanup;
    }
    
    // 清理函数：组件卸载或 chartFund 变化时取消正在进行的请求
    return () => {
      if (chartAbortControllerRef.current) {
        chartAbortControllerRef.current.abort();
        chartAbortControllerRef.current = null;
      }
    };
  }, [chartFund?.code, fetchChartData, preloadedChartData]);

  // 估值曲线定时刷新（实时）- 使用低优先级，不阻塞页面
  useEffect(() => {
    if (!chartFund || !auth) return;
    const t = setInterval(() => {
      // 使用 setTimeout 延迟执行，确保不阻塞主线程
      setTimeout(() => {
        // 使用 API 客户端，带缓存（10分钟）
        apiGet(`${API}/api/fund/chart-data?code=${chartFund.code}`, {
          cache: { ttl: 10 * 60 * 1000 }, // 10分钟缓存
        })
          .then((d) => {
            if (d.chart_data) {
              const refreshedData = decompressChartData(d.chart_data as CompressedChartData);
              
              if (refreshedData.labels && refreshedData.labels.length > 0) {
                // 更新缓存
                chartDataCache.current.set(chartFund.code, refreshedData);
                // 更新预加载数据状态
                const updatedPreload = { ...preloadedChartData, [chartFund.code]: refreshedData };
                // 使用 startTransition 更新，不阻塞UI
                startTransition(() => {
                  setPreloadedChartData(updatedPreload);
                  setChartData(refreshedData);
                });
                // 同步更新 sessionStorage
                savePreloadDataToStorage(updatedPreload);
              }
            }
          })
          .catch(() => {});
      }, 0); // 使用 setTimeout(0) 延迟到下一个事件循环
    }, 60000); // 60秒刷新一次
    return () => clearInterval(t);
  }, [chartFund?.code, auth, preloadedChartData, savePreloadDataToStorage]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      // 取消所有正在进行的图表请求
      if (chartAbortControllerRef.current) {
        chartAbortControllerRef.current.abort();
        chartAbortControllerRef.current = null;
      }
    };
  }, []);

  return {
    chartFund,
    setChartFund,
    chartData,
    chartLoading,
    preloadedChartData,
    preloadChartData,
    fetchChartData,
    refreshChartData,
  };
}
