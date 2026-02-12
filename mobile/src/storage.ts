/**
 * 本地存储工具
 * 封装 AsyncStorage，用于持久化配置信息
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEY_SERVER_URL, DEFAULT_SERVER_URL } from './config';

/**
 * 获取保存的服务器地址
 */
export async function getServerUrl(): Promise<string> {
  try {
    const url = await AsyncStorage.getItem(STORAGE_KEY_SERVER_URL);
    return url || DEFAULT_SERVER_URL;
  } catch {
    return DEFAULT_SERVER_URL;
  }
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
