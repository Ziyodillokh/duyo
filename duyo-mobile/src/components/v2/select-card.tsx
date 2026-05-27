import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

interface SelectCardProps {
  selected: boolean;
  onPress: () => void;
  children: ReactNode;
  accessibilityLabel?: string;
}

export function SelectCard({
  selected,
  onPress,
  children,
  accessibilityLabel,
}: SelectCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      style={
        selected
          ? {
              shadowColor: '#000',
              shadowOpacity: 0.1,
              shadowRadius: 15,
              shadowOffset: { width: 0, height: 10 },
              elevation: 4,
            }
          : undefined
      }
      className={`w-full rounded-xl px-[26px] py-[26px] flex-row items-center ${
        selected
          ? 'bg-primary/[0.05] border-2 border-primary'
          : 'bg-white border border-primary/10'
      }`}
    >
      <View className="flex-row items-center gap-4">{children}</View>
    </Pressable>
  );
}
