import { AudioLines } from 'lucide-react-native';
import { Pressable, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';

import { ChatCosmos } from '@/components/chat/chat-cosmos';
import { Text } from '@/components/text';
import { MascotImage } from '@/components/v2/mascot-image';
import { glass } from '@/lib/glass';

const PRIMARY = '#2F6FE4';
const GREEN = '#22B573';
const AMBER = '#F0B429';

/** How tall the block is, and how much of its width the sky gets.
 *
 *  The first version let the height fall out of the artwork's aspect ratio and
 *  landed on 251pt. On a 390x844 screen that pushed the greeting, the quick
 *  replies and the composer past the bottom, and since the list is inverted —
 *  it fills from the bottom up — the overflow came off the TOP: DUYO's face was
 *  sliced in half by the header and the voice button was a white sliver in the
 *  corner. A fixed, smaller height is what keeps the whole conversation on one
 *  screen, which is the only thing this block must not cost. */
const HEIGHT = 172;
const SKY_SHARE = 0.6;

/**
 * Who the child is talking to, at the top of the conversation.
 *
 * ## Why this scrolls instead of being pinned under the header
 *
 * It is rendered as an item in the message list, not as chrome. A fixed
 * identity panel would eat a fifth of the screen forever, and it is worth
 * exactly one look: the first time the screen opens. Being in the list, it sits
 * above the first message the way a letterhead does and slides away as soon as
 * there is a conversation to read.
 *
 * ## Why the sky is a column and not a background
 *
 * It started as a full-bleed backdrop with the name written over it, and the
 * planets went straight through the lettering — a comet crossed the middle of
 * "DUYO AI". Text over a busy illustration is only legible if the illustration
 * is faded to almost nothing, at which point there is no reason to draw it. So
 * the two share the width instead: the name owns the left, the sky owns the
 * right, and neither has to be dimmed to survive the other.
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
  // The list pads its content by 16 a side; this is the width that leaves.
  const inner = Math.min(width - 32, 420);
  const skyW = Math.round(inner * SKY_SHARE);

  return (
    <View style={[styles.host, { height: HEIGHT }]}>
      {/* Behind everything, and unreachable: the sky is not a control. */}
      <View style={[styles.sky, { width: skyW }]} pointerEvents="none">
        <ChatCosmos width={skyW} height={HEIGHT} />
      </View>

      <View style={styles.identity}>
        <View style={[glass(28, 'md', 0.62), styles.avatar]}>
          <MascotImage size={46} glow="none" />
        </View>

        <Text style={styles.name} numberOfLines={1}>
          DUYO AI
        </Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: thinking ? AMBER : GREEN }]} />
          <Text style={[styles.status, { color: thinking ? AMBER : GREEN }]}>
            {thinking ? "O'ylayapti" : 'Onlayn'}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onVoice}
        accessibilityRole="button"
        accessibilityLabel="Ovozli suhbatga o'tish"
        style={[glass(16, 'sm'), styles.voice, styles.focusable]}
      >
        <AudioLines size={21} color={PRIMARY} strokeWidth={2.2} />
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

  host: { marginBottom: 4, justifyContent: 'center' },
  // Pinned right and vertically centred, so the artwork sits opposite the name
  // rather than under it.
  sky: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center' },

  // Bounded so a longer status line can never run out under the planets.
  identity: { maxWidth: '52%', gap: 8 },
  avatar: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 20, fontWeight: '700', color: PRIMARY, letterSpacing: -0.2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 13.5, fontWeight: '600' },

  voice: {
    position: 'absolute',
    top: 2,
    right: 0,
    width: 48,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
