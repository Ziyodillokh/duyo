import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { Text } from '@/components/text';
import { glass } from '@/lib/glass';

const PRIMARY = '#2F6FE4';
const INK = '#22406F';

export function Chip({
  selected = false,
  onPress,
  children,
  accessibilityLabel,
  disabled = false,
}: {
  selected?: boolean;
  onPress: () => void;
  children: ReactNode;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.on : styles.off,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        styles.focusable,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelOn]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  chip: {
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A chip is the lowest thing on the page that is still an object — 'sm'.
  off: glass(16, 'sm', 0.86),
  on: { backgroundColor: PRIMARY, borderRadius: 16 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },

  label: { fontSize: 14.5, fontWeight: '600', color: INK },
  labelOn: { color: '#FFFFFF' },
});
