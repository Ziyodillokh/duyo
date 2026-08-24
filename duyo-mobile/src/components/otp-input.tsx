import { useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type TextInput as RNTextInput,
  type ViewStyle,
} from 'react-native';

import { Text, TextInput } from '@/components/text';
import { glass } from '@/lib/glass';

const PRIMARY = '#2F6FE4';
const INK = '#22406F';
/** The empty cell's edge: a blue hairline, not a grey one — see lib/glass.ts. */
const HAIRLINE = 'rgba(47,111,228,0.14)';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus = true,
}: OtpInputProps) {
  const inputRef = useRef<RNTextInput>(null);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  const handleChange = (text: string) => {
    onChange(text.replace(/\D/g, '').slice(0, length));
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.focusable}>
      <View style={styles.row}>
        {digits.map((d, i) => {
          const isFilled = d.trim().length > 0;
          const isCursor = i === value.length;
          return (
            <View
              key={i}
              style={[
                styles.cell,
                isCursor
                  ? styles.cellCursor
                  : isFilled
                    ? styles.cellFilled
                    : styles.cellEmpty,
              ]}
            >
              <Text style={styles.digit}>{d.trim()}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        accessibilityLabel="Tasdiqlash kodi"
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  row: { flexDirection: 'row', gap: 8 },

  // Six wells resting on the sheet they are typed into — 'sm', the same height
  // off the page as a chip, because they belong to the card that holds them.
  // The 2pt edge is kept on every state so a cell never changes size as the
  // cursor moves through it; only the colour of that edge tells the states
  // apart.
  cell: {
    ...glass(14, 'sm', 0.86),
    width: 48,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  cellCursor: { borderColor: PRIMARY },
  cellFilled: { borderColor: INK },
  cellEmpty: { borderColor: HAIRLINE },

  digit: { fontSize: 24, fontWeight: '700', color: INK },

  /** The real field: offscreen-thin, so the keyboard has something to type
   *  into while the cells above do the showing. */
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
