import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { MascotImage } from '@/components/v2/mascot-image';
import { ScreenGradient } from '@/components/v2/screen-gradient';
import { type UserType, useOnboardingStore } from '@/store/onboarding';

interface TypeOption {
  type: UserType;
  emoji: string;
  label: string;
  accessibilityLabel: string;
}

const TYPE_OPTIONS: readonly TypeOption[] = [
  {
    type: 'child',
    emoji: '👧🏻',
    label: 'Men bola',
    accessibilityLabel: 'Men bola — bolaning hisobi',
  },
  {
    type: 'parent',
    emoji: '👨‍👩‍👧‍👦',
    label: 'Men ota-ona',
    accessibilityLabel: 'Men ota-ona — ota-onaning hisobi',
  },
];

export default function UserTypeScreen() {
  const setUserType = useOnboardingStore((s) => s.setUserType);

  const handleSelect = (type: UserType) => {
    setUserType(type);
    router.push('/(onboarding)/phone');
  };

  return (
    <ScreenGradient>
      <View className="flex-1 px-6 items-center">
        <View className="flex-1 justify-center items-center w-full max-w-[345px]">
          <MascotImage size={176} glow="cosmic" />

          <View className="items-center mt-6 gap-2">
            <Text className="text-[24px] leading-8 font-bold text-foreground">
              Salom!
            </Text>
            <Text className="text-base text-muted-foreground">Siz kimsiz?</Text>
          </View>

          <View className="w-full gap-4 mt-8">
            {TYPE_OPTIONS.map((option) => (
              <Pressable
                key={option.type}
                onPress={() => handleSelect(option.type)}
                accessibilityRole="button"
                accessibilityLabel={option.accessibilityLabel}
                className="w-full bg-white rounded-xl border border-primary/10 py-8 items-center active:opacity-80"
              >
                <Text className="text-[60px]">{option.emoji}</Text>
                <Text className="text-[20px] font-medium text-foreground mt-3">
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </ScreenGradient>
  );
}
