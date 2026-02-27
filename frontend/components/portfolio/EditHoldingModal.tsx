import type { FundRow } from '../../types/portfolio';
import Modal from '../Modal';

type EditHoldingModalProps = {
  row: FundRow | null;
  onClose: () => void;
  holdingAmount: string;
  cumulativeProfit: string;
  onHoldingAmountChange: (v: string) => void;
  onCumulativeProfitChange: (v: string) => void;
  calculatedUnits: number;
  calculatedCostPerUnit: number;
  error: string;
  loading: boolean;
  onSave: () => void;
};

export default function EditHoldingModal({
  row,
  onClose,
  holdingAmount,
  cumulativeProfit,
  onHoldingAmountChange,
  onCumulativeProfitChange,
  calculatedUnits,
  calculatedCostPerUnit,
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
          <label style={{ display: 'block', marginBottom: 6, fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)' }}>持仓金额（元）</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="填写当前持仓总金额"
            value={holdingAmount}
            onChange={(e) => onHoldingAmountChange(e.target.value)}
            className="sector-modal-search"
            style={{ width: '100%', marginBottom: 12 }}
          />
          <label style={{ display: 'block', marginBottom: 6, fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)' }}>累计收益（元）</label>
          <input
            type="number"
            step="0.01"
            placeholder="填写累计收益，用于计算成本单价"
            value={cumulativeProfit}
            onChange={(e) => onCumulativeProfitChange(e.target.value)}
            className="sector-modal-search"
            style={{ width: '100%', marginBottom: 16 }}
          />
          <div style={{ padding: '12px', background: 'var(--gh-bg-tertiary)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)', marginBottom: 8 }}>自动计算结果</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-main)' }}>持有份额：</span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-main)', fontWeight: 500 }}>{calculatedUnits.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-main)' }}>成本单价：</span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-main)', fontWeight: 500 }}>{calculatedCostPerUnit.toFixed(4)}</span>
            </div>
          </div>
          {error && <p style={{ margin: '12px 0 0', color: 'var(--gh-danger-fg)', fontSize: 'var(--font-size-xs)' }}>{error}</p>}
        </div>
      )}
    </Modal>
  );
}
