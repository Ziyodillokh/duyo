import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useIsDark } from '@/store/theme';

type GlowColor =
  | 'purple'
  | 'magenta'
  | 'orange'
  | 'green'
  | 'blue'
  | 'pink'
  | 'none';

interface DarkCardProps {
  children: ReactNode;
  glow?: GlowColor;
  className?: string;
}

const GLOW_BORDER: Record<Exclude<GlowColor, 'none'>, string> = {
  purple: 'border-glow-purple',
  magenta: 'border-glow-magenta',
  orange: 'border-glow-orange',
  green: 'border-glow-green',
  blue: 'border-glow-blue',
  pink: 'border-glow-pink',
};

export function DarkCard({
  children,
  glow = 'none',
  className = '',
}: DarkCardProps) {
  const isDark = useIsDark();
  const bgClass = isDark ? 'bg-dark-surface' : 'bg-white';
  const borderClass =
    glow === 'none'
      ? isDark
        ? 'border border-dark-text/10'
        : 'border border-primary/10'
      : `border-[3px] ${GLOW_BORDER[glow]}`;

  return (
    <View className={`${bgClass} rounded-xl p-6 ${borderClass} ${className}`}>
      {children}
    </View>
  );
}
