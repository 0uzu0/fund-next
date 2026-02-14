import type { FundRow, Group } from '../../types/portfolio';
import { toNum, formatPct } from '../../lib/format';
import { isEstimateStale } from '../../lib/portfolioHelpers';

export type WatchlistSortState = { col: number; dir: 'asc' | 'desc' } | null;

type WatchlistSectionProps = {
  groups: Group[];
  selectedGroupId: number | null;
  onSelectGroup: (id: number) => void;
  rows: FundRow[];
  totalCount: number;
  isEmpty: boolean;
  sort: WatchlistSortState;
  onSortChange: (col: number, dir: 'asc' | 'desc' | null) => void;
  pageSize: 10 | 20 | 30;
  page: number;
  totalPages: number;
  onPageSizeChange: (v: 10 | 20 | 30) => void;
  onPageChange: (page: number) => void;
  addInput: string;
  onAddInputChange: (v: string) => void;
  addSuggestions: { code: string; name: string }[];
  /** 联想接口请求中时为 true，用于下拉显示「加载中」 */
  addSuggestionsLoading?: boolean;
  showSuggestions: boolean;
  onShowSuggestions: (v: boolean) => void;
  onSelectSuggestion: (code: string, name: string) => void;
  addLoading: boolean;
  addError: string;
  onAddFund: () => void;
  onNewGroup: () => void;
  onDeleteGroup: () => void;
  defaultGroupId: number | null; // 默认分组 id，用于显示「修改持仓」或「删除」
  onRowDetail: (row: FundRow) => void;
  onEditHolding: (row: FundRow) => void;
  onRemoveFromGroup: (code: string) => void;
  /** 当前数据源：天天基金不提供连涨/跌、近30天，用于显示提示 */
  dataSource?: 'fund123' | 'tiantian';
};

const COLS = [
  { key: 2, label: '净值' },
  { key: 3, label: '预估涨幅' },
  { key: 4, label: '昨日涨幅' },
  { key: 5, label: '连涨/跌' },
  { key: 6, label: '近30天' },
] as const;

export default function WatchlistSection({
  groups,
  selectedGroupId,
  onSelectGroup,
  rows,
  totalCount,
  isEmpty,
  sort,
  onSortChange,
  pageSize,
  page,
  totalPages,
  onPageSizeChange,
  onPageChange,
  addInput,
  onAddInputChange,
  addSuggestions,
  addSuggestionsLoading = false,
  showSuggestions,
  onShowSuggestions,
  onSelectSuggestion,
  addLoading,
  addError,
  onAddFund,
  onNewGroup,
  onDeleteGroup,
  defaultGroupId,
  onRowDetail,
  onEditHolding,
  onRemoveFromGroup,
  dataSource,
}: WatchlistSectionProps) {
  const tiantianNoDataTitle = dataSource === 'tiantian' ? '天天基金不提供该数据，可切换 Fund123 查看' : undefined;
  const handleSort = (col: number) => {
    const nextDir = sort?.col === col
      ? (sort.dir === 'asc' ? 'desc' : null)
      : 'asc';
    onSortChange(col, nextDir);
  };

  const isDefaultGroup = selectedGroupId !== null && defaultGroupId !== null && selectedGroupId === defaultGroupId;

  return (
    <div>
      <h3 className="portfolio-section-title" data-section-title="small" style={{ margin: '0 0 16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-lg)' }}>
        <span aria-hidden style={{ fontSize: '1.1em' }}>⭐</span> 自选基金
      </h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            className={selectedGroupId === g.id ? 'btn btn-primary' : 'btn btn-secondary'}
            style={
              selectedGroupId === g.id
                ? { padding: '6px 12px', background: 'var(--gh-bg-tertiary)', color: 'var(--accent)', borderColor: 'var(--accent)' }
                : { padding: '6px 12px' }
            }
            onClick={() => onSelectGroup(g.id)}
          >
            {g.name}
          </button>
        ))}
        <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', borderStyle: 'dashed' }} onClick={onNewGroup}>+ 新建分组</button>
        <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', borderStyle: 'dashed' }} onClick={onDeleteGroup}>🗑️ 删除分组</button>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-start', position: 'relative' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <input
            type="text"
            value={addInput}
            onChange={(e) => { onAddInputChange(e.target.value); onShowSuggestions(true); }}
            onFocus={() => addInput.trim() && onShowSuggestions(true)}
            onBlur={() => setTimeout(() => onShowSuggestions(false), 200)}
            placeholder="输入基金代码或名称 (支持联想)"
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--gh-bg-primary)',
              color: 'var(--text-main)',
              fontSize: 'var(--font-size-md)',
            }}
          />
          {showSuggestions && (addSuggestions.length > 0 || addSuggestionsLoading) && (
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
              {addSuggestionsLoading && addSuggestions.length === 0 ? (
                <li style={{ padding: '10px 14px', color: 'var(--text-dim)', fontSize: 'var(--font-size-md)' }}>加载中…</li>
              ) : (
                addSuggestions.map((f) => (
                  <li
                    key={f.code}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--gh-border-secondary)',
                      color: 'var(--text-main)',
                      fontSize: 'var(--font-size-md)',
                    }}
                    onMouseDown={(e) => { e.preventDefault(); onSelectSuggestion(f.code, f.name); onShowSuggestions(false); }}
                  >
                    <span style={{ color: 'var(--accent)' }}>{f.code}</span> {f.name}
                  </li>
                ))
              )}
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
              {COLS.map(({ key, label }) => (
                <th
                  key={key}
                  className={`sortable ${sort?.col === key ? (sort.dir === 'asc' ? 'sorted-asc' : 'sorted-desc') : ''}`}
                  onClick={() => handleSort(key)}
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
                <td colSpan={8} style={{ padding: 24, color: 'var(--text-dim)' }}>暂无自选基金，输入代码或名称后点击添加</td>
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
                  title="点击查看详情"
                >{String(r.code ?? '')}</td>
                <td
                  style={{ textAlign: 'left', cursor: 'pointer', color: '#fff' }}
                  onClick={() => onRowDetail(r)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowDetail(r); } }}
                  role="button"
                  tabIndex={0}
                  title="点击查看详情"
                >{String(r.name ?? '')}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{r.netValue != null && r.netValue !== '' ? String(r.netValue) : '—'}</td>
                <td className={toNum(r.estPct) >= 0 ? 'positive' : 'negative'}>{isEstimateStale(r.estimateDate) ? '—' : (r.estPct != null && String(r.estPct) !== '' ? formatPct(r.estPct) : '—')}</td>
                <td className={String(r.dayOfGrowth ?? '').startsWith('-') ? 'negative' : 'positive'} style={{ fontFamily: 'var(--font-mono)' }}>{r.dayOfGrowth != null && r.dayOfGrowth !== '' ? String(r.dayOfGrowth) : '—'}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }} title={((r.consecutiveInfo == null || r.consecutiveInfo === '') && tiantianNoDataTitle) || undefined}>{r.consecutiveInfo != null && r.consecutiveInfo !== '' ? String(r.consecutiveInfo) : '—'}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }} title={((r.monthlyInfo == null || r.monthlyInfo === '') && tiantianNoDataTitle) || undefined}>{r.monthlyInfo != null && r.monthlyInfo !== '' ? String(r.monthlyInfo) : '—'}</td>
                <td>
                  {selectedGroupId !== null && isDefaultGroup ? (
                    <button type="button" className="btn btn-success" style={{ padding: '6px 12px' }} onClick={() => onEditHolding(r)}>修改持仓</button>
                  ) : (
                    <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', color: 'var(--gh-danger-fg)' }} onClick={() => onRemoveFromGroup(r.code)}>删除</button>
                  )}
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
