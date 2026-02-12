import { useEffect, useState, memo, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import TopNavbar from '../components/TopNavbar';
import Sidebar from '../components/Sidebar';
import { apiGet, apiPost } from '../utils/apiClient';

const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

type SectorRow = {
  code: string;
  name: string;
  change: string;
  main_inflow: string;
  main_inflow_pct: string;
  small_inflow: string;
  small_inflow_pct: string;
};

type SectorFund = {
  code: string;
  name: string;
  net_value: string;
  day_growth: string;
  estimated_growth?: string;
};

const SECTOR_CATEGORIES: Record<string, string[]> = {
  '科技': ['人工智能', '半导体', '云计算', '5G', '光模块', 'CPO', '通信设备', 'PCB', '消费电子', '计算机', '软件开发', '信创', '网络安全', 'IT服务', '国产软件', '计算机设备', '光通信', '算力', '通信', '电子', '光学光电子', '元件', '存储芯片', '第三代半导体', '光刻胶', '电子化学品', 'LED', '毫米波', '智能穿戴', '东数西算', '数据要素', '国资云', 'Web3.0', 'AIGC', 'AI应用', 'AI手机', 'AI眼镜', 'DeepSeek', 'TMT', '科技'],
  '医药健康': ['医药生物', '医疗器械', '生物疫苗', 'CRO', '创新药', '精准医疗', '医疗服务', '中药', '化学制药', '生物制品', '基因测序', '超级真菌'],
  '消费': ['食品饮料', '白酒', '家用电器', '纺织服饰', '商贸零售', '新零售', '家居用品', '文娱用品', '婴童', '养老产业', '体育', '教育', '在线教育', '社会服务', '轻工制造', '新消费', '可选消费', '消费', '家电零部件', '智能家居'],
  '金融': ['银行', '证券', '保险', '非银金融', '国有大型银行', '股份制银行', '城商行', '金融'],
  '能源': ['新能源', '煤炭', '石油石化', '电力', '绿色电力', '氢能源', '储能', '锂电池', '电池', '光伏设备', '风电设备', '充电桩', '固态电池', '能源', '煤炭开采', '公用事业', '锂矿'],
  '工业制造': ['机械设备', '汽车', '新能源车', '工程机械', '高端装备', '电力设备', '专用设备', '通用设备', '自动化设备', '机器人', '人形机器人', '汽车零部件', '汽车服务', '汽车热管理', '尾气治理', '特斯拉', '无人驾驶', '智能驾驶', '电网设备', '电机', '高端制造', '工业4.0', '工业互联', '低空经济', '通用航空'],
  '材料': ['有色金属', '黄金股', '贵金属', '基础化工', '钢铁', '建筑材料', '稀土永磁', '小金属', '工业金属', '材料', '大宗商品', '资源'],
  '军工': ['国防军工', '航天装备', '航空装备', '航海装备', '军工电子', '军民融合', '商业航天', '卫星互联网', '航母', '航空机场'],
  '基建地产': ['建筑装饰', '房地产', '房地产开发', '房地产服务', '交通运输', '物流'],
  '环保': ['环保', '环保设备', '环境治理', '垃圾分类', '碳中和', '可控核聚变', '液冷'],
  '传媒': ['传媒', '游戏', '影视', '元宇宙', '超清视频', '数字孪生'],
  '主题': ['国企改革', '一带一路', '中特估', '中字头', '并购重组', '华为', '新兴产业', '国家安防', '安全主题', '农牧主题', '农林牧渔', '养殖业', '猪肉', '高端装备'],
};

function Sectors() {
  const router = useRouter();
  const [auth, setAuth] = useState<{ username: string } | null>(null);
  const [tab, setTab] = useState<'sectors' | 'query'>('sectors');
  const [sectorsData, setSectorsData] = useState<SectorRow[]>([]);
  const [sectorsLoading, setSectorsLoading] = useState(false);
  const [sectorList, setSectorList] = useState<string[]>([]);
  const [sectorListLoading, setSectorListLoading] = useState(false);
  const [sectorFunds, setSectorFunds] = useState<SectorFund[]>([]);
  const [sectorFundsLoading, setSectorFundsLoading] = useState(false);
  const [sectorSearch, setSectorSearch] = useState('');
  const [sectorFundModalOpen, setSectorFundModalOpen] = useState(false);
  const [sectorFundModalName, setSectorFundModalName] = useState('');
  const [addingFundCode, setAddingFundCode] = useState<string | null>(null);
  const [defaultGroupId, setDefaultGroupId] = useState<number | null>(null);
  const [groups, setGroups] = useState<{ id: number; name: string; fund_codes: string[]; sort_order: number }[]>([]);
  const [showAddToGroupModal, setShowAddToGroupModal] = useState(false);
  const [selectedFundCode, setSelectedFundCode] = useState<string | null>(null);
  const [addToGroupLoading, setAddToGroupLoading] = useState(false);

  useEffect(() => {
    // 使用 API 客户端，带缓存
    apiGet<{ username: string }>(apiBase + '/api/auth/me', {
      cache: { ttl: 10 * 60 * 1000 }, // 10分钟缓存
    })
      .then(setAuth)
      .catch(() => router.replace('/login'));
  }, [router]);

  const loadSectors = useCallback(() => {
    setSectorsLoading(true);
    // 使用 API 客户端，带缓存（5分钟）
    apiGet<{ success: boolean; data?: SectorRow[] }>(apiBase + '/api/sectors', {
      cache: { ttl: 5 * 60 * 1000 }, // 5分钟缓存
    })
      .then((res) => {
        if (res.success && Array.isArray(res.data)) setSectorsData(res.data);
        else setSectorsData([]);
      })
      .catch(() => setSectorsData([]))
      .finally(() => setSectorsLoading(false));
  }, []);

  const loadSectorList = useCallback(() => {
    setSectorListLoading(true);
    // 使用 API 客户端，带缓存（10分钟）
    apiGet<{ success: boolean; list?: string[] }>(apiBase + '/api/sector-list', {
      cache: { ttl: 10 * 60 * 1000 }, // 10分钟缓存
    })
      .then((res) => {
        if (res.success && Array.isArray(res.list)) setSectorList(res.list);
        else setSectorList([]);
      })
      .catch(() => setSectorList([]))
      .finally(() => setSectorListLoading(false));
  }, []);

  const loadSectorFunds = useCallback((sectorId: number, sectorName: string) => {
    setSectorFundModalName(sectorName);
    setSectorFundModalOpen(true);
    setSectorFundsLoading(true);
    setSectorFunds([]);
    // 使用 API 客户端，带缓存（5分钟）
    apiGet<{ success: boolean; data?: SectorFund[] }>(apiBase + '/api/sector/' + sectorId, {
      cache: { ttl: 5 * 60 * 1000 }, // 5分钟缓存
    })
      .then((res) => {
        if (res.success && Array.isArray(res.data)) setSectorFunds(res.data);
        else setSectorFunds([]);
      })
      .catch(() => setSectorFunds([]))
      .finally(() => setSectorFundsLoading(false));
  }, []);

  useEffect(() => {
    if (auth && tab === 'sectors') loadSectors();
  }, [auth, tab, loadSectors]);

  useEffect(() => {
    if (auth && tab === 'query') {
      loadSectorList();
      // 加载分组列表，使用 API 客户端，带缓存（10分钟）
      apiGet<{ success: boolean; groups?: { id: number; name: string; fund_codes: string[]; sort_order: number }[] }>(apiBase + '/api/fund/groups', {
        cache: { ttl: 10 * 60 * 1000 }, // 10分钟缓存
      })
        .then((res) => {
          if (res.success && Array.isArray(res.groups)) {
            setGroups(res.groups);
            const defaultGroup = res.groups.find((g: any) => g.sort_order === 0);
            if (defaultGroup) {
              setDefaultGroupId(defaultGroup.id);
            }
          }
        })
        .catch(() => {});
    }
  }, [auth, tab, loadSectorList]);

  const refresh = () => {
    if (tab === 'sectors') loadSectors();
    else loadSectorList();
  };

  const sectorListIndex = (name: string) => {
    const i = sectorList.indexOf(name);
    return i >= 0 ? i + 1 : null;
  };

  const handleAddToWatchlist = (fundCode: string) => {
    setSelectedFundCode(fundCode);
    setShowAddToGroupModal(true);
  };

  const handleConfirmAddToGroup = async (groupId: number) => {
    if (!selectedFundCode) return;
    setAddToGroupLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/fund/groups/${groupId}/funds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: selectedFundCode }),
      });
      const d = await r.json();
      if (d.success) {
        const group = groups.find((g) => g.id === groupId);
        alert(`已添加基金 ${selectedFundCode} 到分组"${group?.name || '未知'}"（同时已添加到默认分组）`);
        setShowAddToGroupModal(false);
        setSelectedFundCode(null);
      } else {
        alert(d.message || '添加失败');
      }
    } catch (e) {
      alert('网络错误：' + (e as Error).message);
    } finally {
      setAddToGroupLoading(false);
    }
  };

  const filteredCategories: Record<string, string[]> = sectorSearch.trim()
    ? Object.fromEntries(
        Object.entries(SECTOR_CATEGORIES)
          .map(([cat, list]) => [
            cat,
            list.filter((s: string) => s.includes(sectorSearch.trim())),
          ] as [string, string[]])
          .filter((entry): entry is [string, string[]] => entry[1].length > 0)
      ) as Record<string, string[]>
    : SECTOR_CATEGORIES;

  if (!auth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        加载中…
      </div>
    );
  }

  return (
    <>
      <Head><title>行业板块 - LanFund</title></Head>
      <TopNavbar />
      <div className="main-container">
        <Sidebar />
        <div className="content-area">
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button
              type="button"
              className={`tab-button ${tab === 'sectors' ? 'active' : ''}`}
              onClick={() => setTab('sectors')}
            >
              🏢 行业板块
            </button>
            <button
              type="button"
              className={`tab-button ${tab === 'query' ? 'active' : ''}`}
              onClick={() => setTab('query')}
            >
              🔍 板块基金查询
            </button>
          </div>

          {tab === 'sectors' && (
            <>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 8 }}>
                🏢 行业板块
                <button type="button" className="btn" style={{ background: 'var(--accent)', color: '#fff' }} onClick={refresh}>
                  🔄 刷新
                </button>
              </h1>
              <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>查看各行业板块的市场表现</p>
              <div className="content-card">
                {sectorsLoading ? (
                  <p style={{ padding: 24, color: 'var(--text-dim)' }}>加载中…</p>
                ) : sectorsData.length === 0 ? (
                  <p style={{ padding: 24, color: 'var(--text-dim)' }}>暂无数据或请先启动后端并配置 API 地址</p>
                ) : (
                  <div className="table-container">
                    <table className="style-table">
                      <thead>
                        <tr>
                          <th>板块名称</th>
                          <th>今日涨跌幅</th>
                          <th>今日主力净流入</th>
                          <th>今日主力净流入占比</th>
                          <th>今日小单净流入</th>
                          <th>今日小单流入占比</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectorsData.map((row, i) => (
                          <tr key={i}>
                            <td>{row.name}</td>
                            <td className={String(row.change).startsWith('-') ? 'negative' : 'positive'} style={{ fontFamily: 'var(--font-mono)' }}>{row.change}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{row.main_inflow}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{row.main_inflow_pct}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{row.small_inflow}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{row.small_inflow_pct}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'query' && (
            <>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 8 }}>
                🔍 板块基金查询
                <button type="button" className="btn" style={{ background: 'var(--accent)', color: '#fff' }} onClick={refresh}>
                  🔄 刷新
                </button>
              </h1>
              <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>选择板块查看基金产品</p>
              <div className="content-card" style={{ marginBottom: 24 }}>
                <input
                  type="text"
                  placeholder="搜索板块名称..."
                  value={sectorSearch}
                  onChange={(e) => setSectorSearch(e.target.value)}
                  className="sector-modal-search"
                  style={{ width: '100%', maxWidth: 320, marginBottom: 16 }}
                />
                {sectorListLoading ? (
                  <p style={{ color: 'var(--text-dim)' }}>加载板块列表…</p>
                ) : (
                  Object.entries(filteredCategories).map(([category, list]) => (
                    <div key={category} style={{ marginBottom: 24 }}>
                      <h4 style={{ margin: '0 0 10px', color: 'var(--text-dim)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{category}</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                        {list.map((name) => {
                          const id = sectorListIndex(name);
                          return (
                            <button
                              key={name}
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '10px', textAlign: 'center' }}
                              onClick={() => id != null && loadSectorFunds(id, name)}
                              disabled={id == null}
                            >
                              {name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 板块基金弹窗：点击板块时在当前位置弹出 */}
              {sectorFundModalOpen && (
                <div
                  className="sector-modal active"
                  style={{
                    position: 'fixed',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.5)',
                    zIndex: 9999,
                  }}
                  onClick={() => setSectorFundModalOpen(false)}
                >
                  <div
                    className="sector-modal-content"
                    style={{
                      maxWidth: 720,
                      width: '95%',
                      maxHeight: '85vh',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      background: 'var(--card-bg)',
                      borderRadius: 12,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="sector-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                      <span>板块：{sectorFundModalName}</span>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.25rem', padding: '0 8px' }}
                        onClick={() => setSectorFundModalOpen(false)}
                        aria-label="关闭"
                      >
                        ×
                      </button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
                      {sectorFundsLoading ? (
                        <p style={{ padding: 24, color: 'var(--text-dim)' }}>加载基金列表…</p>
                      ) : sectorFunds.length === 0 ? (
                        <p style={{ padding: 24, color: 'var(--text-dim)' }}>该板块暂无基金数据</p>
                      ) : (
                        <div className="table-container">
                          <table className="style-table">
                            <thead>
                              <tr>
                                <th>基金代码</th>
                                <th>基金名称</th>
                                <th>净值</th>
                                <th>日增长率</th>
                                <th>操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sectorFunds.slice(0, 100).map((row, i) => (
                                <tr key={i}>
                                  <td style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{row.code}</td>
                                  <td>{row.name}</td>
                                  <td style={{ fontFamily: 'var(--font-mono)' }}>{row.net_value}</td>
                                  <td className={String(row.day_growth).startsWith('-') ? 'negative' : 'positive'} style={{ fontFamily: 'var(--font-mono)' }}>{row.day_growth}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="btn btn-info"
                                      style={{ padding: '6px 12px', fontSize: 'var(--font-size-sm)' }}
                                      onClick={() => handleAddToWatchlist(row.code)}
                                      disabled={addingFundCode === row.code || groups.length === 0}
                                    >
                                      ➕ 添加
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 选择分组模态框 */}
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
                            onClick={() => handleConfirmAddToGroup(group.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleConfirmAddToGroup(group.id);
                              }
                            }}
                          >
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                              {group.name}
                              {group.sort_order === 0 && <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'var(--accent)', color: '#fff' }}>默认</span>}
                            </div>
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
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default memo(Sectors);
