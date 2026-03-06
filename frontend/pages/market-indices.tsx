import { useEffect, useState, memo, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { apiGet, clearCache } from '../utils/apiClient';

// 动态导入图表组件，优化首屏加载
const LineChart = dynamic(() => import('../components/LineChart'), {
  loading: () => <div style={{ padding: '20px', textAlign: 'center' }}>加载图表中...</div>,
  ssr: false,
});

type IndexRow = {
  name: string;
  value: string;
  change: string;
  change_pct: number;
};

type TimingData = {
  labels: string[];
  prices: number[];
  change_pcts?: number[];
  change_amounts?: number[];
  volumes?: number[];
  amounts?: number[];
  current_price?: number;
  change?: number;
  change_pct?: number;
};

function MarketIndices() {
  const router = useRouter();
  const [auth, setAuth] = useState<{ username: string } | null>(null);
  const [indices, setIndices] = useState<IndexRow[]>([]);
  const [timing, setTiming] = useState<TimingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingChart, setLoadingChart] = useState(false);

  useEffect(() => {
    // 使用 API 客户端，带缓存（10分钟）
    apiGet<{ username: string }>('/api/auth/me', {
      cache: { ttl: 10 * 60 * 1000 }, // 10分钟缓存
    })
      .then(setAuth)
      .catch(() => router.replace('/login?redirect=' + encodeURIComponent(router.asPath || '/market-indices')));
  }, [router]);

  const loadIndices = useCallback(() => {
    setLoading(true);
    // 使用 API 客户端，带缓存（3分钟）
    apiGet<{ success: boolean; data?: IndexRow[] }>('/api/indices/global', {
      cache: { ttl: 3 * 60 * 1000 }, // 3分钟缓存
    })
      .then((res) => {
        if (res.success && Array.isArray(res.data)) setIndices(res.data);
        else setIndices([]);
      })
      .catch(() => setIndices([]))
      .finally(() => setLoading(false));
  }, []);

  const loadCharts = useCallback(() => {
    setLoadingChart(true);
    apiGet<{ success: boolean; data?: TimingData }>('/api/timing', {
      cache: { ttl: 2 * 60 * 1000 }, // 2分钟缓存
    })
      .then((res) => {
        if (res.success && res.data?.labels) setTiming(res.data);
        else setTiming(null);
      })
      .catch(() => setTiming(null))
      .finally(() => setLoadingChart(false));
  }, []);

  const refresh = () => {
    clearCache('api/indices');
    clearCache('api/timing');
    loadIndices();
    loadCharts();
  };

  useEffect(() => {
    if (auth) {
      loadIndices();
      loadCharts();
    }
  }, [auth, loadIndices, loadCharts]);

  // 自动刷新：每30秒刷新一次数据
  useEffect(() => {
    if (!auth) return;
    const interval = setInterval(() => {
      loadIndices();
      loadCharts();
    }, 30000);
    return () => clearInterval(interval);
  }, [auth]);

  if (!auth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        加载中…
      </div>
    );
  }

  return (
    <>
      <Head><title>市场指数 - LanFund</title></Head>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 8 }}>
            📊 市场指数
            <button type="button" className="btn" style={{ background: 'var(--accent)', color: '#fff' }} onClick={refresh} disabled={loading || loadingChart}>
              {loading || loadingChart ? '加载中…' : '🔄 刷新'}
            </button>
          </h1>
          <p style={{ color: 'var(--text-dim)', marginBottom: 24 }}>上证分时与全球指数</p>

          {/* 上证分时 */}
          <div className="content-card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>📉 上证分时</span>
              {timing?.current_price != null && (
                <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>
                  最新 <strong style={{ color: 'var(--text-main)' }}>{timing.current_price.toFixed(2)}</strong>
                  {timing.change_pct != null && (
                    <span className={timing.change_pct >= 0 ? 'positive' : 'negative'} style={{ marginLeft: 8 }}>
                      {timing.change_pct >= 0 ? '+' : ''}{timing.change_pct.toFixed(2)}%
                    </span>
                  )}
                </span>
              )}
            </div>
            <div style={{ padding: 16 }}>
              {loadingChart && !timing ? (
                <p style={{ color: 'var(--text-dim)' }}>加载中…</p>
              ) : timing?.labels?.length && timing?.prices?.length ? (
                <LineChart
                  labels={timing.labels}
                  series={[{ label: '指数', values: timing.prices }]}
                  yAxisLabel="指数"
                  valueFormat={(v) => v.toFixed(2)}
                />
              ) : (
                <p style={{ color: 'var(--text-dim)' }}>暂无分时数据（非交易时段或数据源暂时不可用），请稍后重试</p>
              )}
            </div>
          </div>

          {/* 全球指数表格 */}
          <div className="content-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🌍</span>
              <span style={{ fontWeight: 600 }}>全球指数</span>
            </div>
            <div style={{ padding: 16, maxHeight: 420, overflowY: 'auto' }}>
              {loading && indices.length === 0 ? (
                <p style={{ color: 'var(--text-dim)' }}>加载中…</p>
              ) : indices.length === 0 ? (
                <p style={{ color: 'var(--text-dim)' }}>暂无数据，请检查网络或稍后重试</p>
              ) : (
                <div className="table-container">
                  <table className="style-table">
                    <thead>
                      <tr>
                        <th>指数名称</th>
                        <th>指数</th>
                        <th>涨跌幅</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indices.map((row, i) => (
                        <tr key={i}>
                          <td>{row.name}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{row.value}</td>
                          <td className={row.change_pct >= 0 ? 'positive' : 'negative'}>{row.change}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
    </>
  );
}

export default memo(MarketIndices);
