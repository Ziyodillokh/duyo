import { useMutation } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { jwtDecode } from 'jwt-decode';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/text';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { sendOtp, verifyOtp } from '@/api/endpoints/auth';
import { listChildren } from '@/api/endpoints/children';
import { updateMe } from '@/api/endpoints/me';
import { MascotImage } from '@/components/v2/mascot-image';
import { PrimaryButton } from '@/components/v2/primary-button';
import { OtpInput } from '@/components/otp-input';
import { useT } from '@/i18n';
import { glass } from '@/lib/glass';
import { useAuthStore } from '@/store/auth';
import { useChildStore } from '@/store/child';
import { useMascotStore } from '@/store/mascot';
// OTA-ONA BO'LIMI O'CHIRILGAN — userType selektori bilan birga kommentda:
// import { useOnboardingStore } from '@/store/onboarding';

// ── The glass sky, the same pale morning the inner screens wake up to ────────
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

const PHONE_PREFIX = '+998';
const OTP_LENGTH = 5;
const RESEND_COOLDOWN_SEC = 60;

interface JwtClaims {
  sub: string;
  type?: string;
  exp?: number;
}

interface AxiosErrorShape {
  response?: { status?: number; data?: { detail?: string } };
}

export default function OtpScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ phone: string; demoCode?: string }>();
  const national = params.phone ?? '';
  const fullPhone = `${PHONE_PREFIX}${national}`;
  const [demoCode, setDemoCode] = useState(params.demoCode ?? '');
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SEC);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setChild = useChildStore((s) => s.setChild);
  const setMascotVariant = useMascotStore((s) => s.setVariant);
  // OTA-ONA BO'LIMI O'CHIRILGAN: rol endi doim 'child' (pastda).
  // const userType = useOnboardingStore((s) => s.userType);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const verify = useMutation({
    mutationFn: async () => {
      const token = await verifyOtp(fullPhone, code);
      const claims = jwtDecode<JwtClaims>(token.access_token);
      setAuth(
        {
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresAt: claims.exp,
        },
        claims.sub,
      );

      // Record who this account belongs to. Best-effort: the answer is a
      // nice-to-have, and failing it must not block a login.
      void updateMe({ role: 'child' }).catch(() => undefined);

      // Does this account already have a child? Signing in again — after a
      // reinstall, on a new phone, after logging out — must return the child
      // that exists, not walk onboarding and leave a second profile behind.
      const children = await listChildren();
      return { children };
    },
    onSuccess: ({ children }) => {
      const existing = children[0];
      if (existing) {
        setChild(existing);
        if (existing.mascot === 'raccoon' || existing.mascot === 'duyo') {
          setMascotVariant(existing.mascot);
        }
        router.replace('/(main)/(tabs)');
        return;
      }
      router.replace('/(onboarding)/child-name');
    },
    onError: (err) => {
      const status = (err as AxiosErrorShape).response?.status;
      // Every failure used to say "wrong code", including the ones where
      // retrying the same code is exactly the right move.
      if (status === 401) {
        Alert.alert(
          t('onboarding.otp.wrongCode.title'),
          t('onboarding.otp.wrongCode.body'),
        );
        setCode('');
        return;
      }
      if (status === 429) {
        Alert.alert(
          t('common.tooManyAttempts.title'),
          t('common.tooManyAttempts.body'),
        );
        return;
      }
      if (status === undefined) {
        Alert.alert(t('common.noInternet.title'), t('common.noInternet.body'));
        return;
      }
      Alert.alert(
        t('common.error'),
        (err as AxiosErrorShape).response?.data?.detail ?? t('common.tryLater'),
      );
    },
  });

  const resend = useMutation({
    mutationFn: () => sendOtp(fullPhone),
    onSuccess: (res) => {
      setSecondsLeft(RESEND_COOLDOWN_SEC);
      setDemoCode(res.demo_code ?? '');
      if (!res.demo_code) Alert.alert(t('onboarding.otp.resent'));
    },
    onError: () => Alert.alert(t('onboarding.otp.resendFailed')),
  });

  const isReady = code.length === OTP_LENGTH;
  const canVerify = isReady && !verify.isPending;
  const canResend = secondsLeft === 0 && !resend.isPending;

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

            <View style={styles.cardHolder}>
              {/* The sheet the whole screen is about, so it sits highest. */}
              <View style={[glass(28, 'lg'), styles.card]}>
                <View style={styles.heading}>
                  <Text style={styles.title}>
                    {demoCode
                      ? t('onboarding.otp.titleDemo')
                      : t('onboarding.otp.titleSms')}
                  </Text>
                  <Text style={styles.subtitle}>
                    {demoCode
                      ? t('onboarding.otp.subtitleDemo', { phone: fullPhone })
                      : t('onboarding.otp.subtitleSms', { phone: fullPhone })}
                  </Text>
                </View>

                {/* No SMS provider is connected yet, so the server publishes the
                    code. Saying so is better than leaving a tester waiting. */}
                {demoCode !== '' ? (
                  <View style={styles.notice}>
                    <Text style={styles.noticeText}>
                      {t('onboarding.otp.demoNotice')}{' '}
                      <Text style={styles.noticeCode}>{demoCode}</Text>
                    </Text>
                  </View>
                ) : null}

                <View style={styles.codeBlock}>
                  <Text style={styles.codeLabel}>
                    {t('onboarding.otp.codeLabel')}
                  </Text>
                  <View style={styles.codeRow}>
                    <OtpInput
                      value={code}
                      onChange={setCode}
                      length={OTP_LENGTH}
                    />
                  </View>
                </View>

                <View style={styles.cta}>
                  <PrimaryButton
                    onPress={() => verify.mutate()}
                    disabled={!canVerify}
                    accessibilityLabel={t('onboarding.otp.verify')}
                  >
                    {verify.isPending
                      ? t('onboarding.otp.verifying')
                      : t('onboarding.otp.verify')}
                  </PrimaryButton>
                </View>

                <Pressable
                  onPress={() => canResend && resend.mutate()}
                  disabled={!canResend}
                  accessibilityRole="button"
                  style={styles.resend}
                >
                  <Text
                    style={[styles.resendText, canResend && styles.resendTextOn]}
                  >
                    {resend.isPending
                      ? t('common.sending')
                      : canResend
                        ? t('onboarding.otp.resend')
                        : t('onboarding.otp.resendIn', { seconds: secondsLeft })}
                  </Text>
                </Pressable>
              </View>
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
  column: { width: '100%', maxWidth: 345, alignItems: 'center' },

  cardHolder: { marginTop: 48, width: '100%' },
  card: { padding: 24 },

  heading: { alignItems: 'center', gap: 8 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    textAlign: 'center',
  },

  // Flush on the card it sits in: an inner notice with a shadow would read as
  // a second card rather than as part of this one.
  notice: {
    marginTop: 16,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(47,111,228,0.20)',
    backgroundColor: 'rgba(47,111,228,0.06)',
  },
  noticeText: { fontSize: 14, color: INK, textAlign: 'center' },
  noticeCode: { fontWeight: '700', color: PRIMARY },

  codeBlock: { marginTop: 24, gap: 12 },
  codeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: INK,
    textAlign: 'center',
  },
  codeRow: { alignItems: 'center' },

  cta: { marginTop: 24 },

  // Padded rather than hitSlopped: hitSlop does not grow the element on web,
  // and this is the one way back out of a wrong number.
  resend: { marginTop: 12, paddingVertical: 8, alignItems: 'center' },
  resendText: { fontSize: 14, color: MUTED },
  resendTextOn: { fontWeight: '500', color: PRIMARY },
});
