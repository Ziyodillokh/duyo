import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useIsDark } from '@/store/theme';

interface SettingsRowProps {
  Icon: LucideIcon;
  label: string;
  trailing?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  isLast?: boolean;
  accessibilityLabel?: string;
}

export function SettingsRow({
  Icon,
  label,
  trailing,
  onPress,
  showChevron = false,
  isLast = false,
  accessibilityLabel,
}: SettingsRowProps) {
  const isDark = useIsDark();
  // Per Figma: row icons use neon blue accent in both themes for visual harmony
  const iconColor = isDark ? '#60A5FA' : '#2563EB';
  const chevronColor = isDark ? '#94A3B8' : '#64748B';
  const dividerClass = isDark ? 'border-neon-blue/20' : 'border-primary/10';
  const labelClass = isDark ? 'text-dark-text' : 'text-foreground';

  const content = (
    <View
      className={`flex-row items-center justify-between px-4 py-4 ${
        isLast ? '' : `border-b ${dividerClass}`
      }`}
    >
      <View className="flex-row items-center gap-3 flex-1">
        <Icon size={20} color={iconColor} />
        <Text className={`text-base font-medium ${labelClass}`}>{label}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        {trailing}
        {showChevron && <ChevronRight size={20} color={chevronColor} />}
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      className="active:opacity-70"
    >
      {content}
    </Pressable>
  );
}
