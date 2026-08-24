import { useMutation } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
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

import { sendOtp } from '@/api/endpoints/auth';
import { MascotImage } from '@/components/v2/mascot-image';
import { useT } from '@/i18n';
import { glass, lift } from '@/lib/glass';

// ── The glass sky, the same morning the inner screens wake up to ─────────────
const PRIMARY = '#2F6FE4';
const TITLE = '#2A63DC';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const PLACEHOLDER = '#7693C2';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

const PHONE_PREFIX = '+998';
const NATIONAL_DIGITS = 9;

interface AxiosErrorShape {
  response?: { status?: number; data?: { detail?: string } };
}

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

export default function PhoneScreen() {
  const t = useT();
  const [phone, setPhone] = useState('');
  const isValid = phone.length === NATIONAL_DIGITS;

  const mutation = useMutation({
    mutationFn: (national: string) => sendOtp(`${PHONE_PREFIX}${national}`),
    onSuccess: (res) => {
      // While SMS is not connected the server answers with the code itself.
      // Carrying it to the next screen is what stops a tester waiting for an
      // SMS that is never coming.
      router.push({
        pathname: '/(onboarding)/otp',
        params: { phone, demoCode: res.demo_code ?? '' },
      });
    },
    onError: (err) => {
      const status = (err as AxiosErrorShape).response?.status;
      if (status === 429) {
        Alert.alert(
          t('common.tooManyAttempts.title'),
          t('common.tooManyAttempts.body'),
        );
        return;
      }
      const detail =
        (err as AxiosErrorShape).response?.data?.detail ??
        t('common.errorGeneric');
      Alert.alert(t('common.error'), detail);
    },
  });

  const canSend = isValid && !mutation.isPending;

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
            <MascotImage size={160} glow="soft" />

            {/* The one hero object on the screen, so it sits a rung above the
                chip and the field it contains. */}
            <View style={[glass(28, 'lg'), styles.card]}>
              <View style={styles.heading}>
                <Text style={styles.title}>{t('onboarding.phone.title')}</Text>
                <Text style={styles.subtitle}>
                  {t('onboarding.phone.subtitle')}
                </Text>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>{t('onboarding.phone.label')}</Text>
                <View style={styles.fieldRow}>
                  <View style={[glass(14, 'sm'), styles.chip]}>
                    <Text style={styles.chipText}>{PHONE_PREFIX}</Text>
                  </View>
                  <View style={styles.fieldSlot}>
                    <GlassField
                      value={phone}
                      onChangeText={(t) =>
                        setPhone(
                          t.replace(/\D/g, '').slice(0, NATIONAL_DIGITS),
                        )
                      }
                      placeholder="901234567"
                      keyboardType="phone-pad"
                      autoFocus
                      accessibilityLabel={t('onboarding.phone.label')}
                    />
                  </View>
                </View>
              </View>

              <Pressable
                onPress={() => mutation.mutate(phone)}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSend }}
                accessibilityLabel={t('onboarding.phone.send')}
                style={({ pressed }) => [
                  styles.cta,
                  !canSend && styles.ctaOff,
                  styles.focusable,
                  pressed && canSend && styles.pressed,
                ]}
              >
                <Text style={styles.ctaLabel}>
                  {mutation.isPending
                    ? t('common.sending')
                    : t('onboarding.phone.send')}
                </Text>
              </Pressable>
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
    marginTop: 48,
    padding: 24,
  },

  heading: { gap: 8, alignItems: 'center' },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: TITLE,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    textAlign: 'center',
  },

  fieldBlock: { gap: 8, marginTop: 24 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: INK,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldSlot: { flex: 1 },

  chip: {
    height: 56,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 16,
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
});
