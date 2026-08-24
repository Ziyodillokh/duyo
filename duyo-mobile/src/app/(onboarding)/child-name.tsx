import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput } from '@/components/text';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { MascotImage } from '@/components/v2/mascot-image';
import { useT } from '@/i18n';
import { glass, lift } from '@/lib/glass';
import { useOnboardingStore } from '@/store/onboarding';

// ── The glass sky, the same morning the inner screens wake up to ─────────────
const PRIMARY = '#2F6FE4';
const TITLE = '#2A63DC';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const PLACEHOLDER = '#7693C2';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

const NAME_MAX_LENGTH = 80;

/**
 * A glass form field.
 *
 * The pane carries the focus state rather than the input itself: a focus
 * border on the `TextInput` would sit inside the pane's rounded edge and read
 * as a second box, and the web input's own outline is suppressed below so the
 * pane is the only thing that lights up.
 */
function GlassField({ onFocus, onBlur, ...rest }: TextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[glass(18, 'sm'), styles.field, focused && styles.fieldOn]}>
      <TextInput
        placeholderTextColor={PLACEHOLDER}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={styles.fieldInput}
        {...rest}
      />
    </View>
  );
}

export default function ChildNameScreen() {
  const t = useT();
  const setPendingName = useOnboardingStore((s) => s.setPendingName);
  const persistedName = useOnboardingStore((s) => s.pendingName);
  // OTA-ONA BO'LIMI O'CHIRILGAN: userType endi bu tarmoqda o'qilmaydi.
  // const userType = useOnboardingStore((s) => s.userType);
  const [name, setName] = useState(persistedName);

  const trimmedName = name.trim();
  const isValid = trimmedName.length > 0;

  const handleContinue = () => {
    setPendingName(trimmedName);
    // OTA-ONA BO'LIMI O'CHIRILGAN: ilova faqat bola uchun, shuning uchun
    // "ota-ona bolaning telefonini kiritadi" tarmog'i kommentda turibdi.
    // router.push(
    //   userType === 'parent'
    //     ? '/(onboarding)/child-phone'
    //     : '/(onboarding)/age',
    // );
    router.push('/(onboarding)/age');
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.scroll}
          bottomOffset={24}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            <MascotImage size={176} glow="cosmic" />

            {/* The one hero object on the screen, so it sits a rung above the
                field it contains. */}
            <View style={[glass(28, 'lg'), styles.card]}>
              <View style={styles.heading}>
                <Text style={styles.title}>{t('onboarding.name.title')}</Text>
                <Text style={styles.subtitle}>
                  {t('onboarding.name.subtitle')}
                </Text>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>{t('onboarding.name.label')}</Text>
                <GlassField
                  value={name}
                  onChangeText={setName}
                  placeholder={t('onboarding.name.placeholder')}
                  maxLength={NAME_MAX_LENGTH}
                  autoFocus
                  accessibilityLabel={t('onboarding.name.label')}
                />
              </View>

              <Pressable
                onPress={handleContinue}
                disabled={!isValid}
                accessibilityRole="button"
                accessibilityState={{ disabled: !isValid }}
                accessibilityLabel={t('common.continue')}
                style={({ pressed }) => [
                  styles.cta,
                  !isValid && styles.ctaOff,
                  styles.focusable,
                  pressed && isValid && styles.pressed,
                ]}
              >
                <Text style={styles.ctaLabel}>{t('common.continue')}</Text>
              </Pressable>
            </View>

            <View style={styles.helperBlock}>
              <Text style={styles.helper}>{t('onboarding.name.helper')}</Text>
            </View>
          </View>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  column: {
    width: '100%',
    maxWidth: 345,
    alignItems: 'center',
  },

  card: {
    width: '100%',
    marginTop: 24,
    padding: 24,
  },

  heading: { gap: 8, alignItems: 'center' },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: TITLE,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: MUTED,
    textAlign: 'center',
  },

  fieldBlock: { gap: 8, marginTop: 24 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: INK,
  },

  field: {
    width: '100%',
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderWidth: 2,
  },
  fieldOn: { borderColor: PRIMARY },
  fieldInput: {
    fontSize: 18,
    color: INK,
    paddingVertical: 0,
    // The pane above already shows focus; the input's own web outline would
    // draw a second, square ring inside the rounded edge.
    outlineStyle: 'none',
    outlineWidth: 0,
  } as unknown as TextStyle,

  // Solid rather than glass: the card's one action should not read as another
  // frosted pane stacked on the pane it sits in.
  cta: {
    width: '100%',
    height: 56,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: PRIMARY,
    boxShadow: lift('md'),
  },
  // Unavailable, so it settles back onto the page as well as fading.
  ctaOff: {
    backgroundColor: 'rgba(47,111,228,0.40)',
    boxShadow: lift('sm'),
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

  helperBlock: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  helper: {
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    textAlign: 'center',
  },
});
