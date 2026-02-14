import React, { useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { WEB_BASE_URL } from '../config';

type Props = {
  path: string;
};

export function WebViewScreen({ path }: Props) {
  const base = WEB_BASE_URL || 'http://10.0.2.2:3000';
  const uri = `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : '/' + path}`;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // 用于 onLoadEnd 后隐藏 loading

  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        source={{ uri }}
        style={styles.webview}
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
          <Text style={styles.errorHint}>
            若为 net::ERR_CLEARTEXT_NOT_PERMITTED，请重新打包 APK 并确认 app 已允许明文流量；
            真机请设置 .env 中 EXPO_PUBLIC_WEB_URL=http://你的电脑IP:3000
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
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
  errorDesc: { color: '#cbd5e1', fontSize: 14, marginBottom: 12 },
  errorHint: { color: '#94a3b8', fontSize: 12 },
});
