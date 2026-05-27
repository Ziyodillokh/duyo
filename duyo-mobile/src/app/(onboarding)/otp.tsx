import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { jwtDecode } from 'jwt-decode';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { sendOtp, verifyOtp } from '@/api/endpoints/auth';
import { DuyoAvatar } from '@/components/duyo-avatar';
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
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 justify-center gap-10">
        <View className="items-center">
          <DuyoAvatar size="lg" state="idle" />
        </View>

        <View className="bg-card p-6 rounded-2xl gap-6">
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground text-center">
              SMS kodni kiriting
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              {fullPhone} raqamiga yuborildi
            </Text>
          </View>

          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground">
              Tasdiqlash kodi
            </Text>
            <View className="items-center">
              <OtpInput value={code} onChange={setCode} length={OTP_LENGTH} />
            </View>
          </View>

          <Pressable
            onPress={() => verify.mutate()}
            disabled={!canVerify}
            accessibilityRole="button"
            className={`h-14 rounded-xl items-center justify-center ${
              canVerify ? 'bg-primary' : 'bg-primary/40'
            }`}
          >
            <Text className="text-base font-semibold text-primary-foreground">
              {verify.isPending ? 'Tekshirilmoqda...' : 'Tasdiqlash'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => canResend && resend.mutate()}
            disabled={!canResend}
            accessibilityRole="button"
            className="items-center"
          >
            <Text
              className={`text-sm ${
                canResend
                  ? 'text-primary font-semibold'
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
        </View>
      </View>
    </SafeAreaView>
  );
}
