import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

import { createChild } from '@/api/endpoints/children';
import { Card } from '@/components/v2/card';
import { Chip } from '@/components/v2/chip';
import { MascotImage } from '@/components/v2/mascot-image';
import { ScreenGradient } from '@/components/v2/screen-gradient';
import { useChildStore } from '@/store/child';
import { useLanguageStore } from '@/store/language';
import { useOnboardingStore } from '@/store/onboarding';

interface AxiosErrorShape {
  response?: { data?: { detail?: string } };
}

const SUGGESTIONS: ReadonlyArray<string> = [
  'Boshlaymiz',
  "Menga she'r o'qib ber",
  "Bugungi missiyani ko'rsat",
  'Men bilan gaplash',
];

export default function FirstConversationScreen() {
  const language = useLanguageStore((s) => s.language);
  const setChild = useChildStore((s) => s.setChild);
  const pendingName = useOnboardingStore((s) => s.pendingName);
  const pendingAge = useOnboardingStore((s) => s.pendingAge);
  const resetOnboarding = useOnboardingStore((s) => s.reset);

  const mutation = useMutation({
    mutationFn: () => {
      if (!pendingName || pendingAge === null) {
        throw new Error('Missing onboarding data');
      }
      return createChild({
        name: pendingName,
        age: pendingAge,
        language,
      });
    },
    onSuccess: (child) => {
      setChild(child);
      resetOnboarding();
      router.replace('/(main)/(tabs)');
    },
    onError: (err) => {
      const detail =
        (err as AxiosErrorShape).response?.data?.detail ?? 'Xatolik yuz berdi';
      Alert.alert('Xatolik', detail);
    },
  });

  const startChat = () => {
    mutation.mutate();
  };

  return (
    <ScreenGradient>
      <View className="flex-1 px-6 items-center">
        <View className="w-full max-w-[345px] flex-1 pt-6 items-center">
          <MascotImage size={210} glow="cosmic" />

          <View className="w-full mt-6">
            <Card className="p-5">
              <View className="flex-row gap-3 items-start">
                <View className="w-16 h-16">
                  <MascotImage size={64} glow="soft" />
                </View>
                <View className="flex-1 bg-white border border-primary/10 rounded-2xl p-4">
                  <Text className="text-base leading-6 text-foreground">
                    Salom! Men DUYO. Endi birga o'rganamiz, suhbatlashamiz va
                    o'samiz. Bugun nima qilmoqchisiz?
                  </Text>
                </View>
              </View>
            </Card>
          </View>

          <View className="w-full mt-6 items-center">
            <Text className="text-sm text-muted-foreground text-center">
              Tanlang yoki o'zingiz yozing:
            </Text>
            <View className="flex-row flex-wrap gap-3 justify-center mt-3">
              {SUGGESTIONS.map((label) => (
                <Chip
                  key={label}
                  onPress={startChat}
                  disabled={mutation.isPending}
                  accessibilityLabel={label}
                >
                  {label}
                </Chip>
              ))}
            </View>
          </View>

          <View className="mt-auto pb-6">
            <Pressable
              onPress={startChat}
              disabled={mutation.isPending}
              accessibilityRole="button"
              className="items-center"
            >
              <Text className="text-sm font-medium text-muted-foreground">
                {mutation.isPending
                  ? 'Saqlanmoqda...'
                  : "O'tkazib yuborish →"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScreenGradient>
  );
}
