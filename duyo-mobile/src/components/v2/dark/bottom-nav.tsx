import {
  BookOpen,
  Home,
  MessageCircle,
  Package,
  User,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';

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

const ACTIVE_COLOR = '#60A5FA';
const INACTIVE_COLOR = '#94A3B8';

export function BottomNav({ active, onSelect }: BottomNavProps) {
  return (
    <View className="bg-dark-surface border-t border-neon-blue/20 flex-row h-16">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const color = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;
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
