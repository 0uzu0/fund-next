import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useServerUrl } from '../context/ServerUrlContext';

type Props = {
  onSaved: () => void;
};

export function ServerAddressScreen({ onSaved }: Props) {
  const { setServerUrl } = useServerUrl();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeUrl = (raw: string): string => {
    let u = raw.trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
    return u.replace(/\/+$/, '');
  };

  const handleSave = async () => {
    const url = normalizeUrl(input);
    if (!url) {
      setError('请输入服务端地址');
      return;
    }
    try {
      new URL(url);
    } catch {
      setError('请输入有效的地址（如 https://域名 或 http://192.168.1.1:3000）');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await setServerUrl(url);
      onSaved();
    } catch (e) {
      setError('保存失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <View style={styles.card}>
        <Text style={styles.title}>服务端地址</Text>
        <Text style={styles.hint}>
          请填写前端页面地址，例如：https://你的域名 或 http://192.168.1.100:3000
        </Text>
        <TextInput
          style={styles.input}
          placeholder="https://example.com 或 http://192.168.x.x:3000"
          placeholderTextColor="#64748b"
          value={input}
          onChangeText={(t) => { setInput(t); setError(null); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!loading}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>保存并进入登录</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#334155',
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    marginTop: 8,
  },
  button: {
    marginTop: 24,
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
