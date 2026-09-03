import {
  CircleStop,
  CloudUpload,
  Mic,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react-native';
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
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { Text } from '@/components/text';
import { useT, type TranslationKey } from '@/i18n';
import { asyncStorage } from '@/lib/async-storage';
import { glass, lift } from '@/lib/glass';

// The voice screen has no dark variant — it paints its own pale blue sky — so
// the sheet raised over it borrows that screen's palette rather than the
// app-wide light/dark pair.
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';

interface MicDisclosureState {
  accepted: boolean;
  hydrated: boolean;
  accept: () => void;
  setHydrated: (hydrated: boolean) => void;
}

/**
 * Whether this child has read what the microphone does.
 *
 * Persisted, and deliberately not part of any other store: it is a fact about
 * a disclosure having been SHOWN, not a preference, and it must survive every
 * settings reset a child can reach — the sheet is the app's only prominent
 * disclosure and re-showing it costs nothing, while losing it means a Play
 * policy the app silently stops meeting.
 */
export const useMicDisclosureStore = create<MicDisclosureState>()(
  persist(
    (set) => ({
      accepted: false,
      hydrated: false,
      accept: () => set({ accepted: true }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'duyo-mic-disclosure',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({ accepted: state.accepted }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

/** The four facts, in the order they matter to a thirteen-year-old. */
const POINTS: readonly { icon: LucideIcon; key: TranslationKey }[] = [
  { icon: Mic, key: 'voice.mic.whileOpen' },
  { icon: CloudUpload, key: 'voice.mic.toGemini' },
  { icon: ShieldCheck, key: 'voice.mic.notStored' },
  { icon: CircleStop, key: 'voice.mic.stopAnytime' },
];

interface MicDisclosureProps {
  visible: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

/**
 * What happens to your voice — said before the microphone is ever asked for.
 *
 * Google Play's User Data policy requires a prominent in-app disclosure ahead
 * of the system permission dialog for a sensitive permission, naming the data,
 * the purpose, and the fact that it leaves the device. DUYO streams raw PCM to
 * Gemini Live, so all three apply, and the OS dialog says none of them: it says
 * "Allow DUYO to record audio?" and nothing about where the audio goes.
 *
 * It stands between the mic button and `mic.requestPermission()`, so accepting
 * it flows straight into the OS prompt — read, then decide, in one gesture.
 */
export function MicDisclosure({
  visible,
  onAccept,
  onDismiss,
}: MicDisclosureProps) {
  const t = useT();
  const [slide] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(slide, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      // Same settle as the memory consent sheet: this is a thing to read, not
      // a reward to bounce.
      damping: 18,
      stiffness: 170,
      mass: 0.9,
    }).start();
  }, [visible, slide]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.root}>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={styles.scrim}
        />

        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [
                {
                  translateY: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [400, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <SafeAreaView edges={['bottom']}>
            <View style={styles.handleRow}>
              <View style={styles.handle} />
            </View>

            <View style={styles.body}>
              <View style={styles.headerRow}>
                <View style={styles.iconWell}>
                  <Mic size={22} color={PRIMARY} />
                </View>
                <View style={styles.headerText}>
                  <Text style={styles.title}>{t('voice.mic.title')}</Text>
                  <Text style={styles.lead}>{t('voice.mic.lead')}</Text>
                </View>
              </View>

              <View style={styles.points}>
                {POINTS.map(({ icon: Icon, key }) => (
                  <View key={key} style={styles.point}>
                    <View style={styles.pointWell}>
                      <Icon size={16} color={PRIMARY} />
                    </View>
                    <Text style={styles.pointText}>{t(key)}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.actions}>
                <Pressable
                  onPress={onDismiss}
                  accessibilityRole="button"
                  accessibilityLabel={t('voice.mic.decline')}
                  style={({ pressed }) => [
                    styles.button,
                    styles.decline,
                    pressed && styles.pressed,
                    styles.focusable,
                  ]}
                >
                  <Text style={styles.declineText}>
                    {t('voice.mic.decline')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={onAccept}
                  accessibilityRole="button"
                  accessibilityLabel={t('voice.mic.accept')}
                  style={({ pressed }) => [
                    styles.button,
                    styles.accept,
                    pressed && styles.pressed,
                    styles.focusable,
                  ]}
                >
                  <Text style={styles.acceptText}>{t('voice.mic.accept')}</Text>
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

  // Chrome floating over the screen — the top of the ladder. The surface is
  // drawn here because only the top corners round, so `lift` supplies the
  // light on its own.
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(47,111,228,0.18)',
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
    backgroundColor: 'rgba(47,111,228,0.10)',
  },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontWeight: '700', color: INK },
  lead: { fontSize: 12, marginTop: 2, color: MUTED },

  points: { marginTop: 18, gap: 12 },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  // Flush: a well drawn on the sheet gets the glass edges and no shadow of
  // its own.
  pointWell: {
    ...glass(11, 'flush'),
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47,111,228,0.08)',
  },
  pointText: { flex: 1, fontSize: 14, lineHeight: 21, color: INK },

  actions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  button: {
    flex: 1,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  pressed: { opacity: 0.75 },
  // The two answers sit at different heights: "yes" is a raised object, "no"
  // stays flat on the sheet, which is what says which one is being offered
  // without colouring the refusal as a warning.
  decline: { borderWidth: 1, borderColor: 'rgba(16,32,51,0.12)' },
  declineText: { fontSize: 16, fontWeight: '500', color: MUTED },
  accept: { backgroundColor: PRIMARY, boxShadow: lift('md') },
  acceptText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
