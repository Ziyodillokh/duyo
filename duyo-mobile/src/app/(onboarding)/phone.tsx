import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { sendOtp } from '@/api/endpoints/auth';
import { DuyoAvatar } from '@/components/duyo-avatar';

const PHONE_PREFIX = '+998';
const NATIONAL_DIGITS = 9;

interface AxiosErrorShape {
  response?: { status?: number; data?: { detail?: string } };
}

export default function PhoneScreen() {
  const [phone, setPhone] = useState('');
  const isValid = phone.length === NATIONAL_DIGITS;

  const mutation = useMutation({
    mutationFn: (national: string) => sendOtp(`${PHONE_PREFIX}${national}`),
    onSuccess: () => {
      router.push({ pathname: '/(onboarding)/otp', params: { phone } });
    },
    onError: (err) => {
      const status = (err as AxiosErrorShape).response?.status;
      if (status === 429) {
        Alert.alert(
          "Juda ko'p urinish",
          "Bir necha daqiqadan keyin qayta urinib ko'ring.",
        );
        return;
      }
      const detail =
        (err as AxiosErrorShape).response?.data?.detail ?? 'Xatolik yuz berdi';
      Alert.alert('Xatolik', detail);
    },
  });

  const canSend = isValid && !mutation.isPending;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-6 justify-center gap-10">
          <View className="items-center">
            <DuyoAvatar size="lg" state="idle" />
          </View>

          <View className="bg-card p-6 rounded-2xl gap-6">
            <View className="gap-2">
              <Text className="text-2xl font-bold text-foreground text-center">
                Telefon raqamingiz
              </Text>
              <Text className="text-sm text-muted-foreground text-center">
                Xavfsizlik uchun telefon raqamingizni tasdiqlang
              </Text>
            </View>

            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">
                Telefon raqam
              </Text>
              <View className="flex-row gap-3 items-center">
                <View className="px-4 py-3 rounded-xl bg-primary/10">
                  <Text className="text-base font-medium text-foreground">
                    {PHONE_PREFIX}
                  </Text>
                </View>
                <TextInput
                  value={phone}
                  onChangeText={(t) =>
                    setPhone(t.replace(/\D/g, '').slice(0, NATIONAL_DIGITS))
                  }
                  placeholder="901234567"
                  keyboardType="phone-pad"
                  autoFocus
                  accessibilityLabel="Telefon raqam"
                  className="flex-1 px-4 py-3 rounded-xl bg-background text-base text-foreground"
                />
              </View>
            </View>

            <Pressable
              onPress={() => mutation.mutate(phone)}
              disabled={!canSend}
              accessibilityRole="button"
              className={`h-14 rounded-xl items-center justify-center ${
                canSend ? 'bg-primary' : 'bg-primary/40'
              }`}
            >
              <Text className="text-base font-semibold text-primary-foreground">
                {mutation.isPending ? 'Yuborilmoqda...' : 'SMS yuborish'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
