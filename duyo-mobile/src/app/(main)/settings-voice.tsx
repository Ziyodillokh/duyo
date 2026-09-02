import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { useT } from '@/i18n';
import { glass, lift } from '@/lib/glass';
import { useVoiceSettingsStore, VOICE_CHOICES } from '@/store/voice-settings';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
// Same family as settings and notifications: frosted panes on pale blue.
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

export default function VoiceSettingsScreen() {
  const t = useT();
  // Persisted, and read by the voice session when it opens the socket.
  // This was a plain useState that reached nothing: the choice died on
  // navigation and the server had its voice hard-coded anyway.
  const selectedVoice = useVoiceSettingsStore((st) => st.voice);
  const setSelectedVoice = useVoiceSettingsStore((st) => st.setVoice);


  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* ── Header: 48pt glass round, the inner-screen pattern ─────── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={[glass(24, 'sm'), styles.headerButton, styles.focusable]}
          >
            <ArrowLeft size={23} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>{t('settings.voice')}</Text>
          {/* Keeps the title centred. */}
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('settings.voiceScreen.duyoVoice')}
            </Text>
            {VOICE_CHOICES.map((v) => {
              const isSel = v.key === selectedVoice;
              return (
                <Pressable
                  key={v.key}
                  onPress={() => setSelectedVoice(v.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSel }}
                  accessibilityLabel={t(v.labelKey)}
                  // The chosen voice sits a step nearer the reader and takes
                  // the primary edge — the tick alone is easy to miss.
                  style={({ pressed }) => [
                    glass(20, isSel ? 'lg' : 'md', isSel ? 0.75 : 0.55),
                    styles.option,
                    isSel && styles.optionSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.optionRow}>
                    <View style={styles.optionBody}>
                      <Text style={styles.optionLabel}>{t(v.labelKey)}</Text>
                      <Text style={styles.optionHint}>{t(v.hintKey)}</Text>

                    </View>
                    {/* The listen button that used to sit here said
                        "coming soon" through an Alert — which on web is an
                        empty function, so it said nothing at all. A preview
                        needs a TTS endpoint the API does not serve yet;
                        until it does, a control that cannot play a voice is
                        worse than no control. */}
                    {isSel ? (
                      <Check size={20} color={PRIMARY} strokeWidth={2.4} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* The speaking-speed row and the Save button used to sit here.

              Speed was three buttons over a number nothing read: the Live
              API exposes no speaking-rate control, so the multiplier could
              not reach anything even in principle. Save was an Alert saying
              "saved" — and on web an Alert is an empty function, so it said
              nothing. Neither is missing functionality; both were controls
              for functionality that does not exist.

              The voice itself now saves the moment it is tapped, into the
              persisted store the session reads when it opens the socket, so
              there is nothing left for a Save button to do. */}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 14,
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flexGrow: 1, flexShrink: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: INK,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 48,
    gap: 24,
  },
  section: { gap: 10 },
  sectionTitle: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: MUTED,
  },
  pressed: { opacity: 0.8 },
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  option: { padding: 16 },
  optionSelected: { borderColor: 'rgba(47,111,228,0.45)' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionBody: { flex: 1, gap: 2 },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: INK,
  },
  optionHint: {
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
  },
  play: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  speedRow: {
    flexDirection: 'row',
    gap: 10,
  },
  speed: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 14,
  },
  speedSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  speedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: INK,
  },
  speedLabelSelected: { color: '#FFFFFF' },
  speedValue: {
    fontSize: 12,
    color: MUTED,
  },
  speedValueSelected: { color: 'rgba(255,255,255,0.85)' },

  // The one solid button on the screen, so it takes the shadow ladder from
  // lift() rather than glass() — a filled pane, not a frosted one.
  save: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    boxShadow: lift('md'),
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
