import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { Text } from '@/components/text';
import { lift } from '@/lib/glass';

const PRIMARY = '#2F6FE4';
/** The disabled fill. Not `PRIMARY` at low opacity: a translucent button lets
 *  the page's gradient through and reads as a hole rather than a dimmed
 *  control. */
const PRIMARY_OFF = '#A8C2EA';

export function PrimaryButton({
  onPress,
  children,
  disabled = false,
  accessibilityLabel,
}: {
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.button,
        disabled ? styles.off : styles.on,
        pressed && !disabled && styles.pressed,
        styles.focusable,
      ]}
    >
      <Text style={styles.label}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The browser draws a square focus ring on whatever was last clicked; this
  // control is a rounded slab, so the default ring is simply wrong.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  button: {
    width: '100%',
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A raised button on the glass page: the same shadow ladder as every other
  // object, so the eye can tell how high it sits relative to the cards near it.
  on: { backgroundColor: PRIMARY, boxShadow: lift('md') },
  off: { backgroundColor: PRIMARY_OFF },
  pressed: { opacity: 0.85 },

  label: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
});
