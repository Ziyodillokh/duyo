import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <View className="gap-3">
      <Text className="text-sm font-medium text-dark-muted px-2">{title}</Text>
      <View className="bg-dark-surface rounded-xl border border-neon-blue/20 overflow-hidden">
        {children}
      </View>
    </View>
  );
}
