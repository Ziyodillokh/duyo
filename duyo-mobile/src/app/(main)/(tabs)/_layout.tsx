import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { BottomNav, type TabKey } from '@/components/v2/dark/bottom-nav';

type TabBarProp = NonNullable<ComponentProps<typeof Tabs>['tabBar']>;
type TabBarProps = Parameters<TabBarProp>[0];

// Keys are route file names under (tabs). Must stay in step with TABS in
// bottom-nav.tsx: a stale key here silently no-ops on tap, and the reverse
// lookup silently falls back to 'home' rather than erroring.
const ROUTE_TO_TAB: Record<string, TabKey> = {
  index: 'home',
  chat: 'chat',
  goals: 'goals',
  brain: 'brain',
  profile: 'profile',
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

  // Home, Maqsaddoshlar and Miya are glass screens: they paint their own
  // light sky whatever the theme is, so the bar over them must stay light
  // too. Miya's map is the one dark ground under a light bar — the same
  // pairing light mode has always shown there, and the tab bar cannot see
  // which sub-screen Miya is on.
  return (
    <BottomNav
      active={active}
      onSelect={handleSelect}
      forceLight={active === 'home' || active === 'goals' || active === 'brain'}
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="goals" />
      <Tabs.Screen name="brain" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
