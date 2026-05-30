import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/v2/card';
import { MascotImage } from '@/components/v2/mascot-image';
import { PrimaryButton } from '@/components/v2/primary-button';
import { ScreenGradient } from '@/components/v2/screen-gradient';
import { Tabs } from '@/components/v2/tabs';
import { useOnboardingStore } from '@/store/onboarding';

type TabKey = 'body' | 'color' | 'accent' | 'face';

interface AvatarOption {
  key: string;
  emoji: string;
  label: string;
}

const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: 'body', label: 'Tana' },
  { key: 'color', label: 'Rang' },
  { key: 'accent', label: 'Aksent' },
  { key: 'face', label: 'Yuz' },
];

const OPTIONS: Record<TabKey, ReadonlyArray<AvatarOption>> = {
  body: [
    { key: 'sphere', emoji: '⚪', label: 'Sharsimon' },
    { key: 'cube', emoji: '🟦', label: 'Kubik' },
    { key: 'vertical', emoji: '⬜', label: 'Vertikal' },
  ],
  color: [
    { key: 'blue', emoji: '🔵', label: 'Ko‘k' },
    { key: 'purple', emoji: '🟣', label: 'Binafsha' },
    { key: 'green', emoji: '🟢', label: 'Yashil' },
  ],
  accent: [
    { key: 'star', emoji: '⭐', label: 'Yulduz' },
    { key: 'cap', emoji: '🧢', label: 'Shapka' },
    { key: 'glasses', emoji: '🤓', label: 'Ko‘zoynak' },
  ],
  face: [
    { key: 'smile', emoji: '😊', label: 'Tabassum' },
    { key: 'curious', emoji: '🤔', label: 'Qiziqish' },
    { key: 'sunny', emoji: '😄', label: 'Quvonchli' },
  ],
};

const DEFAULTS: Record<TabKey, string> = {
  body: 'sphere',
  color: 'blue',
  accent: 'star',
  face: 'smile',
};

export default function AvatarScreen() {
  const setPendingAvatarConfig = useOnboardingStore(
    (s) => s.setPendingAvatarConfig,
  );
  const persisted = useOnboardingStore((s) => s.pendingAvatarConfig);
  const [activeTab, setActiveTab] = useState<TabKey>('body');
  const [config, setConfig] = useState<Record<TabKey, string>>({
    body: persisted.body ?? DEFAULTS.body,
    color: persisted.color ?? DEFAULTS.color,
    accent: persisted.accent ?? DEFAULTS.accent,
    face: persisted.face ?? DEFAULTS.face,
  });

  const setOption = (key: string) => {
    setConfig((prev) => ({ ...prev, [activeTab]: key }));
  };

  const handleContinue = () => {
    setPendingAvatarConfig(config);
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
              <MascotImage size={210} glow="cosmic" />
            </LinearGradient>
          </View>

          <View className="mt-4">
            <Card className="p-3">
              <Tabs<TabKey>
                items={TABS}
                active={activeTab}
                onChange={setActiveTab}
              />

              <View className="flex-row gap-3 mt-3">
                {OPTIONS[activeTab].map((option) => {
                  const isSelected = config[activeTab] === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => setOption(option.key)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={option.label}
                      className={`flex-1 py-4 rounded-xl items-center gap-2 ${
                        isSelected
                          ? 'bg-primary/5 border-2 border-primary'
                          : 'bg-white border border-primary/10'
                      }`}
                    >
                      <Text className="text-3xl">{option.emoji}</Text>
                      <Text className="text-xs text-foreground text-center">
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
