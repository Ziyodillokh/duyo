import { Text, View } from 'react-native';

interface XPBadgeProps {
  amount: number;
  prefix?: string;
}

export function XPBadge({ amount, prefix = '+' }: XPBadgeProps) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-2xl">⭐</Text>
      <Text className="text-xl font-bold text-neon-yellow">
        {prefix}
        {amount} XP
      </Text>
    </View>
  );
}
