/**
 * 前端 Web 地址，用于 WebView 加载
 * - 开发：Android 模拟器用 10.0.2.2:3000，真机用电脑 IP:3000
 * - 生产：填部署后的前端地址
 */
export const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_URL || 'http://10.0.2.2:3000';

export const ROUTES = {
  portfolio: '/portfolio',
  preciousMetals: '/precious-metals',
  sectors: '/sectors',
  userManage: '/admin/profile',
} as const;
