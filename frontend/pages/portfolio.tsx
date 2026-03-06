import { useState, useEffect, useCallback, useMemo, useRef, startTransition, Suspense } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useChartData } from '../hooks/useChartData';
import { useTableSort } from '../hooks/useTableSort';
import { apiGet, apiPost, apiDelete, clearCache, getApiBase } from '../utils/apiClient';
import { toast } from '../utils/toast';
import type { FundRow, Summary, Group, DataSourceOption } from '../types/portfolio';
import { toNum, formatMoney, formatPct, formatYuan } from '../lib/format';
import { SECTOR_CATEGORIES } from '../constants/portfolio';
import {
  parseNetValue,
  addDaysToDate,
  getTodayStr,
  isEstimateStale,
  parseCodeFromInput,
  parseNameFromInput,
} from '../lib/portfolioHelpers';
import PortfolioHeader from '../components/portfolio/PortfolioHeader';
import PortfolioSummaryBar from '../components/portfolio/PortfolioSummaryBar';
import HoldingTable from '../components/portfolio/HoldingTable';
import WatchlistSection from '../components/portfolio/WatchlistSection';
import FundDetailModal from '../components/portfolio/FundDetailModal';
import EditHoldingModal from '../components/portfolio/EditHoldingModal';
import AiAssistant from '../components/AiAssistant';

const FundChart = dynamic(() => import('../components/FundChart'), {
  loading: () => null,
  ssr: false,
});

export default function Portfolio() {
  const router = useRouter();
  const [auth, setAuth] = useState<{ username: string } | null>(null);
  const [fundRows, setFundRows] = useState<FundRow[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalHolding: 0,
    todayEstChange: 0,
    todayEstPct: 0,
    todayActualText: '净值未更新',
    todayActual: 0,
    cumulative: 0,
  });
  const [clearedProfit, setClearedProfit] = useState(0); // 清仓基金历史收益
  const [fundList, setFundList] = useState<{ code: string; name: string }[]>([]);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartSvgContainerRef = useRef<HTMLDivElement>(null);
  const chartSvgRef = useRef<SVGSVGElement>(null);
  const [chartWidth, setChartWidth] = useState(600);
  const [chartHeight, setChartHeight] = useState(270);
  const [svgScale, setSvgScale] = useState({ x: 1, y: 1 }); // SVG 实际缩放比例
  const [chartHoverIndex, setChartHoverIndex] = useState<number | null>(null);
  const [chartTooltipPos, setChartTooltipPos] = useState<{ left: number; top: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // 图表显示/隐藏状态
  const [chartVisible, setChartVisible] = useState(() => {
    // 从 localStorage 读取保存的状态，默认为 true
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('portfolio_chart_visible');
      return saved === null ? true : saved === 'true';
    }
    return true;
  });
  // 行情数据源（fund123 / 天天基金），需在 useChartData 之前声明
  const [dataSource, setDataSource] = useState<DataSourceOption>('fund123');

  // 使用图表数据 Hook
  const {
    chartFund,
    setChartFund,
    chartData,
    chartLoading,
    preloadedChartData,
    preloadChartData,
    fetchChartData,
  } = useChartData(auth, dataSource);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [watchlistRows, setWatchlistRows] = useState<FundRow[]>([]);
  const [addInput, setAddInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestList, setSuggestList] = useState<{ code: string; name: string }[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [newGroupLoading, setNewGroupLoading] = useState(false);
  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null);
  const [editHoldingRow, setEditHoldingRow] = useState<FundRow | null>(null);
  const [editHoldingAmount, setEditHoldingAmount] = useState('');
  const [editCumulativeProfit, setEditCumulativeProfit] = useState('');
  const [editHoldingLoading, setEditHoldingLoading] = useState(false);
  const [editHoldingError, setEditHoldingError] = useState('');
  const [detailRow, setDetailRow] = useState<FundRow | null>(null);
  const [detailHoldings, setDetailHoldings] = useState<{ code: string; name: string; weight: string; change: number | null }[]>([]);
  const [detailHoldingsLoading, setDetailHoldingsLoading] = useState(false);
  const [detailHoldingsCollapsed, setDetailHoldingsCollapsed] = useState(false);
  const [showShowoffModal, setShowShowoffModal] = useState(false);
  const [hideSensitiveValues, setHideSensitiveValues] = useState(false);
  // 行业板块标注/删除
  const [sectorOp, setSectorOp] = useState<'mark' | 'remove' | null>(null);
  const [showSectorFundModal, setShowSectorFundModal] = useState(false);
  const [sectorFundList, setSectorFundList] = useState<{ code: string; name: string; sectors?: string[] }[]>([]);
  const [sectorSelectedCodes, setSectorSelectedCodes] = useState<string[]>([]);
  const [showSectorTagModal, setShowSectorTagModal] = useState(false);
  const [sectorSelectedTags, setSectorSelectedTags] = useState<string[]>([]);
  const [sectorSubmitLoading, setSectorSubmitLoading] = useState(false);
  const [showAddToGroupModal, setShowAddToGroupModal] = useState(false);
  const [addToGroupLoading, setAddToGroupLoading] = useState(false);
  // 删除基金
  const [showDeleteFundModal, setShowDeleteFundModal] = useState(false);
  const [deleteFundList, setDeleteFundList] = useState<{ code: string; name: string }[]>([]);
  const [deleteSelectedCodes, setDeleteSelectedCodes] = useState<string[]>([]);
  const [deleteSubmitLoading, setDeleteSubmitLoading] = useState(false);
  // 持有基金表排序：列索引 2~7（持仓金额到持仓收益）
  const { sort: holdingSort, handleSort: onHoldingSortClick } = useTableSort();
  const { sort: watchlistSort, handleSort: onWatchlistSortClick } = useTableSort();
  // 持有基金分页：每页条数、当前页
  const [holdingPageSize, setHoldingPageSize] = useState<10 | 20 | 30>(10);
  const [holdingPage, setHoldingPage] = useState(1);
  // 自选基金分页：每页条数、当前页
  const [watchlistPageSize, setWatchlistPageSize] = useState<10 | 20 | 30>(10);
  const [watchlistPage, setWatchlistPage] = useState(1);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setHideSensitiveValues(localStorage.getItem('hideSensitiveValues') === 'true');
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const s = localStorage.getItem('portfolio_data_source');
    if (s === 'tiantian' || s === 'fund123') setDataSource(s);
  }, []);

  const fetchAuth = useCallback(() => {
    // 使用 API 客户端，带缓存（10分钟）
    return apiGet<{ username: string }>(`/api/auth/me`, {
      cache: { ttl: 10 * 60 * 1000 }, // 10分钟缓存
    })
      .then((d) => {
        setAuth(d);
        return d;
      });
  }, []);

  const fetchData = useCallback((overrideSource?: 'fund123' | 'tiantian') => {
    setLoading(false);
    const source = overrideSource ?? dataSource;

    Promise.all([
      apiGet(`/api/portfolio/table?group=&holdOnly=1&source=${source}`, {
        cache: { ttl: 2 * 60 * 1000 }, // 2分钟缓存
      }),
      apiGet(`/api/fund/data`, {
        cache: { ttl: 5 * 60 * 1000 }, // 5分钟缓存
      }),
      apiGet(`/api/portfolio/fund-list?_t=${Date.now()}`, {
        cache: { ttl: 5 * 60 * 1000 }, // 5分钟缓存
      }),
      apiGet(`/api/fund/groups`, {
        cache: { ttl: 10 * 60 * 1000 }, // 10分钟缓存
      }),
    ]).then(([tableRes, fundMapRes, listRes, groupsRes]) => {
      if (tableRes.success && tableRes.rows) {
        setFundRows(tableRes.rows);
        let total = 0, todayEst = 0, todayActual = 0, cum = 0;
        tableRes.rows.forEach((r: FundRow) => {
          total += toNum(r.holding);
          todayEst += toNum(r.estAmount);
          todayActual += toNum(r.actualAmount);
          cum += toNum(r.cumulative);
        });
        // 获取清仓基金历史收益
        const clearedProfitValue = toNum((tableRes as any).clearedProfit) || 0;
        setClearedProfit(clearedProfitValue);
        const actualPct = total ? (todayActual / total) * 100 : 0;
        const todayActualText = todayActual !== 0 ? `${formatMoney(todayActual)} (${formatPct(actualPct)})` : '净值未更新';
        setSummary({
          totalHolding: total,
          todayEstChange: todayEst,
          todayEstPct: total ? (todayEst / total) * 100 : 0,
          todayActualText,
          todayActual,
          cumulative: cum,
        });
      } else if (tableRes.success) {
        // 即使没有数据也要清空 fundRows
        setFundRows([]);
        setClearedProfit(0);
      }
      if (listRes.success && listRes.funds) {
        setFundList(listRes.funds);
      }
      // 有持仓表格或 fund-list 时预加载图表数据，并设置默认选中基金
      const hasFundList = listRes.success && listRes.funds && listRes.funds.length;
      const hasHoldingRows = tableRes.success && tableRes.rows && tableRes.rows.length;
      if (hasFundList || hasHoldingRows) {
        preloadChartData();
        if (!chartFund) {
          const firstFund = hasFundList
            ? (listRes.funds as { code: string; name: string }[])[0]
            : { code: (tableRes.rows as FundRow[])[0].code, name: (tableRes.rows as FundRow[])[0].name || `基金${(tableRes.rows as FundRow[])[0].code}` };
          setTimeout(() => {
            startTransition(() => {
              setChartFund(firstFund);
            });
          }, 500);
        }
      }
      if (groupsRes.success && groupsRes.groups && groupsRes.groups.length) {
        const list = groupsRes.groups as Group[];
        setGroups(list);
        setSelectedGroupId((prev) => (prev === null && list.length ? list[0].id : prev));
      }
      setRefreshing(false);
    }).catch(() => {
      setLoading(false);
      setRefreshing(false);
      // 失败时保留原数据，便于用户重试，不闪白
    });
  }, [chartFund, preloadChartData, dataSource]);

  // 估值曲线容器宽高（用于 SVG viewBox，曲线随屏幕适配）
  useEffect(() => {
    const el = chartContainerRef.current;
    const svgEl = chartSvgRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth || 600;
      const totalH = el.clientHeight || 300;
      // 计算实际可用高度：总高度 - padding(30) - 图例区域(约36) - marginTop(24)
      // SVG viewBox 高度需要包含图表区域 + Y轴标题空间(顶部16) + X轴标签空间(底部16)
      const isMobile = w < 600;
      const legendHeight = isMobile ? 32 : 36;
      const svgContainerH = totalH - 30 - legendHeight - 24; // SVG 容器实际高度
      // chartHeight 是 viewBox 高度，需要包含所有内容（图表区域 + 标签空间）
      const topLabelSpace = isMobile ? 12 : 16;  // Y轴标题空间
      const bottomLabelSpace = isMobile ? 32 : 34;  // X轴标签空间（进一步增加以确保时间轴完全可见）
      const chartAreaH = Math.max(150, svgContainerH - topLabelSpace - bottomLabelSpace);
      const h = chartAreaH + topLabelSpace + bottomLabelSpace;
      setChartWidth(w);
      setChartHeight(h);
      // 计算 SVG 的实际缩放比例（用于定位绝对定位的文本元素）
      if (svgEl) {
        const svgRect = svgEl.getBoundingClientRect();
        if (svgRect.width > 0 && svgRect.height > 0 && w > 0 && h > 0) {
          const scaleX = svgRect.width / w;
          const scaleY = svgRect.height / h;
          setSvgScale({ x: scaleX, y: scaleY });
        } else {
          setSvgScale({ x: 1, y: 1 });
        }
      } else {
        setSvgScale({ x: 1, y: 1 });
      }
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    // 监听窗口大小变化
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);


  useEffect(() => {
    fetchAuth().then(() => fetchData()).catch(() => router.replace('/login?redirect=' + encodeURIComponent(router.asPath || '/portfolio')));
  }, []);

  useEffect(() => {
    if (auth && !loading) fetchData();
  }, [auth, refreshing]);

  // 自动刷新：每30秒刷新一次数据
  useEffect(() => {
    if (!auth) return;
    const interval = setInterval(() => {
      fetchData();
      if (selectedGroupId != null) fetchWatchlist();
    }, 30000);
    return () => clearInterval(interval);
  }, [auth, selectedGroupId, dataSource]);

  const fetchWatchlist = useCallback((overrideSource?: 'fund123' | 'tiantian', noCache?: boolean) => {
    if (selectedGroupId == null) return;
    const source = overrideSource ?? dataSource;
    const url = `/api/portfolio/table?group=${selectedGroupId}&source=${source}${noCache ? `&_t=${Date.now()}` : ''}`;
    // noCache 时跳过缓存，直接请求
    const cacheConfig = noCache ? undefined : { cache: { ttl: 2 * 60 * 1000, key: `portfolio/table:${selectedGroupId}:${source}` } };
    apiGet<{ success: boolean; rows?: FundRow[] }>(url, cacheConfig)
      .then((res) => {
        if (res.success && res.rows) setWatchlistRows(res.rows);
        else setWatchlistRows([]);
      })
      .catch(() => setWatchlistRows([]));
  }, [selectedGroupId, dataSource]);

  useEffect(() => {
    if (auth && selectedGroupId != null) fetchWatchlist();
  }, [auth, selectedGroupId, fetchWatchlist, refreshing]);

  useEffect(() => {
    if (!detailRow?.code) {
      setDetailHoldings([]);
      return;
    }
    setDetailHoldingsLoading(true);
    setDetailHoldings([]);
    setDetailHoldingsCollapsed(false);
    apiGet<{ success: boolean; holdings?: { code: string; name: string; weight: string; change: number | null }[] }>(
      `/api/fund/holdings?code=${encodeURIComponent(detailRow.code)}`,
      { cache: { ttl: 5 * 60 * 1000 } }
    )
      .then((res) => {
        if (res.success && Array.isArray(res.holdings)) setDetailHoldings(res.holdings);
      })
      .catch(() => setDetailHoldings([]))
      .finally(() => setDetailHoldingsLoading(false));
  }, [detailRow?.code]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
    if (selectedGroupId != null) fetchWatchlist();
  };

  const onExport = () => {
    window.open(`/api/fund/download`, '_blank');
  };

  const onImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const form = new FormData();
      form.append('file', file);
      const r = await fetch(`/api/fund/upload`, { method: 'POST', credentials: 'include', body: form });
      const d = await r.json();
      (d.success ? toast.success : toast.error)(d.message || (d.success ? '导入成功' : '导入失败'));
      if (d.success) {
        clearCache();
        fetchData();
        if (selectedGroupId != null) fetchWatchlist();
      }
    };
    input.click();
  };

  const openSectorFundModal = async (op: 'mark' | 'remove') => {
    setSectorOp(op);
    setSectorSelectedCodes([]);
    setSectorSelectedTags([]);
    setShowSectorTagModal(false);
    try {
      const fundMap = await apiGet<Record<string, { fund_name?: string; sectors?: string[] }>>(`/api/fund/data`, {
        cache: { ttl: 2 * 60 * 1000 },
      });
      const list = Object.entries(fundMap).map(([code, data]) => ({
        code,
        name: data.fund_name || `基金${code}`,
        sectors: data.sectors || [],
      }));
      setSectorFundList(list);
      setShowSectorFundModal(true);
    } catch (e) {
      toast.error('获取基金列表失败');
    }
  };

  const openDeleteFundModal = async () => {
    setDeleteSelectedCodes([]);
    try {
      const fundMap = await apiGet<Record<string, { fund_name?: string }>>(`/api/fund/data`, {
        cache: { ttl: 2 * 60 * 1000 },
      });
      const list = Object.entries(fundMap).map(([code, data]) => ({
        code,
        name: data.fund_name || `基金${code}`,
      }));
      setDeleteFundList(list);
      setShowDeleteFundModal(true);
    } catch (e) {
      toast.error('获取基金列表失败');
    }
  };

  const confirmDeleteFund = () => {
    if (deleteSelectedCodes.length === 0) {
      toast.error('请至少选择一只基金');
      return;
    }
    if (!confirm(`确定要删除 ${deleteSelectedCodes.length} 只基金吗？`)) return;
    setDeleteSubmitLoading(true);
    fetch(`/api/fund/delete`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes: deleteSelectedCodes.join(',') }),
    })
      .then((res) => res.json())
      .then((d) => {
        (d.success ? toast.success : toast.error)(d.message || (d.success ? '删除成功' : '删除失败'));
        if (d.success) {
          setShowDeleteFundModal(false);
          setDeleteSelectedCodes([]);
          // 清除所有相关缓存
          clearCache('portfolio/table');
          clearCache('portfolio/fund-list');
          clearCache('/api/fund/data');
          clearCache('/api/fund/groups');
          clearCache('/api/fund/chart-data');
          // 清除 sessionStorage 中的图表数据
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('fund_chart_preload_data');
            sessionStorage.removeItem('fund_chart_preload_timestamp');
          }
          // 如果被删除的基金包含当前选中的图表基金，重置图表基金
          if (chartFund && deleteSelectedCodes.includes(chartFund.code)) {
            setChartFund(null);
          }
          // 立即从 fundList 中移除被删除的基金（即时更新图表下拉框）
          setFundList((prev) => prev.filter((f) => !deleteSelectedCodes.includes(f.code)));
          // 刷新持有基金数据
          fetchData();
          // 强制刷新自选基金数据（跳过缓存）
          if (selectedGroupId != null) {
            fetchWatchlist(undefined, true);
          }
        }
      })
      .catch(() => toast.error('删除失败'))
      .finally(() => setDeleteSubmitLoading(false));
  };

  const confirmSectorFundSelection = () => {
    if (sectorSelectedCodes.length === 0) {
      toast.error('请至少选择一只基金');
      return;
    }
    if (sectorOp === 'remove') {
      setSectorSubmitLoading(true);
      apiPost<{ success: boolean; message?: string }>(`/api/fund/sector/remove`, { codes: sectorSelectedCodes.join(',') })
        .then((d) => {
          (d.success ? toast.success : toast.error)(d.message || (d.success ? '已删除板块标记' : '操作失败'));
          if (d.success) {
            clearCache('api/fund/data');
            fetchData();
            setShowSectorFundModal(false);
            setSectorOp(null);
          }
        })
        .catch(() => toast.error('操作失败'))
        .finally(() => setSectorSubmitLoading(false));
      return;
    }
    setShowSectorFundModal(false);
    setShowSectorTagModal(true);
  };

  const confirmSectorTagSelection = () => {
    if (sectorSelectedTags.length === 0) {
      toast.error('请至少选择一个板块');
      return;
    }
    setSectorSubmitLoading(true);
    apiPost<{ success: boolean; message?: string }>(`/api/fund/sector`, {
      codes: sectorSelectedCodes.join(','),
      sectors: sectorSelectedTags,
    })
      .then((d) => {
        (d.success ? toast.success : toast.error)(d.message || (d.success ? '已标注板块' : '操作失败'));
        if (d.success) {
          clearCache('api/fund/data');
          fetchData();
          setShowSectorTagModal(false);
          setSectorOp(null);
        }
      })
      .catch(() => toast.error('操作失败'))
      .finally(() => setSectorSubmitLoading(false));
  };

  const toggleSectorTag = (tag: string) => {
    setSectorSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // 联想搜索：输入时防抖请求后端 suggest 接口（东方财富，参考 real-time-fund）
  useEffect(() => {
    const keyword = addInput.trim();
    if (suggestTimeoutRef.current) {
      clearTimeout(suggestTimeoutRef.current);
      suggestTimeoutRef.current = null;
    }
    if (!keyword) {
      setSuggestList([]);
      setSuggestLoading(false);
      return;
    }
    setSuggestLoading(true);
    suggestTimeoutRef.current = setTimeout(() => {
      suggestTimeoutRef.current = null;
      fetch(`/api/fund/suggest?key=${encodeURIComponent(keyword)}`, { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.list)) setSuggestList(d.list);
          else setSuggestList([]);
        })
        .catch(() => setSuggestList([]))
        .finally(() => setSuggestLoading(false));
    }, 300);
    return () => {
      if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current);
    };
  }, [addInput]);

  const addSuggestions = suggestList;

  const onRemoveFromGroup = async (code: string) => {
    if (selectedGroupId == null) return;
    if (!confirm('确定从该分组中移除该基金吗？')) return;
    try {
      const r = await fetch(`/api/fund/groups/${selectedGroupId}/funds/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const d = await r.json();
      if (d.success) {
        clearCache('portfolio/table');
        clearCache('/api/portfolio/fund-list');
        clearCache('/api/fund/chart-data');
        clearCache('/api/fund/data');
        // 清除 sessionStorage 中的图表数据
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('fund_chart_preload_data');
          sessionStorage.removeItem('fund_chart_preload_timestamp');
        }
        // 立即清空 fundList、fundRows 和 watchlistRows，强制重新加载
        setFundList([]);
        setFundRows([]);
        setWatchlistRows([]);
        fetchData();
        fetchWatchlist(undefined, true);
      } else {
        toast.error(d.message || '移除失败');
      }
    } catch (e) {
      toast.error('网络错误');
    }
  };

  const onAddFund = async () => {
    const code = parseCodeFromInput(addInput);
    if (!code) {
      toast.error('请输入基金代码');
      return;
    }
    if (selectedGroupId == null) {
      toast.error('请先选择分组');
      return;
    }
    // 从输入中解析基金名称（如果用户通过联想选择了基金）
    const fundName = parseNameFromInput(addInput);
    setAddLoading(true);
    try {
      const r = await fetch(`/api/fund/groups/${selectedGroupId}/funds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code, fund_name: fundName }),
      });
      const d = await r.json();
      if (d.success) {
        setAddInput('');
        setShowSuggestions(false);
        clearCache('portfolio/table');
        clearCache('/api/portfolio/fund-list');
        clearCache('/api/fund/data');
        // 立即清空 fundList，强制重新加载
        setFundList([]);
        fetchData();
        fetchWatchlist();
        toast.success('添加成功');
      } else {
        toast.error(d.message || '添加失败');
      }
    } catch (e) {
      toast.error('网络错误');
    } finally {
      setAddLoading(false);
    }
  };

  const onCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      toast.error('请输入分组名称');
      return;
    }
    setNewGroupLoading(true);
    try {
      const r = await fetch(`/api/fund/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });
      const d = await r.json();
      if (d.success) {
        setShowNewGroupModal(false);
        setNewGroupName('');
        // 清除分组列表缓存，强制刷新
        clearCache(`/api/fund/groups`);
        // 重新获取分组列表
        apiGet(`/api/fund/groups`, {
          cache: { ttl: 10 * 60 * 1000 },
        }).then((groupsRes) => {
          if (groupsRes.success && groupsRes.groups && groupsRes.groups.length) {
            const list = groupsRes.groups as Group[];
            setGroups(list);
            if (d.group_id) {
              setSelectedGroupId(d.group_id);
            } else if (list.length > 0) {
              setSelectedGroupId(list[0].id);
            }
          }
        });
        fetchData();
      } else {
        toast.error(d.message || '创建失败');
      }
    } catch (e) {
      toast.error('网络错误');
    } finally {
      setNewGroupLoading(false);
    }
  };

  async function onDeleteGroup(id: number) {
    setDeletingGroupId(id);
    try {
      const r = await fetch(`/api/fund/groups/${id}`, { method: 'DELETE', credentials: 'include' });
      const d = await r.json();
      if (d.success) {
        setShowDeleteGroupModal(false);
        // 清除分组列表缓存，强制刷新
        clearCache(`/api/fund/groups`);
        // 重新获取分组列表
        apiGet(`/api/fund/groups`, {
          cache: { ttl: 10 * 60 * 1000 },
        }).then((groupsRes) => {
          if (groupsRes.success && groupsRes.groups && groupsRes.groups.length) {
            const list = groupsRes.groups as Group[];
            setGroups(list);
            // 如果删除的是当前选中的分组，切换到默认分组或其他分组
            if (selectedGroupId === id) {
              const defaultGroupId = list.find((g) => g.sort_order === 0)?.id ?? list[0]?.id;
              if (defaultGroupId) {
                setSelectedGroupId(defaultGroupId);
              } else {
                setSelectedGroupId(null);
              }
            }
          } else {
            // 如果没有分组了，清空选中状态
            setGroups([]);
            setSelectedGroupId(null);
          }
        });
        fetchData();
        fetchWatchlist();
        setDeletingGroupId(null);
      } else {
        toast.error(d.message || '删除失败');
        setDeletingGroupId(null);
      }
    } catch (e) {
      toast.error('网络错误');
      setDeletingGroupId(null);
    }
  }

  // 计算持有份额和成本单价
  const calculateHoldingData = (holdingAmount: number, cumulativeProfit: number, netValue: number) => {
    // 持有份额 = 持有金额 / 昨日净值
    const units = netValue > 0 ? holdingAmount / netValue : 0;
    // 持仓成本 = 持仓收益 / 持有份额 + 昨日净值
    const costPerUnit = units > 0 ? netValue - cumulativeProfit / units : netValue;
    return { units, costPerUnit };
  };

  const openEditHolding = (r: FundRow) => {
    setEditHoldingRow(r);
    // 初始化持仓金额和持仓收益
    const currentHolding = (r.holding_units ?? 0) * (r.cost_per_unit ?? 1);
    const currentCumulative = (r as any).holding_profit ?? 0;
    setEditHoldingAmount(currentHolding.toFixed(2));
    setEditCumulativeProfit(currentCumulative.toFixed(2));
    setEditHoldingError('');
  };

  const onSaveEditHolding = async () => {
    if (!editHoldingRow) return;
    const holdingAmount = parseFloat(editHoldingAmount);
    const cumulativeProfit = parseFloat(editCumulativeProfit);
    if (isNaN(holdingAmount) || holdingAmount < 0 || isNaN(cumulativeProfit)) {
      setEditHoldingError('请输入有效的持仓金额和持仓收益');
      return;
    }

    // 持仓金额为0时，检查是否有累计收益需要保留
    if (holdingAmount === 0) {
      // 如果有累计收益，保留份额为0但保留收益
      if (cumulativeProfit !== 0) {
        setEditHoldingError('');
        setEditHoldingLoading(true);
        try {
          const res = await fetch(`/api/fund/shares`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
              code: editHoldingRow.code, 
              holding_units: 0, 
              cost_per_unit: 0, 
              holding_profit: cumulativeProfit 
            }),
          });
          const d = await res.json();
          if (d.success) {
            setEditHoldingRow(null);
            clearCache('portfolio/table');
            clearCache('/api/fund/data');
            fetchData();
            fetchWatchlist();
            toast.success('已保存（持仓为0，保留历史收益）');
          } else {
            setEditHoldingError(d.message || '保存失败');
          }
        } catch (e) {
          setEditHoldingError('网络错误');
        } finally {
          setEditHoldingLoading(false);
        }
        return;
      }
      // 持仓金额为0且累计收益也为0，清空所有数据
      setEditHoldingError('');
      setEditHoldingLoading(true);
      try {
        const res = await fetch(`/api/fund/shares`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ 
            code: editHoldingRow.code, 
            holding_units: 0, 
            cost_per_unit: 0, 
            holding_profit: 0 
          }),
        });
        const d = await res.json();
        if (d.success) {
          setEditHoldingRow(null);
          clearCache('portfolio/table');
          clearCache('/api/fund/data');
          fetchData();
          fetchWatchlist();
          toast.success('已清空持仓');
        } else {
          setEditHoldingError(d.message || '保存失败');
        }
      } catch (e) {
        setEditHoldingError('网络错误');
      } finally {
        setEditHoldingLoading(false);
      }
      return;
    }

    // 获取昨日净值用于计算
    const netValue = parseNetValue(editHoldingRow.netValue) || 1;
    const { units, costPerUnit } = calculateHoldingData(holdingAmount, cumulativeProfit, netValue);

    if (units <= 0 || costPerUnit <= 0) {
      setEditHoldingError('计算结果无效，请检查输入值');
      return;
    }

    setEditHoldingError('');
    setEditHoldingLoading(true);
    const unitsRounded = Math.round(units * 100) / 100;
    const costRounded = Math.round(costPerUnit * 10000) / 10000;
    const profitRounded = Math.round(cumulativeProfit * 100) / 100;
    try {
      const res = await fetch(`/api/fund/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: editHoldingRow.code, holding_units: unitsRounded, cost_per_unit: costRounded, holding_profit: profitRounded }),
      });
      const d = await res.json();
      if (d.success) {
        setEditHoldingRow(null);
        clearCache('portfolio/table');
        clearCache('/api/fund/data');
        fetchData();
        fetchWatchlist();
      } else {
        setEditHoldingError(d.message || '保存失败');
      }
    } catch (e) {
      setEditHoldingError('网络错误');
    } finally {
      setEditHoldingLoading(false);
    }
  };

  // 图表选择器列表：优先用 fund-list 接口，无则用持仓表格数据，保证有持仓时必有选项
  const chartSelectorFunds = useMemo(() => {
    if (fundList.length > 0) return fundList;
    return fundRows.map((r) => ({ code: r.code, name: r.name || `基金${r.code}` }));
  }, [fundList, fundRows]);

  // 图表选择器与列表同步：当选中的基金不在当前列表中时，改为列表第一项
  useEffect(() => {
    if (chartSelectorFunds.length === 0) return;
    const exists = chartFund && chartSelectorFunds.some((f) => f.code === chartFund.code);
    if (!exists) {
      startTransition(() => setChartFund(chartSelectorFunds[0]));
    }
  }, [chartSelectorFunds, chartFund?.code]);

  const displayFundRows = useMemo(() => {
    return fundRows.map((r) => {
      const raw = toNum(r.holding);
      const displayHolding = Math.max(0, raw);
      return { ...r, displayHolding };
    });
  }, [fundRows]);

  // 持有基金表排序列取值（列索引 2~7）
  const getHoldingSortValue = useCallback((row: FundRow & { displayHolding: number }, col: number): number => {
    switch (col) {
      case 2: return row.displayHolding;
      case 3: return toNum(row.estAmount);
      case 4: return toNum(row.estPct);
      case 5: return toNum(row.actualAmount);
      case 6: return toNum(row.actualPct);
      case 7: return toNum(row.cumulative);
      default: return 0;
    }
  }, []);

  const sortedHoldingRows = useMemo(() => {
    if (!holdingSort) return displayFundRows;
    const { col, dir } = holdingSort;
    const arr = [...displayFundRows];
    arr.sort((a, b) => {
      const va = getHoldingSortValue(a, col);
      const vb = getHoldingSortValue(b, col);
      const cmp = va - vb;
      return dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [displayFundRows, holdingSort, getHoldingSortValue]);

  // 自选基金表排序列取值（列索引 2~6）：优先按数值，否则按字符串
  const getWatchlistSortValue = useCallback((row: FundRow, col: number): number | string => {
    switch (col) {
      case 2: return toNum(row.netValue);
      case 3: return toNum(row.estPct);
      case 4: {
        const s = String(row.dayOfGrowth ?? '');
        const m = s.match(/-?[\d.]+/);
        return m ? parseFloat(m[0]) : s;
      }
      case 5: return String(row.consecutiveInfo ?? '');
      case 6: return String(row.monthlyInfo ?? '');
      default: return 0;
    }
  }, []);

  const sortedWatchlistRows = useMemo(() => {
    if (!watchlistSort) return watchlistRows;
    const { col, dir } = watchlistSort;
    const arr = [...watchlistRows];
    arr.sort((a, b) => {
      const va = getWatchlistSortValue(a, col);
      const vb = getWatchlistSortValue(b, col);
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [watchlistRows, watchlistSort, getWatchlistSortValue]);

  const holdingTotalPages = Math.max(1, Math.ceil(sortedHoldingRows.length / holdingPageSize));
  const holdingPageSafe = Math.min(Math.max(1, holdingPage), holdingTotalPages);
  const holdingRowsForPage = useMemo(
    () => sortedHoldingRows.slice((holdingPageSafe - 1) * holdingPageSize, holdingPageSafe * holdingPageSize),
    [sortedHoldingRows, holdingPageSize, holdingPageSafe]
  );

  const watchlistTotalPages = Math.max(1, Math.ceil(sortedWatchlistRows.length / watchlistPageSize));
  const watchlistPageSafe = Math.min(Math.max(1, watchlistPage), watchlistTotalPages);
  const watchlistRowsForPage = useMemo(
    () => sortedWatchlistRows.slice((watchlistPageSafe - 1) * watchlistPageSize, watchlistPageSafe * watchlistPageSize),
    [sortedWatchlistRows, watchlistPageSize, watchlistPageSafe]
  );

  useEffect(() => {
    if (holdingPage > holdingTotalPages) setHoldingPage(Math.max(1, holdingTotalPages));
  }, [holdingTotalPages, holdingPage]);
  useEffect(() => {
    if (watchlistPage > watchlistTotalPages) setWatchlistPage(Math.max(1, watchlistTotalPages));
  }, [watchlistTotalPages, watchlistPage]);

  const displayTotalHolding = useMemo(() => displayFundRows.reduce((s, r) => s + r.displayHolding, 0), [displayFundRows]);
  const displayTodayEstPct = displayTotalHolding > 0 ? (summary.todayEstChange / displayTotalHolding) * 100 : summary.todayEstPct;
  const displayCumulative = summary.cumulative;
  const isSummaryEstimateStale = useMemo(() => {
    const first = fundRows.find((r) => toNum(r.holding) > 0) || fundRows[0];
    return first ? isEstimateStale(first.estimateDate) : false;
  }, [fundRows]);

  const aiContext = useMemo(() => {
    const parts: string[] = [];
    parts.push(`总持仓约 ${formatMoney(summary.totalHolding)}，今日预估涨跌 ${formatMoney(summary.todayEstChange)}（${formatPct(summary.todayEstPct)}），持仓收益 ${formatMoney(displayCumulative)}。`);
    if (fundRows.length > 0) {
      parts.push('持仓基金：');
      fundRows.forEach((r) => {
        const hold = toNum(r.holding);
        if (hold <= 0) return;
        parts.push(`- ${r.code} ${r.name || ''} 份额${hold} 今日预估${formatPct(r.estPct ?? 0)}`);
      });
    }
    return parts.join('\n');
  }, [summary.totalHolding, summary.todayEstChange, summary.todayEstPct, displayCumulative, fundRows]);

  if (!auth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        加载中…
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>持仓基金 - LanFund</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
          <PortfolioHeader
            dataSource={dataSource}
            onDataSourceChange={(v) => {
              setDataSource(v);
              if (typeof window !== 'undefined') localStorage.setItem('portfolio_data_source', v);
              clearCache('portfolio/table');
              clearCache('chart-data');
              // 切换数据源时只更新：预估收益、预估涨跌、预估涨幅、图表（实际收益/昨日涨幅/连涨跌/近30天由后端主备合并，不随切换变化）
              fetchData(v);
              if (selectedGroupId != null) fetchWatchlist(v);
            }}
            onRefresh={onRefresh}
            refreshing={refreshing}
            chartVisible={chartVisible}
            onChartVisibilityChange={(visible) => {
              setChartVisible(visible);
              if (typeof window !== 'undefined') {
                localStorage.setItem('portfolio_chart_visible', String(visible));
              }
            }}
          />

          {/* 免责声明 - 一比一样式 */}
          <div style={{
            marginBottom: 20,
            padding: '12px 15px',
            background: 'rgba(255, 193, 7, 0.1)',
            border: '1px solid rgba(255, 193, 7, 0.3)',
            borderRadius: 8,
            fontSize: 'var(--font-size-xs)',
            color: 'var(--text-dim)',
          }}>
            <p style={{ margin: 0, lineHeight: 1.5 }}>
              <strong style={{ color: '#ffc107' }}>⚠️ 免责声明</strong>：
              预估收益根据您输入的持仓份额与实时估值计算得出，仅供参考。
              实际收益以基金公司最终结算为准，可能因份额确认时间、分红方式、费用扣除等因素存在偏差。
              投资有风险，入市需谨慎。
            </p>
          </div>

          {/* 基金估值 - 可显示/隐藏 */}
          {chartVisible && (
          <div style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflow: 'hidden',
            marginBottom: 20,
          }}>
            <div style={{
              padding: '12px 15px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 15,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 15, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', color: 'var(--text-main)', flexShrink: 0 }}>
                  <span style={{ color: 'var(--up-color)' }}>■</span> 基金估值
                </h3>
                <div className="fund-selector-wrapper" style={{ flex: 1, minWidth: 280, maxWidth: '100%' }}>
                  <select
                    value={chartFund?.code || ''}
                    onChange={(e) => {
                      const code = e.target.value;
                      const f = chartSelectorFunds.find((x) => x.code === code);
                      if (f) setChartFund(f);
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 32px 6px 12px',
                      background: 'var(--card-bg)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 'var(--font-size-md)',
                    }}
                  >
                    {chartSelectorFunds.map((f) => (
                      <option key={f.code} value={f.code}>
                        {f.code} - {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div
              ref={chartContainerRef}
              className="fund-chart-container"
              style={{
                padding: '15px 15px 20px 15px', // 底部 padding 减小
                minHeight: 260,
                height: 'clamp(260px, 40vh, 520px)',
                background: 'var(--gh-bg-primary)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                width: '100%', // 确保铺满容器宽度
                overflow: 'visible', // 允许时间轴显示
              }}
            >
              {chartData.labels.length > 0 && chartData.growth.length > 0 ? (
                <>
                  {/* 右上角图例 */}
                  <div className="fund-chart-legend" style={{ position: 'absolute', top: 12, right: 15, color: 'var(--text-dim)', zIndex: 1, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-md)' }}>
                    {(() => {
                      const lastGrowth = chartData.growth[chartData.growth.length - 1];
                      const lastNetValue = chartData.net_values?.length ? chartData.net_values[chartData.net_values.length - 1] : null;
                      const isPositive = lastGrowth >= 0;
                      return (
                        <>
                          <span style={{ 
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            backgroundColor: isPositive ? 'var(--up-color)' : 'var(--down-color)',
                            borderRadius: 2,
                          }}></span>
                          <span>涨幅: {formatPct(lastGrowth)}</span>
                          {lastNetValue != null && (
                            <>
                              <span>|</span>
                              <span>净值: {lastNetValue.toFixed(4)}</span>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  {/* 使用 Chart.js 图表组件 - 使用 Suspense 延迟渲染，不阻塞页面 */}
                  <div style={{ flex: 1, minHeight: 0, marginTop: 24, width: '100%', height: 'calc(100% - 20px)', position: 'relative', pointerEvents: 'auto' }}>
                    {chartLoading ? (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <span style={{ color: 'var(--text-dim)' }}>加载图表数据中...</span>
                      </div>
                    ) : chartData.labels.length > 0 && chartData.growth.length > 0 ? (
                      <Suspense fallback={<div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'var(--text-dim)' }}>渲染图表中...</span></div>}>
                        <FundChart
                          labels={chartData.labels}
                          growth={chartData.growth}
                          netValues={chartData.net_values}
                        />
                      </Suspense>
                    ) : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <span style={{ color: 'var(--text-dim)' }}>暂无估值曲线数据</span>
                      </div>
                    )}
                  </div>
                  {/* 旧的 SVG 实现已替换为 Chart.js，以下代码保留但不执行 */}
                  {false && chartSvgContainerRef.current && (
                  <div ref={chartSvgContainerRef} style={{ flex: 1, minHeight: 0, marginTop: 24, width: '100%', height: 'calc(100% - 20px)', overflow: 'visible', position: 'relative', paddingBottom: 20 }}>
                  <svg
                    ref={chartSvgRef}
                    width="100%"
                    height="100%"
                    style={{ display: 'block', cursor: 'crosshair', position: 'absolute', top: 0, left: 0 }}
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    preserveAspectRatio="none"
                    onMouseMove={(e) => {
                      const svg = chartSvgRef.current;
                      const container = chartSvgContainerRef.current;
                      if (!svg || !container) return;
                      const rect = svg.getBoundingClientRect();
                      const containerRect = container.getBoundingClientRect();
                      // 根据实际 SVG 尺寸计算坐标（SVG 使用 preserveAspectRatio="none" 会拉伸）
                      const scaleX = chartWidth / rect.width;
                      const scaleY = chartHeight / rect.height;
                      const vx = (e.clientX - rect.left) * scaleX;
                      // 动态计算 padding（移动端更小）
                      const isMobile = rect.width < 600;
                      const pad = {
                        left: isMobile ? 40 : 52,
                        right: isMobile ? 12 : 20,
                        top: isMobile ? 8 : 10,
                        bottom: isMobile ? 24 : 30,
                      };
                      const w = Math.max(0, chartWidth - pad.left - pad.right);
                      const h = chartHeight - pad.top - pad.bottom;
                      const n = chartData.growth.length;
                      if (n === 0) return;
                      let i = Math.round(((vx - pad.left) / w) * (n - 1));
                      i = Math.max(0, Math.min(n - 1, i));
                      const growth = chartData.growth;
                      const minG = Math.min(...growth);
                      const maxG = Math.max(...growth);
                      const range = maxG - minG || 1;
                      const pointY = pad.top + h * (1 - (growth[i] - minG) / range);
                      const pointX = n > 1 ? pad.left + (i / (n - 1)) * w : pad.left + w / 2;
                      setChartHoverIndex(i);
                      setChartTooltipPos({
                        left: rect.left - containerRect.left + (pointX / scaleX),
                        top: rect.top - containerRect.top + (pointY / scaleY),
                      });
                    }}
                    onMouseLeave={() => {
                      setChartHoverIndex(null);
                      setChartTooltipPos(null);
                    }}
                  >
                    {(() => {
                      // 动态计算 padding（移动端更小）
                      const containerEl = chartSvgContainerRef.current;
                      if (!containerEl) return null;
                      // TypeScript 类型收窄：此时 containerEl 已确定不为 null
                      const containerWidth = containerEl!.clientWidth;
                      const isMobile = containerWidth < 600;
                      // 基础字体大小（固定，不受 SVG 缩放影响，因为使用 foreignObject）
                      const baseFontSize = isMobile ? 11 : 12; // 基础字体大小
                      // padding 需要为 Y 轴标题和 X 轴标签预留空间
                      const topLabelSpace = isMobile ? 12 : 16;
                      const bottomLabelSpace = isMobile ? 32 : 34; // 进一步增加底部空间，确保时间轴完全可见
                      const pad = {
                        left: isMobile ? 40 : 52,
                        right: isMobile ? 12 : 20,
                        top: topLabelSpace,  // 顶部空间用于 Y 轴标题
                        bottom: bottomLabelSpace,  // 底部空间用于 X 轴标签
                      };
                      const w = Math.max(0, chartWidth - pad.left - pad.right);
                      // chartHeight 已经包含了标签空间，所以图表区域高度需要减去这些空间
                      const h = Math.max(100, chartHeight - pad.top - pad.bottom);
                      const growth = chartData.growth;
                      const n = growth.length;
                      const minG = Math.min(...growth);
                      const maxG = Math.max(...growth);
                      const range = maxG - minG || 1;
                      const points = growth.map((g, i) => {
                        const x = n > 1 ? pad.left + (i / (n - 1)) * w : pad.left + w / 2;
                        const y = pad.top + h * (1 - (g - minG) / range);
                        return `${x},${y}`;
                      });
                      const numYGrid = Math.max(3, Math.min(14, Math.floor(h / (isMobile ? 30 : 40))));
                      // 横坐标铺满容器：使用更多网格点，确保时间标签分布到整个宽度
                      const numXGrid = Math.max(5, Math.min(15, Math.floor(w / (isMobile ? 40 : 50))));
                      const rawStepY = range / Math.max(1, numYGrid - 1);
                      const stepY = rawStepY <= 0.2 ? 0.1 : rawStepY <= 0.4 ? 0.25 : rawStepY <= 1 ? 0.5 : 1;
                      const tickMin = Math.floor(minG / stepY) * stepY;
                      const tickMax = Math.ceil(maxG / stepY) * stepY;
                      const yTicks: number[] = [];
                      for (let v = tickMin; v <= tickMax; v += stepY) {
                        const val = Math.round(v * 100) / 100;
                        if (val >= minG - 0.01 && val <= maxG + 0.01) yTicks.push(val);
                      }
                      if (yTicks.length === 0) yTicks.push(minG, maxG);
                      yTicks.sort((a, b) => a - b);
                      // 横坐标铺满容器：确保第一个和最后一个索引包含在内，中间均匀分布
                      const xTickIndices: number[] = [];
                      if (n > 0) {
                        xTickIndices.push(0); // 第一个点
                        if (numXGrid > 2) {
                          for (let k = 1; k < numXGrid - 1; k++) {
                            const idx = Math.round((k / (numXGrid - 1)) * (n - 1));
                            if (idx > 0 && idx < n - 1) xTickIndices.push(idx);
                          }
                        }
                        if (n > 1) xTickIndices.push(n - 1); // 最后一个点
                      }
                      const firstX = pad.left;
                      const lastX = pad.left + w;
                      const midIdx = Math.floor(n / 2);
                      const midX = n > 1 ? pad.left + (midIdx / (n - 1)) * w : pad.left + w / 2;
                      return (
                        <>
                          {/* 水平网格线（平行于 X 轴） */}
                          {yTicks.map((val, idx) => {
                            const y = pad.top + h * (1 - (val - minG) / range);
                            return (
                              <line
                                key={`hy-${idx}`}
                                x1={pad.left}
                                y1={y}
                                x2={pad.left + w}
                                y2={y}
                                stroke="var(--border)"
                                strokeWidth={0.5}
                                opacity={0.4}
                              />
                            );
                          })}
                          {/* 垂直网格线（平行于 Y 轴） */}
                          {xTickIndices.map((idx, k) => {
                            const x = n > 1 ? pad.left + (idx / (n - 1)) * w : pad.left + w / 2;
                            return (
                              <line
                                key={`vx-${k}`}
                                x1={x}
                                y1={pad.top}
                                x2={x}
                                y2={pad.top + h}
                                stroke="var(--border)"
                                strokeWidth={0.5}
                                opacity={0.4}
                              />
                            );
                          })}
                          {/* 0% 基准线（若区间含 0） */}
                          {minG <= 0 && maxG >= 0 && (
                            <line
                              x1={pad.left}
                              y1={pad.top + h * (1 - (0 - minG) / range)}
                              x2={pad.left + w}
                              y2={pad.top + h * (1 - (0 - minG) / range)}
                              stroke="var(--border)"
                              strokeDasharray="4 2"
                              strokeWidth={0.5}
                              opacity={0.6}
                            />
                          )}
                          {/* 分段着色：涨幅>0 红，涨幅<0 绿，带区域填充 */}
                          {points.map((_, i) => {
                            if (i === 0) return null;
                            const [x0, y0] = points[i - 1].split(',').map(Number);
                            const [x1, y1] = points[i].split(',').map(Number);
                            const isPositive = growth[i] > 0;
                            const color = isPositive ? 'var(--up-color)' : 'var(--down-color)';
                            // 计算 0% 基准线的 Y 坐标（如果存在）
                            const zeroY = minG <= 0 && maxG >= 0 ? pad.top + h * (1 - (0 - minG) / range) : null;
                            // 确定填充区域的基准线：如果存在 0% 基准线，使用它；否则使用图表底部
                            const baselineY = zeroY !== null ? zeroY : pad.top + h;
                            // 确定填充区域的上下边界
                            const fillTop = Math.min(y0, y1, baselineY);
                            const fillBottom = Math.max(y0, y1, baselineY);
                            return (
                              <g key={i}>
                                {/* 区域填充 */}
                                <polygon
                                  points={`${x0},${fillBottom} ${x0},${y0} ${x1},${y1} ${x1},${fillBottom}`}
                                  fill={color}
                                  fillOpacity={0.2}
                                />
                                {/* 线条 */}
                                <line
                                  x1={x0}
                                  y1={y0}
                                  x2={x1}
                                  y2={y1}
                                  stroke={color}
                                  strokeWidth={1}
                                  strokeLinecap="round"
                                />
                              </g>
                            );
                          })}
                          {/* 悬停时：竖线 + 圆点 */}
                          {(() => {
                            const hoverIdx = chartHoverIndex;
                            if (hoverIdx === null) return null;
                            if (n === 0) return null;
                            // TypeScript 类型收窄：此时 hoverIdx 已确定不为 null
                            const idx = hoverIdx as number;
                            if (idx < 0 || idx >= growth.length) {
                              return null;
                            }
                            return (
                              <>
                                <line
                                  x1={n > 1 ? pad.left + (idx / (n - 1)) * w : pad.left + w / 2}
                                  y1={pad.top}
                                  x2={n > 1 ? pad.left + (idx / (n - 1)) * w : pad.left + w / 2}
                                  y2={pad.top + h}
                                  stroke="var(--accent)"
                                  strokeDasharray="3 3"
                                  strokeWidth={1}
                                  opacity={0.8}
                                />
                                <circle
                                  r={4}
                                  cx={n > 1 ? pad.left + (idx / (n - 1)) * w : pad.left + w / 2}
                                  cy={pad.top + h * (1 - (growth[idx] - minG) / range)}
                                  fill={growth[idx] > 0 ? 'var(--up-color)' : 'var(--down-color)'}
                                  stroke="var(--card-bg)"
                                  strokeWidth={2}
                                />
                              </>
                            );
                          })()}
                        </>
                      );
                    })()}
                  </svg>
                  {/* 图表文本标签（绝对定位，不受 SVG 缩放影响） */}
                  {chartData.labels.length > 0 && chartWidth > 0 && chartHeight > 0 && (() => {
                    const containerEl = chartSvgContainerRef.current;
                    const svgEl = chartSvgRef.current;
                    if (!containerEl || !svgEl) return null;
                    // TypeScript 类型收窄：此时 containerEl 和 svgEl 已确定不为 null
                    const containerRect = containerEl!.getBoundingClientRect();
                    const svgRect = svgEl!.getBoundingClientRect();
                    if (svgRect.width === 0 || svgRect.height === 0) return null;
                    const scaleX = svgRect.width / chartWidth;
                    const scaleY = svgRect.height / chartHeight;
                    const containerWidth = containerEl!.clientWidth;
                    const isMobile = containerWidth < 600;
                    const baseFontSize = isMobile ? 11 : 12; // 基础字体大小
                    const pad = {
                      left: isMobile ? 40 : 52,
                      right: isMobile ? 12 : 20,
                      top: isMobile ? 12 : 16,
                      bottom: isMobile ? 32 : 34, // 进一步增加底部空间，确保时间轴完全可见
                    };
                    const w = Math.max(0, chartWidth - pad.left - pad.right);
                    const h = Math.max(100, chartHeight - pad.top - pad.bottom);
                    const growth = chartData.growth;
                    const n = growth.length;
                    const minG = Math.min(...growth);
                    const maxG = Math.max(...growth);
                    const range = maxG - minG || 1;
                    // 横坐标铺满容器：使用更多网格点，确保时间标签分布到整个宽度
                    const numXGrid = Math.max(5, Math.min(15, Math.floor(w / (isMobile ? 40 : 50))));
                    const xTickIndices: number[] = [];
                    if (n > 0) {
                      xTickIndices.push(0); // 第一个点
                      if (numXGrid > 2) {
                        for (let k = 1; k < numXGrid - 1; k++) {
                          const idx = Math.round((k / (numXGrid - 1)) * (n - 1));
                          if (idx > 0 && idx < n - 1) xTickIndices.push(idx);
                        }
                      }
                      if (n > 1) xTickIndices.push(n - 1); // 最后一个点
                    }
                    const rawStepY = range / Math.max(1, Math.max(3, Math.min(14, Math.floor(h / (isMobile ? 30 : 40)))) - 1);
                    const stepY = rawStepY <= 0.2 ? 0.1 : rawStepY <= 0.4 ? 0.25 : rawStepY <= 1 ? 0.5 : 1;
                    const tickMin = Math.floor(minG / stepY) * stepY;
                    const tickMax = Math.ceil(maxG / stepY) * stepY;
                    const yTicks: number[] = [];
                    for (let v = tickMin; v <= tickMax; v += stepY) {
                      const val = Math.round(v * 100) / 100;
                      if (val >= minG - 0.01 && val <= maxG + 0.01) yTicks.push(val);
                    }
                    if (yTicks.length === 0) yTicks.push(minG, maxG);
                    yTicks.sort((a, b) => a - b);
                    return (
                      <>
                        {/* X 轴时间标签 */}
                        {xTickIndices.map((idx, k) => {
                          const x = n > 1 ? pad.left + (idx / (n - 1)) * w : pad.left + w / 2;
                          const anchor = k === 0 ? 'start' : k === xTickIndices.length - 1 ? 'end' : 'middle';
                          const labelY = pad.top + h + (isMobile ? 20 : 22);
                          // 转换为实际像素位置
                          const pixelX = (svgRect.left - containerRect.left) + x * scaleX;
                          const pixelY = (svgRect.top - containerRect.top) + labelY * scaleY;
                          // 确保标签在容器内可见（考虑容器底部 padding）
                          const containerBottom = containerRect.top + containerRect.height;
                          const labelBottom = pixelY + baseFontSize * 1.2; // 估算标签高度
                          const adjustedPixelY = labelBottom > containerBottom - 20 ? containerBottom - 20 - baseFontSize * 1.2 : pixelY;
                          return (
                            <div
                              key={`xl-${k}`}
                              style={{
                                position: 'absolute',
                                left: `${pixelX}px`,
                                top: `${adjustedPixelY}px`,
                                transform: anchor === 'start' ? 'translateX(0)' : anchor === 'end' ? 'translateX(-100%)' : 'translateX(-50%)',
                                fontSize: `${baseFontSize}px`,
                                color: 'var(--text-dim)',
                                textAlign: anchor === 'start' ? 'left' : anchor === 'end' ? 'right' : 'center',
                                fontFamily: 'var(--font-family)',
                                whiteSpace: 'nowrap',
                                userSelect: 'none',
                                pointerEvents: 'none',
                                lineHeight: 1.2, // 增加行高，确保文字完整显示
                                paddingTop: 2, // 增加顶部内边距，确保文字不被裁剪
                              }}
                            >
                              {chartData.labels[idx]}
                            </div>
                          );
                        })}
                        {/* Y 轴刻度 */}
                        {yTicks.map((val, idx) => {
                          const tickY = Math.max(pad.top, Math.min(pad.top + h, pad.top + h * (1 - (val - minG) / range) + 4));
                          const tickX = pad.left - (isMobile ? 4 : 6);
                          const pixelX = (svgRect.left - containerRect.left) + tickX * scaleX;
                          const pixelY = (svgRect.top - containerRect.top) + tickY * scaleY;
                          return (
                            <div
                              key={idx}
                              style={{
                                position: 'absolute',
                                left: `${pixelX}px`,
                                top: `${pixelY}px`,
                                transform: 'translateX(-100%) translateY(-50%)',
                                fontSize: `${baseFontSize}px`,
                                color: 'var(--text-dim)',
                                textAlign: 'right',
                                fontFamily: 'var(--font-family)',
                                whiteSpace: 'nowrap',
                                userSelect: 'none',
                                pointerEvents: 'none',
                                lineHeight: 1,
                                paddingRight: '4px',
                              }}
                            >
                              {val.toFixed(2)}%
                            </div>
                          );
                        })}
                        {/* Y 轴标题 */}
                        {(() => {
                          const titleY = Math.max(10, pad.top - 2);
                          const titleX = pad.left - (isMobile ? 4 : 6);
                          const pixelX = (svgRect.left - containerRect.left) + titleX * scaleX;
                          const pixelY = (svgRect.top - containerRect.top) + titleY * scaleY;
                          return (
                            <div
                              style={{
                                position: 'absolute',
                                left: `${pixelX}px`,
                                top: `${pixelY}px`,
                                transform: 'translateX(-100%) translateY(-50%)',
                                fontSize: `${baseFontSize}px`,
                                color: 'var(--text-dim)',
                                textAlign: 'right',
                                fontFamily: 'var(--font-family)',
                                whiteSpace: 'nowrap',
                                userSelect: 'none',
                                pointerEvents: 'none',
                                lineHeight: 1,
                                paddingRight: '4px',
                              }}
                            >
                              涨幅(%)
                            </div>
                          );
                        })()}
                      </>
                    );
                  })()}
                  </div>
                  )}
                  {/* Chart.js 已内置工具提示，不再需要自定义悬停提示框 */}
                  {false && (() => {
                    const hoverIdx = chartHoverIndex;
                    const tooltipPos = chartTooltipPos;
                    if (hoverIdx === null) return null;
                    if (!tooltipPos) return null;
                    // TypeScript 类型收窄：此时 hoverIdx 和 tooltipPos 已确定不为 null
                    const idx = hoverIdx as number;
                    const pos = tooltipPos as { left: number; top: number };
                    if (idx < 0 || idx >= chartData.labels.length) return null;
                    if (chartData.labels[idx] == null) return null;
                    const netValues = chartData.net_values;
                    const netValueAtIdx: number | undefined = netValues ? netValues![idx] : undefined;
                    return (
                      <div
                        className="fund-chart-tooltip"
                        style={{
                          position: 'absolute',
                          left: pos.left,
                          top: pos.top,
                          transform: 'translate(-50%, -100%)',
                          marginTop: -8,
                          padding: '10px 14px',
                          background: 'rgba(30, 30, 30, 0.95)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          color: '#fff',
                          minWidth: 120,
                          zIndex: 10,
                          pointerEvents: 'none',
                        }}
                      >
                        <div style={{ color: 'rgba(255,255,255,0.8)', marginBottom: 6, fontSize: 'var(--font-size-xs)' }}>
                          时间: {chartData.labels[idx]}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: netValueAtIdx != null ? 4 : 0 }}>
                          <span style={{ 
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            backgroundColor: toNum(chartData.growth[idx]) >= 0 ? 'var(--up-color)' : 'var(--down-color)',
                            borderRadius: 2,
                          }}></span>
                          <span style={{ color: toNum(chartData.growth[idx]) >= 0 ? 'var(--up-color)' : 'var(--down-color)', fontWeight: 600 }}>
                            涨幅: {formatPct(chartData.growth[idx])}
                          </span>
                        </div>
                        {netValueAtIdx != null && netValueAtIdx !== undefined && (() => {
                          const value = netValueAtIdx!;
                          return (
                            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 'var(--font-size-xs)' }}>
                              净值: {value.toFixed(4)}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'var(--text-dim)' }}>暂无估值曲线数据</span>
                </div>
              )}
            </div>
          </div>
          )}

          {/* 导入/导出 */}
          <div className="file-operations" style={{
            marginBottom: 15,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: 15,
            background: 'rgba(102, 126, 234, 0.05)',
            borderRadius: 8,
            border: '1px solid rgba(102, 126, 234, 0.1)',
          }}>
            <button type="button" className="btn btn-secondary" onClick={onExport}>📄 导出基金列表</button>
            <button type="button" className="btn btn-secondary" onClick={onImport}>📄 导入基金列表</button>
            <button type="button" className="btn btn-info" style={{ marginLeft: 4 }} onClick={() => openSectorFundModal('mark')}>🏷️ 标注板块</button>
            <button type="button" className="btn btn-warning" onClick={() => openSectorFundModal('remove')}>🏷️ 删除板块</button>
            <button type="button" className="btn btn-danger" onClick={openDeleteFundModal}>🗑️ 删除基金</button>
            <span className="file-operations-tip">▲ 导入/导出为覆盖性操作,直接应用最新配置(非累加)</span>
          </div>

          <section className="portfolio-block" aria-label="持仓统计">
            <PortfolioSummaryBar
              summary={summary}
              hideSensitiveValues={hideSensitiveValues}
              displayTotalHolding={displayTotalHolding}
              displayTodayEstPct={displayTodayEstPct}
              displayCumulative={displayCumulative}
              clearedProfit={clearedProfit}
              isSummaryEstimateStale={isSummaryEstimateStale}
              onShowShowoff={() => setShowShowoffModal(true)}
              onToggleSensitive={() => {
                const next = !hideSensitiveValues;
                if (typeof window !== 'undefined') localStorage.setItem('hideSensitiveValues', String(next));
                setHideSensitiveValues(next);
              }}
            />
          </section>

          <section className="portfolio-block portfolio-fund-table" aria-label="持有基金">
            <HoldingTable
            rows={holdingRowsForPage}
            totalCount={sortedHoldingRows.length}
            isEmpty={fundRows.length === 0}
            sort={holdingSort}
            onSortClick={onHoldingSortClick}
            pageSize={holdingPageSize}
            page={holdingPageSafe}
            totalPages={holdingTotalPages}
            onPageSizeChange={(v) => { setHoldingPageSize(v); setHoldingPage(1); }}
            onPageChange={setHoldingPage}
            hideSensitiveValues={hideSensitiveValues}
            onRowDetail={setDetailRow}
          />
          </section>

          <section className="portfolio-block portfolio-fund-table" aria-label="自选基金">
            <WatchlistSection
            groups={groups}
            selectedGroupId={selectedGroupId}
            onSelectGroup={setSelectedGroupId}
            rows={watchlistRowsForPage}
            totalCount={sortedWatchlistRows.length}
            isEmpty={watchlistRows.length === 0}
            sort={watchlistSort}
            onSortClick={onWatchlistSortClick}
            pageSize={watchlistPageSize}
            page={watchlistPageSafe}
            totalPages={watchlistTotalPages}
            onPageSizeChange={(v) => { setWatchlistPageSize(v); setWatchlistPage(1); }}
            onPageChange={setWatchlistPage}
            addInput={addInput}
            onAddInputChange={(v) => { setAddInput(v); setShowSuggestions(true); setAddError(''); }}
            addSuggestions={addSuggestions}
            addSuggestionsLoading={suggestLoading}
            showSuggestions={showSuggestions}
            onShowSuggestions={setShowSuggestions}
            onSelectSuggestion={(code, name) => { setAddInput(`${code} - ${name}`); setShowSuggestions(false); }}
            addLoading={addLoading}
            addError={addError}
            onAddFund={onAddFund}
            onNewGroup={() => setShowNewGroupModal(true)}
            onDeleteGroup={() => setShowDeleteGroupModal(true)}
            defaultGroupId={groups.find((g) => g.sort_order === 0)?.id ?? groups[0]?.id ?? null}
            onRowDetail={setDetailRow}
            onEditHolding={openEditHolding}
            onRemoveFromGroup={onRemoveFromGroup}
            dataSource={dataSource}
          />
          </section>

          <FundDetailModal
            row={detailRow}
            onClose={() => setDetailRow(null)}
            holdings={detailHoldings}
            holdingsLoading={detailHoldingsLoading}
            collapsed={detailHoldingsCollapsed}
            onToggleCollapsed={() => setDetailHoldingsCollapsed((c) => !c)}
            hideSensitiveValues={hideSensitiveValues}
          />

          <EditHoldingModal
            row={editHoldingRow}
            onClose={() => setEditHoldingRow(null)}
            holdingAmount={editHoldingAmount}
            cumulativeProfit={editCumulativeProfit}
            onHoldingAmountChange={setEditHoldingAmount}
            onCumulativeProfitChange={setEditCumulativeProfit}
            calculatedUnits={(() => {
              const amount = parseFloat(editHoldingAmount) || 0;
              const profit = parseFloat(editCumulativeProfit) || 0;
              const netValue = editHoldingRow ? parseNetValue(editHoldingRow.netValue) || 1 : 1;
              return calculateHoldingData(amount, profit, netValue).units;
            })()}
            calculatedCostPerUnit={(() => {
              const amount = parseFloat(editHoldingAmount) || 0;
              const profit = parseFloat(editCumulativeProfit) || 0;
              const netValue = editHoldingRow ? parseNetValue(editHoldingRow.netValue) || 1 : 1;
              return calculateHoldingData(amount, profit, netValue).costPerUnit;
            })()}
            error={editHoldingError}
            loading={editHoldingLoading}
            onSave={onSaveEditHolding}
          />

          {/* 新建分组弹窗 */}
          {showNewGroupModal && (
            <div className="sector-modal active" style={{ display: 'flex' }} onClick={() => !newGroupLoading && setShowNewGroupModal(false)}>
              <div className="sector-modal-content" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
                <div className="sector-modal-header">新建分组</div>
                <div style={{ padding: '16px 0' }}>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)' }}>分组名称</label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="例如：科技板块"
                    className="sector-modal-search"
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="sector-modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowNewGroupModal(false)} disabled={newGroupLoading}>取消</button>
                  <button type="button" className="btn btn-primary" onClick={onCreateGroup} disabled={newGroupLoading}>{newGroupLoading ? '创建中…' : '创建'}</button>
                </div>
              </div>
            </div>
          )}

          {/* 删除分组弹窗 */}
          {showDeleteGroupModal && (
            <div className="sector-modal active" style={{ display: 'flex' }} onClick={() => !deletingGroupId && setShowDeleteGroupModal(false)}>
              <div className="sector-modal-content" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
                <div className="sector-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)' }}>删除分组</span>
                  <button type="button" style={{ background: 'none', border: 'none', fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)', cursor: 'pointer', padding: '0 4px' }} onClick={() => setShowDeleteGroupModal(false)}>×</button>
                </div>
                <div style={{ padding: '16px 0' }}>
                  <p style={{ margin: '0 0 16px', fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)' }}>
                    请选择要删除的分组，删除后该分组内的基金将移至默认分组。
                  </p>
                  {groups.filter((g) => g.sort_order !== 0).length === 0 ? (
                    <p style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 'var(--font-size-xs)' }}>没有可删除的分组</p>
                  ) : (
                    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                      {groups
                        .filter((g) => g.sort_order !== 0)
                        .map((g) => (
                          <div
                            key={g.id}
                            style={{
                              padding: '12px 16px',
                              marginBottom: 8,
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              background: deletingGroupId === g.id ? 'var(--gh-bg-tertiary)' : 'var(--card-bg)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              cursor: deletingGroupId === g.id ? 'not-allowed' : 'pointer',
                              opacity: deletingGroupId === g.id ? 0.6 : 1,
                            }}
                            onClick={() => {
                              if (deletingGroupId === null) {
                                onDeleteGroup(g.id);
                              }
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-main)', fontWeight: 500 }}>{g.name}</div>
                              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)', marginTop: 4 }}>
                                包含 {g.fund_codes?.length || 0} 只基金
                              </div>
                            </div>
                            {deletingGroupId === g.id ? (
                              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)' }}>删除中…</span>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '6px 12px', fontSize: 'var(--font-size-xs)' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteGroup(g.id);
                                }}
                              >
                                删除
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                <div className="sector-modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteGroupModal(false)} disabled={deletingGroupId !== null}>
                    关闭
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 选择基金（标注/删除板块） */}
          {showSectorFundModal && (
            <div className="sector-modal active" style={{ display: 'flex' }} onClick={() => !sectorSubmitLoading && setShowSectorFundModal(false)}>
              <div className="sector-modal-content" style={{ maxWidth: 480, width: '95%' }} onClick={(e) => e.stopPropagation()}>
                <div className="sector-modal-header">
                  {sectorOp === 'mark' ? '选择要标注板块的基金' : '选择要删除板块的基金'}
                </div>
                <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
                  {sectorFundList.map((f) => (
                    <div
                      key={f.code}
                      role="button"
                      tabIndex={0}
                      style={{
                        padding: '12px',
                        marginBottom: 8,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: sectorSelectedCodes.includes(f.code) ? 'rgba(102, 126, 234, 0.2)' : 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                      }}
                      onClick={() => setSectorSelectedCodes((prev) => prev.includes(f.code) ? prev.filter((c) => c !== f.code) : [...prev, f.code])}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSectorSelectedCodes((prev) => prev.includes(f.code) ? prev.filter((c) => c !== f.code) : [...prev, f.code]); } }}
                    >
                      <span style={{ color: 'var(--accent)' }}>{f.code}</span>
                      <span>{f.name}</span>
                      {f.sectors && f.sectors.length > 0 && (
                        <span style={{ color: 'var(--text-dim)', fontSize: 'var(--font-size-xs)' }}>🏷️ {f.sectors.join(', ')}</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="sector-modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowSectorFundModal(false)} disabled={sectorSubmitLoading}>取消</button>
                  <button type="button" className="btn btn-primary" onClick={confirmSectorFundSelection} disabled={sectorSubmitLoading}>
                    {sectorSubmitLoading ? '处理中…' : '确定'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 删除基金模态框 */}
          {showDeleteFundModal && (
            <div className="sector-modal active" style={{ display: 'flex' }} onClick={() => !deleteSubmitLoading && setShowDeleteFundModal(false)}>
              <div className="sector-modal-content" style={{ maxWidth: 480, width: '95%' }} onClick={(e) => e.stopPropagation()}>
                <div className="sector-modal-header">选择要删除的基金</div>
                <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
                  {deleteFundList.map((f) => (
                    <div
                      key={f.code}
                      role="button"
                      tabIndex={0}
                      style={{
                        padding: '12px',
                        marginBottom: 8,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: deleteSelectedCodes.includes(f.code) ? 'rgba(248, 81, 73, 0.2)' : 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                      }}
                      onClick={() => setDeleteSelectedCodes((prev) => prev.includes(f.code) ? prev.filter((c) => c !== f.code) : [...prev, f.code])}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDeleteSelectedCodes((prev) => prev.includes(f.code) ? prev.filter((c) => c !== f.code) : [...prev, f.code]); } }}
                    >
                      <span style={{ color: 'var(--down-color)' }}>{f.code}</span>
                      <span>{f.name}</span>
                    </div>
                  ))}
                </div>
                <div className="sector-modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteFundModal(false)} disabled={deleteSubmitLoading}>取消</button>
                  <button type="button" className="btn btn-danger" onClick={confirmDeleteFund} disabled={deleteSubmitLoading}>
                    {deleteSubmitLoading ? '删除中…' : '确定删除'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 选择板块（标注用） */}
          {showSectorTagModal && (
            <div className="sector-modal active" style={{ display: 'flex' }} onClick={() => !sectorSubmitLoading && setShowSectorTagModal(false)}>
              <div className="sector-modal-content sector-modal-two-col" style={{ maxWidth: 720, width: '95%', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'row', gap: 16 }} onClick={(e) => e.stopPropagation()}>
                {/* 左侧：板块选择 */}
                <div className="sector-modal-two-col-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div className="sector-modal-header">选择板块</div>
                  <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
                    {Object.entries(SECTOR_CATEGORIES).map(([category, tags]) => (
                      <div key={category} style={{ marginBottom: 20 }}>
                        <div style={{ marginBottom: 8, color: 'var(--text-dim)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{category}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {tags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              className="btn"
                              style={{
                                padding: '8px 12px',
                                fontSize: 'var(--font-size-xs)',
                                background: sectorSelectedTags.includes(tag) ? 'var(--accent)' : 'var(--gh-bg-tertiary)',
                                color: sectorSelectedTags.includes(tag) ? '#fff' : 'var(--text-main)',
                                border: '1px solid var(--border)',
                              }}
                              onClick={() => toggleSectorTag(tag)}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="sector-modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowSectorTagModal(false)} disabled={sectorSubmitLoading}>取消</button>
                    <button type="button" className="btn btn-primary" onClick={confirmSectorTagSelection} disabled={sectorSubmitLoading}>
                      {sectorSubmitLoading ? '提交中…' : '确定'}
                    </button>
                  </div>
                </div>
                {/* 右侧：添加分组功能 */}
                <div className="sector-modal-two-col-side" style={{ width: 180, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
                  <div style={{ marginBottom: 12, color: 'var(--text-main)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>功能</div>
                  <button
                    type="button"
                    className="btn btn-info"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 'var(--font-size-xs)',
                      marginBottom: 12,
                    }}
                    onClick={() => {
                      if (sectorSelectedCodes.length === 0) {
                        toast.error('请先选择要添加的基金');
                        return;
                      }
                      setShowAddToGroupModal(true);
                    }}
                    disabled={sectorSubmitLoading || sectorSelectedCodes.length === 0}
                  >
                    ➕ 添加分组
                  </button>
                  {sectorSelectedCodes.length > 0 && (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)', marginTop: 8 }}>
                      已选择 {sectorSelectedCodes.length} 只基金
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 选择分组（添加基金到分组） */}
          {showAddToGroupModal && (
            <div className="sector-modal active" style={{ display: 'flex' }} onClick={() => !addToGroupLoading && setShowAddToGroupModal(false)}>
              <div className="sector-modal-content" style={{ maxWidth: 400, width: '95%' }} onClick={(e) => e.stopPropagation()}>
                <div className="sector-modal-header">选择分组</div>
                <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 16 }}>
                  {groups.length === 0 ? (
                    <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>暂无分组，请先创建分组</p>
                  ) : (
                    groups.map((group) => (
                      <div
                        key={group.id}
                        role="button"
                        tabIndex={0}
                        style={{
                          padding: '12px',
                          marginBottom: 8,
                          cursor: 'pointer',
                          background: 'var(--gh-bg-tertiary)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                        }}
                        onClick={async () => {
                          if (addToGroupLoading) return;
                          setAddToGroupLoading(true);
                          try {
                            const results = await Promise.all(
                              sectorSelectedCodes.map(async (code) => {
                                const r = await fetch(`/api/fund/groups/${group.id}/funds`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ code }),
                                });
                                const d = await r.json();
                                return { code, success: d.success, message: d.message };
                              })
                            );
                            const successCount = results.filter((r) => r.success).length;
                            const failCount = results.length - successCount;
                            if (successCount > 0) {
                              toast.success(`成功添加 ${successCount} 只基金到分组"${group.name}"${failCount > 0 ? `，${failCount} 只失败` : ''}`);
                              clearCache('portfolio/table');
                              fetchData();
                              fetchWatchlist();
                            } else {
                              toast.error('添加失败：' + results.map((r) => r.message).filter(Boolean).join('; '));
                            }
                            setShowAddToGroupModal(false);
                          } catch (e) {
                            toast.error('操作失败：' + (e as Error).message);
                          } finally {
                            setAddToGroupLoading(false);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            (e.currentTarget as HTMLElement).click();
                          }
                        }}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{group.name}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)', marginTop: 4 }}>
                          {group.fund_codes?.length || 0} 只基金
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="sector-modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddToGroupModal(false)} disabled={addToGroupLoading}>取消</button>
                </div>
              </div>
            </div>
          )}

          {/* 一键炫耀卡片弹窗 */}
          {showShowoffModal && (
            <div
              className="sector-modal active"
              style={{
                display: 'flex',
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                zIndex: 10000,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onClick={() => setShowShowoffModal(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 375,
                  maxWidth: 'calc(100vw - 40px)',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                  borderRadius: 24,
                  position: 'relative',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                  padding: 20,
                  color: '#fff',
                }}
              >
                <button
                  type="button"
                  title="关闭"
                  style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: '1.25rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onClick={() => setShowShowoffModal(false)}
                >
                  ✕
                </button>
                <div style={{ textAlign: 'center', padding: '25px 20px 12px' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>💰</div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 8px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>今日收益</h2>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                    {new Date().getFullYear()}-{String(new Date().getMonth() + 1).padStart(2, '0')}-{String(new Date().getDate()).padStart(2, '0')}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{ flex: 1, maxWidth: 200, background: 'linear-gradient(135deg, rgba(102,126,234,0.2), rgba(118,75,162,0.15))', border: '1px solid rgba(102,126,234,0.3)', borderRadius: 16, padding: '14px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>总持仓</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>{hideSensitiveValues ? '****' : formatYuan(displayTotalHolding)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                    <div style={{ flex: 1, maxWidth: 140, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '14px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>今日预估</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: summary.todayEstChange >= 0 ? '#ff4757' : '#2ed573' }}>{hideSensitiveValues ? '****' : formatMoney(summary.todayEstChange)}</div>
                    </div>
                    <div style={{ flex: 1, maxWidth: 140, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '14px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>今日实际</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: summary.todayActualText.includes('未') ? 'rgba(255,255,255,0.7)' : (summary.todayEstChange >= 0 ? '#ff4757' : '#2ed573') }}>{hideSensitiveValues ? '****' : summary.todayActualText}</div>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '0 20px 20px' }}>
                  <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>🏆 收益Top3</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[...fundRows]
                      .sort((a, b) => {
                        const gainA = toNum(a.actualAmount) !== 0 ? toNum(a.actualAmount) : toNum(a.estAmount);
                        const gainB = toNum(b.actualAmount) !== 0 ? toNum(b.actualAmount) : toNum(b.estAmount);
                        return gainB - gainA;
                      })
                      .slice(0, 3)
                      .map((r, i) => {
                        const gain = toNum(r.actualAmount) !== 0 ? toNum(r.actualAmount) : toNum(r.estAmount);
                        const gainColor = gain >= 0 ? '#ff4757' : '#2ed573';
                        return (
                          <div
                            key={r.code}
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: 12,
                              padding: '12px 16px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                            }}
                          >
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 700,
                                flexShrink: 0,
                                background: i === 0 ? 'linear-gradient(135deg, #ffd700, #ffaa00)' : i === 1 ? 'linear-gradient(135deg, #c0c0c0, #a0a0a0)' : 'linear-gradient(135deg, #cd7f32, #b87333)',
                                color: '#1a1a2e',
                              }}
                            >
                              {i + 1}
                            </div>
                            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{r.name || r.code}</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: gainColor, whiteSpace: 'nowrap' }}>{hideSensitiveValues ? '****' : formatMoney(gain)}</div>
                          </div>
                        );
                      })}
                    {fundRows.length === 0 && (
                      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 'var(--font-size-xs)' }}>暂无数据</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
      <AiAssistant context={aiContext} />
    </>
  );
}
