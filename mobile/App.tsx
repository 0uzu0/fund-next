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
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import WebViewScreen from './src/WebViewScreen';
import SettingsScreen from './src/SettingsScreen';
import { getStoredServerUrl, getServerUrl } from './src/storage';
import { THEME } from './src/config';

type AppScreen = 'loading' | 'settings' | 'webview';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [serverUrl, setServerUrl] = useState('');
  const [previousScreen, setPreviousScreen] = useState<AppScreen>('webview');

  // 应用启动时加载服务器地址（未配置过则进入设置页）
  useEffect(() => {
    (async () => {
      const stored = await getStoredServerUrl();
      const url = stored || (await getServerUrl());
      setServerUrl(url);
      setScreen(stored ? 'webview' : 'settings');
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

  // 加载中（与前端深色主题一致）
  if (screen === 'loading') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.background} />
        <View style={styles.loadingCenter}>
          <View style={styles.loadingLogo}>
            <Text style={styles.loadingLogoText}>L</Text>
          </View>
          <Text style={styles.loadingTitle}>LanFund</Text>
          <Text style={styles.loadingSubtitle}>智能基金管理系统</Text>
        </View>
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
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.cardBg,
    borderWidth: 1,
    borderColor: THEME.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingLogoText: {
    color: THEME.accent,
    fontSize: 28,
    fontWeight: '700',
  },
  loadingTitle: {
    color: THEME.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  loadingSubtitle: {
    color: THEME.textSecondary,
    fontSize: 13,
  },
});
