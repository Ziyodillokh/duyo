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
 * How tall the block is, as a share of the screen.
 *
 * The first version took its height from the artwork's aspect ratio and landed
 * on 251pt — a fifth of a small phone and a tenth of a large one, so the screen
 * arrived differently proportioned on every device. The second was a flat 172,
 * which fixed the clipping and kept the mismatch: 172pt is a quarter of a 640pt
 * phone and a sixth of a 932pt one.
 *
 * A share of the height is what makes the screen look like ITSELF everywhere.
 * The floor keeps DUYO's face and name legible on the smallest phone we
 * support; the ceiling stops the block becoming a poster on the largest, where
 * a fifth of the screen is a lot of sky to cross before reading anything.
 */
const HEIGHT_SHARE = 0.2;
const HEIGHT_MIN = 132;
const HEIGHT_MAX = 216;
/** How much of the width the sky gets. The name owns the rest. */
const SKY_SHARE = 0.6;

/**
 * Who the child is talking to, at the top of the conversation.
 *
 * ## Why it sits above the list rather than inside it
 *
 * It rode inside the message list at first, which is an INVERTED list: it
 * fills from the bottom up. On a short phone the overflow came off the top and
 * cut DUYO's face in half; on a tall one the whole block sank to the middle of
 * the screen under a void. Neither was a layout anyone chose — both were the
 * list's fill direction showing through.
 *
 * Above the list it is in the same place on every phone. It costs nothing in
 * the long run because it is only drawn while the conversation is empty: once
 * there is a thread worth the room it stands down, and by then the header
 * names the screen and every reply carries DUYO's face anyway.
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
  const { width, height } = useWindowDimensions();
  // The screen pads this block by 16 a side; this is the width that leaves.
  const inner = Math.min(width - 32, 420);
  const skyW = Math.round(inner * SKY_SHARE);
  const h = Math.round(
    Math.min(HEIGHT_MAX, Math.max(HEIGHT_MIN, height * HEIGHT_SHARE)),
  );

  return (
    <View style={[styles.host, { height: h }]}>
      {/* Behind everything, and unreachable: the sky is not a control. */}
      <View style={[styles.sky, { width: skyW }]} pointerEvents="none">
        <ChatCosmos width={skyW} height={h} />
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
