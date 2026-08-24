import { forwardRef, useState } from 'react';
import {
  StyleSheet,
  View,
  type TextInputProps,
  type TextInput as RNTextInput,
  type TextStyle,
} from 'react-native';

import { Text, TextInput } from '@/components/text';
import { lift } from '@/lib/glass';

const INK = '#22406F';
const MUTED = '#8CA3CB';
const PRIMARY = '#2F6FE4';
const PLACEHOLDER = '#7693C2';

export const FormInput = forwardRef<
  RNTextInput,
  Omit<TextInputProps, 'className'> & { label?: string }
>(function FormInput({ label, onFocus, onBlur, style, ...rest }, ref) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      {/* `? :`, not `&&`: an empty label string would reach React as a text
          node, which inside a View is a hard error on react-native-web. */}
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={PLACEHOLDER}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, focused ? styles.focused : styles.idle, style]}
        {...rest}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 8 },
  label: { fontSize: 13.5, fontWeight: '600', color: MUTED },
  input: {
    width: '100%',
    minHeight: 56,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
    fontSize: 17,
    color: INK,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1.5,
    // The browser's own focus ring is a square drawn outside the radius; the
    // border below is what shows focus here instead.
    outlineStyle: 'none',
    outlineWidth: 0,
  } as unknown as TextStyle,
  idle: { borderColor: 'rgba(47,111,228,0.12)', boxShadow: lift('sm') },
  focused: { borderColor: PRIMARY, boxShadow: lift('md') },
});
