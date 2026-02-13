import React from 'react';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WebViewScreen } from './src/components/WebViewScreen';
import { ROUTES } from './src/config';

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

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer>
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
                tabBarIcon: ({ color }) => <TabIcon icon={icon} />,
              }}
            >
              {() => <WebViewScreen path={path} />}
            </Tab.Screen>
          ))}
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
