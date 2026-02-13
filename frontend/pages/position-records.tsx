import { useEffect, useState, useCallback, memo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { apiGet, apiDelete, clearCache, API_BASE } from '../utils/apiClient';

/** 与 apiClient 一致：有配置用配置，否则浏览器端用当前 origin（前后端同机部署时生效），避免 Failed to fetch */
function getApiBase(): string {
  if (API_BASE) return API_BASE;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

type PositionRecord = {
  id: number;
  fund_code: string;
  fund_name: string;
  op: string;
  amount: number;
  units: number | null;
  trade_date: string;
  period: string;
  created_at: string;
  can_undo: boolean;
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  } catch {
    return iso;
  }
}

function formatAmount(n: number): string {
  return '¥' + (Number(n) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatUnits(n: number | null): string {
  if (n == null) return '—';
  return (Number(n) || 0).toFixed(2) + '份';
}

function PositionRecords() {
  const router = useRouter();
  const [auth, setAuth] = useState<{ username: string } | null>(null);
  const [records, setRecords] = useState<PositionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [undoingId, setUndoingId] = useState<number | null>(null);

  const fetchRecords = useCallback(() => {
    setLoading(true);
    setError('');
    // 使用 API 客户端，带缓存（2分钟）
    apiGet<{ success: boolean; records?: PositionRecord[] }>(getApiBase() + '/api/fund/position-records', {
      cache: { ttl: 2 * 60 * 1000 }, // 2分钟缓存
    })
      .then((data) => {
        if (data.success && Array.isArray(data.records)) {
          setRecords(data.records);
        } else {
          setRecords([]);
        }
        setAuth({ username: '' }); // 有数据即视为已登录
      })
      .catch((e) => {
        if (e.message === 'Unauthorized') {
          router.push('/login?redirect=/position-records');
          return;
        }
        setAuth({ username: '' }); // 非 401 时也允许展示页面（显示错误信息）
        setError('加载失败: ' + (e.message || String(e)));
        setRecords([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // 从持仓页加减仓后切回本页时强制刷新列表（避免缓存导致不显示新记录）
  useEffect(() => {
    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        clearCache('api/fund/position-records');
        fetchRecords();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [fetchRecords]);

  const onUndo = useCallback((rec: PositionRecord) => {
    if (!rec.can_undo) return;
    if (!confirm('确定撤销该次操作？将恢复该次操作前的持仓。')) return;
    setUndoingId(rec.id);
    // 使用 API 客户端
    apiDelete<{ success: boolean; message?: string }>(getApiBase() + '/api/fund/position-records/' + rec.id)
      .then((res) => {
        if (res.success) {
          // 清除缓存并重新获取
          fetchRecords();
        } else {
          alert(res.message || '撤销失败');
        }
      })
      .catch((e) => alert('请求失败: ' + (e.message || e)))
      .finally(() => setUndoingId(null));
  }, [fetchRecords]);

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
        <title>持仓记录 - LanFund</title>
      </Head>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: '1.5rem', color: 'var(--text-main)' }}>📋 持仓记录</h1>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-dim)' }}>
          每次加仓、减仓会在此记录；删除某条记录将撤销该次操作并恢复当时持仓。当日15:00前操作须在当日15:00前撤销，当日15:00后操作须在次日15:00前撤销；到账规则：当日15:00前操作次日到账(T+1)，当日15:00后操作第三天到账(T+2)。
        </p>
      </div>

          {loading && <p style={{ color: 'var(--text-dim)' }}>加载中…</p>}
          {error && <p style={{ color: 'var(--gh-danger-fg)' }}>{error}</p>}
          {!loading && !error && records.length === 0 && (
            <p style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>暂无持仓记录</p>
          )}
          {!loading && !error && records.length > 0 && (
            <div className="table-container">
              <table className="style-table">
                <thead>
                  <tr>
                    <th>基金编号</th>
                    <th>基金名称</th>
                    <th>操作时间</th>
                    <th>操作方式</th>
                    <th>加减仓</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => (
                    <tr key={rec.id}>
                      <td style={{ color: 'var(--accent)' }}>{rec.fund_code || '—'}</td>
                      <td>{rec.fund_name || '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)' }}>{formatDateTime(rec.created_at)}</td>
                      <td>
                        <span style={{ color: rec.op === 'add' ? '#22c55e' : '#f59e0b', fontWeight: 500 }}>
                          {rec.op === 'add' ? '加仓' : '减仓'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {rec.op === 'add' ? formatAmount(rec.amount) : formatUnits(rec.units)}
                      </td>
                      <td>
                        {rec.can_undo ? (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: 'var(--font-size-sm)' }}
                            onClick={() => onUndo(rec)}
                            disabled={undoingId === rec.id}
                          >
                            {undoingId === rec.id ? '撤销中…' : '撤销'}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: 'var(--font-size-sm)' }} title="已过撤销截止时间（当日15:00前操作须在当日15:00前撤销，当日15:00后操作须在次日15:00前撤销）">
                            已过截止
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </>
  );
}

export default memo(PositionRecords);
