/**
 * 设置页面
 *
 * 提供以下功能：
 * - 配置服务器地址
 * - 测试服务器连接
 * - 查看应用信息
 * - 清除本地数据
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Constants from 'expo-constants';
import { THEME, APP_NAME, DEFAULT_SERVER_URL } from './config';
import { setServerUrl, clearAllData } from './storage';

const APP_VERSION = Constants.expoConfig?.version ?? Constants.manifest?.version ?? '1.0.0';

interface SettingsScreenProps {
  currentServerUrl: string;
  onSave: (url: string) => void;
  onClose: () => void;
}

export default function SettingsScreen({ currentServerUrl, onSave, onClose }: SettingsScreenProps) {
  const [serverUrl, setServerUrlState] = useState(currentServerUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // 测试服务器连接
  const testConnection = useCallback(async () => {
    const url = serverUrl.trim().replace(/\/+$/, '');
    if (!url) {
      Alert.alert('提示', '请输入服务器地址');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${url}/api/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        // 健康检查无需登录，200 即说明服务器可达
        setTestResult({
          success: true,
          message: '连接成功！服务器正常',
        });
      } else {
        setTestResult({
          success: false,
          message: `服务器响应异常 (HTTP ${response.status})`,
        });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setTestResult({
          success: false,
          message: '连接超时（10秒），请检查地址和网络',
        });
      } else {
        setTestResult({
          success: false,
          message: `无法连接: ${err.message || '未知错误'}`,
        });
      }
    } finally {
      setTesting(false);
    }
  }, [serverUrl]);

  // 保存设置（自动补全 http/https，便于用户只填域名:端口）
  const handleSave = useCallback(async () => {
    let url = serverUrl.trim().replace(/\/+$/, '');
    if (!url) {
      Alert.alert('提示', '请输入服务器地址');
      return;
    }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try {
      new URL(url);
    } catch {
      Alert.alert('提示', '请输入有效的地址，例如 https://fund.example.com:8311 或 192.168.1.100:8311');
      return;
    }
    await setServerUrl(url);
    onSave(url);
  }, [serverUrl, onSave]);

  // 重置为默认地址
  const handleReset = useCallback(() => {
    setServerUrlState(DEFAULT_SERVER_URL);
    setTestResult(null);
  }, []);

  // 清除所有数据
  const handleClearData = useCallback(() => {
    Alert.alert(
      '确认清除',
      '将清除所有本地数据（服务器地址、缓存等），是否继续？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认清除',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            setServerUrlState(DEFAULT_SERVER_URL);
            setTestResult(null);
            Alert.alert('提示', '已清除所有本地数据');
          },
        },
      ]
    );
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.background} />

      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} activeOpacity={0.6} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>设置</Text>
        <TouchableOpacity onPress={handleSave} activeOpacity={0.6} style={styles.headerButton}>
          <Text style={[styles.headerButtonText, styles.headerSaveText]}>保存</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>

          {/* 服务器设置 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>服务器设置</Text>
            <View style={styles.card}>
              <Text style={styles.label}>服务器地址</Text>
              <TextInput
                style={styles.input}
                value={serverUrl}
                onChangeText={(text) => {
                  setServerUrlState(text);
                  setTestResult(null);
                }}
                placeholder="例如: http://192.168.1.100:8311"
                placeholderTextColor={THEME.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                selectTextOnFocus
              />
              <Text style={styles.hint}>
                请输入 LanFund 后端服务的地址。确保手机和服务器在同一网络中。
              </Text>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.testButton]}
                  onPress={testConnection}
                  disabled={testing}
                  activeOpacity={0.7}
                >
                  {testing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>🔗 测试连接</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.resetButton]}
                  onPress={handleReset}
                  activeOpacity={0.7}
                >
                  <Text style={styles.resetButtonText}>↩️ 重置</Text>
                </TouchableOpacity>
              </View>

              {/* 测试结果 */}
              {testResult && (
                <View
                  style={[
                    styles.testResult,
                    testResult.success ? styles.testResultSuccess : styles.testResultError,
                  ]}
                >
                  <Text
                    style={[
                      styles.testResultText,
                      { color: testResult.success ? THEME.success : THEME.danger },
                    ]}
                  >
                    {testResult.success ? '✅ ' : '❌ '}
                    {testResult.message}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* 数据管理 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>数据管理</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={[styles.button, styles.dangerButton]}
                onPress={handleClearData}
                activeOpacity={0.7}
              >
                <Text style={styles.dangerButtonText}>🗑️ 清除本地数据</Text>
              </TouchableOpacity>
              <Text style={styles.hint}>
                清除后需要重新配置服务器地址并登录。
              </Text>
            </View>
          </View>

          {/* 关于 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>关于</Text>
            <View style={styles.card}>
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>应用名称</Text>
                <Text style={styles.aboutValue}>{APP_NAME}</Text>
              </View>
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>版本号</Text>
                <Text style={styles.aboutValue}>{APP_VERSION}</Text>
              </View>
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>技术栈</Text>
                <Text style={styles.aboutValue}>React Native + Expo</Text>
              </View>
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>当前服务器</Text>
                <Text style={[styles.aboutValue, { fontSize: 12 }]}>{currentServerUrl}</Text>
              </View>
            </View>
          </View>

          {/* 使用说明 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>使用说明</Text>
            <View style={styles.card}>
              <Text style={styles.instructions}>
                1. 确保 LanFund 后端服务已启动{'\n'}
                2. 手机和服务器需在同一局域网{'\n'}
                3. 在上方输入服务器地址并测试连接{'\n'}
                4. 连接成功后点击"保存"即可使用{'\n'}
                5. 若使用公网部署，输入公网地址即可
              </Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  headerButton: {
    padding: 4,
    minWidth: 60,
  },
  headerButtonText: {
    color: THEME.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  headerSaveText: {
    color: THEME.accent,
    textAlign: 'right',
    fontWeight: '700',
  },
  headerTitle: {
    color: THEME.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: THEME.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: THEME.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  label: {
    color: THEME.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: THEME.background,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: THEME.textPrimary,
    fontSize: 15,
    marginBottom: 8,
  },
  hint: {
    color: THEME.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  testButton: {
    backgroundColor: THEME.accent,
  },
  resetButton: {
    backgroundColor: THEME.cardBg,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  resetButtonText: {
    color: THEME.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248, 81, 73, 0.3)',
  },
  dangerButtonText: {
    color: THEME.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  testResult: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
  },
  testResultSuccess: {
    backgroundColor: 'rgba(63, 185, 80, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(63, 185, 80, 0.3)',
  },
  testResultError: {
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248, 81, 73, 0.3)',
  },
  testResultText: {
    fontSize: 13,
    fontWeight: '500',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  aboutLabel: {
    color: THEME.textSecondary,
    fontSize: 14,
  },
  aboutValue: {
    color: THEME.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  instructions: {
    color: THEME.textSecondary,
    fontSize: 13,
    lineHeight: 22,
  },
});
