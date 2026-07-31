import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/v2/card';
import { MascotImage, type MascotVariant } from '@/components/v2/mascot-image';
import { PrimaryButton } from '@/components/v2/primary-button';
import { ScreenGradient } from '@/components/v2/screen-gradient';
import { useOnboardingStore } from '@/store/onboarding';

interface BodyOption {
  key: MascotVariant;
  label: string;
}

// Only the body is chosen here — one tap, no tabs. The picked key is stored as
// `body` so it keeps matching the backend's body_shape field.
const BODIES: ReadonlyArray<BodyOption> = [
  { key: 'duyo', label: 'DUYO' },
  { key: 'raccoon', label: 'Yenot' },
];

const DEFAULT_BODY: MascotVariant = 'duyo';

function isVariant(value: string | undefined): value is MascotVariant {
  return BODIES.some((body) => body.key === value);
}

export default function AvatarScreen() {
  const setPendingAvatarConfig = useOnboardingStore(
    (s) => s.setPendingAvatarConfig,
  );
  const persisted = useOnboardingStore((s) => s.pendingAvatarConfig);
  const [body, setBody] = useState<MascotVariant>(
    isVariant(persisted.body) ? persisted.body : DEFAULT_BODY,
  );

  const handleContinue = () => {
    setPendingAvatarConfig({ body });
    router.push('/(onboarding)/first-conversation');
  };

  return (
    <ScreenGradient>
      <View className="flex-1 px-6 items-center">
        <View className="w-full max-w-[345px] flex-1 pt-6">
          <View className="items-center gap-2">
            <Text className="text-[24px] leading-8 font-bold text-foreground text-center">
              DUYO'ingizni yarating
            </Text>
            <Text className="text-base text-muted-foreground text-center">
              O'zingizga yoqqan ko'rinishni tanlang
            </Text>
          </View>

          <View className="rounded-2xl overflow-hidden mt-6 shadow-md">
            <LinearGradient
              colors={['#ffffff', 'rgba(255, 199, 0, 0.20)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                height: 240,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MascotImage size={210} glow="cosmic" variant={body} />
            </LinearGradient>
          </View>

          <View className="mt-4">
            <Card className="p-4">
              <Text className="text-base font-semibold text-foreground text-center">
                O'z DUYO'yingni tanla
              </Text>

              <View className="flex-row gap-3 mt-3">
                {BODIES.map((option) => {
                  const isSelected = body === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => setBody(option.key)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={option.label}
                      className={`flex-1 pt-3 pb-3 rounded-2xl items-center gap-2 active:opacity-80 ${
                        isSelected
                          ? 'bg-primary/5 border-2 border-primary'
                          : 'bg-white border border-primary/10'
                      }`}
                    >
                      <View className="w-full items-center">
                        <MascotImage
                          size={96}
                          glow="none"
                          variant={option.key}
                        />
                        {isSelected && (
                          <View className="absolute top-0 right-2 w-6 h-6 rounded-full bg-primary items-center justify-center">
                            <Check size={14} color="#ffffff" strokeWidth={3} />
                          </View>
                        )}
                      </View>
                      <Text
                        className={`text-sm text-center ${
                          isSelected
                            ? 'text-primary font-semibold'
                            : 'text-foreground'
                        }`}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </View>

          <View className="mt-auto pb-6">
            <PrimaryButton
              onPress={handleContinue}
              accessibilityLabel="Mening DUYO'im tayyor"
            >
              Mening DUYO'im tayyor
            </PrimaryButton>
          </View>
        </View>
      </View>
    </ScreenGradient>
  );
}
