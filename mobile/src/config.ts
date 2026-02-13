/**
 * LanFund 移动端配置
 *
 * 与前端 (frontend) 对齐：
 * - THEME 与 styles/globals.css :root 变量一致
 * - ROUTES 与 Sidebar 主导航一致，便于底部栏快捷跳转
 *
 * 配置说明：
 * - DEFAULT_SERVER_URL: 默认后端服务地址，用户可在设置页中修改
 * - 首次启动无保存地址时显示设置页，保存后进入 WebView
 */

/** 默认后端服务器地址（留空则首次启动强制进入设置页） */
export const DEFAULT_SERVER_URL = 'http://192.168.1.100:8311';

/** AsyncStorage 中保存服务器地址的 key */
export const STORAGE_KEY_SERVER_URL = '@lanfund/server_url';

/** AsyncStorage 中保存登录 cookie 的 key */
export const STORAGE_KEY_COOKIES = '@lanfund/cookies';

/** 应用名称 */
export const APP_NAME = 'LanFund';

/** 应用版本（与 app.json / package.json 保持一致） */
export const APP_VERSION = '1.0.0';

/** WebView 用户代理后缀（用于后端识别移动端请求） */
export const USER_AGENT_SUFFIX = 'LanFundApp/1.0';

/** 页面加载超时时间（毫秒） */
export const PAGE_LOAD_TIMEOUT = 20000;

/**
 * 规范化服务器地址：去空格、补全协议（无协议时默认 https）
 */
export function normalizeServerUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return 'https://' + trimmed;
}

/** 深色主题（与 frontend/styles/globals.css :root 一致） */
export const THEME = {
  background: '#0d1117',
  cardBg: '#161b22',
  cardTertiary: '#1c2128',
  border: '#30363d',
  borderSecondary: '#21262d',
  textPrimary: '#e6edf3',
  textSecondary: '#8b949e',
  textTertiary: '#6e7681',
  accent: '#667eea',
  accentSecondary: '#764ba2',
  danger: '#f85149',
  success: '#3fb950',
  up: '#ff4d4f',
  down: '#52c41a',
};

/** 底部栏快捷导航（与前端 Sidebar 主导航对应） */
export const BOTTOM_NAV_ROUTES = [
  { path: '/portfolio', icon: '💼', label: '持仓' },
  { path: '/position-records', icon: '📋', label: '记录' },
  { path: '/market', icon: '📈', label: '行情' },
] as const;
