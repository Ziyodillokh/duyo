import { View } from 'react-native';

type ProgressColor = 'gold' | 'blue' | 'pink' | 'green' | 'gradient';

interface ProgressBarProps {
  value: number; // 0..1
  color?: ProgressColor;
  height?: number;
}

const FILL_CLASS: Record<Exclude<ProgressColor, 'gradient'>, string> = {
  gold: 'bg-neon-gold',
  blue: 'bg-neon-cyan',
  pink: 'bg-neon-magenta',
  green: 'bg-neon-green',
};

export function ProgressBar({
  value,
  color = 'gold',
  height = 12,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const fillClass = color === 'gradient' ? 'bg-neon-cyan' : FILL_CLASS[color];

  return (
    <View
      className="bg-dark-track w-full overflow-hidden rounded-full"
      style={{ height }}
    >
      <View
        className={`h-full ${fillClass}`}
        style={{ width: `${pct}%` }}
      />
    </View>
  );
}
