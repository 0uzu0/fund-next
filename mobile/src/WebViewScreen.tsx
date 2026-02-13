/**
 * WebView 主屏幕
 *
 * 使用 react-native-webview 加载 LanFund Web 前端。
 * 支持功能：
 * - 加载远程 Web 页面（后端同源托管的前端）
 * - Android 返回键处理（优先 WebView 后退）
 * - 页面加载状态指示
 * - 网络错误时的重试机制
 * - 下拉刷新
 * - JavaScript 注入（适配移动端）
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  BackHandler,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { THEME, USER_AGENT_SUFFIX, BOTTOM_NAV_ROUTES, APP_VERSION, PAGE_LOAD_TIMEOUT, normalizeServerUrl } from './config';

interface WebViewScreenProps {
  serverUrl: string;
  onOpenSettings: () => void;
}

/** 生成注入脚本（注入版本号，与前端 globals 一致的安全区/触摸优化） */
function getInjectedJS(version: string): string {
  return `
(function() {
  window.__LANFUND_APP__ = true;
  window.__LANFUND_APP_VERSION__ = '${version.replace(/'/g, "\\'")}';
  if (document.body) document.body.classList.add('lanfund-app');
  else document.addEventListener('DOMContentLoaded', function() { document.body.classList.add('lanfund-app'); });

  document.addEventListener('contextmenu', function(e) { e.preventDefault(); });

  var meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  }

  var style = document.createElement('style');
  style.textContent = [
    'body { padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); -webkit-overflow-scrolling: touch; overscroll-behavior-y: none; }',
    '.content-area, .main-container { -webkit-overflow-scrolling: touch; }',
    '* { -webkit-tap-highlight-color: transparent; }',
    '.table-container { -webkit-overflow-scrolling: touch; }'
  ].join(' ');
  document.head.appendChild(style);

  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'page_loaded', url: window.location.href, title: document.title }));
  }
  var _pushState = history.pushState;
  history.pushState = function() {
    _pushState.apply(this, arguments);
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'navigation', url: window.location.href, title: document.title }));
    }
  };
  true;
})();
`;
}

export default function WebViewScreen({ serverUrl, onOpenSettings }: WebViewScreenProps) {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [pageTitle, setPageTitle] = useState('LanFund');
  const [refreshing, setRefreshing] = useState(false);

  // 规范化 URL（补全协议、去空格），无效则不加载
  const loadUrl = (() => {
    const normalized = normalizeServerUrl(serverUrl);
    if (!normalized) return '';
    try {
      new URL(normalized);
      return normalized;
    } catch {
      return '';
    }
  })();

  // 加载超时：服务器不可达时避免一直转圈
  useEffect(() => {
    if (!loadUrl || !loading || error) return;
    const timer = setTimeout(() => {
      setLoading(false);
      setError('连接超时\n请检查网络与服务器地址，或到设置中修改后重试');
    }, PAGE_LOAD_TIMEOUT);
    return () => clearTimeout(timer);
  }, [loadUrl, loading, error]);

  // Android 返回键处理
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true; // 拦截返回键
      }
      return false; // 使用默认行为（退出应用）
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [canGoBack]);

  // 处理 WebView 导航状态变化
  const onNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    setCurrentUrl(navState.url);
    if (navState.title) {
      setPageTitle(navState.title);
    }
  }, []);

  // 处理 WebView 发送的消息
  const onMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'page_loaded') {
        setLoading(false);
      } else if (data.type === 'navigation') {
        setCurrentUrl(data.url);
        if (data.title) setPageTitle(data.title);
      }
    } catch {
      // 忽略无法解析的消息
    }
  }, []);

  // 加载开始
  const onLoadStart = useCallback(() => {
    setLoading(true);
    setError(null);
  }, []);

  // 加载完成：仅关闭下拉刷新；loading 由 page_loaded 消息关闭，避免链接跳转时
  // onLoadEnd 先于新页 onLoadStart 触发导致底部栏短暂露出再闪回「加载中」
  const onLoadEnd = useCallback(() => {
    setRefreshing(false);
  }, []);

  // 加载错误
  const onError = useCallback((syntheticEvent: { nativeEvent: { description: string; code: number } }) => {
    const { description, code } = syntheticEvent.nativeEvent;
    setLoading(false);
    setRefreshing(false);
    setError(`无法连接到服务器\n${description || '请检查网络连接和服务器地址'}\n错误代码: ${code}`);
  }, []);

  // HTTP 错误
  const onHttpError = useCallback((syntheticEvent: { nativeEvent: { statusCode: number; url: string } }) => {
    const { statusCode } = syntheticEvent.nativeEvent;
    if (statusCode >= 500) {
      setError(`服务器错误 (${statusCode})\n请稍后重试`);
    }
  }, []);

  // 重试加载
  const onRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

  // 无有效 URL 时不渲染 WebView
  if (!loadUrl) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.background} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>连接失败</Text>
          <Text style={styles.errorMessage}>服务器地址无效，请到设置中配置正确地址。</Text>
          <TouchableOpacity style={styles.settingsButton} onPress={onOpenSettings} activeOpacity={0.7}>
            <Text style={styles.settingsButtonText}>⚙️ 设置</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 下拉刷新
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    webViewRef.current?.reload();
  }, []);

  // 导航到前端路由（与 Sidebar 路径一致）
  const baseUrl = loadUrl.replace(/\/+$/, '');
  const navigateTo = useCallback(
    (path: string) => {
      const url = `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
      webViewRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(url)}; true;`);
    },
    [baseUrl]
  );

  // 无效 URL 或连接错误时显示错误页
  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.background} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>连接失败</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Text style={styles.errorUrl}>服务器地址: {loadUrl || serverUrl || '未设置'}</Text>
          <View style={styles.errorActions}>
            <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.7}>
              <Text style={styles.retryButtonText}>🔄 重试</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsButton} onPress={onOpenSettings} activeOpacity={0.7}>
              <Text style={styles.settingsButtonText}>⚙️ 设置</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.background} translucent={false} />

      {/* WebView */}
      <WebView
        key={loadUrl}
        ref={webViewRef}
        source={{ uri: loadUrl }}
        style={styles.webview}
        onNavigationStateChange={onNavigationStateChange}
        onMessage={onMessage}
        onLoadStart={onLoadStart}
        onLoadEnd={onLoadEnd}
        onError={onError}
        onHttpError={onHttpError}
        injectedJavaScript={getInjectedJS(APP_VERSION)}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        scalesPageToFit={true}
        allowsBackForwardNavigationGestures={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="compatibility"
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
        userAgent={`Mozilla/5.0 (Linux; Android ${Platform.Version}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 ${USER_AGENT_SUFFIX}`}
        originWhitelist={['*']}
        setSupportMultipleWindows={false}
        overScrollMode="never"
        pullToRefreshEnabled={true}
        nestedScrollEnabled={true}
        textZoom={100}
      />

      {/* 加载指示器 */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={THEME.accent} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      )}

      {/* 底部栏：与前端 Sidebar 主导航一致 */}
      <View style={styles.bottomBar}>
        {BOTTOM_NAV_ROUTES.map(({ path, icon, label }) => (
          <TouchableOpacity
            key={path}
            style={styles.bottomBarButton}
            onPress={() => navigateTo(path)}
            activeOpacity={0.6}
          >
            <Text style={styles.bottomBarIcon}>{icon}</Text>
            <Text style={styles.bottomBarLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.bottomBarButton} onPress={onOpenSettings} activeOpacity={0.6}>
          <Text style={styles.bottomBarIcon}>⚙️</Text>
          <Text style={styles.bottomBarLabel}>设置</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  webview: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: THEME.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: THEME.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    color: THEME.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  errorMessage: {
    color: THEME.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  errorUrl: {
    color: THEME.textSecondary,
    fontSize: 12,
    marginBottom: 24,
    opacity: 0.7,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: THEME.accent,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: THEME.cardBg,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  settingsButtonText: {
    color: THEME.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  bottomBar: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: THEME.cardBg,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  bottomBarButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  bottomBarIcon: {
    fontSize: 20,
    color: THEME.textSecondary,
    marginBottom: 2,
  },
  bottomBarLabel: {
    fontSize: 11,
    color: THEME.textSecondary,
  },
});
