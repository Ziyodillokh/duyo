import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/v2/card';
import { MascotImage } from '@/components/v2/mascot-image';
import { PrimaryButton } from '@/components/v2/primary-button';
import { ScreenGradient } from '@/components/v2/screen-gradient';
import { useT, type TranslationKey } from '@/i18n';
import { useOnboardingStore } from '@/store/onboarding';

const MIN_AGE = 7;
const MAX_AGE = 16;
const DEFAULT_AGE = 10;

function ageSegmentKey(age: number): TranslationKey {
  if (age <= 10) return 'onboarding.age.segment.junior';
  if (age <= 13) return 'onboarding.age.segment.explorer';
  return 'onboarding.age.segment.companion';
}

export default function AgeScreen() {
  const t = useT();
  const setPendingAge = useOnboardingStore((s) => s.setPendingAge);
  const persistedAge = useOnboardingStore((s) => s.pendingAge);
  const [age, setAge] = useState(persistedAge ?? DEFAULT_AGE);

  const handleContinue = () => {
    setPendingAge(age);
    router.push('/(onboarding)/interests');
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
                  {t('onboarding.age.title')}
                </Text>
                <Text className="text-base text-muted-foreground text-center">
                  {t('onboarding.age.subtitle')}
                </Text>
              </View>

              <View className="flex-row items-center justify-center gap-4 mt-6">
                <Pressable
                  onPress={() => setAge((a) => Math.max(MIN_AGE, a - 1))}
                  disabled={age <= MIN_AGE}
                  accessibilityRole="button"
                  accessibilityLabel={t('onboarding.age.decrease')}
                  className={`w-14 h-10 rounded-md border border-primary/10 items-center justify-center ${
                    age <= MIN_AGE ? 'opacity-40 bg-secondary' : 'bg-secondary'
                  }`}
                >
                  <Text className="text-base font-medium text-foreground">
                    −
                  </Text>
                </Pressable>

                <View className="min-w-[100px] items-center">
                  <Text className="text-6xl leading-[60px] font-bold text-primary">
                    {age}
                  </Text>
                </View>

                <Pressable
                  onPress={() => setAge((a) => Math.min(MAX_AGE, a + 1))}
                  disabled={age >= MAX_AGE}
                  accessibilityRole="button"
                  accessibilityLabel={t('onboarding.age.increase')}
                  className={`w-14 h-10 rounded-md border border-primary/10 items-center justify-center ${
                    age >= MAX_AGE ? 'opacity-40 bg-secondary' : 'bg-secondary'
                  }`}
                >
                  <Text className="text-base font-medium text-foreground">
                    +
                  </Text>
                </Pressable>
              </View>

              <View className="bg-accent/20 rounded-lg px-4 py-3 mt-4">
                <Text className="text-sm font-medium text-foreground text-center">
                  {t(ageSegmentKey(age))}
                </Text>
              </View>

              <View className="mt-6">
                <PrimaryButton
                  onPress={handleContinue}
                  accessibilityLabel={t('common.continue')}
                >
                  {t('common.continue')}
                </PrimaryButton>
              </View>
            </Card>
          </View>
        </View>
      </View>
    </ScreenGradient>
  );
}
