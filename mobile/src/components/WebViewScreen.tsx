import React, { useState, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import { useServerUrl } from '../context/ServerUrlContext';
import { WEB_BASE_URL } from '../config';
import { WEBVIEW_APP_CSS } from '../styles/webviewAppOverrides';

type Props = {
  path: string;
  onNavigateToLogin?: () => void;
};

function isLoginUrl(url: string): boolean {
  try {
    if (!url || url === 'about:blank' || url.startsWith('about:')) return false;
    const path = new URL(url).pathname;
    return path === '/login' || path === '/login/';
  } catch {
    return false;
  }
}

export function WebViewScreen({ path, onNavigateToLogin }: Props) {
  const { serverUrl } = useServerUrl();
  const base = serverUrl || WEB_BASE_URL || 'http://10.0.2.2:3000';
  const uri = `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : '/' + path}`;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasNavigatedToLogin = useRef(false);

  const handleNavigationStateChange = (nav: WebViewNavigation) => {
    const url = nav.url || '';
    if (!isLoginUrl(url) || !onNavigateToLogin || hasNavigatedToLogin.current) return;
    hasNavigatedToLogin.current = true;
    onNavigateToLogin();
  };

  // 与前端解耦：本端注入样式并移除 Web 顶栏/侧栏节点，客户端无顶部导航，仅底部 Tab；不依赖前端逻辑
  const injectAppStyles = `
    (function() {
      var css = ${JSON.stringify(WEBVIEW_APP_CSS)};
      var el = document.createElement('style');
      el.textContent = css;
      (document.head || document.documentElement).appendChild(el);
      function removeTopAndSideNav() {
        var top = document.querySelector('.top-navbar');
        if (top) top.remove();
        var side = document.querySelector('.sidebar-nav');
        if (side) side.remove();
      }
      if (document.body) removeTopAndSideNav();
      else document.addEventListener('DOMContentLoaded', removeTopAndSideNav);
    })();
    true;
  `;

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]}>
      <WebView
        source={{ uri }}
        style={styles.webview}
        scrollEnabled={true}
        injectedJavaScriptBeforeContentLoaded={injectAppStyles}
        startInLoadingState
        onLoadStart={() => { setError(null); setLoading(true); }}
        onLoadEnd={() => setLoading(false)}
        onError={(e) => {
          const msg = e.nativeEvent?.description || e.nativeEvent?.code?.toString() || '加载失败';
          setError(msg);
          setLoading(false);
        }}
        onHttpError={(e) => {
          if (e.nativeEvent?.statusCode >= 400) {
            setError(`HTTP ${e.nativeEvent.statusCode}`);
            setLoading(false);
          }
        }}
        onNavigationStateChange={handleNavigationStateChange}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#7c3aed" />
          </View>
        )}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback
        mediaCapture="grant"
      />
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>页面加载错误</Text>
          <Text style={styles.errorDesc}>{error}</Text>
          <Text style={styles.errorUrl}>请求地址: {uri}</Text>
          <Text style={styles.errorHint}>
            若为 net::ERR_CLEARTEXT_NOT_PERMITTED，请重新打包 APK 并确认 app 已允许明文流量；
            真机或正式包请在构建时设置 EXPO_PUBLIC_WEB_URL 为可访问的前端地址（如 https://你的域名 或 http://电脑IP:3000）
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
  },
  webview: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loading: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  errorBox: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '30%',
    padding: 20,
    backgroundColor: 'rgba(30,41,59,0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
  },
  errorTitle: { color: '#f87171', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  errorDesc: { color: '#cbd5e1', fontSize: 14, marginBottom: 8 },
  errorUrl: { color: '#94a3b8', fontSize: 12, marginBottom: 12 },
  errorHint: { color: '#94a3b8', fontSize: 12 },
});
