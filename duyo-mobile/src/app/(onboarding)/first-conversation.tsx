import { useMutation } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  Alert,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createChild } from '@/api/endpoints/children';
import { updateMe } from '@/api/endpoints/me';
import { Text } from '@/components/text';
import { MascotImage } from '@/components/v2/mascot-image';
import { useT, type TranslationKey } from '@/i18n';
import { glass } from '@/lib/glass';
import { useChildStore } from '@/store/child';
import { useLanguageStore } from '@/store/language';
import { useOnboardingStore } from '@/store/onboarding';

// ── The glass sky, the same morning the main app wakes up in ─────────────────
// This is the last onboarding step and it hands straight over to the tabs, so
// it ends on the surfaces the tabs are made of rather than the old v2 wash.
const INK = '#22406F';
const MUTED = '#8CA3CB';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

interface AxiosErrorShape {
  response?: { data?: { detail?: string } };
}

const SUGGESTION_KEYS: readonly TranslationKey[] = [
  'onboarding.firstChat.suggestionStart',
  'onboarding.firstChat.suggestionPoem',
  'onboarding.firstChat.suggestionMission',
  'onboarding.firstChat.suggestionTalk',
];

export default function FirstConversationScreen() {
  const t = useT();
  const language = useLanguageStore((s) => s.language);
  const setChild = useChildStore((s) => s.setChild);
  const pendingName = useOnboardingStore((s) => s.pendingName);
  const pendingAge = useOnboardingStore((s) => s.pendingAge);
  const pendingInterests = useOnboardingStore((s) => s.pendingInterests);
  const pendingAvatarConfig = useOnboardingStore((s) => s.pendingAvatarConfig);
  const userType = useOnboardingStore((s) => s.userType);
  const resetOnboarding = useOnboardingStore((s) => s.reset);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!pendingName || pendingAge === null) {
        throw new Error('Missing onboarding data');
      }
      // Everything the child answered goes with the profile. Interests and
      // the chosen body used to be collected and then dropped on the floor.
      const child = await createChild({
        name: pendingName,
        age: pendingAge,
        language,
        interests: [...pendingInterests],
        mascot: pendingAvatarConfig.body,
      });

      // A child-held account gets their own name on it; a parent's name was
      // never asked for, so nothing is invented here.
      if (userType === 'child') {
        void updateMe({ role: 'child', display_name: pendingName }).catch(
          () => undefined,
        );
      }
      return child;
    },
    onSuccess: (child) => {
      setChild(child);
      resetOnboarding();
      router.replace('/(main)/(tabs)');
    },
    onError: (err) => {
      const detail =
        (err as AxiosErrorShape).response?.data?.detail ??
        t('common.errorGeneric');
      Alert.alert(t('common.error'), detail);
    },
  });

  const startChat = () => {
    mutation.mutate();
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.page}>
          <View style={styles.column}>
            <MascotImage size={210} glow="cosmic" />

            {/* DUYO's first sentence is what the screen leads with, so it is
                the only pane lifted to `lg`; the speech bubble inside it is
                `flush`, because a pane cannot cast a shadow onto its own
                card, and the chips below rest at `sm`. */}
            <View style={[glass(24, 'lg'), styles.greetingCard]}>
              <View style={styles.greetingRow}>
                <View style={styles.greetingMascot}>
                  <MascotImage size={64} glow="soft" />
                </View>
                <View style={[glass(18, 'flush', 0.72), styles.bubble]}>
                  <Text style={styles.greetingText}>
                    {t('onboarding.firstChat.greeting')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.suggestions}>
              <Text style={styles.prompt}>
                {t('onboarding.firstChat.prompt')}
              </Text>
              <View style={styles.chipRow}>
                {SUGGESTION_KEYS.map((key) => (
                  <Pressable
                    key={key}
                    onPress={startChat}
                    disabled={mutation.isPending}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: false,
                      disabled: mutation.isPending,
                    }}
                    accessibilityLabel={t(key)}
                    style={[
                      glass(16, 'sm'),
                      styles.chip,
                      styles.focusable,
                      mutation.isPending && styles.chipDisabled,
                    ]}
                  >
                    <Text style={styles.chipText}>{t(key)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.skipWrap}>
              <Pressable
                onPress={startChat}
                disabled={mutation.isPending}
                accessibilityRole="button"
                style={[styles.skip, styles.focusable]}
              >
                <Text style={styles.skipText}>
                  {mutation.isPending
                    ? t('common.saving')
                    : t('onboarding.firstChat.skip')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  page: { flex: 1, paddingHorizontal: 24, alignItems: 'center' },
  // The column the whole onboarding flow is set in: never wider than 345,
  // centred on a tablet.
  column: {
    width: '100%',
    maxWidth: 345,
    flex: 1,
    paddingTop: 24,
    alignItems: 'center',
  },

  greetingCard: { width: '100%', marginTop: 24, padding: 20 },
  greetingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  greetingMascot: { width: 64, height: 64 },
  bubble: { flex: 1, padding: 16 },
  greetingText: { fontSize: 16, lineHeight: 24, color: INK },

  suggestions: { width: '100%', marginTop: 24, alignItems: 'center' },
  prompt: { fontSize: 14, color: MUTED, textAlign: 'center' },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },
  chip: {
    height: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontSize: 14, fontWeight: '500', color: INK },
  // The browser's default focus ring is a black rectangle around a rounded
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  skipWrap: { marginTop: 'auto', paddingBottom: 24 },
  // Padded to a real 40pt row: the label alone was a ~20pt tap target.
  skip: {
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { fontSize: 14, fontWeight: '500', color: MUTED },
});
