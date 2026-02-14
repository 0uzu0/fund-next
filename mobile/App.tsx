import React from 'react';
import { Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ServerUrlProvider, useServerUrl } from './src/context/ServerUrlContext';
import { ServerAddressScreen } from './src/screens/ServerAddressScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { WebViewScreen } from './src/components/WebViewScreen';
import { ROUTES } from './src/config';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// 客户端无顶部导航，仅底部 Tab 导航；Web 页内的顶栏/侧栏由 WebView 注入脚本移除
const TabScreens = [
  { name: 'Portfolio', path: ROUTES.portfolio, label: '持仓基金', icon: '💼' },
  { name: 'PreciousMetals', path: ROUTES.preciousMetals, label: '贵金属行情', icon: '🥇' },
  { name: 'Sectors', path: ROUTES.sectors, label: '行业板块', icon: '🏢' },
  { name: 'User', path: ROUTES.userManage, label: '用户管理', icon: '👤' },
] as const;

function TabIcon({ icon }: { icon: string }) {
  return <Text style={{ fontSize: 20 }}>{icon}</Text>;
}

function MainTabs({ onNavigateToLogin }: { onNavigateToLogin?: () => void }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false, // 无顶部导航，仅底部 Tab
        tabBarActiveTintColor: '#a78bfa',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#1e293b',
          borderTopColor: '#334155',
        },
        tabBarLabelStyle: {
          fontSize: 11,
        },
        unmountOnBlur: false,
        sceneContainerStyle: { backgroundColor: '#1a1a2e' },
      }}
    >
      {TabScreens.map(({ name, path, label, icon }) => (
        <Tab.Screen
          key={name}
          name={name}
          options={{
            title: label,
            tabBarIcon: () => <TabIcon icon={icon} />,
          }}
        >
          {() => <WebViewScreen path={path} onNavigateToLogin={onNavigateToLogin} />}
        </Tab.Screen>
      ))}
    </Tab.Navigator>
  );
}

// 根栈：未配置地址时显示 ServerAddress；已配置则直接进 Main，仅当 WebView 跳转到 /login 时再显示登录页
function RootStack() {
  const { serverUrl, isLoading } = useServerUrl();

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingText}>加载中…</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={!serverUrl ? 'ServerAddress' : 'Main'}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#1a1a2e' },
      }}
    >
      <Stack.Screen name="ServerAddress">
        {({ navigation }) => (
          <ServerAddressScreen
            onSaved={() => navigation.replace('Login')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Login">
        {({ navigation }) => (
          <LoginScreen
            onLoggedIn={() => navigation.replace('Main')}
            onBackToServerAddress={() => navigation.replace('ServerAddress')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Main">
        {({ navigation }) => (
          <MainTabs
            onNavigateToLogin={() =>
              navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] })
            }
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ServerUrlProvider>
        <NavigationContainer>
          <RootStack />
        </NavigationContainer>
      </ServerUrlProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
});
