import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { Text } from '@/components/text';

interface ChipProps {
  selected?: boolean;
  onPress: () => void;
  children: ReactNode;
  accessibilityLabel?: string;
  disabled?: boolean;
}

export function Chip({
  selected = false,
  onPress,
  children,
  accessibilityLabel,
  disabled = false,
}: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel}
      className={`h-12 px-6 rounded-md items-center justify-center active:opacity-80 ${
        selected
          ? 'bg-primary'
          : 'bg-white border border-primary/10'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      <Text
        className={`text-sm font-medium ${
          selected ? 'text-primary-foreground' : 'text-foreground'
        }`}
      >
        {children}
      </Text>
    </Pressable>
  );
}
