import type { ReactNode } from 'react';
import { Text } from 'react-native';

interface HelperTextProps {
  children: ReactNode;
  align?: 'left' | 'center';
}

export function HelperText({ children, align = 'center' }: HelperTextProps) {
  return (
    <Text
      className={`text-sm text-muted-foreground ${
        align === 'center' ? 'text-center' : ''
      }`}
    >
      {children}
    </Text>
  );
}
