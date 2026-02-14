import { useEffect, useState, useCallback, memo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { apiGet, clearCache } from '../utils/apiClient';

const API = process.env.NEXT_PUBLIC_API_URL || '';

type KxItem = { time: string; evaluate: string; title: string; entity?: string };

function Market() {
  const router = useRouter();
  const [auth, setAuth] = useState<{ username: string } | null>(null);
  const [list, setList] = useState<KxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKx = useCallback((skipCache = false) => {
    if (skipCache) clearCache('api/market/kx');
    setLoading(true);
    setError(null);
    const base = (API || '').replace(/\/$/, '');
    const url = base ? `${base}/api/market/kx?count=20` : '/api/market/kx?count=20';
    
    // 使用 API 客户端，带缓存（5分钟）；刷新时已清缓存
    apiGet<{ success: boolean; list?: KxItem[]; message?: string }>(url, {
      cache: { ttl: 5 * 60 * 1000 }, // 5分钟缓存
    })
      .then((d) => {
        if (d.success && Array.isArray(d.list)) setList(d.list);
        else setError(d.message || '加载失败');
      })
      .catch((e) => {
        if (e.message === 'API_NOT_FOUND' || e.message?.includes('404')) {
          setError('接口不可用：请先启动后端 (cd backend && npm start)，并在前端根目录设置 .env.local 中 NEXT_PUBLIC_API_URL=http://localhost:8311');
        } else {
          setError('网络错误');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // 使用 API 客户端，带缓存（10分钟）
    apiGet<{ username: string }>(API + '/api/auth/me', {
      cache: { ttl: 10 * 60 * 1000 }, // 10分钟缓存
    })
      .then(setAuth)
      .catch(() => router.replace('/login?redirect=' + encodeURIComponent(router.asPath || '/market')));
  }, [router]);

  useEffect(() => {
    if (auth) fetchKx();
  }, [auth, fetchKx]);

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
        <title>市场行情 - LanFund</title>
      </Head>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              📰 7*24快讯
              <button
                type="button"
                onClick={() => fetchKx(true)}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: loading ? 'wait' : 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                }}
              >
                {loading ? '加载中…' : '🔄 刷新'}
              </button>
            </h1>
            <p style={{ margin: '8px 0 0', color: 'var(--text-dim)' }}>实时追踪全球市场动态</p>
          </div>

          <div
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 20,
              maxHeight: 'calc(100vh - 220px)',
              overflowY: 'auto',
            }}
          >
            {error && (
              <p style={{ color: 'var(--down-color)', margin: '0 0 12px' }}>{error}</p>
            )}
            {list.length === 0 && !loading && !error && (
              <p style={{ color: 'var(--text-dim)' }}>暂无快讯数据</p>
            )}
            {list.length > 0 && (
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  tableLayout: 'auto',
                  fontSize: 'var(--font-size-md)',
                }}
              >
                <thead>
                  <tr>
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      时间
                    </th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontWeight: 500, width: 72 }}>
                      多空
                    </th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontWeight: 500 }}>
                      快讯内容
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                        {item.time}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            color: item.evaluate === '利好' ? 'var(--up-color)' : item.evaluate === '利空' ? 'var(--down-color)' : 'var(--text-dim)',
                            fontWeight: 600,
                          }}
                        >
                          {item.evaluate || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-main)' }}>
                        <div>{item.title}</div>
                        {item.entity && (
                          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-dim)', marginTop: 4 }}>
                            影响股票: {item.entity}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
    </>
  );
}

export default memo(Market);
