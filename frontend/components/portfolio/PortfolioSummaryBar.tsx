import type { Summary } from '../../types/portfolio';
import { formatYuan, formatMoney, formatPct } from '../../lib/format';

type PortfolioSummaryBarProps = {
  summary: Summary;
  hideSensitiveValues: boolean;
  displayTotalHolding: number;
  displayTodayEstPct: number;
  displayCumulative: number;
  /** 清仓基金历史收益 */
  clearedProfit?: number;
  /** 次日9:30之后估值未更新时为 true，今日预估涨跌显示 — */
  isSummaryEstimateStale?: boolean;
  onShowShowoff: () => void;
  onToggleSensitive: () => void;
};

export default function PortfolioSummaryBar({
  summary,
  hideSensitiveValues,
  displayTotalHolding,
  displayTodayEstPct,
  displayCumulative,
  clearedProfit = 0,
  isSummaryEstimateStale = false,
  onShowShowoff,
  onToggleSensitive,
}: PortfolioSummaryBarProps) {
  // 累计收益 = 持仓收益 + 清仓基金历史收益
  const totalCumulative = displayCumulative + clearedProfit;
  
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 className="portfolio-section-title" data-section-title="small" style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-lg)' }}>
          <span aria-hidden style={{ fontSize: '1.1em' }}>📊</span> 持仓统计
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ borderRadius: 20, padding: '6px 16px' }}
            onClick={onShowShowoff}
          >
            ✨ 一键炫耀
          </button>
          <span
            role="button"
            tabIndex={0}
            title="显示 / 隐藏 收益明细"
            style={{ cursor: 'pointer', fontSize: 'var(--font-size-xs)', userSelect: 'none' }}
            onClick={onToggleSensitive}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggleSensitive();
              }
            }}
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
          <div className={`summary-value ${!isSummaryEstimateStale && summary.todayEstChange >= 0 ? 'positive' : !isSummaryEstimateStale && summary.todayEstChange < 0 ? 'negative' : ''}`}>
            {hideSensitiveValues ? '****' : (isSummaryEstimateStale ? '—' : `${formatMoney(summary.todayEstChange)} (${formatPct(displayTodayEstPct)})`)}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">今日实际涨跌(已结算部分)</div>
          <div className={`summary-value ${summary.todayActual >= 0 ? 'positive' : 'negative'}`}>
            {hideSensitiveValues ? '****' : summary.todayActualText}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">持仓收益</div>
          <div className={`summary-value ${displayCumulative >= 0 ? 'positive' : 'negative'}`}>
            {hideSensitiveValues ? '****' : formatMoney(displayCumulative)}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">累计收益</div>
          <div className={`summary-value ${totalCumulative >= 0 ? 'positive' : 'negative'}`}>
            {hideSensitiveValues ? '****' : formatMoney(totalCumulative)}
          </div>
        </div>
      </div>
    </div>
  );
}