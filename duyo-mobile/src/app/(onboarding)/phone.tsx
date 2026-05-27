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
          'Bir necha daqiqadan keyin qayta urinib ko\'ring.',
        );
        return;
      }
      const detail =
        (err as AxiosErrorShape).response?.data?.detail ?? 'Xatolik yuz berdi';
      Alert.alert('Xatolik', detail);
    },
  });

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-6 justify-center gap-8">
          <View className="items-center">
            <DuyoAvatar size="lg" state="idle" />
          </View>

          <View className="bg-card p-6 rounded-xl gap-6">
            <View>
              <Text className="text-xl font-bold text-foreground text-center mb-2">
                Telefon raqamingiz
              </Text>
              <Text className="text-sm text-muted-foreground text-center">
                Xavfsizlik uchun telefon raqamingizni tasdiqlang
              </Text>
            </View>

            <View className="gap-2">
              <Text className="text-sm font-medium text-foreground">
                Telefon raqam
              </Text>
              <View className="flex-row gap-2 items-center">
                <View className="px-4 py-3 border-2 border-border rounded-lg bg-muted">
                  <Text className="text-base text-muted-foreground">
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
                  className="flex-1 px-4 py-3 border-2 border-border rounded-lg bg-card text-base text-foreground"
                />
              </View>
            </View>

            <Pressable
              onPress={() => mutation.mutate(phone)}
              disabled={!isValid || mutation.isPending}
              accessibilityRole="button"
              className={`h-12 rounded-lg items-center justify-center ${
                isValid && !mutation.isPending ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <Text
                className={`text-base font-semibold ${
                  isValid && !mutation.isPending
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {mutation.isPending ? 'Yuborilmoqda...' : 'SMS yuborish'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
