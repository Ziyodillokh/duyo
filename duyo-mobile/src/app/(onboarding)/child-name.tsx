import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Card } from '@/components/v2/card';
import { FormInput } from '@/components/v2/form-input';
import { HelperText } from '@/components/v2/helper-text';
import { MascotImage } from '@/components/v2/mascot-image';
import { PrimaryButton } from '@/components/v2/primary-button';
import { ScreenGradient } from '@/components/v2/screen-gradient';
import { useT } from '@/i18n';
import { useOnboardingStore } from '@/store/onboarding';

const NAME_MAX_LENGTH = 80;

export default function ChildNameScreen() {
  const t = useT();
  const setPendingName = useOnboardingStore((s) => s.setPendingName);
  const persistedName = useOnboardingStore((s) => s.pendingName);
  const userType = useOnboardingStore((s) => s.userType);
  const [name, setName] = useState(persistedName);

  const trimmedName = name.trim();
  const isValid = trimmedName.length > 0;

  const handleContinue = () => {
    setPendingName(trimmedName);
    // A parent naming their child doesn't also know the child's age — that
    // question moves to the child's own device (see child-phone.tsx).
    router.push(
      userType === 'parent'
        ? '/(onboarding)/child-phone'
        : '/(onboarding)/age',
    );
  };

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
            <MascotImage size={176} glow="cosmic" />

            <View className="w-full mt-6">
              <Card>
                <View className="gap-2 items-center">
                  <Text className="text-[24px] leading-8 font-bold text-foreground text-center">
                    {t('onboarding.name.title')}
                  </Text>
                  <Text className="text-base text-muted-foreground text-center">
                    {t('onboarding.name.subtitle')}
                  </Text>
                </View>

                <View className="gap-2 mt-6">
                  <Text className="text-sm font-medium text-foreground">
                    {t('onboarding.name.label')}
                  </Text>
                  <FormInput
                    value={name}
                    onChangeText={setName}
                    placeholder={t('onboarding.name.placeholder')}
                    maxLength={NAME_MAX_LENGTH}
                    autoFocus
                    accessibilityLabel={t('onboarding.name.label')}
                  />
                </View>

                <View className="mt-6">
                  <PrimaryButton
                    onPress={handleContinue}
                    disabled={!isValid}
                    accessibilityLabel={t('common.continue')}
                  >
                    {t('common.continue')}
                  </PrimaryButton>
                </View>
              </Card>
            </View>

            <View className="mt-6 px-4">
              <HelperText>{t('onboarding.name.helper')}</HelperText>
            </View>
        </View>
      </KeyboardAwareScrollView>
    </ScreenGradient>
  );
}
