import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Card } from '@/components/v2/card';
import { Chip } from '@/components/v2/chip';
import { MascotImage } from '@/components/v2/mascot-image';
import { PrimaryButton } from '@/components/v2/primary-button';
import { ScreenGradient } from '@/components/v2/screen-gradient';
import { useOnboardingStore } from '@/store/onboarding';

interface InterestOption {
  key: string;
  label: string;
}

const INTEREST_OPTIONS: readonly InterestOption[] = [
  { key: 'drawing', label: 'Rasm chizish' },
  { key: 'animals', label: 'Hayvonlar' },
  { key: 'fairy_tales', label: 'Ertaklar' },
  { key: 'space', label: 'Kosmos' },
  { key: 'superheroes', label: 'Super qahramonlar' },
  { key: 'games', label: "O'yinlar" },
  { key: 'music', label: 'Musiqa' },
  { key: 'nature', label: 'Tabiat' },
];

const MIN_SELECTED = 3;

export default function InterestsScreen() {
  const setPendingInterests = useOnboardingStore((s) => s.setPendingInterests);
  const persistedInterests = useOnboardingStore((s) => s.pendingInterests);
  const [selected, setSelected] = useState<ReadonlyArray<string>>(
    persistedInterests,
  );

  const toggle = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const canContinue = selected.length >= MIN_SELECTED;

  const handleContinue = () => {
    setPendingInterests(selected);
    router.push('/(onboarding)/avatar');
  };

  return (
    <ScreenGradient>
      <View className="flex-1 px-6 items-center justify-center">
        <View className="w-full max-w-[345px] items-center">
          <MascotImage size={176} glow="cosmic" />

          <View className="w-full mt-6">
            <Card>
              <View className="gap-2 items-center">
                <Text className="text-[24px] leading-8 font-bold text-foreground text-center">
                  Sizni nima qiziqtiradi?
                </Text>
                <Text className="text-base text-muted-foreground text-center">
                  Kamida {MIN_SELECTED} ta tanlang
                </Text>
              </View>

              <View className="flex-row flex-wrap gap-3 justify-center mt-6">
                {INTEREST_OPTIONS.map((option) => (
                  <Chip
                    key={option.key}
                    selected={selected.includes(option.key)}
                    onPress={() => toggle(option.key)}
                    accessibilityLabel={option.label}
                  >
                    {option.label}
                  </Chip>
                ))}
              </View>

              <Text className="text-sm text-muted-foreground text-center mt-4">
                {selected.length} ta tanlandi
              </Text>

              <View className="mt-4">
                <PrimaryButton
                  onPress={handleContinue}
                  disabled={!canContinue}
                  accessibilityLabel="Davom etish"
                >
                  Davom etish
                </PrimaryButton>
              </View>
            </Card>
          </View>
        </View>
      </View>
    </ScreenGradient>
  );
}
