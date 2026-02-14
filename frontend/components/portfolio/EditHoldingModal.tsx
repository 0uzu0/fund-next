import type { FundRow } from '../../types/portfolio';
import Modal from '../Modal';

type EditHoldingModalProps = {
  row: FundRow | null;
  onClose: () => void;
  units: string;
  costPerUnit: string;
  onUnitsChange: (v: string) => void;
  onCostPerUnitChange: (v: string) => void;
  error: string;
  loading: boolean;
  onSave: () => void;
};

export default function EditHoldingModal({
  row,
  onClose,
  units,
  costPerUnit,
  onUnitsChange,
  onCostPerUnitChange,
  error,
  loading,
  onSave,
}: EditHoldingModalProps) {
  return (
    <Modal
      open={!!row}
      onClose={onClose}
      title="修改持仓金额"
      maxWidth={400}
      closeOnBackdrop={!loading}
      closeDisabled={loading}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>取消</button>
          <button type="button" className="btn btn-primary" onClick={onSave} disabled={loading}>{loading ? '保存中…' : '保存'}</button>
        </>
      }
    >
      {row && (
        <div style={{ padding: '16px 0' }}>
          <p style={{ margin: '0 0 12px', color: 'var(--text-dim)', fontSize: 'var(--font-size-xs)' }}>
            {row.code} - {row.name}
          </p>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)' }}>持有份额</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="保留两位小数"
            value={units}
            onChange={(e) => onUnitsChange(e.target.value)}
            className="sector-modal-search"
            style={{ width: '100%', marginBottom: 12 }}
          />
          <label style={{ display: 'block', marginBottom: 6, fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)' }}>成本单价（元）</label>
          <input
            type="number"
            min="0"
            step="0.0001"
            placeholder="保留四位小数"
            value={costPerUnit}
            onChange={(e) => onCostPerUnitChange(e.target.value)}
            className="sector-modal-search"
            style={{ width: '100%' }}
          />
          {error && <p style={{ margin: '12px 0 0', color: 'var(--gh-danger-fg)', fontSize: 'var(--font-size-xs)' }}>{error}</p>}
        </div>
      )}
    </Modal>
  );
}
