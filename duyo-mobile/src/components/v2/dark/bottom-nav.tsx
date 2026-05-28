import {
  BookOpen,
  Home,
  MessageCircle,
  Package,
  User,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useIsDark } from '@/store/theme';

export type TabKey = 'home' | 'chat' | 'library' | 'profile' | 'inventory';

interface TabItem {
  key: TabKey;
  label: string;
  Icon: ComponentType<{ size?: number; color?: string }>;
}

const TABS: ReadonlyArray<TabItem> = [
  { key: 'home', label: 'Bosh sahifa', Icon: Home },
  { key: 'chat', label: 'Suhbat', Icon: MessageCircle },
  { key: 'library', label: 'Kutubxona', Icon: BookOpen },
  { key: 'profile', label: 'Profil', Icon: User },
  { key: 'inventory', label: 'Inventar', Icon: Package },
];

interface BottomNavProps {
  active: TabKey;
  onSelect: (key: TabKey) => void;
}

const DARK_ACTIVE = '#60A5FA';
const DARK_INACTIVE = '#94A3B8';
const LIGHT_ACTIVE = '#2563EB';
const LIGHT_INACTIVE = '#64748B';

export function BottomNav({ active, onSelect }: BottomNavProps) {
  const isDark = useIsDark();
  const bgClass = isDark
    ? 'bg-card dark:bg-dark-surface border-t border-neon-blue/20'
    : 'bg-white border-t border-primary/10';
  const activeColor = isDark ? DARK_ACTIVE : LIGHT_ACTIVE;
  const inactiveColor = isDark ? DARK_INACTIVE : LIGHT_INACTIVE;
  return (
    <View className={`${bgClass} flex-row h-16`}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const color = isActive ? activeColor : inactiveColor;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            className="flex-1 items-center justify-center gap-1"
          >
            <tab.Icon size={24} color={color} />
            <Text
              className="text-xs font-medium"
              style={{ color }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export { TABS };
