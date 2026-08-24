import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Check, Play } from 'lucide-react-native';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { useT, type TranslationKey } from '@/i18n';
import { glass, lift } from '@/lib/glass';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
// Same family as settings and notifications: frosted panes on pale blue.
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

interface VoiceOption {
  key: string;
  /** Gemini voice name — a proper noun, never translated. */
  label: string;
  descriptionKey: TranslationKey;
}

const VOICE_OPTIONS: readonly VoiceOption[] = [
  { key: 'kore', label: 'Kore', descriptionKey: 'settings.voiceScreen.voiceKore' },
  { key: 'aoede', label: 'Aoede', descriptionKey: 'settings.voiceScreen.voiceAoede' },
  { key: 'charon', label: 'Charon', descriptionKey: 'settings.voiceScreen.voiceCharon' },
  { key: 'fenrir', label: 'Fenrir', descriptionKey: 'settings.voiceScreen.voiceFenrir' },
  { key: 'leda', label: 'Leda', descriptionKey: 'settings.voiceScreen.voiceLeda' },
];

const SPEED_OPTIONS: readonly {
  key: string;
  labelKey: TranslationKey;
  multiplier: number;
}[] = [
  { key: 'slow', labelKey: 'settings.voiceScreen.speedSlow', multiplier: 0.8 },
  { key: 'normal', labelKey: 'settings.voiceScreen.speedNormal', multiplier: 1.0 },
  { key: 'fast', labelKey: 'settings.voiceScreen.speedFast', multiplier: 1.25 },
];

export default function VoiceSettingsScreen() {
  const t = useT();
  const [selectedVoice, setSelectedVoice] = useState('kore');
  const [selectedSpeed, setSelectedSpeed] = useState('normal');

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
            {VOICE_OPTIONS.map((v) => {
              const isSel = v.key === selectedVoice;
              return (
                <Pressable
                  key={v.key}
                  onPress={() => setSelectedVoice(v.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSel }}
                  accessibilityLabel={v.label}
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
                      <Text style={styles.optionLabel}>{v.label}</Text>
                      <Text style={styles.optionHint}>
                        {t(v.descriptionKey)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() =>
                        Alert.alert(
                          t('common.comingSoon'),
                          t('settings.voiceScreen.sampleSoon', {
                            voice: v.label,
                          }),
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={t('settings.voiceScreen.listen')}
                      style={({ pressed }) => [
                        glass(20, 'sm', 0.7),
                        styles.play,
                        styles.focusable,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Play size={16} color={PRIMARY} fill={PRIMARY} />
                    </Pressable>
                    {isSel ? (
                      <Check size={20} color={PRIMARY} strokeWidth={2.4} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('settings.voiceScreen.speed')}
            </Text>
            <View style={styles.speedRow}>
              {SPEED_OPTIONS.map((s) => {
                const isSel = s.key === selectedSpeed;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => setSelectedSpeed(s.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSel }}
                    accessibilityLabel={t(s.labelKey)}
                    style={({ pressed }) => [
                      glass(16, 'sm'),
                      styles.speed,
                      isSel && styles.speedSelected,
                      styles.focusable,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.speedLabel,
                        isSel && styles.speedLabelSelected,
                      ]}
                    >
                      {t(s.labelKey)}
                    </Text>
                    <Text
                      style={[
                        styles.speedValue,
                        isSel && styles.speedValueSelected,
                      ]}
                    >
                      {s.multiplier}x
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            onPress={() =>
              Alert.alert(
                t('settings.voiceScreen.savedTitle'),
                t('settings.voiceScreen.savedBody'),
              )
            }
            accessibilityRole="button"
            accessibilityLabel={t('common.save')}
            style={({ pressed }) => [
              styles.save,
              styles.focusable,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.saveText}>{t('common.save')}</Text>
          </Pressable>
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
    flex: 1,
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
