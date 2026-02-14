import type { ReactNode, CSSProperties } from 'react';

export type ModalProps = {
  /** 是否显示 */
  open: boolean;
  /** 关闭回调（点击遮罩或关闭按钮时） */
  onClose: () => void;
  /** 标题，不传则不渲染 header */
  title?: ReactNode;
  /** 内容 */
  children: ReactNode;
  /** 底部区域（如按钮组），不传则不渲染 footer */
  footer?: ReactNode;
  /** 内容区最大宽度，如 400、'90%' */
  maxWidth?: number | string;
  /** 内容区宽度，如 '95%' */
  width?: string;
  /** 内容区额外 class（与 sector-modal-content 一起应用） */
  contentClassName?: string;
  /** 内容区额外 style */
  contentStyle?: CSSProperties;
  /** 点击遮罩是否关闭，默认 true */
  closeOnBackdrop?: boolean;
  /** 是否显示右上角关闭按钮，默认 false */
  showCloseButton?: boolean;
  /** 禁用关闭时的 loading 状态（与 closeOnBackdrop 配合，loading 时点击遮罩不关闭） */
  closeDisabled?: boolean;
};

/**
 * 统一弹窗：遮罩 + 内容区 + 可选标题/底部
 * 样式与原有 .sector-modal 保持一致，便于渐进迁移
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth,
  width,
  contentClassName = '',
  contentStyle,
  closeOnBackdrop = true,
  showCloseButton = false,
  closeDisabled = false,
}: ModalProps) {
  if (!open) return null;

  const handleBackdropClick = () => {
    if (closeOnBackdrop && !closeDisabled) onClose();
  };

  const contentWidthStyle: CSSProperties = { position: showCloseButton ? 'relative' : undefined };
  if (maxWidth != null) contentWidthStyle.maxWidth = typeof maxWidth === 'number' ? maxWidth : maxWidth;
  if (width) contentWidthStyle.width = width;

  return (
    <div
      className="sector-modal active"
      style={{ display: 'flex' }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        className={`sector-modal-content ${contentClassName}`.trim()}
        style={{ ...contentWidthStyle, ...contentStyle }}
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseButton && (
          <button
            type="button"
            title="关闭"
            aria-label="关闭"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              padding: 4,
              fontSize: '1.2rem',
              lineHeight: 1,
            }}
            onClick={onClose}
          >
            ×
          </button>
        )}
        {title != null && (
          <div id="modal-title" className="sector-modal-header">
            {title}
          </div>
        )}
        {children}
        {footer != null && <div className="sector-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
