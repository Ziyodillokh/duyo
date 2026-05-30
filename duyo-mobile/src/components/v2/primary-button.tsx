import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

interface PrimaryButtonProps {
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function PrimaryButton({
  onPress,
  children,
  disabled = false,
  accessibilityLabel,
}: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel}
      className={`w-full h-14 rounded-md items-center justify-center active:opacity-80 ${
        disabled ? 'bg-primary/40' : 'bg-primary'
      }`}
    >
      <Text className="text-[18px] font-medium text-primary-foreground tracking-tight">
        {children}
      </Text>
    </Pressable>
  );
}
