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
  RefreshControl,
  ScrollView,
  Dimensions,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { THEME, USER_AGENT_SUFFIX, PAGE_LOAD_TIMEOUT } from './config';

interface WebViewScreenProps {
  serverUrl: string;
  onOpenSettings: () => void;
}

/** 注入到 WebView 中的 JavaScript，用于优化移动端体验 */
const INJECTED_JS = `
(function() {
  // 标识为 APP 内嵌浏览器
  window.__LANFUND_APP__ = true;
  window.__LANFUND_APP_VERSION__ = '1.0';

  // 禁用 Web 端的长按弹出菜单（避免干扰原生手势）
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  });

  // 设置 viewport 适配移动端
  var meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  }

  // 注入移动端特定样式
  var style = document.createElement('style');
  style.textContent = \`
    /* 隐藏 Web 端不需要在 APP 中显示的元素 */
    /* 如果需要隐藏顶部导航栏中的某些元素，可以在这里添加 */

    /* 确保安全区域适配 */
    body {
      padding-top: env(safe-area-inset-top, 0px);
      padding-bottom: env(safe-area-inset-bottom, 0px);
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-y: none;
    }

    /* 移动端滚动优化 */
    .content-area {
      -webkit-overflow-scrolling: touch;
    }

    /* 防止文本选择 */
    * {
      -webkit-tap-highlight-color: transparent;
    }

    /* 表格横向滚动优化 */
    .table-container {
      -webkit-overflow-scrolling: touch;
    }
  \`;
  document.head.appendChild(style);

  // 通知 React Native 页面已加载
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'page_loaded',
      url: window.location.href,
      title: document.title,
    }));
  }

  // 监听路由变化
  var _pushState = history.pushState;
  history.pushState = function() {
    _pushState.apply(this, arguments);
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'navigation',
        url: window.location.href,
        title: document.title,
      }));
    }
  };

  true; // 返回 true 避免警告
})();
`;

export default function WebViewScreen({ serverUrl, onOpenSettings }: WebViewScreenProps) {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [pageTitle, setPageTitle] = useState('LanFund');
  const [refreshing, setRefreshing] = useState(false);

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

  // 加载完成
  const onLoadEnd = useCallback(() => {
    setLoading(false);
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

  // 下拉刷新
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    webViewRef.current?.reload();
  }, []);

  // 渲染错误页面
  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.background} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>连接失败</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Text style={styles.errorUrl}>服务器地址: {serverUrl}</Text>
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
        ref={webViewRef}
        source={{ uri: serverUrl }}
        style={styles.webview}
        onNavigationStateChange={onNavigationStateChange}
        onMessage={onMessage}
        onLoadStart={onLoadStart}
        onLoadEnd={onLoadEnd}
        onError={onError}
        onHttpError={onHttpError}
        injectedJavaScript={INJECTED_JS}
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

      {/* 底部工具栏（长按显示设置入口） */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.bottomBarButton}
          onPress={() => {
            if (canGoBack) webViewRef.current?.goBack();
          }}
          disabled={!canGoBack}
          activeOpacity={0.6}
        >
          <Text style={[styles.bottomBarIcon, !canGoBack && styles.bottomBarIconDisabled]}>◀</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarButton}
          onPress={() => webViewRef.current?.reload()}
          activeOpacity={0.6}
        >
          <Text style={styles.bottomBarIcon}>🔄</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarButton}
          onPress={() => {
            // 导航到首页
            webViewRef.current?.injectJavaScript(`window.location.href = '/portfolio'; true;`);
          }}
          activeOpacity={0.6}
        >
          <Text style={styles.bottomBarIcon}>🏠</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarButton}
          onPress={onOpenSettings}
          activeOpacity={0.6}
        >
          <Text style={styles.bottomBarIcon}>⚙️</Text>
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
    height: 48,
    backgroundColor: THEME.cardBg,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  bottomBarButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  bottomBarIcon: {
    fontSize: 18,
    color: THEME.textSecondary,
  },
  bottomBarIconDisabled: {
    opacity: 0.3,
  },
});
