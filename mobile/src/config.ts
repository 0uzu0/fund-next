/**
 * 前端 Web 地址，用于 WebView 加载
 * - 开发：Android 模拟器用 10.0.2.2:3000，真机用电脑 IP:3000
 * - 生产：填部署后的前端地址
 * 保证始终为字符串，避免 Domain: undefined / ERR_CLEARTEXT 等问题
 */
const _base = typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_WEB_URL;
export const WEB_BASE_URL = (typeof _base === 'string' && _base.trim()) ? _base.trim() : 'http://10.0.2.2:3000';

export const ROUTES = {
  portfolio: '/portfolio',
  preciousMetals: '/precious-metals',
  sectors: '/sectors',
  userManage: '/admin/profile',
} as const;
