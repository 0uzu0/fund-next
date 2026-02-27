import type { HoldingRow } from '../../types/portfolio';
import { toNum, formatMoney, formatPct, formatYuan } from '../../lib/format';
import { isEstimateStale, shouldShowActualData } from '../../lib/portfolioHelpers';

export type HoldingSortState = { col: number; dir: 'asc' | 'desc' } | null;

type HoldingTableProps = {
  rows: HoldingRow[];
  totalCount: number;
  isEmpty: boolean;
  sort: HoldingSortState;
  onSortClick: (col: number) => void;
  pageSize: 10 | 20 | 30;
  page: number;
  totalPages: number;
  onPageSizeChange: (v: 10 | 20 | 30) => void;
  onPageChange: (page: number) => void;
  hideSensitiveValues: boolean;
  onRowDetail: (row: HoldingRow) => void;
  onAddPosition: (row: HoldingRow) => void;
  onReducePosition: (row: HoldingRow) => void;
};

const COLS = [
  { key: 2, label: '持仓金额' },
  { key: 3, label: '预估收益' },
  { key: 4, label: '预估涨跌' },
  { key: 5, label: '实际收益' },
  { key: 6, label: '实际涨跌' },
  { key: 7, label: '累计收益' },
] as const;

export default function HoldingTable({
  rows,
  totalCount,
  isEmpty,
  sort,
  onSortClick,
  pageSize,
  page,
  totalPages,
  onPageSizeChange,
  onPageChange,
  hideSensitiveValues,
  onRowDetail,
  onAddPosition,
  onReducePosition,
}: HoldingTableProps) {
  return (
    <div>
      <h3 className="portfolio-section-title" data-section-title="small" style={{ margin: '0 0 16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-lg)' }}>
        <span aria-hidden style={{ fontSize: '1.1em' }}>🗂️</span> 持有基金
      </h3>
      <div className="table-container">
        <table className="style-table">
          <thead>
            <tr>
              <th>基金代码</th>
              <th>基金名称</th>
              {COLS.map(({ key, label }) => (
                <th
                  key={key}
                  role="columnheader"
                  aria-sort={sort?.col === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={`sortable ${sort?.col === key ? (sort.dir === 'asc' ? 'sorted-asc' : 'sorted-desc') : ''}`}
                  onClick={() => onSortClick(key)}
                >
                  {label}
                </th>
              ))}
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {isEmpty && (
              <tr>
                <td colSpan={9} style={{ padding: 24, color: 'var(--text-dim)' }}>暂无持仓数据</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.code}>
                <td
                  style={{ color: 'var(--accent)', cursor: 'pointer' }}
                  onClick={() => onRowDetail(r)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowDetail(r); } }}
                  role="button"
                  tabIndex={0}
                  title="查看详情"
                >{String(r.code ?? '')}</td>
                <td
                  style={{ textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => onRowDetail(r)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowDetail(r); } }}
                  role="button"
                  tabIndex={0}
                  title="查看详情"
                >{String(r.name ?? '')}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{hideSensitiveValues ? '****' : formatYuan(r.displayHolding)}</td>
                <td className={toNum(r.estAmount) >= 0 ? 'positive' : 'negative'}>{hideSensitiveValues ? '****' : (isEstimateStale(r.estimateDate) ? '—' : formatMoney(r.estAmount))}</td>
                <td className={toNum(r.estPct) >= 0 ? 'positive' : 'negative'}>{hideSensitiveValues ? '****' : (isEstimateStale(r.estimateDate) ? '—' : formatPct(r.estPct))}</td>
                <td className={toNum(r.actualAmount) >= 0 ? 'positive' : 'negative'}>{
                  hideSensitiveValues ? '****' : (shouldShowActualData(r.netValueDate) && r.actualAmount != null && Number.isFinite(Number(r.actualAmount)) && toNum(r.actualAmount) !== 0 ? formatMoney(r.actualAmount) : '—')
                }</td>
                <td className={toNum(r.actualPct) >= 0 ? 'positive' : 'negative'}>{hideSensitiveValues ? '****' : (shouldShowActualData(r.netValueDate) && toNum(r.actualPct) !== 0 ? formatPct(r.actualPct) : '—')}</td>
                <td className={toNum(r.cumulative) >= 0 ? 'positive' : 'negative'}>{hideSensitiveValues ? '****' : formatMoney(r.cumulative)}</td>
                <td>
                  <button type="button" className="btn btn-primary" style={{ padding: '6px 12px', marginRight: 8 }} onClick={() => onAddPosition(r)}>加仓</button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => onReducePosition(r)}>减仓</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-dim)' }}>共{totalCount}条</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value) as 10 | 20 | 30)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--gh-bg-primary)', color: 'var(--text-main)', fontSize: 'var(--font-size-sm)' }}
        >
          <option value={10}>10条/页</option>
          <option value={20}>20条/页</option>
          <option value={30}>30条/页</option>
        </select>
        <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}>上一页</button>
        <span style={{ minWidth: 80, textAlign: 'center' }}>第{page}/{totalPages}页</span>
        <button type="button" className="btn btn-secondary" disabled={page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))}>下一页</button>
      </div>
    </div>
  );
}
