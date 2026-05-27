import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { BottomNav, type TabKey } from '@/components/v2/dark/bottom-nav';

type TabBarProp = NonNullable<ComponentProps<typeof Tabs>['tabBar']>;
type TabBarProps = Parameters<TabBarProp>[0];

const ROUTE_TO_TAB: Record<string, TabKey> = {
  index: 'home',
  chat: 'chat',
  library: 'library',
  profile: 'profile',
  inventory: 'inventory',
};

function CustomTabBar({ state, navigation }: TabBarProps) {
  const currentRouteName = state.routes[state.index]?.name ?? 'index';
  const active: TabKey = ROUTE_TO_TAB[currentRouteName] ?? 'home';

  const handleSelect = (key: TabKey) => {
    const targetRoute = Object.keys(ROUTE_TO_TAB).find(
      (route) => ROUTE_TO_TAB[route] === key,
    );
    if (targetRoute) {
      navigation.navigate(targetRoute);
    }
  };

  return <BottomNav active={active} onSelect={handleSelect} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="inventory" />
    </Tabs>
  );
}
