import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { glass } from '@/lib/glass';

/**
 * A card on the glass page.
 *
 * It used to take and forward a `className`, which is how callers passed their
 * own padding and width while the app was still on nativewind. Nothing passes
 * one any more, so the prop is gone and `style` is the way to adjust a card.
 */
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  // 'md' and radius 24: a card, the middle of the height ladder — above a chip,
  // below a sheet.
  card: { ...glass(24, 'md'), padding: 20 },
});
