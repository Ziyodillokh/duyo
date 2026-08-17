import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { FlagIcon } from '@/components/v2/flag-icon';
import { MascotImage } from '@/components/v2/mascot-image';
import { PrimaryButton } from '@/components/v2/primary-button';
import { ScreenGradient } from '@/components/v2/screen-gradient';
import { SelectCard } from '@/components/v2/select-card';
import { LANGUAGE_NAMES, translate } from '@/i18n';
import { type Language, useLanguageStore } from '@/store/language';
import { useOnboardingStore } from '@/store/onboarding';

const LANGUAGE_OPTIONS: readonly Language[] = ['uz', 'ru', 'en'];

export default function LanguageScreen() {
  const persistedLanguage = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const [selected, setSelected] = useState<Language>(persistedLanguage);

  // This one screen follows the highlighted card, not the saved language —
  // the whole point of it is previewing the language before committing.
  const t = (key: Parameters<typeof translate>[1]) => translate(selected, key);

  const handleContinue = () => {
    setLanguage(selected);
    // OTA-ONA BO'LIMI O'CHIRILGAN: "Siz kimsiz?" ekrani tashlab o'tiladi —
    // ilova hozircha faqat bola uchun, hisob turi hamisha 'child'.
    // router.push('/(onboarding)/user-type');
    useOnboardingStore.getState().setUserType('child');
    router.push('/(onboarding)/phone');
  };

  return (
    <ScreenGradient>
      <View className="flex-1 px-6 items-center">
        <View className="flex-1 justify-center items-center w-full max-w-[345px]">
          <MascotImage size={176} />

          <Text className="text-[24px] leading-8 font-bold text-foreground mt-6">
            {t('onboarding.language.title')}
          </Text>

          <View className="w-full gap-3 mt-8">
            {LANGUAGE_OPTIONS.map((code) => (
              <SelectCard
                key={code}
                selected={code === selected}
                onPress={() => setSelected(code)}
                accessibilityLabel={LANGUAGE_NAMES[code]}
              >
                <FlagIcon code={code} width={40} />
                <Text className="text-[20px] font-medium text-foreground">
                  {LANGUAGE_NAMES[code]}
                </Text>
              </SelectCard>
            ))}
          </View>
        </View>

        <View className="w-full max-w-[345px] pb-6">
          <PrimaryButton
            onPress={handleContinue}
            accessibilityLabel={t('common.continue')}
          >
            {t('common.continue')}
          </PrimaryButton>
        </View>
      </View>
    </ScreenGradient>
  );
}
