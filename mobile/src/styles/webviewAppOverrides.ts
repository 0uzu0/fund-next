/**
 * App 内嵌 WebView 时注入的样式覆盖。
 * 与前端代码、样式完全独立：不依赖前端逻辑，仅通过本端注入适配。
 * 顶栏/侧栏由 WebViewScreen 注入脚本从 DOM 移除，客户端无顶部导航，仅底部 Tab。
 */
export const WEBVIEW_APP_CSS = `
/* 注入后立即隐藏顶栏/侧栏，随后脚本会从 DOM 移除，避免布局闪动 */
.sidebar-nav,
.top-navbar {
  display: none !important;
}
.main-container {
  padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px));
}
.content-area {
  width: 100%;
}

/* 板块/确认弹窗：底部抽屉式、安全区、大触控区 */
.sector-modal,
.confirm-dialog {
  padding-left: env(safe-area-inset-left, 0);
  padding-right: env(safe-area-inset-right, 0);
  padding-bottom: env(safe-area-inset-bottom, 0);
  align-items: flex-end;
  justify-content: flex-end;
}
.sector-modal-content,
.confirm-dialog-content {
  width: 100%;
  max-width: 100%;
  max-height: 88vh;
  border-radius: 16px 16px 0 0;
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.25);
  -webkit-overflow-scrolling: touch;
  overflow-y: auto;
}
.sector-modal-header {
  font-size: var(--font-size-lg);
  margin-bottom: 12px;
  padding-right: 36px;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sector-modal-header button[aria-label="关闭"],
.sector-modal-header .sector-modal-close {
  min-width: 44px;
  min-height: 44px;
  margin: -8px;
  padding: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: var(--text-dim);
}
.sector-modal-search {
  font-size: 16px;
  padding: 12px 14px;
  min-height: 48px;
  margin-bottom: 12px;
}
.sector-modal-footer {
  gap: 12px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.sector-modal-footer .btn {
  min-height: 44px;
  padding: 12px 20px;
  font-size: var(--font-size-md);
  flex: 1;
}
.sector-modal .table-container {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 0 -8px 8px;
}
.sector-modal .style-table {
  font-size: var(--font-size-sm);
  min-width: 480px;
}
.sector-modal .style-table th,
.sector-modal .style-table td {
  padding: 10px 8px;
}
.sector-modal .style-table .btn {
  min-height: 36px;
  padding: 8px 12px;
}
.sector-modal-two-col {
  flex-direction: column !important;
}
.sector-modal-two-col .sector-modal-two-col-side {
  width: 100% !important;
  border-left: none !important;
  border-top: 1px solid var(--border);
  padding-left: 0 !important;
  padding-top: 16px;
  margin-top: 8px;
}
`;
