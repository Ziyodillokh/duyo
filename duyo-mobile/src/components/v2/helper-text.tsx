import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { Text } from '@/components/text';

const MUTED = '#8CA3CB';

export function HelperText({
  children,
  align = 'center',
}: {
  children: ReactNode;
  align?: 'left' | 'center';
}) {
  return (
    <Text style={[styles.text, align === 'center' && styles.centre]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 13.5, lineHeight: 19, color: MUTED },
  centre: { textAlign: 'center' },
});
