import { useState, useEffect, useCallback, useMemo, useRef, startTransition, Suspense } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useChartData } from '../hooks/useChartData';
import { apiGet, apiPost, apiPut, apiDelete, clearCache } from '../utils/apiClient';

// 动态导入大型图表组件，优化首屏加载
// 使用更激进的延迟加载策略，确保不阻塞页面
const FundChart = dynamic(() => import('../components/FundChart'), {
  loading: () => null, // 不显示加载提示，避免阻塞页面
  ssr: false, // 图表组件不需要 SSR
});

const API = process.env.NEXT_PUBLIC_API_URL || '';

type FundRow = {
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

type Summary = {
  totalHolding: number;
  todayEstChange: number;
  todayEstPct: number;
  todayActualText: string;
  todayActual: number;
  cumulative: number;
};

type Group = { id: number; name: string; fund_codes: string[]; sort_order: number };

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function formatMoney(n: number): string {
  const x = toNum(n);
  const s = x >= 0 ? `+¥${x.toFixed(2)}` : `-¥${Math.abs(x).toFixed(2)}`;
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function formatPct(n: number): string {
  const x = toNum(n);
  const s = x >= 0 ? `+${x.toFixed(2)}%` : `${x.toFixed(2)}%`;
  return s;
}
function formatYuan(n: number): string {
  const x = toNum(n);
  return '¥' + x.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const SECTOR_CATEGORIES: Record<string, string[]> = {
  '科技': ['人工智能', '半导体', '云计算', '5G', '光模块', 'CPO', '通信设备', 'PCB', '消费电子', '计算机', '软件开发', '信创', '网络安全', 'IT服务', '国产软件', '光通信', '算力', '通信', '电子', '光学光电子', '元件', '存储芯片', '第三代半导体', '光刻胶', '电子化学品', 'LED', 'TMT', '科技'],
  '医药健康': ['医药生物', '医疗器械', '生物疫苗', 'CRO', '创新药', '精准医疗', '医疗服务', '中药', '化学制药', '生物制品', '基因测序'],
  '消费': ['食品饮料', '白酒', '家用电器', '纺织服饰', '商贸零售', '新零售', '家居用品', '婴童', '养老产业', '可选消费', '消费', '智能家居'],
  '金融': ['银行', '证券', '保险', '非银金融', '国有大型银行', '股份制银行', '城商行', '金融'],
  '能源': ['新能源', '煤炭', '石油石化', '电力', '绿色电力', '氢能源', '储能', '锂电池', '电池', '光伏设备', '风电设备', '充电桩', '固态电池', '能源', '公用事业', '锂矿'],
  '工业制造': ['机械设备', '汽车', '新能源车', '工程机械', '高端装备', '电力设备', '专用设备', '通用设备', '自动化设备', '机器人', '人形机器人', '汽车零部件', '电网设备', '电机', '高端制造', '工业4.0', '低空经济'],
  '材料': ['有色金属', '黄金股', '贵金属', '基础化工', '钢铁', '建筑材料', '稀土永磁', '小金属', '工业金属', '材料', '大宗商品', '资源'],
  '军工': ['国防军工', '航天装备', '航空装备', '航海装备', '军工电子', '军民融合', '商业航天', '卫星互联网', '航母', '航空机场'],
  '基建地产': ['建筑装饰', '房地产', '房地产开发', '房地产服务', '交通运输', '物流'],
  '环保': ['环保', '环保设备', '环境治理', '垃圾分类', '碳中和', '液冷'],
  '传媒': ['传媒', '游戏', '影视', '元宇宙', '超清视频', '数字孪生'],
  '主题': ['国企改革', '一带一路', '中特估', '中字头', '并购重组', '华为', '新兴产业', '国家安防', '农牧主题', '农林牧渔', '养殖业', '猪肉'],
};

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
  
  // 使用图表数据 Hook
  const {
    chartFund,
    setChartFund,
    chartData,
    chartLoading,
    preloadedChartData,
    preloadChartData,
    fetchChartData,
  } = useChartData(auth);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [watchlistRows, setWatchlistRows] = useState<FundRow[]>([]);
  const [addInput, setAddInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [newGroupLoading, setNewGroupLoading] = useState(false);
  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null);
  const [editHoldingRow, setEditHoldingRow] = useState<FundRow | null>(null);
  const [editHoldingUnits, setEditHoldingUnits] = useState('');
  const [editCostPerUnit, setEditCostPerUnit] = useState('');
  const [editHoldingLoading, setEditHoldingLoading] = useState(false);
  const [editHoldingError, setEditHoldingError] = useState('');
  const [detailRow, setDetailRow] = useState<FundRow | null>(null);
  const [showShowoffModal, setShowShowoffModal] = useState(false);
  const [hideSensitiveValues, setHideSensitiveValues] = useState(false);
  // 加仓弹窗（参照 openAddPositionModal）
  const [addPositionRow, setAddPositionRow] = useState<FundRow | null>(null);
  const [addPositionAmount, setAddPositionAmount] = useState('');
  const [addPositionFeeRate, setAddPositionFeeRate] = useState<0 | 0.1 | 0.15>(0);
  const [addPositionTime, setAddPositionTime] = useState<{ date: string; period: 'before15' | 'after15' } | null>(null);
  const [addPositionLoading, setAddPositionLoading] = useState(false);
  const [addPositionTimePickerOpen, setAddPositionTimePickerOpen] = useState(false);
  // 减仓弹窗（参照 openReducePositionModal）
  const [reducePositionRow, setReducePositionRow] = useState<FundRow | null>(null);
  const [reducePositionUnits, setReducePositionUnits] = useState('');
  const [reducePositionFeeRate, setReducePositionFeeRate] = useState<0 | 0.5 | 1 | 1.5>(0);
  const [reducePositionTime, setReducePositionTime] = useState<{ date: string; period: 'before15' | 'after15' } | null>(null);
  const [reducePositionLoading, setReducePositionLoading] = useState(false);
  const [reducePositionTimePickerOpen, setReducePositionTimePickerOpen] = useState(false);
  const [cumulativeCorrection, setCumulativeCorrection] = useState(0);
  const [showCumulativeCorrectionModal, setShowCumulativeCorrectionModal] = useState(false);
  const [cumulativeCorrectionInput, setCumulativeCorrectionInput] = useState('');
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setHideSensitiveValues(localStorage.getItem('hideSensitiveValues') === 'true');
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const v = localStorage.getItem('lan_fund_cumulative_correction');
    const n = v !== null && v !== '' ? parseFloat(v) : 0;
    setCumulativeCorrection(Number.isFinite(n) ? n : 0);
  }, []);

  const fetchAuth = useCallback(() => {
    // 使用 API 客户端，带缓存（10分钟）
    return apiGet<{ username: string }>(`${API}/api/auth/me`, {
      cache: { ttl: 10 * 60 * 1000 }, // 10分钟缓存
    })
      .then((d) => {
        setAuth(d);
        return d;
      });
  }, []);

  const fetchData = useCallback(() => {
    // 立即设置 loading 为 false，让页面可以立即交互
    // 数据会在后台加载，完成后更新状态，但不阻塞用户操作
    setLoading(false);
    setRefreshing(false);
    
    // 使用 API 客户端，带缓存
    Promise.all([
      apiGet(`${API}/api/portfolio/table?group=&holdOnly=1`, {
        cache: { ttl: 2 * 60 * 1000 }, // 2分钟缓存
      }),
      apiGet(`${API}/api/fund/data`, {
        cache: { ttl: 5 * 60 * 1000 }, // 5分钟缓存
      }),
      apiGet(`${API}/api/portfolio/fund-list`, {
        cache: { ttl: 5 * 60 * 1000 }, // 5分钟缓存
      }),
      apiGet(`${API}/api/fund/groups`, {
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
      }
      if (listRes.success && listRes.funds && listRes.funds.length) {
        setFundList(listRes.funds);
        const firstFund = listRes.funds[0];
        
        // 预加载所有持仓基金的图表数据
        preloadChartData();
        
        // 只在首次加载且没有选中基金时设置默认基金
        if (!chartFund) {
          // 延迟设置图表基金，确保页面完全渲染后再加载图表
          setTimeout(() => {
            startTransition(() => {
              setChartFund(firstFund);
            });
          }, 500); // 延迟500ms，让页面先完全渲染和交互
        }
      }
      if (groupsRes.success && groupsRes.groups && groupsRes.groups.length) {
        const list = groupsRes.groups as Group[];
        setGroups(list);
        setSelectedGroupId((prev) => (prev === null && list.length ? list[0].id : prev));
      }
    }).catch(() => {
      setFundRows([]);
      setLoading(false);
      setRefreshing(false);
    });
  }, [chartFund, preloadChartData]);

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
    fetchAuth().then(() => fetchData()).catch(() => router.replace('/login'));
  }, []);

  useEffect(() => {
    if (auth && !loading) fetchData();
  }, [auth, refreshing]);

  const fetchWatchlist = useCallback(() => {
    if (selectedGroupId == null) return;
    const opts = { credentials: 'include' as RequestCredentials };
    fetch(`${API}/api/portfolio/table?group=${selectedGroupId}`, opts)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.rows) setWatchlistRows(res.rows);
        else setWatchlistRows([]);
      })
      .catch(() => setWatchlistRows([]));
  }, [selectedGroupId]);

  useEffect(() => {
    if (auth && selectedGroupId != null) fetchWatchlist();
  }, [auth, selectedGroupId, fetchWatchlist, refreshing]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
    if (selectedGroupId != null) fetchWatchlist();
  };

  const onExport = () => {
    window.open(`${API}/api/fund/download`, '_blank');
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
      const r = await fetch(`${API}/api/fund/upload`, { method: 'POST', credentials: 'include', body: form });
      const d = await r.json();
      alert(d.message || (d.success ? '导入成功' : '导入失败'));
      if (d.success) {
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
      const r = await fetch(`${API}/api/fund/data`, { credentials: 'include' });
      const fundMap = (await r.json()) as Record<string, { fund_name?: string; sectors?: string[] }>;
      const list = Object.entries(fundMap).map(([code, data]) => ({
        code,
        name: data.fund_name || `基金${code}`,
        sectors: data.sectors || [],
      }));
      setSectorFundList(list);
      setShowSectorFundModal(true);
    } catch (e) {
      alert('获取基金列表失败');
    }
  };

  const openDeleteFundModal = async () => {
    setDeleteSelectedCodes([]);
    try {
      const r = await fetch(`${API}/api/fund/data`, { credentials: 'include' });
      const fundMap = (await r.json()) as Record<string, { fund_name?: string }>;
      const list = Object.entries(fundMap).map(([code, data]) => ({
        code,
        name: data.fund_name || `基金${code}`,
      }));
      setDeleteFundList(list);
      setShowDeleteFundModal(true);
    } catch (e) {
      alert('获取基金列表失败');
    }
  };

  const confirmDeleteFund = () => {
    if (deleteSelectedCodes.length === 0) {
      alert('请至少选择一只基金');
      return;
    }
    if (!confirm(`确定要删除 ${deleteSelectedCodes.length} 只基金吗？`)) return;
    setDeleteSubmitLoading(true);
    fetch(`${API}/api/fund/delete`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes: deleteSelectedCodes.join(',') }),
    })
      .then((res) => res.json())
      .then((d) => {
        alert(d.message || (d.success ? '删除成功' : '删除失败'));
        if (d.success) {
          setShowDeleteFundModal(false);
          setDeleteSelectedCodes([]);
          fetchData();
          fetchWatchlist();
        }
      })
      .catch(() => alert('删除失败'))
      .finally(() => setDeleteSubmitLoading(false));
  };

  const confirmSectorFundSelection = () => {
    if (sectorSelectedCodes.length === 0) {
      alert('请至少选择一只基金');
      return;
    }
    if (sectorOp === 'remove') {
      setSectorSubmitLoading(true);
      fetch(`${API}/api/fund/sector/remove`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: sectorSelectedCodes.join(',') }),
      })
        .then((res) => res.json())
        .then((d) => {
          alert(d.message || (d.success ? '已删除板块标记' : '操作失败'));
          if (d.success) { fetchData(); setShowSectorFundModal(false); setSectorOp(null); }
        })
        .catch(() => alert('操作失败'))
        .finally(() => setSectorSubmitLoading(false));
      return;
    }
    setShowSectorFundModal(false);
    setShowSectorTagModal(true);
  };

  const confirmSectorTagSelection = () => {
    if (sectorSelectedTags.length === 0) {
      alert('请至少选择一个板块');
      return;
    }
    setSectorSubmitLoading(true);
    fetch(`${API}/api/fund/sector`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes: sectorSelectedCodes.join(','), sectors: sectorSelectedTags }),
    })
      .then((res) => res.json())
      .then((d) => {
        alert(d.message || (d.success ? '已标注板块' : '操作失败'));
        if (d.success) { fetchData(); setShowSectorTagModal(false); setSectorOp(null); }
      })
      .catch(() => alert('操作失败'))
      .finally(() => setSectorSubmitLoading(false));
  };

  const toggleSectorTag = (tag: string) => {
    setSectorSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addSuggestions = addInput.trim()
    ? fundList.filter(
        (f) =>
          f.code.includes(addInput.trim()) ||
          (f.name && f.name.includes(addInput.trim()))
      ).slice(0, 8)
    : [];

  const parseCodeFromInput = (val: string): string => {
    const t = val.trim();
    if (/^\d{6}$/.test(t)) return t;
    const m = t.match(/^(\d{6})\s*[-–—]\s*/);
    if (m) return m[1];
    return t;
  };

  const onRemoveFromGroup = async (code: string) => {
    if (selectedGroupId == null) return;
    if (!confirm('确定从该分组中移除该基金吗？')) return;
    try {
      const r = await fetch(`${API}/api/fund/groups/${selectedGroupId}/funds/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const d = await r.json();
      if (d.success) {
        fetchData();
        fetchWatchlist();
      } else {
        alert(d.message || '移除失败');
      }
    } catch (e) {
      alert('网络错误');
    }
  };

  const onAddFund = async () => {
    const code = parseCodeFromInput(addInput);
    if (!code) {
      setAddError('请输入基金代码');
      return;
    }
    if (selectedGroupId == null) {
      setAddError('请先选择分组');
      return;
    }
    setAddError('');
    setAddLoading(true);
    try {
      const r = await fetch(`${API}/api/fund/groups/${selectedGroupId}/funds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });
      const d = await r.json();
      if (d.success) {
        setAddInput('');
        setShowSuggestions(false);
        fetchData();
        fetchWatchlist();
      } else {
        setAddError(d.message || '添加失败');
      }
    } catch (e) {
      setAddError('网络错误');
    } finally {
      setAddLoading(false);
    }
  };

  const onCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      alert('请输入分组名称');
      return;
    }
    setNewGroupLoading(true);
    try {
      const r = await fetch(`${API}/api/fund/groups`, {
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
        clearCache(`${API}/api/fund/groups`);
        // 重新获取分组列表
        apiGet(`${API}/api/fund/groups`, {
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
        alert(d.message || '创建失败');
      }
    } catch (e) {
      alert('网络错误');
    } finally {
      setNewGroupLoading(false);
    }
  };

  async function onDeleteGroup(id: number) {
    setDeletingGroupId(id);
    try {
      const r = await fetch(`${API}/api/fund/groups/${id}`, { method: 'DELETE', credentials: 'include' });
      const d = await r.json();
      if (d.success) {
        setShowDeleteGroupModal(false);
        // 清除分组列表缓存，强制刷新
        clearCache(`${API}/api/fund/groups`);
        // 重新获取分组列表
        apiGet(`${API}/api/fund/groups`, {
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
        alert(d.message || '删除失败');
        setDeletingGroupId(null);
      }
    } catch (e) {
      alert('网络错误');
      setDeletingGroupId(null);
    }
  }

  function parseNetValue(s: string | undefined): number {
    if (s == null || s === '' || s === '—') return 0;
    const parts = String(s).split('(');
    const n = parseFloat(parts[0]);
    return Number.isFinite(n) ? n : 0;
  }
  function addDaysToDate(ymd: string, days: number): string {
    const d = new Date(ymd + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
  const PENDING_ADD_KEY = 'lan_fund_pending_adds';
  const PENDING_REDUCE_KEY = 'lan_fund_pending_reduces';
  function getTodayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }
  function loadPendingAdds(): { fundCode: string; amount: number; settlementDate: string }[] {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(PENDING_ADD_KEY) : null;
      const list: { fundCode: string; amount: number; settlementDate: string }[] = raw ? JSON.parse(raw) : [];
      const today = getTodayStr();
      const still = list.filter((p) => (p.settlementDate || '') > today);
      if (still.length !== list.length && typeof window !== 'undefined') localStorage.setItem(PENDING_ADD_KEY, JSON.stringify(still));
      return still;
    } catch {
      return [];
    }
  }
  function loadPendingReduces(): { fundCode: string; amount: number; settlementDate: string }[] {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(PENDING_REDUCE_KEY) : null;
      const list: { fundCode: string; amount: number; settlementDate: string }[] = raw ? JSON.parse(raw) : [];
      const today = getTodayStr();
      const still = list.filter((p) => (p.settlementDate || '') > today);
      if (still.length !== list.length && typeof window !== 'undefined') localStorage.setItem(PENDING_REDUCE_KEY, JSON.stringify(still));
      return still;
    } catch {
      return [];
    }
  }

  const [pendingAdds, setPendingAdds] = useState<{ fundCode: string; amount: number; settlementDate: string }[]>([]);
  const [pendingReduces, setPendingReduces] = useState<{ fundCode: string; amount: number; settlementDate: string }[]>([]);
  useEffect(() => {
    setPendingAdds(loadPendingAdds());
    setPendingReduces(loadPendingReduces());
  }, [refreshing]);

  const openAddPositionModal = (r: FundRow) => {
    setAddPositionRow(r);
    setAddPositionAmount('');
    setAddPositionFeeRate(0);
    setAddPositionTime(null);
  };
  const openReducePositionModal = (r: FundRow) => {
    setReducePositionRow(r);
    setReducePositionUnits('');
    setReducePositionFeeRate(0);
    setReducePositionTime(null);
  };

  const openEditHolding = (r: FundRow) => {
    setEditHoldingRow(r);
    setEditHoldingUnits(String(r.holding_units ?? 0));
    setEditCostPerUnit(String(r.cost_per_unit ?? 1));
    setEditHoldingError('');
  };

  const onSaveEditHolding = async () => {
    if (!editHoldingRow) return;
    const units = parseFloat(editHoldingUnits);
    const cost = parseFloat(editCostPerUnit);
    if (isNaN(units) || units < 0 || isNaN(cost) || cost < 0) {
      setEditHoldingError('请输入有效的份额和成本单价（非负数）');
      return;
    }
    setEditHoldingError('');
    setEditHoldingLoading(true);
    try {
      const res = await fetch(`${API}/api/fund/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: editHoldingRow.code, holding_units: units, cost_per_unit: cost }),
      });
      const d = await res.json();
      if (d.success) {
        setEditHoldingRow(null);
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

  const confirmAddPosition = async () => {
    if (!addPositionRow) return;
    const amount = parseFloat(addPositionAmount);
    if (!(amount > 0)) {
      alert('请填写已买入金额');
      return;
    }
    if (!addPositionTime?.date) {
      alert('请选择买入时间');
      return;
    }
    const buyDate = addPositionTime.date;
    const isAfter15 = addPositionTime.period === 'after15';
    
    // 根据交易规则获取净值
    let netValue = parseNetValue(addPositionRow.netValue) || 1;
    try {
      const netValueRes = await fetch(`${API}/api/fund/net-value?code=${encodeURIComponent(addPositionRow.code)}&trade_date=${buyDate}&period=${isAfter15 ? 'after15' : 'before15'}`, {
        credentials: 'include',
      });
      const netValueData = await netValueRes.json();
      if (netValueData.success && netValueData.netValue > 0) {
        netValue = netValueData.netValue;
      }
    } catch (e) {
      console.warn('获取净值失败，使用当前净值:', e);
    }
    
    const oldUnits = toNum(addPositionRow.holding_units);
    const oldCost = toNum(addPositionRow.cost_per_unit) || 1;
    
    // 计算手续费
    const fee = amount * addPositionFeeRate / 100;
    // 实际买入金额（扣除手续费后）
    const actualAmount = amount - fee;
    
    // 新增份额 = 实际买入金额 / 净值
    const addUnits = actualAmount / netValue;
    const newUnits = oldUnits + addUnits;
    
    // 新持仓金额 = 原持仓金额 + 已买入金额 - 手续费
    const oldHoldingAmount = oldUnits * oldCost;
    const newHoldingAmount = oldHoldingAmount + actualAmount;
    
    // 新持仓成本 = 新持仓金额 / 新份额
    const newCost = newUnits > 0 ? (newHoldingAmount / newUnits) : oldCost;
    
    setAddPositionLoading(true);
    try {
      const res = await fetch(`${API}/api/fund/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code: addPositionRow.code,
          holding_units: newUnits,
          cost_per_unit: newCost,
          record_op: 'add',
          amount, // 已买入金额（用于记录显示）
          fee_rate: addPositionFeeRate, // 买入费率
          trade_date: buyDate,
          period: isAfter15 ? 'after15' : 'before15',
          fund_name: addPositionRow.name,
        }),
      });
      const d = await res.json();
      if (d.success) {
        const settlementDate = addDaysToDate(buyDate, isAfter15 ? 2 : 1);
        const next = [...loadPendingAdds(), { fundCode: addPositionRow.code, amount, settlementDate }];
        try {
          localStorage.setItem(PENDING_ADD_KEY, JSON.stringify(next));
        } catch (_) {}
        setPendingAdds(next);
        setAddPositionRow(null);
        fetchData();
        fetchWatchlist();
      } else {
        alert(d.message || '加仓失败');
      }
    } catch (e) {
      alert('加仓失败: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAddPositionLoading(false);
    }
  };

  const confirmReducePosition = async () => {
    if (!reducePositionRow) return;
    const reduceUnits = parseFloat(reducePositionUnits);
    if (!(reduceUnits > 0)) {
      alert('请填写减仓份额');
      return;
    }
    if (!reducePositionTime?.date) {
      alert('请选择卖出时间');
      return;
    }
    const sellDate = reducePositionTime.date;
    const isAfter15 = reducePositionTime.period === 'after15';
    
    // 根据交易规则获取净值
    let netValue = parseNetValue(reducePositionRow.netValue) || 1;
    try {
      const netValueRes = await fetch(`${API}/api/fund/net-value?code=${encodeURIComponent(reducePositionRow.code)}&trade_date=${sellDate}&period=${isAfter15 ? 'after15' : 'before15'}`, {
        credentials: 'include',
      });
      const netValueData = await netValueRes.json();
      if (netValueData.success && netValueData.netValue > 0) {
        netValue = netValueData.netValue;
      }
    } catch (e) {
      console.warn('获取净值失败，使用当前净值:', e);
    }
    
    const oldUnits = toNum(reducePositionRow.holding_units);
    const oldCost = toNum(reducePositionRow.cost_per_unit) || 1;
    if (reduceUnits > oldUnits) {
      alert('减仓份额不能大于当前持有份额');
      return;
    }
    let newUnits = Math.max(0, oldUnits - reduceUnits);
    if (newUnits < 1e-6) newUnits = 0;
    
    // 计算减仓金额（包含手续费）：
    // 减仓金额 = 减仓份数 * 净值 + 减仓份数 * 净值 * 赎回费率
    const reduceAmount = reduceUnits * netValue + reduceUnits * netValue * reducePositionFeeRate / 100;
    
    // 计算新持仓金额：原持仓金额 - 减仓金额（含手续费）
    const oldHoldingAmount = oldUnits * oldCost;
    const newHoldingAmount = Math.max(0, oldHoldingAmount - reduceAmount);
    
    // 计算新持仓成本
    const newCost = newUnits > 0 ? (newHoldingAmount / newUnits) : 1;
    
    // 记录中的持仓金额（用于显示）
    const amount = reduceUnits * netValue;
    
    setReducePositionLoading(true);
    try {
      const res = await fetch(`${API}/api/fund/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code: reducePositionRow.code,
          holding_units: newUnits,
          cost_per_unit: newCost,
          record_op: 'reduce',
          amount, // 持仓金额（用于记录显示）
          units: reduceUnits, // 减仓份额
          fee_rate: reducePositionFeeRate, // 赎回费率
          trade_date: sellDate,
          period: isAfter15 ? 'after15' : 'before15',
          fund_name: reducePositionRow.name,
        }),
      });
      const d = await res.json();
      if (d.success) {
        // 同步减仓，立即更新，不保存到pendingReduces
        setReducePositionRow(null);
        fetchData();
        fetchWatchlist();
      } else {
        alert(d.message || '减仓失败');
      }
    } catch (e) {
      alert('减仓失败: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setReducePositionLoading(false);
    }
  };

  const displayFundRows = useMemo(() => {
    const today = getTodayStr();
    const addByCode: Record<string, number> = {};
    const reduceByCode: Record<string, number> = {};
    pendingAdds.filter((p) => (p.settlementDate || '') > today).forEach((p) => { addByCode[p.fundCode] = (addByCode[p.fundCode] || 0) + (p.amount || 0); });
    pendingReduces.filter((p) => (p.settlementDate || '') > today).forEach((p) => { reduceByCode[p.fundCode] = (reduceByCode[p.fundCode] || 0) + (p.amount || 0); });
    return fundRows.map((r) => {
      const raw = toNum(r.holding);
      const addSum = addByCode[r.code] || 0;
      const reduceSum = reduceByCode[r.code] || 0;
      const displayHolding = Math.max(0, raw - addSum + reduceSum);
      return { ...r, displayHolding };
    });
  }, [fundRows, pendingAdds, pendingReduces]);

  const displayTotalHolding = useMemo(() => displayFundRows.reduce((s, r) => s + r.displayHolding, 0), [displayFundRows]);
  const displayTodayEstPct = displayTotalHolding > 0 ? (summary.todayEstChange / displayTotalHolding) * 100 : summary.todayEstPct;
  const displayCumulative = summary.cumulative - cumulativeCorrection;

  const openCumulativeCorrectionModal = () => {
    setCumulativeCorrectionInput(cumulativeCorrection === 0 ? '' : String(cumulativeCorrection));
    setShowCumulativeCorrectionModal(true);
  };
  const applyCumulativeCorrection = () => {
    const raw = cumulativeCorrectionInput.trim();
    const val = raw === '' ? 0 : parseFloat(raw);
    if (!Number.isFinite(val)) {
      alert('请输入有效的数字');
      return;
    }
    setCumulativeCorrection(val);
    try {
      localStorage.setItem('lan_fund_cumulative_correction', String(val));
    } catch (_) {}
    setShowCumulativeCorrectionModal(false);
  };

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
          <div className="portfolio-header">
            <h1>
              💼 持仓基金
              <button type="button" className="refresh-button" onClick={onRefresh} disabled={refreshing}>
                🔄 刷新
              </button>
            </h1>
          </div>

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

          {/* 基金估值 */}
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
                      const f = fundList.find((x) => x.code === e.target.value);
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
                    {fundList.map((f) => (
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

          {/* 持仓统计 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#facc15' }}>●</span> 持仓统计
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{
                    borderRadius: 20,
                    padding: '6px 16px',
                  }}
                  onClick={() => setShowShowoffModal(true)}
                >
                  ✨ 一键炫耀
                </button>
                <span
                  role="button"
                  tabIndex={0}
                  title="显示 / 隐藏 收益明细"
                  style={{ cursor: 'pointer', fontSize: 'var(--font-size-xs)', userSelect: 'none' }}
                  onClick={() => {
                    const next = !hideSensitiveValues;
                    if (typeof window !== 'undefined') localStorage.setItem('hideSensitiveValues', String(next));
                    setHideSensitiveValues(next);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const next = !hideSensitiveValues; if (typeof window !== 'undefined') localStorage.setItem('hideSensitiveValues', String(next)); setHideSensitiveValues(next); } }}
                >
                  {hideSensitiveValues ? '😑' : '😀'}
                </span>
              </div>
            </div>
            <div className="summary-bar">
              <div className="summary-card">
                <div className="summary-label">总持仓金额</div>
                <div className="summary-value">{hideSensitiveValues ? '****' : formatYuan(displayTotalHolding)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">今日预估涨跌</div>
                <div className={`summary-value ${summary.todayEstChange >= 0 ? 'positive' : 'negative'}`}>
                  {hideSensitiveValues ? '****' : `${formatMoney(summary.todayEstChange)} (${formatPct(displayTodayEstPct)})`}
                </div>
              </div>
              <div className="summary-card">
                <div className="summary-label">今日实际涨跌(已结算部分)</div>
                <div className={`summary-value ${summary.todayActual >= 0 ? 'positive' : 'negative'}`}>
                  {hideSensitiveValues ? '****' : summary.todayActualText}
                </div>
              </div>
              <div className="summary-card">
                <div className="summary-label">累计收益</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className={`summary-value ${displayCumulative >= 0 ? 'positive' : 'negative'}`}>
                    {hideSensitiveValues ? '****' : formatMoney(displayCumulative)}
                  </span>
                  <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 'var(--font-size-xs)' }} onClick={openCumulativeCorrectionModal}>修正</button>
                </div>
              </div>
            </div>
          </div>

          {/* 持有基金表格 */}
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: 'var(--font-size-md)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--accent)' }}>■</span> 持有基金
            </h3>
            <div className="table-container">
              <table className="style-table">
                <thead>
                  <tr>
                    <th>基金代码</th>
                    <th>基金名称</th>
                    <th>持仓金额</th>
                    <th>预估收益</th>
                    <th>预估涨跌</th>
                    <th>实际收益</th>
                    <th>实际涨跌</th>
                    <th>累计收益</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {fundRows.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: 24, color: 'var(--text-dim)' }}>暂无持仓数据</td></tr>
                  )}
                  {displayFundRows.map((r) => (
                    <tr key={r.code}>
                      <td style={{ color: 'var(--accent)' }}>{String(r.code ?? '')}</td>
                      <td style={{ textAlign: 'left' }}>{String(r.name ?? '')}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{hideSensitiveValues ? '****' : formatYuan(r.displayHolding)}</td>
                      <td className={toNum(r.estAmount) >= 0 ? 'positive' : 'negative'}>{hideSensitiveValues ? '****' : formatMoney(r.estAmount)}</td>
                      <td className={toNum(r.estPct) >= 0 ? 'positive' : 'negative'}>{hideSensitiveValues ? '****' : formatPct(r.estPct)}</td>
                      <td className={toNum(r.actualAmount) >= 0 ? 'positive' : 'negative'}>{hideSensitiveValues ? '****' : formatMoney(r.actualAmount)}</td>
                      <td className={toNum(r.actualPct) >= 0 ? 'positive' : 'negative'}>{hideSensitiveValues ? '****' : (toNum(r.actualPct) !== 0 ? formatPct(r.actualPct) : '—')}</td>
                      <td className={toNum(r.cumulative) >= 0 ? 'positive' : 'negative'}>{hideSensitiveValues ? '****' : formatMoney(r.cumulative)}</td>
                      <td>
                        <button type="button" className="btn btn-primary" style={{ padding: '6px 12px', marginRight: 8 }} onClick={() => openAddPositionModal(r)}>加仓</button>
                        <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => openReducePositionModal(r)}>减仓</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>

          {/* 自选基金区块 - 分组切换 + 联想添加 */}
          <div style={{ marginTop: 32 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 'var(--font-size-md)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--accent)' }}>◆</span> 自选基金
            </h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {groups.map((g) => {
                return (
                  <button
                    key={g.id}
                    type="button"
                    className={selectedGroupId === g.id ? 'btn btn-primary' : 'btn btn-secondary'}
                    style={
                      selectedGroupId === g.id
                        ? { padding: '6px 12px', background: 'var(--gh-bg-tertiary)', color: 'var(--accent)', borderColor: 'var(--accent)' }
                        : { padding: '6px 12px' }
                    }
                    onClick={() => setSelectedGroupId(g.id)}
                  >
                    {g.name}
                  </button>
                );
              })}
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '6px 12px', borderStyle: 'dashed' }}
                onClick={() => setShowNewGroupModal(true)}
              >
                + 新建分组
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '6px 12px', borderStyle: 'dashed' }}
                onClick={() => setShowDeleteGroupModal(true)}
              >
                🗑️ 删除分组
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-start', position: 'relative' }}>
              <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                <input
                  type="text"
                  value={addInput}
                  onChange={(e) => { setAddInput(e.target.value); setShowSuggestions(true); setAddError(''); }}
                  onFocus={() => addInput.trim() && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="输入基金代码或名称 (支持联想)"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--gh-bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: 'var(--font-size-xs)',
                  }}
                />
                {showSuggestions && addSuggestions.length > 0 && (
                  <ul
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      margin: 0,
                      padding: 0,
                      listStyle: 'none',
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      marginTop: 4,
                      maxHeight: 240,
                      overflowY: 'auto',
                      zIndex: 10,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    }}
                  >
                    {addSuggestions.map((f) => (
                      <li
                        key={f.code}
                        style={{
                          padding: '10px 14px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--gh-border-secondary)',
                          color: 'var(--text-main)',
                          fontSize: 'var(--font-size-xs)',
                        }}
                        onMouseDown={(e) => { e.preventDefault(); setAddInput(`${f.code} - ${f.name}`); setShowSuggestions(false); }}
                      >
                        <span style={{ color: 'var(--accent)' }}>{f.code}</span> {f.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                type="button"
                className="btn"
                style={{ background: '#7c3aed', color: '#fff' }}
                onClick={onAddFund}
                disabled={addLoading || selectedGroupId == null}
              >
                {addLoading ? '添加中…' : '添加'}
              </button>
              {addError && <span style={{ color: 'var(--gh-danger-fg)', fontSize: 'var(--font-size-xs)' }}>{addError}</span>}
            </div>
            <div className="table-container">
              <table className="style-table">
                <thead>
                  <tr>
                    <th>基金代码</th>
                    <th>基金名称</th>
                    <th>净值</th>
                    <th className="sortable">今日涨幅</th>
                    <th className="sortable">昨日涨幅</th>
                    <th className="sortable">连涨/跌</th>
                    <th className="sortable">近30天</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {watchlistRows.slice(0, 10).map((r) => (
                    <tr key={r.code}>
                      <td style={{ color: 'var(--accent)' }}>{String(r.code ?? '')}</td>
                      <td
                        style={{ textAlign: 'left', cursor: 'pointer', color: 'var(--accent)' }}
                        onClick={() => setDetailRow(r)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailRow(r); } }}
                        role="button"
                        tabIndex={0}
                        title="点击查看详情"
                      >
                        {String(r.name ?? '')}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>{r.netValue != null && r.netValue !== '' ? String(r.netValue) : '—'}</td>
                      <td className={toNum(r.estPct) >= 0 ? 'positive' : 'negative'}>{r.estPct != null && String(r.estPct) !== '' ? formatPct(r.estPct) : '—'}</td>
                      <td className={String(r.dayOfGrowth ?? '').startsWith('-') ? 'negative' : 'positive'} style={{ fontFamily: 'var(--font-mono)' }}>{r.dayOfGrowth != null && r.dayOfGrowth !== '' ? String(r.dayOfGrowth) : '—'}</td>
                      <td style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}>{r.consecutiveInfo != null && r.consecutiveInfo !== '' ? String(r.consecutiveInfo) : '—'}</td>
                      <td style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}>{r.monthlyInfo != null && r.monthlyInfo !== '' ? String(r.monthlyInfo) : '—'}</td>
                      <td>
                        {selectedGroupId !== null && (groups.find((g) => g.sort_order === 0)?.id ?? groups[0]?.id) === selectedGroupId ? (
                          <button type="button" className="btn btn-success" style={{ padding: '6px 12px' }} onClick={() => openEditHolding(r)}>修改持仓</button>
                        ) : (
                          <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', color: 'var(--gh-danger-fg)' }} onClick={() => onRemoveFromGroup(r.code)}>删除</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {watchlistRows.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: 24, color: 'var(--text-dim)' }}>暂无自选基金，输入代码或名称后点击添加</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-dim)' }}>共{watchlistRows.length}条</span>
              <button type="button" className="btn btn-secondary" disabled>上一页</button>
              <span style={{ minWidth: 80, textAlign: 'center' }}>第1/1页</span>
              <button type="button" className="btn btn-secondary" disabled>下一页</button>
            </div>
          </div>

          {/* 基金详情弹窗（点击自选基金名称打开） */}
          {detailRow && (
            <div className="sector-modal active" style={{ display: 'flex' }} onClick={() => setDetailRow(null)}>
              <div className="sector-modal-content" style={{ maxWidth: 480, width: '95%' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.3 }}>{detailRow.name || '—'}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)', marginTop: 4 }}>{detailRow.code}</div>
                  </div>
                  <button type="button" title="关闭" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4, fontSize: 'var(--font-size-xs)' }} onClick={() => setDetailRow(null)}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 20, fontSize: 'var(--font-size-xs)' }}>
                  <div><span style={{ color: 'var(--text-dim)' }}>净值</span><div style={{ fontWeight: 600, marginTop: 2 }}>{detailRow.netValue ?? '—'}</div></div>
                  <div><span style={{ color: 'var(--text-dim)' }}>今日涨幅</span><div className={toNum(detailRow.estPct) >= 0 ? 'positive' : 'negative'} style={{ fontWeight: 600, marginTop: 2 }}>{detailRow.estPct != null && String(detailRow.estPct) !== '' ? formatPct(detailRow.estPct) : '—'}</div></div>
                  <div><span style={{ color: 'var(--text-dim)' }}>昨日涨幅</span><div className={String(detailRow.dayOfGrowth ?? '').startsWith('-') ? 'negative' : 'positive'} style={{ fontWeight: 600, marginTop: 2 }}>{detailRow.dayOfGrowth ?? '—'}</div></div>
                  <div><span style={{ color: 'var(--text-dim)' }}>连涨/跌</span><div style={{ fontWeight: 600, marginTop: 2 }}>{detailRow.consecutiveInfo ?? '—'}</div></div>
                  <div><span style={{ color: 'var(--text-dim)' }}>近30天</span><div style={{ fontWeight: 600, marginTop: 2 }}>{detailRow.monthlyInfo ?? '—'}</div></div>
                  <div><span style={{ color: 'var(--text-dim)' }}>持仓金额</span><div style={{ fontWeight: 600, marginTop: 2 }}>{hideSensitiveValues ? '****' : formatYuan(detailRow.holding)}</div></div>
                  <div><span style={{ color: 'var(--text-dim)' }}>当日预估盈亏</span><div className={toNum(detailRow.estAmount) >= 0 ? 'positive' : 'negative'} style={{ fontWeight: 600, marginTop: 2 }}>{hideSensitiveValues ? '****' : formatMoney(detailRow.estAmount)}</div></div>
                  <div><span style={{ color: 'var(--text-dim)' }}>累计收益</span><div className={toNum(detailRow.cumulative) >= 0 ? 'positive' : 'negative'} style={{ fontWeight: 600, marginTop: 2 }}>{hideSensitiveValues ? '****' : formatMoney(detailRow.cumulative)}</div></div>
                </div>
              </div>
            </div>
          )}

          {/* 修改持仓弹窗 */}
          {editHoldingRow && (
            <div className="sector-modal active" style={{ display: 'flex' }} onClick={() => !editHoldingLoading && setEditHoldingRow(null)}>
              <div className="sector-modal-content" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
                <div className="sector-modal-header">修改持仓金额</div>
                <div style={{ padding: '16px 0' }}>
                  <p style={{ margin: '0 0 12px', color: 'var(--text-dim)', fontSize: 'var(--font-size-xs)' }}>
                    {editHoldingRow.code} - {editHoldingRow.name}
                  </p>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)' }}>持有份额</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editHoldingUnits}
                    onChange={(e) => setEditHoldingUnits(e.target.value)}
                    className="sector-modal-search"
                    style={{ width: '100%', marginBottom: 12 }}
                  />
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)' }}>成本单价（元）</label>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={editCostPerUnit}
                    onChange={(e) => setEditCostPerUnit(e.target.value)}
                    className="sector-modal-search"
                    style={{ width: '100%' }}
                  />
                  {editHoldingError && <p style={{ margin: '12px 0 0', color: 'var(--gh-danger-fg)', fontSize: 'var(--font-size-xs)' }}>{editHoldingError}</p>}
                </div>
                <div className="sector-modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setEditHoldingRow(null)} disabled={editHoldingLoading}>取消</button>
                  <button type="button" className="btn btn-primary" onClick={onSaveEditHolding} disabled={editHoldingLoading}>{editHoldingLoading ? '保存中…' : '保存'}</button>
                </div>
              </div>
            </div>
          )}

          {/* 加仓弹窗（参照 openAddPositionModal） */}
          {addPositionRow && (
            <div className="sector-modal active" style={{ display: 'flex' }} onClick={() => !addPositionLoading && setAddPositionRow(null)}>
              <div className="sector-modal-content" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
                <div className="sector-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>同步加仓</span>
                  <button type="button" style={{ background: 'none', border: 'none', fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)', cursor: 'pointer', padding: '0 4px' }} onClick={() => setAddPositionRow(null)}>×</button>
                </div>
                <div style={{ padding: '16px 0' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>{addPositionRow.name}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)', marginBottom: 12 }}>{addPositionRow.code}</div>
                  <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--gh-bg-tertiary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)' }}>
                      最新净值 {(() => {
                        // 从 netValue 中提取日期，格式可能是 "3.2486(02-12)" 或 "3.2486"
                        const netValueStr = addPositionRow.netValue || '';
                        const dateMatch = netValueStr.match(/\((\d{2}-\d{2})\)/);
                        const dateStr = dateMatch ? dateMatch[1] : '';
                        return dateStr ? `(${dateStr})` : '';
                      })()} <span style={{ fontWeight: 700, color: 'var(--text-main)', marginLeft: 4 }}>{(() => {
                        // 提取净值数字部分，去掉日期
                        const netValueStr = addPositionRow.netValue || '';
                        const numMatch = netValueStr.match(/^([\d.]+)/);
                        return numMatch ? numMatch[1] : (addPositionRow.netValue ?? '—');
                      })()}</span>
                      <span className={toNum(addPositionRow.estPct) >= 0 ? 'positive' : 'negative'} style={{ marginLeft: 6, fontWeight: 600 }}>{addPositionRow.estPct != null ? formatPct(addPositionRow.estPct) : ''}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-main)', marginBottom: 8 }}>同步加仓金额</div>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: 12, color: 'var(--text-dim)', fontSize: 'var(--font-size-xs)', zIndex: 1 }}>¥</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="已买入金额"
                        value={addPositionAmount}
                        onChange={(e) => setAddPositionAmount(e.target.value)}
                        className="sector-modal-search"
                        style={{ width: '100%', padding: '10px 12px 10px 24px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--gh-bg-tertiary)', fontSize: 'var(--font-size-xs)', color: 'var(--text-main)' }}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-main)', marginBottom: 8 }}>买入费率</div>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                      {([0, 0.1, 0.15] as const).map((rate) => (
                        <label key={rate} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input 
                            type="radio" 
                            name="addPositionFeeRate" 
                            checked={addPositionFeeRate === rate} 
                            onChange={() => setAddPositionFeeRate(rate)} 
                            style={{ marginRight: 6, width: 18, height: 18, accentColor: 'var(--accent)' }} 
                          />
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-main)' }}>{rate}%</span>
                        </label>
                      ))}
                    </div>
                    {addPositionAmount && (
                      <div style={{ marginTop: 8, fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)' }}>
                        {(() => {
                          const inputAmount = parseFloat(addPositionAmount) || 0;
                          const fee = inputAmount * addPositionFeeRate / 100;
                          const actualAmount = inputAmount - fee;
                          if (addPositionTime) {
                            const oldUnits = toNum(addPositionRow.holding_units);
                            const oldCost = toNum(addPositionRow.cost_per_unit) || 1;
                            const oldHoldingAmount = oldUnits * oldCost;
                            const newHoldingAmount = oldHoldingAmount + actualAmount;
                            return (
                              <>
                                <div>手续费：¥{fee.toFixed(2)}</div>
                                <div>实际买入金额：¥{actualAmount.toFixed(2)}</div>
                                <div style={{ marginTop: 4, fontWeight: 500, color: 'var(--text-main)' }}>
                                  加仓后持仓金额：¥{newHoldingAmount.toFixed(2)}
                                </div>
                              </>
                            );
                          } else {
                            return (
                              <div>估算手续费：¥{fee.toFixed(2)}</div>
                            );
                          }
                        })()}
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-main)', marginBottom: 8 }}>原平台买入时间</div>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setAddPositionTimePickerOpen(true)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAddPositionTimePickerOpen(true); } }}
                      style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--gh-bg-tertiary)', color: addPositionTime ? 'var(--text-main)' : 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <span style={{ fontSize: 'var(--font-size-xs)' }}>{addPositionTime ? `${addPositionTime.date.slice(5, 7)}月${addPositionTime.date.slice(8)}日 ${addPositionTime.period === 'after15' ? '下午3点后' : '下午3点前'}` : '请选择时间'}</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: 'var(--font-size-xs)' }}>▼</span>
                    </div>
                  </div>
                </div>
                <div className="sector-modal-footer" style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setAddPositionRow(null)} disabled={addPositionLoading} style={{ padding: '10px 20px' }}>取消</button>
                  <button type="button" className="btn btn-primary" onClick={confirmAddPosition} disabled={addPositionLoading || !addPositionTime} style={{ padding: '10px 20px' }}>确认</button>
                </div>
              </div>
            </div>
          )}

          {/* 加仓时间选择器 */}
          {addPositionRow && addPositionTimePickerOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 10001 }} onClick={() => setAddPositionTimePickerOpen(false)} />
              <div style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', background: 'var(--card-bg)', borderRadius: 12, padding: 16, maxHeight: 320, overflowY: 'auto', zIndex: 10002, minWidth: 260 }}>
                <div style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text-main)' }}>选择买入时间</div>
                {(() => {
                  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
                  const options: { date: string; period: 'before15' | 'after15'; label: string }[] = [];
                  const today = new Date();
                  for (let d = 6; d >= 0; d--) {
                    const dt = new Date(today);
                    dt.setDate(dt.getDate() - d);
                    const y = dt.getFullYear(), m = dt.getMonth() + 1, day = dt.getDate();
                    const ymd = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const week = dayNames[dt.getDay()];
                    const dateStr = `${String(m).padStart(2, '0')}月${String(day).padStart(2, '0')}日(${week})`;
                    options.push({ date: ymd, period: 'before15', label: `${dateStr} 下午3点前` });
                    options.push({ date: ymd, period: 'after15', label: `${dateStr} 下午3点后` });
                  }
                  return options.map((opt) => (
                    <div
                      key={opt.date + opt.period}
                      role="button"
                      tabIndex={0}
                      style={{ padding: '8px 12px', fontSize: 'var(--font-size-xs)', cursor: 'pointer', borderBottom: '1px solid var(--border)', color: 'var(--text-main)', background: addPositionTime?.date === opt.date && addPositionTime?.period === opt.period ? 'rgba(59, 130, 246, 0.15)' : 'transparent' }}
                      onClick={() => { setAddPositionTime({ date: opt.date, period: opt.period }); setAddPositionTimePickerOpen(false); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAddPositionTime({ date: opt.date, period: opt.period }); setAddPositionTimePickerOpen(false); } }}
                    >
                      {opt.label}
                    </div>
                  ));
                })()}
              </div>
            </>
          )}

          {/* 减仓弹窗（参照 openReducePositionModal） */}
          {reducePositionRow && (
            <div className="sector-modal active" style={{ display: 'flex' }} onClick={() => !reducePositionLoading && setReducePositionRow(null)}>
              <div className="sector-modal-content" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
                <div className="sector-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>减仓</span>
                  <button type="button" style={{ background: 'none', border: 'none', fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)', cursor: 'pointer', padding: '0 4px' }} onClick={() => setReducePositionRow(null)}>×</button>
                </div>
                <div style={{ padding: '16px 0' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-main)' }}>{reducePositionRow.name}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)', marginTop: 2 }}>{reducePositionRow.code}</div>
                  <div style={{ marginTop: 12, fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)' }}>
                    当前净值 <span style={{ fontWeight: 600, color: 'var(--text-main)', marginLeft: 8 }}>{reducePositionRow.netValue ?? '—'}</span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)', marginLeft: 8 }}>持有份额</span>
                    <span style={{ fontWeight: 500, marginLeft: 4 }}>{(reducePositionRow.holding_units ?? 0).toFixed(2)}</span>
                  </div>
                  <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-dim)', marginRight: 8 }}>减仓份额</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="请输入减仓份额"
                      value={reducePositionUnits}
                      onChange={(e) => setReducePositionUnits(e.target.value)}
                      className="sector-modal-search"
                      style={{ flex: 1, border: 'none', background: 'none', padding: '10px 0', fontSize: 'var(--font-size-xs)', color: 'var(--text-main)' }}
                    />
                    <span style={{ color: 'var(--text-dim)' }}>份</span>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)' }}>
                    赎回费率：
                    {([0, 0.5, 1, 1.5] as const).map((rate) => (
                      <label key={rate} style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', marginLeft: 12 }}>
                        <input type="radio" name="reducePositionFeeRate" checked={reducePositionFeeRate === rate} onChange={() => setReducePositionFeeRate(rate)} style={{ marginRight: 4 }} />
                        {rate}%
                      </label>
                    ))}
                  </div>
                  {reducePositionUnits && reducePositionTime && (
                    <div style={{ marginTop: 8, fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)' }}>
                      {(() => {
                        const units = parseFloat(reducePositionUnits) || 0;
                        const netValue = parseNetValue(reducePositionRow.netValue) || 1;
                        const oldUnits = toNum(reducePositionRow.holding_units);
                        const oldCost = toNum(reducePositionRow.cost_per_unit) || 1;
                        const oldHoldingAmount = oldUnits * oldCost;
                        const reduceAmount = units * netValue + units * netValue * reducePositionFeeRate / 100;
                        const newHoldingAmount = Math.max(0, oldHoldingAmount - reduceAmount);
                        const amount = units * netValue;
                        const fee = amount * reducePositionFeeRate / 100;
                        return (
                          <>
                            <div>减仓金额：¥{amount.toFixed(2)}</div>
                            {reducePositionFeeRate > 0 && (
                              <div style={{ marginTop: 4 }}>手续费：¥{fee.toFixed(2)}</div>
                            )}
                            <div style={{ marginTop: 4, fontWeight: 500, color: 'var(--text-main)' }}>
                              减仓后持仓金额：¥{newHoldingAmount.toFixed(2)}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)', marginBottom: 6 }}>卖出时间</div>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setReducePositionTimePickerOpen(true)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setReducePositionTimePickerOpen(true); } }}
                      style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card-bg)', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <span style={{ fontSize: 'var(--font-size-xs)' }}>{reducePositionTime ? `${reducePositionTime.date.slice(5, 7)}月${reducePositionTime.date.slice(8)}日 ${reducePositionTime.period === 'after15' ? '下午3点后' : '下午3点前'}` : '请选择时间'}</span>
                      <span style={{ color: 'var(--text-dim)' }}>▼</span>
                    </div>
                  </div>
                </div>
                <div className="sector-modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setReducePositionRow(null)} disabled={reducePositionLoading}>取消</button>
                  <button type="button" className="btn btn-primary" onClick={confirmReducePosition} disabled={reducePositionLoading || !reducePositionTime}>确认</button>
                </div>
              </div>
            </div>
          )}

          {/* 减仓时间选择器 */}
          {reducePositionRow && reducePositionTimePickerOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 10001 }} onClick={() => setReducePositionTimePickerOpen(false)} />
              <div style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', background: 'var(--card-bg)', borderRadius: 12, padding: 16, maxHeight: 320, overflowY: 'auto', zIndex: 10002, minWidth: 260 }}>
                <div style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text-main)' }}>选择卖出时间</div>
                {(() => {
                  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
                  const options: { date: string; period: 'before15' | 'after15'; label: string }[] = [];
                  const today = new Date();
                  for (let d = 6; d >= 0; d--) {
                    const dt = new Date(today);
                    dt.setDate(dt.getDate() - d);
                    const y = dt.getFullYear(), m = dt.getMonth() + 1, day = dt.getDate();
                    const ymd = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const week = dayNames[dt.getDay()];
                    const dateStr = `${String(m).padStart(2, '0')}月${String(day).padStart(2, '0')}日(${week})`;
                    options.push({ date: ymd, period: 'before15', label: `${dateStr} 下午3点前` });
                    options.push({ date: ymd, period: 'after15', label: `${dateStr} 下午3点后` });
                  }
                  return options.map((opt) => (
                    <div
                      key={opt.date + opt.period}
                      role="button"
                      tabIndex={0}
                      style={{ padding: '8px 12px', fontSize: 'var(--font-size-xs)', cursor: 'pointer', borderBottom: '1px solid var(--border)', color: 'var(--text-main)', background: reducePositionTime?.date === opt.date && reducePositionTime?.period === opt.period ? 'rgba(59, 130, 246, 0.15)' : 'transparent' }}
                      onClick={() => { setReducePositionTime({ date: opt.date, period: opt.period }); setReducePositionTimePickerOpen(false); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setReducePositionTime({ date: opt.date, period: opt.period }); setReducePositionTimePickerOpen(false); } }}
                    >
                      {opt.label}
                    </div>
                  ));
                })()}
              </div>
            </>
          )}

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

          {/* 累计收益修正弹窗（与原项目一致：显示累计收益 = 现有累计收益 − 修正金额） */}
          {showCumulativeCorrectionModal && (
            <div className="sector-modal active" style={{ display: 'flex' }} onClick={() => setShowCumulativeCorrectionModal(false)}>
              <div className="sector-modal-content" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
                <div className="sector-modal-header">修正累计收益</div>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)', margin: '0 0 12px 0' }}>显示累计收益 = 现有累计收益 − 修正金额</p>
                <div style={{ padding: '16px 0' }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)' }}>修正金额（元）</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={cumulativeCorrectionInput}
                    onChange={(e) => setCumulativeCorrectionInput(e.target.value)}
                    className="sector-modal-search"
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="sector-modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCumulativeCorrectionModal(false)}>取消</button>
                  <button type="button" className="btn btn-primary" onClick={applyCumulativeCorrection}>确定</button>
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
              <div className="sector-modal-content" style={{ maxWidth: 720, width: '95%', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'row', gap: 16 }} onClick={(e) => e.stopPropagation()}>
                {/* 左侧：板块选择 */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
                <div style={{ width: 180, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
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
                        alert('请先选择要添加的基金');
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
                                const r = await fetch(`${API}/api/fund/groups/${group.id}/funds`, {
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
                              alert(`成功添加 ${successCount} 只基金到分组"${group.name}"${failCount > 0 ? `，${failCount} 只失败` : ''}`);
                              fetchData();
                              fetchWatchlist();
                            } else {
                              alert('添加失败：' + results.map((r) => r.message).filter(Boolean).join('; '));
                            }
                            setShowAddToGroupModal(false);
                          } catch (e) {
                            alert('操作失败：' + (e as Error).message);
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
    </>
  );
}
