/**
 * LanFund 移动端入口
 *
 * 功能：
 * - 启动时加载保存的服务器地址
 * - 首次使用时显示设置页面配置服务器地址
 * - 正常使用时显示 WebView 加载 Web 前端
 * - 提供设置入口修改服务器地址
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import WebViewScreen from './src/WebViewScreen';
import SettingsScreen from './src/SettingsScreen';
import { getServerUrl } from './src/storage';
import { THEME } from './src/config';

type AppScreen = 'loading' | 'settings' | 'webview';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [serverUrl, setServerUrl] = useState('');
  const [previousScreen, setPreviousScreen] = useState<AppScreen>('webview');

  // 应用启动时加载服务器地址
  useEffect(() => {
    (async () => {
      const url = await getServerUrl();
      setServerUrl(url);
      // 如果有保存的地址，直接进入 WebView；否则显示设置页
      setScreen(url ? 'webview' : 'settings');
    })();
  }, []);

  // 打开设置页
  const openSettings = useCallback(() => {
    setPreviousScreen(screen);
    setScreen('settings');
  }, [screen]);

  // 关闭设置页
  const closeSettings = useCallback(() => {
    setScreen(serverUrl ? 'webview' : 'settings');
  }, [serverUrl]);

  // 保存设置并切换到 WebView
  const onSaveSettings = useCallback((url: string) => {
    setServerUrl(url);
    setScreen('webview');
  }, []);

  // 加载中
  if (screen === 'loading') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.background} />
      </View>
    );
  }

  // 设置页
  if (screen === 'settings') {
    return (
      <SettingsScreen
        currentServerUrl={serverUrl}
        onSave={onSaveSettings}
        onClose={closeSettings}
      />
    );
  }

  // WebView 主页面
  return (
    <WebViewScreen
      serverUrl={serverUrl}
      onOpenSettings={openSettings}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
});
