import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { MascotImage } from '@/components/v2/mascot-image';
import { PrimaryButton } from '@/components/v2/primary-button';
import { ScreenGradient } from '@/components/v2/screen-gradient';
import { SelectCard } from '@/components/v2/select-card';
import { type Language, useLanguageStore } from '@/store/language';

interface LanguageOption {
  code: Language;
  label: string;
  flag: string;
}

const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: 'uz', label: "O'zbek", flag: '🇺🇿' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

export default function LanguageScreen() {
  const persistedLanguage = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const [selected, setSelected] = useState<Language>(persistedLanguage);

  const handleContinue = () => {
    setLanguage(selected);
    router.push('/(onboarding)/user-type');
  };

  return (
    <ScreenGradient>
      <View className="flex-1 px-6 items-center">
        <View className="flex-1 justify-center items-center w-full max-w-[345px]">
          <MascotImage size={176} />

          <Text className="text-[24px] leading-8 font-bold text-foreground mt-6">
            Tilni tanlang
          </Text>

          <View className="w-full gap-3 mt-8">
            {LANGUAGE_OPTIONS.map((option) => (
              <SelectCard
                key={option.code}
                selected={option.code === selected}
                onPress={() => setSelected(option.code)}
                accessibilityLabel={option.label}
              >
                <Text className="text-[36px]">{option.flag}</Text>
                <Text className="text-[20px] font-medium text-foreground">
                  {option.label}
                </Text>
              </SelectCard>
            ))}
          </View>
        </View>

        <View className="w-full max-w-[345px] pb-6">
          <PrimaryButton
            onPress={handleContinue}
            accessibilityLabel="Davom etish"
          >
            Davom etish
          </PrimaryButton>
        </View>
      </View>
    </ScreenGradient>
  );
}
