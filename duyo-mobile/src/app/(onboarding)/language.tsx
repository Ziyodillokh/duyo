import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/text';

import { FlagIcon } from '@/components/v2/flag-icon';
import { MascotImage } from '@/components/v2/mascot-image';
import { LANGUAGE_NAMES, translate } from '@/i18n';
import { glass, lift } from '@/lib/glass';
import { type Language, useLanguageStore } from '@/store/language';

// ── The glass sky, the same morning the inner screens wake up to ─────────────
const PRIMARY = '#2F6FE4';
const TITLE = '#2A63DC';
const INK = '#22406F';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

const LANGUAGE_OPTIONS: readonly Language[] = ['uz', 'ru', 'en'];

export default function LanguageScreen() {
  const persistedLanguage = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const [selected, setSelected] = useState<Language>(persistedLanguage);

  // This one screen follows the highlighted card, not the saved language —
  // the whole point of it is previewing the language before committing.
  const t = (key: Parameters<typeof translate>[1]) => translate(selected, key);

  const handleContinue = () => {
    setLanguage(selected);
    router.push('/(onboarding)/phone');
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
            <MascotImage size={176} />

            <Text style={styles.title}>{t('onboarding.language.title')}</Text>

            <View style={styles.options}>
              {LANGUAGE_OPTIONS.map((code) => {
                const on = code === selected;
                return (
                  <Pressable
                    key={code}
                    onPress={() => setSelected(code)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={LANGUAGE_NAMES[code]}
                    // The picked language rises a rung on the ladder — the
                    // height is the selection cue, the border only confirms it.
                    style={[
                      glass(20, on ? 'md' : 'sm'),
                      styles.option,
                      on && styles.optionOn,
                      styles.focusable,
                    ]}
                  >
                    <FlagIcon code={code} width={40} />
                    <Text style={styles.optionLabel}>{LANGUAGE_NAMES[code]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={handleContinue}
              accessibilityRole="button"
              accessibilityState={{ disabled: false }}
              accessibilityLabel={t('common.continue')}
              style={({ pressed }) => [
                styles.cta,
                styles.focusable,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.ctaLabel}>{t('common.continue')}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  page: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: 345,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    marginTop: 24,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: TITLE,
  },

  options: {
    width: '100%',
    marginTop: 32,
    gap: 12,
  },
  option: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 26,
    paddingVertical: 26,
  },
  optionOn: {
    borderWidth: 2,
    borderColor: PRIMARY,
    backgroundColor: 'rgba(47,111,228,0.10)',
  },
  optionLabel: {
    fontSize: 20,
    fontWeight: '500',
    color: INK,
  },

  footer: {
    width: '100%',
    maxWidth: 345,
    paddingBottom: 24,
  },
  // Solid rather than glass: the screen's one commitment should not read as
  // another frosted pane among the three the child is choosing between.
  cta: {
    width: '100%',
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: PRIMARY,
    boxShadow: lift('md'),
  },
  ctaLabel: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: '#FFFFFF',
  },
  pressed: { opacity: 0.8 },
  // The browser's default focus ring is a black rectangle around a rounded
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
});
