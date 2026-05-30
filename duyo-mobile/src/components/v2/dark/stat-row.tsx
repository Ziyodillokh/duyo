import { Text, View } from 'react-native';

import { ProgressBar } from './progress-bar';

type StatColor = 'gold' | 'blue' | 'pink' | 'green';

interface StatRowProps {
  emoji: string;
  label: string;
  percent: number; // 0..100
  color: StatColor;
}

const PROGRESS_COLOR: Record<StatColor, 'gold' | 'blue' | 'pink' | 'green'> = {
  gold: 'gold',
  blue: 'blue',
  pink: 'pink',
  green: 'green',
};

export function StatRow({ emoji, label, percent, color }: StatRowProps) {
  return (
    <View className="flex-1 gap-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Text className="text-3xl text-foreground dark:text-dark-text">{emoji}</Text>
          <Text className="text-sm font-bold text-foreground dark:text-dark-text">{label}</Text>
        </View>
        <Text className="text-lg font-bold text-primary dark:text-dark-heading">{percent}%</Text>
      </View>
      <ProgressBar value={percent / 100} color={PROGRESS_COLOR[color]} />
    </View>
  );
}
