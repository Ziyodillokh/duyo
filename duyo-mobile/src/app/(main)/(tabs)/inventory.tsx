import { Text, View } from 'react-native';

import { ScreenDark } from '@/components/v2/dark/screen-dark';

export default function InventoryScreen() {
  return (
    <ScreenDark>
      <View className="flex-1 items-center justify-center px-6 gap-4">
        <Text className="text-5xl">📦</Text>
        <Text className="text-2xl font-bold text-dark-heading text-center">
          Inventar
        </Text>
        <Text className="text-base text-dark-subtitle text-center">
          Tez orada — yutgan mukofotlar va o'yinlar
        </Text>
      </View>
    </ScreenDark>
  );
}
