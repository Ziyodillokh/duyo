import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { jwtDecode } from 'jwt-decode';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { sendOtp, verifyOtp } from '@/api/endpoints/auth';
import { DuyoAvatar } from '@/components/duyo-avatar';
import { OtpInput } from '@/components/otp-input';
import { useAuthStore } from '@/store/auth';

const PHONE_PREFIX = '+998';
const OTP_LENGTH = 6;

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
  const setAuth = useAuthStore((s) => s.setAuth);

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
      Alert.alert("Noto'g'ri kod", 'Yana urinib ko\'ring.');
      setCode('');
    },
  });

  const resend = useMutation({
    mutationFn: () => sendOtp(fullPhone),
    onSuccess: () => Alert.alert('SMS qaytadan yuborildi'),
    onError: () => Alert.alert('Qayta yuborib bo\'lmadi'),
  });

  const isReady = code.length === OTP_LENGTH;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 justify-center gap-8">
        <View className="items-center">
          <DuyoAvatar size="lg" state="idle" />
        </View>

        <View className="bg-card p-6 rounded-xl gap-6 items-center">
          <View className="items-center">
            <Text className="text-xl font-bold text-foreground mb-2">
              SMS kodni kiriting
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              {fullPhone} raqamiga yuborildi
            </Text>
          </View>

          <OtpInput value={code} onChange={setCode} length={OTP_LENGTH} />

          <Pressable
            onPress={() => verify.mutate()}
            disabled={!isReady || verify.isPending}
            accessibilityRole="button"
            className={`w-full h-12 rounded-lg items-center justify-center ${
              isReady && !verify.isPending ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <Text
              className={`text-base font-semibold ${
                isReady && !verify.isPending
                  ? 'text-primary-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {verify.isPending ? 'Tekshirilmoqda...' : 'Tasdiqlash'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => resend.mutate()}
            disabled={resend.isPending}
            accessibilityRole="button"
          >
            <Text className="text-sm text-primary font-medium">
              {resend.isPending ? 'Yuborilmoqda...' : 'Qayta yuborish'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
