import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';
import { Text } from '@/components/text';

import { createChild } from '@/api/endpoints/children';
import { updateMe } from '@/api/endpoints/me';
import { Card } from '@/components/v2/card';
import { Chip } from '@/components/v2/chip';
import { MascotImage } from '@/components/v2/mascot-image';
import { ScreenGradient } from '@/components/v2/screen-gradient';
import { useT, type TranslationKey } from '@/i18n';
import { useChildStore } from '@/store/child';
import { useLanguageStore } from '@/store/language';
import { useOnboardingStore } from '@/store/onboarding';

interface AxiosErrorShape {
  response?: { data?: { detail?: string } };
}

const SUGGESTION_KEYS: readonly TranslationKey[] = [
  'onboarding.firstChat.suggestionStart',
  'onboarding.firstChat.suggestionPoem',
  'onboarding.firstChat.suggestionMission',
  'onboarding.firstChat.suggestionTalk',
];

export default function FirstConversationScreen() {
  const t = useT();
  const language = useLanguageStore((s) => s.language);
  const setChild = useChildStore((s) => s.setChild);
  const pendingName = useOnboardingStore((s) => s.pendingName);
  const pendingAge = useOnboardingStore((s) => s.pendingAge);
  const pendingInterests = useOnboardingStore((s) => s.pendingInterests);
  const pendingAvatarConfig = useOnboardingStore((s) => s.pendingAvatarConfig);
  const userType = useOnboardingStore((s) => s.userType);
  const resetOnboarding = useOnboardingStore((s) => s.reset);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!pendingName || pendingAge === null) {
        throw new Error('Missing onboarding data');
      }
      // Everything the child answered goes with the profile. Interests and
      // the chosen body used to be collected and then dropped on the floor.
      const child = await createChild({
        name: pendingName,
        age: pendingAge,
        language,
        interests: [...pendingInterests],
        mascot: pendingAvatarConfig.body,
      });

      // A child-held account gets their own name on it; a parent's name was
      // never asked for, so nothing is invented here.
      if (userType === 'child') {
        void updateMe({ role: 'child', display_name: pendingName }).catch(
          () => undefined,
        );
      }
      return child;
    },
    onSuccess: (child) => {
      setChild(child);
      resetOnboarding();
      router.replace('/(main)/(tabs)');
    },
    onError: (err) => {
      const detail =
        (err as AxiosErrorShape).response?.data?.detail ??
        t('common.errorGeneric');
      Alert.alert(t('common.error'), detail);
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
                    {t('onboarding.firstChat.greeting')}
                  </Text>
                </View>
              </View>
            </Card>
          </View>

          <View className="w-full mt-6 items-center">
            <Text className="text-sm text-muted-foreground text-center">
              {t('onboarding.firstChat.prompt')}
            </Text>
            <View className="flex-row flex-wrap gap-3 justify-center mt-3">
              {SUGGESTION_KEYS.map((key) => (
                <Chip
                  key={key}
                  onPress={startChat}
                  disabled={mutation.isPending}
                  accessibilityLabel={t(key)}
                >
                  {t(key)}
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
                  ? t('common.saving')
                  : t('onboarding.firstChat.skip')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScreenGradient>
  );
}
