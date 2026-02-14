import React, { useState, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import type { NativeSyntheticEvent } from 'react-native';
import type { WebViewNavigation } from 'react-native-webview';
import { useServerUrl } from '../context/ServerUrlContext';

type Props = {
  onLoggedIn: () => void;
};

const LOGIN_PATH = '/login';

function isLoginUrl(url: string): boolean {
  try {
    if (!url || url === 'about:blank' || url.startsWith('about:')) return false;
    const path = new URL(url).pathname;
    return path === '/login' || path === '/login/';
  } catch {
    return false;
  }
}

export function LoginScreen({ onLoggedIn }: Props) {
  const { serverUrl } = useServerUrl();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasNavigatedAway = useRef(false);
  const hasLoadedLoginPage = useRef(false);
  const webViewRef = useRef<WebView>(null);

  if (!serverUrl) return null;

  const loginUri = `${serverUrl.replace(/\/+$/, '')}${LOGIN_PATH}`;

  const handleNavigationStateChange = (nav: WebViewNavigation) => {
    const url = nav.url || '';
    if (!url || url === 'about:blank' || url.startsWith('about:')) return;
    if (isLoginUrl(url)) {
      hasLoadedLoginPage.current = true;
      return;
    }
    if (hasNavigatedAway.current) return;
    if (!hasLoadedLoginPage.current) return;
    hasNavigatedAway.current = true;
    setLoading(false);
    onLoggedIn();
  };

  const handleError = (e: NativeSyntheticEvent<{ description: string }>) => {
    const msg = e.nativeEvent?.description || '加载失败';
    setError(msg);
    setLoading(false);
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    webViewRef.current?.reload();
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        ref={webViewRef}
        source={{ uri: loginUri }}
        style={styles.webview}
        startInLoadingState
        onLoadStart={() => { setError(null); setLoading(true); }}
        onLoadEnd={() => setLoading(false)}
        onError={handleError}
        onHttpError={(e) => {
          if (e.nativeEvent.statusCode >= 400) {
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
      />
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>页面加载错误</Text>
          <Text style={styles.errorDesc}>{error}</Text>
          <Text style={styles.errorUrl}>请求地址: {loginUri}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
            <Text style={styles.retryBtnText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {loading && !error ? (
        <View style={styles.loadingOverlay} pointerEvents="box-none">
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={styles.loadingText}>正在打开登录页…</Text>
        </View>
      ) : null}
      <View style={styles.footer}>
        <Text style={styles.footerText}>登录成功后将自动进入应用</Text>
        <TouchableOpacity onPress={onLoggedIn}>
          <Text style={styles.enterLink}>已登录，直接进入</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(26,26,46,0.7)',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  errorBox: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '25%',
    padding: 20,
    backgroundColor: 'rgba(30,41,59,0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
  },
  errorTitle: { color: '#f87171', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  errorDesc: { color: '#cbd5e1', fontSize: 14, marginBottom: 8 },
  errorUrl: { color: '#94a3b8', fontSize: 12, marginBottom: 12 },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#7c3aed',
    borderRadius: 8,
  },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: 'rgba(30,41,59,0.95)',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    alignItems: 'center',
  },
  footerText: { color: '#94a3b8', fontSize: 13, marginBottom: 8 },
  enterLink: { color: '#a78bfa', fontSize: 14, fontWeight: '500' },
});
