import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/text';
import { glass } from '@/lib/glass';

interface SuggestedRepliesProps {
  onSelect: (text: string) => void;
}

const INK = '#22406F';

// Hardcoded for Bosqich B beta — Phase 1+ moves these to per-age-segment
// suggestions returned alongside the chat response.
const REPLIES: readonly string[] = [
  'Boshlaymiz',
  "Menga she'r o'qib ber",
  "Bugungi missiyani ko'rsat",
  'Men bilan gaplash',
];

export function SuggestedReplies({ onSelect }: SuggestedRepliesProps) {
  return (
    <View style={styles.row}>
      {REPLIES.map((reply) => (
        <Pressable
          key={reply}
          onPress={() => onSelect(reply)}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.reply,
            pressed && styles.pressed,
            styles.focusable,
          ]}
        >
          <Text style={styles.label}>{reply}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  // Left-aligned, not centred. Centring a wrapped row leaves every line a
  // different distance from the edge, so four chips read as four ragged
  // rows instead of one list; against the left margin the bubbles above
  // them already establish, they read as one block.
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  // Chips, so 'sm' — they rest on the page beneath the bubbles rather than
  // floating with them. Radius at the low end of the chip range because they
  // are shorter than the 46pt Chip in v2/.
  reply: {
    ...glass(14, 'sm', 0.8),
    minHeight: 36,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },

  label: { fontSize: 14, fontWeight: '500', color: INK },
});
