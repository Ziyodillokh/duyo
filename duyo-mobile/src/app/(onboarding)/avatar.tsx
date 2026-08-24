import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/text';

import { MascotImage } from '@/components/v2/mascot-image';
import { PrimaryButton } from '@/components/v2/primary-button';
import { useT, type TranslationKey } from '@/i18n';
import { glass } from '@/lib/glass';
import { useMascotStore, type MascotVariant } from '@/store/mascot';
import { useOnboardingStore } from '@/store/onboarding';

// ── The glass sky, the same pale morning the inner screens wake up to ────────
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

interface BodyOption {
  key: MascotVariant;
  labelKey: TranslationKey;
}

// Only the body is chosen here — one tap, no tabs. The picked key is stored as
// `body` so it keeps matching the backend's body_shape field.
const BODIES: readonly BodyOption[] = [
  { key: 'duyo', labelKey: 'onboarding.avatar.bodyDuyo' },
  { key: 'raccoon', labelKey: 'onboarding.avatar.bodyRaccoon' },
];

const DEFAULT_BODY: MascotVariant = 'duyo';

function isVariant(value: string | undefined): value is MascotVariant {
  return BODIES.some((body) => body.key === value);
}

export default function AvatarScreen() {
  const t = useT();
  const setPendingAvatarConfig = useOnboardingStore(
    (s) => s.setPendingAvatarConfig,
  );
  const persisted = useOnboardingStore((s) => s.pendingAvatarConfig);
  const setVariant = useMascotStore((s) => s.setVariant);
  const [body, setBody] = useState<MascotVariant>(
    isVariant(persisted.body) ? persisted.body : DEFAULT_BODY,
  );

  const handleContinue = () => {
    setPendingAvatarConfig({ body });
    // Every avatar in the app follows this from here on — chat, voice, home.
    setVariant(body);
    router.push('/(onboarding)/first-conversation');
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
            <View style={styles.heading}>
              <Text style={styles.title}>{t('onboarding.avatar.title')}</Text>
              <Text style={styles.subtitle}>
                {t('onboarding.avatar.subtitle')}
              </Text>
            </View>

            {/* The stage is the one hero object here, so it sits highest. The
                gradient rides in the pane's own style rather than on a child:
                a child that filled the pane would paint over the inset edges
                that make it read as glass. */}
            <LinearGradient
              colors={['rgba(255,255,255,0.72)', 'rgba(203,225,255,0.42)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[glass(28, 'lg'), styles.stage]}
            >
              <MascotImage size={210} glow="cosmic" variant={body} />
            </LinearGradient>

            <View style={[glass(24, 'md', 0.6), styles.picker]}>
              <Text style={styles.pickLabel}>{t('onboarding.avatar.pick')}</Text>

              <View style={styles.options}>
                {BODIES.map((option) => {
                  const isSelected = body === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => setBody(option.key)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={t(option.labelKey)}
                      // 'flush': these sit ON the picker pane, and a pane that
                      // casts a shadow onto its own parent reads as pasted on.
                      style={({ pressed }) => [
                        glass(18, 'flush'),
                        styles.option,
                        isSelected && styles.optionOn,
                        pressed && styles.optionPressed,
                      ]}
                    >
                      <View style={styles.optionArt}>
                        <MascotImage
                          size={96}
                          glow="none"
                          variant={option.key}
                        />
                        {isSelected && (
                          <View style={styles.tick}>
                            <Check size={14} color="#FFFFFF" strokeWidth={3} />
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.optionLabel,
                          isSelected && styles.optionLabelOn,
                        ]}
                      >
                        {t(option.labelKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.cta}>
              <PrimaryButton
                onPress={handleContinue}
                accessibilityLabel={t('onboarding.avatar.done')}
              >
                {t('onboarding.avatar.done')}
              </PrimaryButton>
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
  column: { width: '100%', maxWidth: 345, flex: 1, paddingTop: 24 },

  heading: { alignItems: 'center', gap: 8 },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
  },
  subtitle: { fontSize: 16, color: MUTED, textAlign: 'center' },

  stage: {
    marginTop: 24,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  picker: { marginTop: 16, padding: 16 },
  pickLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: INK,
    textAlign: 'center',
  },
  options: { marginTop: 12, flexDirection: 'row', gap: 12 },
  option: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 8,
  },
  optionOn: {
    borderWidth: 2,
    borderColor: PRIMARY,
    backgroundColor: 'rgba(47,111,228,0.08)',
  },
  optionPressed: { opacity: 0.8 },
  optionArt: { width: '100%', alignItems: 'center' },
  tick: {
    position: 'absolute',
    top: 0,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: { fontSize: 14, color: INK, textAlign: 'center' },
  optionLabelOn: { fontWeight: '600', color: PRIMARY },

  cta: { marginTop: 'auto', paddingBottom: 24 },
});
