import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { glass } from '@/lib/glass';

const PRIMARY = '#2F6FE4';

export function SelectCard({
  selected,
  onPress,
  children,
  accessibilityLabel,
}: {
  selected: boolean;
  onPress: () => void;
  children: ReactNode;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.card, selected ? styles.on : styles.off, styles.focusable]}
    >
      <View style={styles.row}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  card: {
    width: '100%',
    paddingHorizontal: 22,
    paddingVertical: 22,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Chosen means nearer: 'lg' against the unchosen 'sm'. The old version said
  // the same thing with a single grey `shadowColor` drop, which Android could
  // not colour and iOS could only draw once.
  off: glass(22, 'sm'),
  on: {
    ...glass(22, 'lg', 0.8),
    borderWidth: 2,
    borderColor: PRIMARY,
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
});
