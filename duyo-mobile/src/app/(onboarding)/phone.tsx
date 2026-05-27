import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  View,
} from 'react-native';

import { sendOtp } from '@/api/endpoints/auth';
import { Card } from '@/components/v2/card';
import { CountryChip } from '@/components/v2/country-chip';
import { FormInput } from '@/components/v2/form-input';
import { MascotImage } from '@/components/v2/mascot-image';
import { PrimaryButton } from '@/components/v2/primary-button';
import { ScreenGradient } from '@/components/v2/screen-gradient';

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
    <ScreenGradient>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-6 items-center justify-center">
          <View className="w-full max-w-[345px] items-center">
            <MascotImage size={160} glow="soft" />

            <View className="w-full mt-12">
              <Card>
                <View className="gap-2 items-center">
                  <Text className="text-xl font-bold text-foreground text-center">
                    Telefon raqamingiz
                  </Text>
                  <Text className="text-sm text-muted-foreground text-center">
                    Xavfsizlik uchun telefon raqamingizni tasdiqlang
                  </Text>
                </View>

                <View className="gap-2 mt-6">
                  <Text className="text-sm font-medium text-foreground">
                    Telefon raqam
                  </Text>
                  <View className="flex-row gap-2 items-center">
                    <CountryChip code={PHONE_PREFIX} />
                    <View className="flex-1">
                      <FormInput
                        value={phone}
                        onChangeText={(t) =>
                          setPhone(
                            t.replace(/\D/g, '').slice(0, NATIONAL_DIGITS),
                          )
                        }
                        placeholder="901234567"
                        keyboardType="phone-pad"
                        autoFocus
                        accessibilityLabel="Telefon raqam"
                      />
                    </View>
                  </View>
                </View>

                <View className="mt-6">
                  <PrimaryButton
                    onPress={() => mutation.mutate(phone)}
                    disabled={!canSend}
                    accessibilityLabel="SMS yuborish"
                  >
                    {mutation.isPending ? 'Yuborilmoqda...' : 'SMS yuborish'}
                  </PrimaryButton>
                </View>
              </Card>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenGradient>
  );
}
