import { Text, View } from 'react-native';

interface CountryChipProps {
  code: string;
}

export function CountryChip({ code }: CountryChipProps) {
  return (
    <View className="bg-muted rounded-lg border border-primary/10 px-4 py-3 items-center justify-center">
      <Text className="text-base text-muted-foreground">{code}</Text>
    </View>
  );
}
