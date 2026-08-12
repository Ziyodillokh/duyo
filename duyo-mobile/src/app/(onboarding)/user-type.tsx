import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { MascotImage } from '@/components/v2/mascot-image';
import { ScreenGradient } from '@/components/v2/screen-gradient';
import { UserTypeIcon } from '@/components/v2/user-type-icon';
import { useT, type TranslationKey } from '@/i18n';
import { type UserType, useOnboardingStore } from '@/store/onboarding';

interface TypeOption {
  type: UserType;
  labelKey: TranslationKey;
  a11yKey: TranslationKey;
}

const TYPE_OPTIONS: readonly TypeOption[] = [
  {
    type: 'child',
    labelKey: 'onboarding.userType.child',
    a11yKey: 'onboarding.userType.childA11y',
  },
  {
    type: 'parent',
    labelKey: 'onboarding.userType.parent',
    a11yKey: 'onboarding.userType.parentA11y',
  },
];

export default function UserTypeScreen() {
  const t = useT();
  const setUserType = useOnboardingStore((s) => s.setUserType);

  const handleSelect = (type: UserType) => {
    setUserType(type);
    router.push('/(onboarding)/phone');
  };

  return (
    <ScreenGradient>
      {/* Card-sized artwork does not fit a short phone alongside the mascot,
          so the column centres when there is room and scrolls when there
          is not, instead of clipping off both ends. */}
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingVertical: 24,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center w-full max-w-[345px]">
          <MascotImage size={176} glow="cosmic" />

          <View className="items-center mt-6 gap-2">
            <Text className="text-[24px] leading-8 font-bold text-foreground">
              {t('onboarding.userType.greeting')}
            </Text>
            <Text className="text-base text-muted-foreground">
              {t('onboarding.userType.question')}
            </Text>
          </View>

          <View className="w-full gap-4 mt-8">
            {TYPE_OPTIONS.map((option) => (
              <Pressable
                key={option.type}
                onPress={() => handleSelect(option.type)}
                accessibilityRole="button"
                accessibilityLabel={t(option.a11yKey)}
                className="w-full bg-white rounded-xl border border-primary/10 px-4 pt-4 pb-5 items-center active:opacity-80"
              >
                <UserTypeIcon type={option.type} />
                <Text className="text-[20px] font-medium text-foreground mt-2">
                  {t(option.labelKey)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenGradient>
  );
}
