/**
 * 本地存储工具
 * 封装 AsyncStorage，用于持久化配置信息，与前端无直接耦合
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEY_SERVER_URL, DEFAULT_SERVER_URL } from './config';

/**
 * 获取已存储的服务器地址（未配置时返回 null）
 */
export async function getStoredServerUrl(): Promise<string | null> {
  try {
    const url = await AsyncStorage.getItem(STORAGE_KEY_SERVER_URL);
    const trimmed = url?.trim();
    return trimmed && trimmed.length > 0 ? trimmed.replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

/**
 * 获取服务器地址（未配置时使用默认值，供 WebView 等使用）
 */
export async function getServerUrl(): Promise<string> {
  const stored = await getStoredServerUrl();
  return stored || DEFAULT_SERVER_URL;
}

/**
 * 保存服务器地址
 */
export async function setServerUrl(url: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_SERVER_URL, url.replace(/\/+$/, ''));
  } catch (e) {
    console.warn('Failed to save server URL:', e);
  }
}

/**
 * 清除所有本地数据（退出登录时使用）
 */
export async function clearAllData(): Promise<void> {
  try {
    await AsyncStorage.clear();
  } catch (e) {
    console.warn('Failed to clear data:', e);
  }
}
