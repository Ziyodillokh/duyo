import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useIsDark } from '@/store/theme';

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  const isDark = useIsDark();
  return (
    <View className="gap-3">
      <Text
        className={`text-sm font-medium px-2 ${
          isDark ? 'text-dark-muted' : 'text-muted-foreground'
        }`}
      >
        {title}
      </Text>
      <View
        className={`rounded-xl overflow-hidden border ${
          isDark
            ? 'bg-dark-surface border-neon-blue/20'
            : 'bg-white border-primary/10'
        }`}
      >
        {children}
      </View>
    </View>
  );
}
