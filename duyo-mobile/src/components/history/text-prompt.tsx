import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Text, TextInput } from '@/components/text';
import { glass } from '@/lib/glass';

const INK = '#22406F';
const MUTED = '#8CA3CB';
const PRIMARY = '#2F6FE4';
const PLACEHOLDER = '#7693C2';

/**
 * A one-field prompt.
 *
 * React Native's `Alert.prompt` is iOS-only, so using it for renaming meant
 * Android children simply could not rename anything. This is the same
 * interaction on both platforms.
 *
 * `initialValue` seeds the field ONCE per mount. To reopen it for a different
 * row, give it a `key` that changes with the row — remounting is how the
 * field resets, rather than an effect that writes state during render.
 */
export function TextPrompt({
  visible,
  title,
  placeholder,
  initialValue = '',
  confirmLabel = 'Saqlash',
  maxLength = 80,
  multiline = false,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  maxLength?: number;
  multiline?: boolean;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Yopish"
        style={styles.scrim}
      >
        {/* Stops a tap inside the card from closing it. */}
        <Pressable onPress={() => {}} style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={PLACEHOLDER}
            maxLength={maxLength}
            multiline={multiline}
            autoFocus
            accessibilityLabel={title}
            style={[
              styles.input,
              {
                minHeight: multiline ? 96 : undefined,
                textAlignVertical: multiline ? 'top' : 'center',
              },
            ]}
          />

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              hitSlop={8}
              style={styles.action}
            >
              <Text style={styles.cancel}>Bekor qilish</Text>
            </Pressable>
            <Pressable
              onPress={() => trimmed && onSubmit(trimmed)}
              disabled={!trimmed}
              accessibilityRole="button"
              accessibilityState={{ disabled: !trimmed }}
              hitSlop={8}
              style={styles.action}
            >
              <Text style={[styles.confirm, trimmed ? styles.on : styles.off]}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,10,22,0.6)',
    padding: 24,
  },
  // A dialog floats over everything, but it is a small object next to a
  // full-width sheet — 'lg' keeps it below the sheet's 'xl' on the ladder.
  // Near-opaque for the same reason the sheet is: the scrim behind it would
  // otherwise show through as grey.
  card: {
    ...glass(24, 'lg', 0.96),
    width: '100%',
    maxWidth: 420,
    padding: 20,
  },
  title: { fontSize: 16, fontWeight: '700', color: INK },

  input: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(47,111,228,0.12)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    fontSize: 16,
    color: INK,
    // The field is drawn inside the card, so it carries no drop shadow — and
    // the browser's focus ring is a square outside the radius, so it goes.
    outlineStyle: 'none',
    outlineWidth: 0,
  } as unknown as TextStyle,

  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20,
    marginTop: 16,
  },
  // hitSlop does not grow the clickable box on web, so the target is real
  // padding instead.
  action: {
    minHeight: 34,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    outlineStyle: 'none',
    outlineWidth: 0,
  } as unknown as ViewStyle,
  cancel: { fontSize: 14, color: MUTED },
  confirm: { fontSize: 14, fontWeight: '700' },
  on: { color: PRIMARY },
  off: { color: MUTED },
});
