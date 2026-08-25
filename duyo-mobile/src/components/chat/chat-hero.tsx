import { AudioLines } from 'lucide-react-native';
import { Pressable, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';

import { ChatCosmos } from '@/components/chat/chat-cosmos';
import { Text } from '@/components/text';
import { MascotImage } from '@/components/v2/mascot-image';
import { glass } from '@/lib/glass';

const PRIMARY = '#2F6FE4';
const GREEN = '#22B573';
const AMBER = '#F0B429';

/**
 * Who the child is talking to, at the top of the conversation.
 *
 * ## Why this scrolls instead of being pinned under the header
 *
 * It is rendered as an item in the message list, not as chrome. A fixed
 * identity panel would eat a fifth of the screen forever, and it is worth
 * exactly one look: the first time the screen opens. Being in the list, it
 * sits above the first message the way a letterhead does and slides away as
 * soon as there is a conversation to read.
 *
 * ## Why the status is a dot AND a word
 *
 * Colour alone is not a status — a child who cannot separate green from amber
 * gets nothing from it, and neither does anyone glancing at a phone in
 * sunlight. The dot is the glance and the word is the answer, and both come
 * from the same boolean so they can never disagree.
 */
export function ChatHero({
  thinking,
  onVoice,
}: {
  thinking: boolean;
  onVoice: () => void;
}) {
  const { width } = useWindowDimensions();
  // The scene keeps the aspect its view box was drawn at, so nothing in it
  // stretches on a wide phone.
  const cosmosW = Math.min(width - 32, 360);
  const cosmosH = Math.round((cosmosW * 210) / 300);

  return (
    <View style={[styles.host, { height: cosmosH }]}>
      {/* Behind everything, and unreachable: the sky is not a control. */}
      <View style={styles.cosmos} pointerEvents="none">
        <ChatCosmos width={cosmosW} height={cosmosH} />
      </View>

      <View style={styles.identityRow}>
        <View style={[glass(30, 'md', 0.62), styles.avatar]}>
          <MascotImage size={54} glow="none" />
        </View>

        <View style={styles.identityText}>
          <Text style={styles.name}>DUYO AI</Text>
          <View style={styles.statusRow}>
            <View
              style={[styles.dot, { backgroundColor: thinking ? AMBER : GREEN }]}
            />
            <Text style={[styles.status, { color: thinking ? AMBER : GREEN }]}>
              {thinking ? "O'ylayapti" : 'Onlayn'}
            </Text>
          </View>
        </View>
      </View>

      <Pressable
        onPress={onVoice}
        accessibilityRole="button"
        accessibilityLabel="Ovozli suhbatga o'tish"
        style={[glass(18, 'sm'), styles.voice, styles.focusable]}
      >
        <AudioLines size={22} color={PRIMARY} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  focusable: {
    outlineStyle: 'none',
    outlineWidth: 0,
    WebkitTapHighlightColor: 'transparent',
  } as unknown as ViewStyle,

  host: { marginTop: 4, marginBottom: 10, justifyContent: 'flex-start' },
  cosmos: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },

  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 18 },
  avatar: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  identityText: { gap: 4 },
  name: { fontSize: 21, fontWeight: '700', color: PRIMARY, letterSpacing: -0.2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 14, fontWeight: '600' },

  voice: {
    position: 'absolute',
    top: 6,
    right: 0,
    width: 54,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
