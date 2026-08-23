import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Text } from '@/components/text';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { sendOtp } from '@/api/endpoints/auth';
import { Card } from '@/components/v2/card';
import { CountryChip } from '@/components/v2/country-chip';
import { FormInput } from '@/components/v2/form-input';
import { MascotImage } from '@/components/v2/mascot-image';
import { PrimaryButton } from '@/components/v2/primary-button';
import { ScreenGradient } from '@/components/v2/screen-gradient';
import { useT } from '@/i18n';

const PHONE_PREFIX = '+998';
const NATIONAL_DIGITS = 9;

interface AxiosErrorShape {
  response?: { status?: number; data?: { detail?: string } };
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
                    {t('onboarding.phone.title')}
                  </Text>
                  <Text className="text-sm text-muted-foreground text-center">
                    {t('onboarding.phone.subtitle')}
                  </Text>
                </View>

                <View className="gap-2 mt-6">
                  <Text className="text-sm font-medium text-foreground">
                    {t('onboarding.phone.label')}
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
                        accessibilityLabel={t('onboarding.phone.label')}
                      />
                    </View>
                  </View>
                </View>

                <View className="mt-6">
                  <PrimaryButton
                    onPress={() => mutation.mutate(phone)}
                    disabled={!canSend}
                    accessibilityLabel={t('onboarding.phone.send')}
                  >
                    {mutation.isPending
                      ? t('common.sending')
                      : t('onboarding.phone.send')}
                  </PrimaryButton>
                </View>
              </Card>
            </View>
        </View>
      </KeyboardAwareScrollView>
    </ScreenGradient>
  );
}
