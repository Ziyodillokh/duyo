import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { useIsDark } from '@/store/theme';

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
  const isDark = useIsDark();
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
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: 'rgba(4,10,22,0.6)', padding: 24 }}
      >
        {/* Stops a tap inside the card from closing it. */}
        <Pressable
          onPress={() => {}}
          className="w-full rounded-2xl border border-neon-blue/20"
          style={{
            backgroundColor: isDark ? '#121B2E' : '#FFFFFF',
            padding: 20,
            maxWidth: 420,
          }}
        >
          <Text className="text-base font-bold text-foreground dark:text-dark-text">
            {title}
          </Text>

          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor="#94A3B8"
            maxLength={maxLength}
            multiline={multiline}
            autoFocus
            accessibilityLabel={title}
            className="text-base text-foreground dark:text-dark-text rounded-lg border border-neon-blue/25 mt-3 px-3"
            style={{
              paddingVertical: 10,
              minHeight: multiline ? 96 : undefined,
              textAlignVertical: multiline ? 'top' : 'center',
            }}
          />

          <View className="flex-row justify-end gap-5 mt-4">
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text className="text-sm text-muted-foreground dark:text-dark-muted">
                Bekor qilish
              </Text>
            </Pressable>
            <Pressable
              onPress={() => trimmed && onSubmit(trimmed)}
              disabled={!trimmed}
              accessibilityRole="button"
              accessibilityState={{ disabled: !trimmed }}
              hitSlop={8}
            >
              <Text
                className="text-sm font-bold"
                style={{ color: trimmed ? '#60A5FA' : '#94A3B8' }}
              >
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
