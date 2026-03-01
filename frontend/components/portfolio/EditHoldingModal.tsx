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
      maxWidth={440}
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
          {/* 基金名称和代码 - 与加仓弹窗保持一致 */}
          <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: 4, fontSize: 'var(--font-size-lg)' }}>{row.name}</div>
          <div style={{ color: 'var(--text-dim)', marginBottom: 16, fontSize: 'var(--font-size-sm)' }}>#{row.code}</div>
          
          {/* 持仓金额输入框 */}
          <div style={{ marginTop: 20 }}>
            <div style={{ color: 'var(--text-main)', marginBottom: 8, fontWeight: 500 }}>持仓金额（元）</div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 12, color: 'var(--text-dim)', zIndex: 1 }}>¥</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="填写当前持仓总金额"
                value={holdingAmount}
                onChange={(e) => onHoldingAmountChange(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '10px 12px 10px 24px', 
                  border: '1px solid var(--border)', 
                  borderRadius: 8, 
                  background: 'var(--gh-bg-tertiary)', 
                  color: 'var(--text-main)',
                  fontSize: 'var(--font-size-md)'
                }}
              />
            </div>
          </div>
          
          {/* 持仓收益输入框 */}
          <div style={{ marginTop: 20 }}>
            <div style={{ color: 'var(--text-main)', marginBottom: 8, fontWeight: 500 }}>持仓收益（元）</div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 12, color: 'var(--text-dim)', zIndex: 1 }}>¥</span>
              <input
                type="number"
                step="0.01"
                placeholder="填写持仓收益，用于计算成本单价"
                value={cumulativeProfit}
                onChange={(e) => onCumulativeProfitChange(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '10px 12px 10px 24px', 
                  border: '1px solid var(--border)', 
                  borderRadius: 8, 
                  background: 'var(--gh-bg-tertiary)', 
                  color: 'var(--text-main)',
                  fontSize: 'var(--font-size-md)'
                }}
              />
            </div>
          </div>
          
          {/* 自动计算结果 - 与加仓弹窗保持一致 */}
          <div style={{ marginTop: 20, padding: '12px', background: 'var(--gh-bg-tertiary)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)', marginBottom: 12 }}>自动计算结果</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-main)', fontWeight: 500 }}>持有份额：</span>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-main)', fontWeight: 700 }}>{calculatedUnits.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-main)', fontWeight: 500 }}>成本单价：</span>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-main)', fontWeight: 700 }}>{calculatedCostPerUnit.toFixed(4)}</span>
            </div>
          </div>
          
          {error && <p style={{ margin: '12px 0 0', color: 'var(--gh-danger-fg)', fontSize: 'var(--font-size-sm)' }}>{error}</p>}
        </div>
      )}
    </Modal>
  );
}
