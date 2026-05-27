import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  View,
} from 'react-native';

import { Card } from '@/components/v2/card';
import { FormInput } from '@/components/v2/form-input';
import { HelperText } from '@/components/v2/helper-text';
import { MascotImage } from '@/components/v2/mascot-image';
import { PrimaryButton } from '@/components/v2/primary-button';
import { ScreenGradient } from '@/components/v2/screen-gradient';
import { useOnboardingStore } from '@/store/onboarding';

const NAME_MAX_LENGTH = 80;

export default function ChildNameScreen() {
  const setPendingName = useOnboardingStore((s) => s.setPendingName);
  const persistedName = useOnboardingStore((s) => s.pendingName);
  const [name, setName] = useState(persistedName);

  const trimmedName = name.trim();
  const isValid = trimmedName.length > 0;

  const handleContinue = () => {
    setPendingName(trimmedName);
    router.push('/(onboarding)/age');
  };

  return (
    <ScreenGradient>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-6 items-center justify-center">
          <View className="w-full max-w-[345px] items-center">
            <MascotImage size={176} glow="cosmic" />

            <View className="w-full mt-6">
              <Card>
                <View className="gap-2 items-center">
                  <Text className="text-[24px] leading-8 font-bold text-foreground text-center">
                    Isming nima?
                  </Text>
                  <Text className="text-base text-muted-foreground text-center">
                    Men seni ismingiz bilan chaqirishni xohlayman
                  </Text>
                </View>

                <View className="gap-2 mt-6">
                  <Text className="text-sm font-medium text-foreground">
                    Ismingiz
                  </Text>
                  <FormInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Masalan: Aziza"
                    maxLength={NAME_MAX_LENGTH}
                    autoFocus
                    accessibilityLabel="Ismingiz"
                  />
                </View>

                <View className="mt-6">
                  <PrimaryButton
                    onPress={handleContinue}
                    disabled={!isValid}
                    accessibilityLabel="Davom etish"
                  >
                    Davom etish
                  </PrimaryButton>
                </View>
              </Card>
            </View>

            <View className="mt-6 px-4">
              <HelperText>
                Ismingiz faqat men bilan suhbatlarda ishlatiladi va xavfsiz
                saqlanadi
              </HelperText>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenGradient>
  );
}
