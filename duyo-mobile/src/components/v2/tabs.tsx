import { Pressable, Text, View } from 'react-native';

interface TabItem<T extends string> {
  key: T;
  label: string;
}

interface TabsProps<T extends string> {
  items: readonly TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
}

export function Tabs<T extends string>({
  items,
  active,
  onChange,
}: TabsProps<T>) {
  return (
    <View className="flex-row bg-muted rounded-xl p-1">
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={item.label}
            className={`flex-1 h-8 rounded-xl items-center justify-center ${
              isActive ? 'bg-white' : ''
            }`}
          >
            <Text className="text-sm font-medium text-foreground">
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
