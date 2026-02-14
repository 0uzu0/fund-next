import type { FundRow } from '../../types/portfolio';
import { toNum, formatMoney, formatPct, formatYuan } from '../../lib/format';
import { isEstimateStale } from '../../lib/portfolioHelpers';

export type DetailHolding = { code: string; name: string; weight: string; change: number | null };

type FundDetailModalProps = {
  row: FundRow | null;
  onClose: () => void;
  holdings: DetailHolding[];
  holdingsLoading: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  hideSensitiveValues: boolean;
};

export default function FundDetailModal({
  row,
  onClose,
  holdings,
  holdingsLoading,
  collapsed,
  onToggleCollapsed,
  hideSensitiveValues,
}: FundDetailModalProps) {
  if (!row) return null;

  const netStr = String(row.netValue ?? '');
  const numMatch = netStr.match(/^([\d.]+)/);
  const unitNet = numMatch ? numMatch[1] : '—';
  const estStale = isEstimateStale(row.estimateDate);
  const estPctNum = toNum(row.estPct);
  const estNet = estStale ? '—' : (numMatch && Number.isFinite(estPctNum) ? (parseFloat(numMatch[1]) * (1 + estPctNum / 100)).toFixed(4) : '—');

  const valuationTime = row.nowTime && String(row.nowTime).trim() && row.nowTime !== '—' ? String(row.nowTime) : '—';

  return (
    <div className="sector-modal active" style={{ display: 'flex' }} onClick={onClose}>
      <div className="sector-modal-content fund-detail-modal" style={{ maxWidth: 480, width: '95%', position: 'relative', paddingTop: 40 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" title="关闭" style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4, fontSize: '1.2rem', lineHeight: 1 }} onClick={onClose}>×</button>
        <div className="fund-detail-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.2rem' }} title="自选">⭐</span>
            <div>
              <div className="fund-detail-title" style={{ fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.3 }}>{row.name || '—'}</div>
              <div className="fund-detail-code" style={{ color: 'var(--text-dim)', marginTop: 4 }}>#{row.code}</div>
            </div>
          </div>
          <span style={{ color: 'var(--text-dim)' }}>估值时间 {valuationTime}</span>
        </div>
        <div className="fund-detail-metrics" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', marginBottom: 16 }}>
          <div><span style={{ color: 'var(--text-dim)' }}>单位净值</span><div className="fund-detail-value" style={{ fontWeight: 600, marginTop: 2 }}>{unitNet}</div></div>
          <div><span style={{ color: 'var(--text-dim)' }}>估值净值</span><div className="fund-detail-value" style={{ fontWeight: 600, marginTop: 2 }}>{estNet}</div></div>
          <div><span style={{ color: 'var(--text-dim)' }}>估值涨跌幅</span><div className={`fund-detail-value ${!estStale && estPctNum >= 0 ? 'positive' : !estStale && estPctNum < 0 ? 'negative' : ''}`} style={{ fontWeight: 600, marginTop: 2 }}>{estStale ? '—' : (row.estPct != null && String(row.estPct) !== '' ? formatPct(row.estPct) : '—')}</div></div>
          <div><span style={{ color: 'var(--text-dim)' }}>持仓金额</span><div className="fund-detail-value" style={{ fontWeight: 600, marginTop: 2 }}>{hideSensitiveValues ? '****' : formatYuan(row.holding)}</div></div>
          <div><span style={{ color: 'var(--text-dim)' }}>当日盈亏</span><div className={`fund-detail-value ${!estStale && toNum(row.estAmount) >= 0 ? 'positive' : !estStale && toNum(row.estAmount) < 0 ? 'negative' : ''}`} style={{ fontWeight: 600, marginTop: 2 }}>{hideSensitiveValues ? '****' : (estStale ? '—' : formatMoney(row.estAmount))}</div></div>
          <div><span style={{ color: 'var(--text-dim)' }}>持有收益</span><div className={`fund-detail-value ${toNum(row.cumulative) >= 0 ? 'positive' : 'negative'}`} style={{ fontWeight: 600, marginTop: 2 }}>{hideSensitiveValues ? '****' : formatMoney(row.cumulative)}</div></div>
        </div>
        <div className="fund-detail-holdings" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <button
            type="button"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: '4px 0', fontWeight: 600 }}
            onClick={onToggleCollapsed}
          >
            <span>前10重仓股票</span>
            <span style={{ color: 'var(--text-dim)', fontWeight: 400, marginLeft: 8 }}>涨跌幅 / 占比</span>
            <span style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
          </button>
          {!collapsed && (
            <div style={{ marginTop: 8 }}>
              {holdingsLoading ? (
                <p style={{ margin: 0, padding: 16, color: 'var(--text-dim)', textAlign: 'center' }}>加载中…</p>
              ) : holdings.length === 0 ? (
                <p style={{ margin: 0, padding: 16, color: 'var(--text-dim)', textAlign: 'center' }}>暂无重仓数据</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                  {holdings.map((h) => (
                    <div key={h.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-main)' }}>{h.name || h.code || '—'}</span>
                      <span>
                        <span className={h.change != null ? (h.change >= 0 ? 'positive' : 'negative') : ''} style={{ marginRight: 8 }}>{h.change != null ? (h.change >= 0 ? '+' : '') + h.change.toFixed(2) + '%' : '—'}</span>
                        <span style={{ color: 'var(--accent)' }}>{h.weight}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
