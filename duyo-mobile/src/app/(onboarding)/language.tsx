import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DuyoAvatar } from '@/components/duyo-avatar';
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
    router.push('/(onboarding)/phone');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6 gap-8">
        <DuyoAvatar size="lg" state="happy" />

        <Text className="text-2xl font-bold text-foreground">Tilni tanlang</Text>

        <View className="w-full gap-3">
          {LANGUAGE_OPTIONS.map((option) => {
            const isSelected = option.code === selected;
            return (
              <Pressable
                key={option.code}
                onPress={() => setSelected(option.code)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={option.label}
                className={`p-5 rounded-lg border-2 bg-card flex-row items-center gap-4 ${
                  isSelected ? 'border-primary' : 'border-border'
                }`}
              >
                <Text className="text-4xl">{option.flag}</Text>
                <Text className="text-xl font-medium text-foreground">
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={handleContinue}
          accessibilityRole="button"
          className="w-full h-14 bg-primary rounded-lg items-center justify-center active:opacity-80"
        >
          <Text className="text-lg font-semibold text-primary-foreground">
            Davom etish
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
