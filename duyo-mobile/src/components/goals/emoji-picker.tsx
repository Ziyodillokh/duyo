import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/text';

/**
 * The emoji panel behind the composer's smiley.
 *
 * A curated set, not the whole Unicode block: a child scrolling past
 * 🔞 or 🖕 to find 🐶 is a worse experience than a shorter list, and the
 * emoji keyboard is one of the few places where "everything" is the wrong
 * answer in an app for seven-year-olds.
 *
 * Tapping appends to the draft rather than sending, so a child can decorate
 * a sentence — and a message that is ONLY emoji is drawn large by the bubble,
 * the way Telegram turns one emoji into a sticker.
 */

const MUTED = '#8CA3CB';
const INK = '#22406F';

interface Group {
  key: string;
  icon: string;
  label: string;
  emoji: string[];
}

const GROUPS: readonly Group[] = [
  {
    key: 'smileys',
    icon: '😀',
    label: 'Kulgichlar',
    emoji: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
      '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤔', '🤐', '😐',
      '😑', '😶', '😏', '😒', '🙄', '😬', '😌', '😔', '😪', '🤤',
      '😴', '😷', '🤒', '🤕', '🥳', '🥺', '😢', '😭', '😤', '😳',
      '🤯', '😱', '😨', '😰', '😥', '🤓', '🧐', '😎', '🤠', '👻',
    ],
  },
  {
    key: 'people',
    icon: '👋',
    label: 'Imo-ishoralar',
    emoji: [
      '👋', '🤚', '✋', '🖐️', '👌', '🤌', '✌️', '🤞', '🤟', '🤘',
      '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛',
      '🤜', '👏', '🙌', '🤝', '🙏', '💪', '🧠', '👀', '👶', '🧒',
      '👦', '👧', '🧑', '👨', '👩', '👪', '🧑‍🎓', '🧑‍🏫', '🧑‍💻', '🦸',
    ],
  },
  {
    key: 'animals',
    icon: '🐶',
    label: 'Hayvonlar',
    emoji: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
      '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆',
      '🦉', '🦄', '🐝', '🦋', '🐌', '🐞', '🐢', '🐍', '🐙', '🦕',
      '🐬', '🐳', '🐟', '🦈', '🐊', '🐘', '🦒', '🐴', '🐑', '🌳',
    ],
  },
  {
    key: 'food',
    icon: '🍎',
    label: 'Taomlar',
    emoji: [
      '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒',
      '🍑', '🥭', '🍍', '🥝', '🍅', '🥕', '🌽', '🥔', '🍞', '🧀',
      '🥚', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥗', '🍜',
      '🍚', '🍛', '🍣', '🍤', '🍦', '🍩', '🍪', '🎂', '🍫', '🍬',
      '☕', '🥛', '🧃', '🍯',
    ],
  },
  {
    key: 'activity',
    icon: '⚽',
    label: 'Mashg‘ulot',
    emoji: [
      '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏓', '🏸', '🥅', '🥊',
      '🏆', '🥇', '🥈', '🥉', '🎯', '🎮', '🕹️', '🎲', '♟️', '🎨',
      '🎭', '🎤', '🎧', '🎸', '🎹', '🥁', '🎺', '🎻', '🚴', '🏃',
      '🏊', '⛷️', '🤸', '🧘', '🚀', '✈️', '🚗', '🚲', '🌍', '🏔️',
    ],
  },
  {
    key: 'objects',
    icon: '📚',
    label: 'Narsalar',
    emoji: [
      '📚', '📖', '📕', '📗', '📘', '📙', '📝', '✏️', '🖊️', '📐',
      '📏', '🎒', '🔬', '🔭', '🧪', '💡', '🔑', '🕰️', '⏰', '📱',
      '💻', '⌨️', '🖥️', '🖨️', '📷', '🎥', '🔋', '💰', '🎁', '🎈',
      '🎉', '🎊', '🏠', '🏫', '⭐', '🌟', '✨', '🔥', '🌈', '☀️',
      '🌙', '❄️', '💧', '🌸',
    ],
  },
  {
    key: 'symbols',
    icon: '❤️',
    label: 'Belgilar',
    emoji: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💕', '💖',
      '💗', '💝', '💯', '✅', '❌', '❗', '❓', '💬', '💭', '🔔',
      '🎵', '🎶', '⚡', '🌀', '♻️', '🔆', '⏳', '🔒', '🔓', '📌',
    ],
  },
];

export function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  /** Kept for the close row, so the panel can be dismissed without hunting
   *  for the smiley again. */
  onClose: () => void;
}) {
  const [group, setGroup] = useState(GROUPS[0].key);
  const active = GROUPS.find((g) => g.key === group) ?? GROUPS[0];

  return (
    <View style={styles.panel}>
      {/* Category strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {GROUPS.map((g) => (
          <Pressable
            key={g.key}
            onPress={() => setGroup(g.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: g.key === group }}
            accessibilityLabel={g.label}
            style={[styles.tab, g.key === group && styles.tabOn, styles.focusable]}
          >
            <Text style={styles.tabIcon}>{g.icon}</Text>
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Emojini yopish"
          style={[styles.tab, styles.focusable]}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </ScrollView>

      <Text style={styles.groupLabel}>{active.label}</Text>

      <ScrollView style={styles.gridScroll} contentContainerStyle={styles.grid}>
        {active.emoji.map((e, i) => (
          <Pressable
            key={`${e}-${i}`}
            onPress={() => onPick(e)}
            accessibilityRole="button"
            accessibilityLabel={e}
            style={[styles.cell, styles.focusable]}
          >
            <Text style={styles.emoji}>{e}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * Is this message nothing but a few emoji?
 *
 * Telegram draws one emoji big and bare, with no bubble — that is what makes
 * it read as a sticker rather than as a very short sentence. Three is the cut
 * Telegram uses too; past that it is a message again.
 */
export function emojiOnly(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  // Emoji, variation selectors, ZWJ, skin tones and whitespace only.
  const allowed =
    /^[\p{Extended_Pictographic}\p{Emoji_Component}‍️\s]+$/u;
  if (!allowed.test(t)) return 0;
  const count = [...t.matchAll(/\p{Extended_Pictographic}/gu)].length;
  return count > 0 && count <= 3 ? count : 0;
}

const styles = StyleSheet.create({
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  panel: {
    height: 248,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 20,
    paddingBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    boxShadow: '0 10px 26px rgba(111,155,221,0.28)',
    overflow: 'hidden',
  },
  tabs: { alignItems: 'center', paddingHorizontal: 8, paddingTop: 8, gap: 4 },
  tab: {
    width: 36,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabOn: { backgroundColor: 'rgba(47,111,228,0.12)' },
  tabIcon: { fontSize: 18 },
  closeText: { fontSize: 15, fontWeight: '700', color: MUTED },

  groupLabel: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 2,
    fontSize: 11.5,
    fontWeight: '700',
    color: MUTED,
  },

  gridScroll: { flex: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  cell: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  emoji: { fontSize: 24, lineHeight: 30, color: INK },
});
