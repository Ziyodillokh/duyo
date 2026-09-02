import { Lock, Sparkles, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { useT } from '@/i18n';
import { glass, lift } from '@/lib/glass';
import {
  MEMORY_CATEGORY_COLOURS,
  MEMORY_CATEGORY_HINTS,
  MEMORY_CATEGORY_ICONS,
  MEMORY_CATEGORY_LABELS,
} from '@/lib/memory-categories';
import { MemoryGuardError, useMemoryStore } from '@/store/memory';
import { useMemoryConsentStore } from '@/store/memory-consent';
import { useIsDark } from '@/store/theme';

const INK = '#22406F';
const MUTED = '#8CA3CB';

// The sheet has always carried a dark variant — it is raised over the chat and
// over the voice screen, and those two do not agree on a background — so the
// light glass palette above is paired with the dark tokens the classes named.
const DARK_SURFACE = '#132340';
const DARK_INK = '#E0E7FF';
const DARK_MUTED = '#94A3B8';

/** Ink for text sitting ON the accent — every category colour is a light one. */
const ON_ACCENT = '#0A1628';

/**
 * "Buni eslab qolaymi?" — the moment the child decides what DUYO keeps.
 *
 * This was an Alert.alert. That put the single most important privacy
 * decision in the product behind an OS dialog that looks like an error: no
 * category, no colour, no way to say where the note goes, and a title
 * rendered in the same grey as "Xatolik". A child cannot consent to something
 * they have to squint at.
 *
 * Mounted ONCE, in the (main) layout, and driven by store/memory-consent.ts —
 * both the text chat and the voice screen raise the same sheet rather than
 * each rendering their own.
 */
export function MemoryConsentSheet() {
  const t = useT();
  const isDark = useIsDark();
  const pending = useMemoryConsentStore((s) => s.pending);
  const dismiss = useMemoryConsentStore((s) => s.dismiss);
  const [saving, setSaving] = useState(false);

  const [slide] = useState(() => new Animated.Value(0));
  const visible = pending !== null;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      // Settles quickly without the bounce reading as playful — this is a
      // consent prompt, not a reward.
      damping: 18,
      stiffness: 170,
      mass: 0.9,
    }).start();
  }, [visible, slide]);

  if (!pending) return null;

  const accent = MEMORY_CATEGORY_COLOURS[pending.category] ?? '#60A5FA';
  const Icon = MEMORY_CATEGORY_ICONS[pending.category];
  const label = MEMORY_CATEGORY_LABELS[pending.category] ?? pending.category;
  const hint = MEMORY_CATEGORY_HINTS[pending.category] ?? '';

  const close = () => {
    setSaving(false);
    dismiss();
  };

  const accept = () => {
    setSaving(true);
    useMemoryStore
      .getState()
      .addMemory(pending.category, pending.content, 'chat_confirmed')
      .catch((err) => {
        // A guard rejection is a successful block, not a failure to explain.
        if (!(err instanceof MemoryGuardError)) {
          console.warn('memory save failed', err);
        }
      })
      .finally(close);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.root}>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={styles.scrim}
        />

        <Animated.View
          style={[
            styles.sheet,
            isDark && dark.sheet,
            {
              transform: [
                {
                  translateY: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [340, 0],
                  }),
                },
              ],
              borderColor: `${accent}44`,
            },
          ]}
        >
          <SafeAreaView edges={['bottom']}>
            {/* Grab handle — signals "this is a sheet you can dismiss". */}
            <View style={styles.handleRow}>
              <View style={[styles.handle, isDark && dark.handle]} />
            </View>

            <View style={styles.body}>
              <View style={styles.headerRow}>
                <View style={[styles.iconWell, { backgroundColor: `${accent}1F` }]}>
                  <Icon size={22} color={accent} />
                </View>

                <View style={styles.headerText}>
                  <Text style={[styles.title, isDark && dark.title]}>
                    {t('memory.consent.title')}
                  </Text>
                  <Text style={[styles.hint, isDark && dark.hint]}>{hint}</Text>
                </View>

                <Pressable
                  onPress={close}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                  hitSlop={10}
                  style={[styles.close, isDark && dark.close, styles.focusable]}
                >
                  <X size={16} color="#94A3B8" />
                </Pressable>
              </View>

              {/* The memory itself — the thing being consented to, quoted so
                  the child can check the wording before agreeing to it. */}
              <View
                style={[
                  styles.quote,
                  isDark && dark.quote,
                  { borderLeftColor: accent },
                ]}
              >
                <Text style={[styles.quoteText, isDark && dark.quoteText]}>
                  {pending.content}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <View style={[styles.tag, { backgroundColor: `${accent}1A` }]}>
                  <View style={[styles.tagDot, { backgroundColor: accent }]} />
                  <Text style={[styles.tagText, { color: accent }]}>{label}</Text>
                </View>

                {/* The promise the whole feature rests on, said plainly at
                    the moment it matters — not buried in a settings page. */}
                <View style={styles.promise}>
                  <Lock size={11} color="#94A3B8" />
                  <Text
                    style={[styles.promiseText, isDark && dark.promiseText]}
                    numberOfLines={1}
                  >
                    {t('memory.consent.promise')}
                  </Text>
                </View>
              </View>

              <View style={styles.actions}>
                <Pressable
                  onPress={close}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={t('memory.consent.decline')}
                  style={({ pressed }) => [
                    styles.button,
                    styles.decline,
                    isDark && dark.decline,
                    pressed && styles.declinePressed,
                    styles.focusable,
                  ]}
                >
                  <Text style={[styles.declineText, isDark && dark.declineText]}>
                    {t('memory.consent.declineShort')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={accept}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={t('memory.consent.accept')}
                  accessibilityState={{ disabled: saving }}
                  style={({ pressed }) => [
                    styles.button,
                    styles.accept,
                    { backgroundColor: accent, opacity: saving ? 0.6 : 1 },
                    pressed && !saving && styles.acceptPressed,
                    styles.focusable,
                  ]}
                >
                  <Sparkles size={17} color={ON_ACCENT} />
                  <Text style={styles.acceptText}>
                    {t('memory.consent.acceptShort')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { flex: 1, backgroundColor: 'rgba(4,10,22,0.62)' },

  // Chrome floating OVER the content is the top of the ladder — 'xl'. Only the
  // top corners round, and only the top edge is bordered (in the category's
  // colour, set at render), so `lift` supplies the light and the surface is
  // drawn here rather than by `glass`.
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    boxShadow: lift('xl'),
  },

  handleRow: { alignItems: 'center', paddingTop: 12 },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(16,32,51,0.15)',
  },

  body: { padding: 22, paddingTop: 16 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWell: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontWeight: '700', color: INK },
  hint: { fontSize: 12, marginTop: 2, color: MUTED },

  // A round control resting on the sheet: 'sm', one step below the sheet.
  close: {
    ...glass(18, 'sm', 0.55),
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Flush: a pane drawn on the sheet gets the glass edges and no shadow.
  quote: {
    marginTop: 16,
    borderRadius: 20,
    padding: 15,
    borderLeftWidth: 3,
    backgroundColor: 'rgba(37,99,235,0.05)',
    boxShadow: lift('flush'),
  },
  quoteText: { fontSize: 16, lineHeight: 24, color: INK },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagDot: { width: 6, height: 6, borderRadius: 3 },
  tagText: { fontSize: 12, fontWeight: '500' },

  promise: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  promiseText: { fontSize: 12, color: MUTED },

  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  button: {
    flex: 1,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
  },
  // The two answers deliberately sit at different heights: "yes" is a raised
  // object ('md'), "no" stays flat on the sheet. That ratio is what says which
  // one is being offered, without colouring the refusal as a warning.
  decline: {
    borderWidth: 1,
    borderColor: 'rgba(16,32,51,0.12)',
  },
  declinePressed: { opacity: 0.7 },
  declineText: { fontSize: 16, fontWeight: '500', color: MUTED },
  accept: { boxShadow: lift('md') },
  acceptPressed: { opacity: 0.8 },
  acceptText: { fontSize: 16, fontWeight: '700', color: ON_ACCENT },
});

/** Only what the dark sheet says differently. */
const dark = StyleSheet.create({
  sheet: { backgroundColor: DARK_SURFACE },
  handle: { backgroundColor: 'rgba(224,231,255,0.22)' },
  title: { color: DARK_INK },
  hint: { color: DARK_MUTED },
  close: {
    backgroundColor: 'rgba(224,231,255,0.07)',
    borderColor: 'rgba(224,231,255,0.12)',
  },
  quote: { backgroundColor: 'rgba(96,165,250,0.07)' },
  quoteText: { color: DARK_INK },
  promiseText: { color: DARK_MUTED },
  decline: { borderColor: 'rgba(224,231,255,0.16)' },
  declineText: { color: DARK_MUTED },
});
