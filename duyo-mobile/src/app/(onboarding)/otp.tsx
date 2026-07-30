import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { jwtDecode } from 'jwt-decode';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { sendOtp, verifyOtp } from '@/api/endpoints/auth';
import { Card } from '@/components/v2/card';
import { MascotImage } from '@/components/v2/mascot-image';
import { PrimaryButton } from '@/components/v2/primary-button';
import { ScreenGradient } from '@/components/v2/screen-gradient';
import { OtpInput } from '@/components/otp-input';
import { useAuthStore } from '@/store/auth';

const PHONE_PREFIX = '+998';
const OTP_LENGTH = 4;
const RESEND_COOLDOWN_SEC = 60;

interface JwtClaims {
  sub: string;
  type?: string;
  exp?: number;
}

export default function OtpScreen() {
  const params = useLocalSearchParams<{ phone: string }>();
  const national = params.phone ?? '';
  const fullPhone = `${PHONE_PREFIX}${national}`;
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SEC);
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const verify = useMutation({
    mutationFn: () => verifyOtp(fullPhone, code),
    onSuccess: (token) => {
      const claims = jwtDecode<JwtClaims>(token.access_token);
      setAuth(
        {
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresAt: claims.exp,
        },
        claims.sub,
      );
      router.replace('/(onboarding)/child-name');
    },
    onError: () => {
      Alert.alert("Noto'g'ri kod", "Yana urinib ko'ring.");
      setCode('');
    },
  });

  const resend = useMutation({
    mutationFn: () => sendOtp(fullPhone),
    onSuccess: () => {
      setSecondsLeft(RESEND_COOLDOWN_SEC);
      Alert.alert('SMS qaytadan yuborildi');
    },
    onError: () => Alert.alert("Qayta yuborib bo'lmadi"),
  });

  const isReady = code.length === OTP_LENGTH;
  const canVerify = isReady && !verify.isPending;
  const canResend = secondsLeft === 0 && !resend.isPending;

  return (
    <ScreenGradient>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingVertical: 24,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="w-full max-w-[345px] items-center">
          <MascotImage size={160} glow="soft" />

          <View className="w-full mt-12">
            <Card>
              <View className="gap-2 items-center">
                <Text className="text-xl font-bold text-foreground text-center">
                  SMS kodni kiriting
                </Text>
                <Text className="text-sm text-muted-foreground text-center">
                  {fullPhone} raqamiga yuborildi
                </Text>
              </View>

              <View className="gap-3 mt-6">
                <Text className="text-sm font-medium text-foreground text-center">
                  Tasdiqlash kodi
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
                  accessibilityLabel="Tasdiqlash"
                >
                  {verify.isPending ? 'Tekshirilmoqda...' : 'Tasdiqlash'}
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
                    ? 'Yuborilmoqda...'
                    : canResend
                      ? 'Qayta yuborish'
                      : `Qayta yuborish: ${secondsLeft} soniya`}
                </Text>
              </Pressable>
            </Card>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenGradient>
  );
}
