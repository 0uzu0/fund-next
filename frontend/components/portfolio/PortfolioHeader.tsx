import type { DataSourceOption } from '../../types/portfolio';
import { DATA_SOURCE_OPTIONS } from '../../constants/portfolio';

type PortfolioHeaderProps = {
  dataSource: DataSourceOption;
  onDataSourceChange: (v: DataSourceOption) => void;
  onRefresh: () => void;
  refreshing: boolean;
};

export default function PortfolioHeader({
  dataSource,
  onDataSourceChange,
  onRefresh,
  refreshing,
}: PortfolioHeaderProps) {
  return (
    <div className="portfolio-header">
      <h1>
        💼 持仓基金
        <label className="data-source-selector">
          <span>数据源</span>
          <select
            value={dataSource}
            onChange={(e) => {
              const v = e.target.value as DataSourceOption;
              onDataSourceChange(v);
            }}
          >
            {DATA_SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`refresh-button${refreshing ? ' refreshing' : ''}`}
          onClick={onRefresh}
          disabled={refreshing}
          title={refreshing ? '正在刷新…' : '刷新数据'}
        >
          <span className="refresh-icon" aria-hidden>🔄</span>
          <span>{refreshing ? '刷新中…' : '刷新'}</span>
        </button>
      </h1>
    </div>
  );
}
