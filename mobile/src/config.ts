/**
 * LanFund 移动端配置
 *
 * 配置说明：
 * - DEFAULT_SERVER_URL: 默认后端服务地址，用户可在设置页中修改
 * - 应用启动后会从 AsyncStorage 读取用户保存的服务地址
 * - 如果用户未配置地址，则使用此默认值
 */

/** 默认后端服务器地址（请根据实际部署修改） */
export const DEFAULT_SERVER_URL = 'http://192.168.1.100:8311';

/** AsyncStorage 中保存服务器地址的 key */
export const STORAGE_KEY_SERVER_URL = '@lanfund/server_url';

/** AsyncStorage 中保存登录 cookie 的 key */
export const STORAGE_KEY_COOKIES = '@lanfund/cookies';

/** 应用名称 */
export const APP_NAME = 'LanFund';

/** 应用版本 */
export const APP_VERSION = '1.0.0';

/** WebView 用户代理后缀（用于后端识别移动端请求） */
export const USER_AGENT_SUFFIX = 'LanFundApp/1.0';

/** 页面加载超时时间（毫秒） */
export const PAGE_LOAD_TIMEOUT = 15000;

/** 深色主题背景色（与 Web 端保持一致） */
export const THEME = {
  background: '#0d1117',
  cardBg: '#161b22',
  border: '#30363d',
  textPrimary: '#e6edf3',
  textSecondary: '#8b949e',
  accent: '#667eea',
  accentSecondary: '#764ba2',
  danger: '#f85149',
  success: '#3fb950',
};
