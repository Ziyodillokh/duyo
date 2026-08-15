import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { jwtDecode } from 'jwt-decode';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { sendOtp, verifyOtp } from '@/api/endpoints/auth';
import { listChildren } from '@/api/endpoints/children';
import { updateMe } from '@/api/endpoints/me';
import { Card } from '@/components/v2/card';
import { MascotImage } from '@/components/v2/mascot-image';
import { PrimaryButton } from '@/components/v2/primary-button';
import { ScreenGradient } from '@/components/v2/screen-gradient';
import { OtpInput } from '@/components/otp-input';
import { useT } from '@/i18n';
import { useAuthStore } from '@/store/auth';
import { useChildStore } from '@/store/child';
import { useMascotStore } from '@/store/mascot';
import { useOnboardingStore } from '@/store/onboarding';

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
  const userType = useOnboardingStore((s) => s.userType);
  const setPendingName = useOnboardingStore((s) => s.setPendingName);

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
      if (userType) {
        void updateMe({ role: userType }).catch(() => undefined);
      }

      // Does this account already have a child? Signing in again — after a
      // reinstall, on a new phone, after logging out — must return the child
      // that exists, not walk onboarding and leave a second profile behind.
      const children = await listChildren();
      return { children, linkedChildName: token.linked_child_name ?? null };
    },
    onSuccess: ({ children, linkedChildName }) => {
      const existing = children[0];
      if (existing) {
        setChild(existing);
        if (existing.mascot === 'raccoon' || existing.mascot === 'duyo') {
          setMascotVariant(existing.mascot);
        }
        router.replace('/(main)/(tabs)');
        return;
      }
      if (linkedChildName) {
        // A parent already sent this phone a code with the child's name
        // attached — skip re-asking it and go straight to the child's own
        // remaining answers (age, interests, avatar).
        setPendingName(linkedChildName);
        router.replace('/(onboarding)/age');
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
    <ScreenGradient>
      <KeyboardAwareScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingVertical: 24,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-[345px] items-center">
          <MascotImage size={160} glow="soft" />

          <View className="w-full mt-12">
            <Card>
              <View className="gap-2 items-center">
                <Text className="text-xl font-bold text-foreground text-center">
                  {demoCode
                    ? t('onboarding.otp.titleDemo')
                    : t('onboarding.otp.titleSms')}
                </Text>
                <Text className="text-sm text-muted-foreground text-center">
                  {demoCode
                    ? t('onboarding.otp.subtitleDemo', { phone: fullPhone })
                    : t('onboarding.otp.subtitleSms', { phone: fullPhone })}
                </Text>
              </View>

              {/* No SMS provider is connected yet, so the server publishes the
                  code. Saying so is better than leaving a tester waiting. */}
              {demoCode !== '' && (
                <View className="mt-4 rounded-xl bg-primary/5 border border-primary/20 p-3">
                  <Text className="text-sm text-foreground text-center">
                    {t('onboarding.otp.demoNotice')}{' '}
                    <Text className="font-bold text-primary">{demoCode}</Text>
                  </Text>
                </View>
              )}

              <View className="gap-3 mt-6">
                <Text className="text-sm font-medium text-foreground text-center">
                  {t('onboarding.otp.codeLabel')}
                </Text>
                <View className="items-center">
                  <OtpInput
                    value={code}
                    onChange={setCode}
                    length={OTP_LENGTH}
                  />
                </View>
              </View>

              <View className="mt-6">
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
                className="items-center mt-4"
              >
                <Text
                  className={`text-sm ${
                    canResend
                      ? 'text-primary font-medium'
                      : 'text-muted-foreground'
                  }`}
                >
                  {resend.isPending
                    ? t('common.sending')
                    : canResend
                      ? t('onboarding.otp.resend')
                      : t('onboarding.otp.resendIn', { seconds: secondsLeft })}
                </Text>
              </Pressable>
            </Card>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </ScreenGradient>
  );
}
