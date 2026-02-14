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

const TabScreens = [
  { name: 'Portfolio', path: ROUTES.portfolio, label: '持仓基金', icon: '💼' },
  { name: 'PreciousMetals', path: ROUTES.preciousMetals, label: '贵金属行情', icon: '🥇' },
  { name: 'Sectors', path: ROUTES.sectors, label: '行业板块', icon: '🏢' },
  { name: 'User', path: ROUTES.userManage, label: '用户管理', icon: '👤' },
] as const;

function TabIcon({ icon }: { icon: string }) {
  return <Text style={{ fontSize: 20 }}>{icon}</Text>;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#a78bfa',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#1e293b',
          borderTopColor: '#334155',
        },
        tabBarLabelStyle: {
          fontSize: 11,
        },
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
          {() => <WebViewScreen path={path} />}
        </Tab.Screen>
      ))}
    </Tab.Navigator>
  );
}

// 根栈：未配置地址时先显示 ServerAddress，否则显示 Login；从 Login 进入 Main
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
      initialRouteName={!serverUrl ? 'ServerAddress' : 'Login'}
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
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Main" component={MainTabs} />
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
