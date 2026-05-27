import type { ReactNode } from 'react';
import { View } from 'react-native';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <View
      className={`bg-white rounded-xl border border-primary/10 p-6 ${className}`}
    >
      {children}
    </View>
  );
}
