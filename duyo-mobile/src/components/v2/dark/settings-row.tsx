import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

interface SettingsRowProps {
  Icon: LucideIcon;
  label: string;
  trailing?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  isLast?: boolean;
  accessibilityLabel?: string;
}

const ICON_COLOR = '#94A3B8';
const CHEVRON_COLOR = '#94A3B8';

export function SettingsRow({
  Icon,
  label,
  trailing,
  onPress,
  showChevron = false,
  isLast = false,
  accessibilityLabel,
}: SettingsRowProps) {
  const content = (
    <View
      className={`flex-row items-center justify-between px-4 py-4 ${
        isLast ? '' : 'border-b border-neon-blue/20'
      }`}
    >
      <View className="flex-row items-center gap-3 flex-1">
        <Icon size={20} color={ICON_COLOR} />
        <Text className="text-base font-medium text-dark-text">{label}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        {trailing}
        {showChevron && <ChevronRight size={20} color={CHEVRON_COLOR} />}
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
