import { router } from 'expo-router';
import {
  BookOpen,
  Check,
  Gamepad2,
  Leaf,
  Music,
  Palette,
  PawPrint,
  Rocket,
  Shield,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { MascotImage } from '@/components/v2/mascot-image';
import { PrimaryButton } from '@/components/v2/primary-button';
import { ScreenGradient } from '@/components/v2/screen-gradient';
import { useT, type TranslationKey } from '@/i18n';
import { useOnboardingStore } from '@/store/onboarding';

interface InterestOption {
  /** Stored on the child profile — never translated. */
  key: string;
  labelKey: TranslationKey;
  Icon: LucideIcon;
  /** Each interest owns a colour, so the grid reads as eight things and not
      one blue wall. Tuned to sit alongside the brand blue without shouting. */
  color: string;
}

const INTEREST_OPTIONS: readonly InterestOption[] = [
  { key: 'drawing', labelKey: 'onboarding.interests.drawing', Icon: Palette, color: '#EC4899' },
  { key: 'animals', labelKey: 'onboarding.interests.animals', Icon: PawPrint, color: '#10B981' },
  { key: 'fairy_tales', labelKey: 'onboarding.interests.fairyTales', Icon: BookOpen, color: '#8B5CF6' },
  { key: 'space', labelKey: 'onboarding.interests.space', Icon: Rocket, color: '#2563EB' },
  { key: 'superheroes', labelKey: 'onboarding.interests.superheroes', Icon: Shield, color: '#F97316' },
  { key: 'games', labelKey: 'onboarding.interests.games', Icon: Gamepad2, color: '#0EA5E9' },
  { key: 'music', labelKey: 'onboarding.interests.music', Icon: Music, color: '#EAB308' },
  { key: 'nature', labelKey: 'onboarding.interests.nature', Icon: Leaf, color: '#22C55E' },
];

const MIN_SELECTED = 3;

/** rgba() from a #rrggbb literal — used for the soft icon wells. */
function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export default function InterestsScreen() {
  const t = useT();
  const setPendingInterests = useOnboardingStore((s) => s.setPendingInterests);
  const persistedInterests = useOnboardingStore((s) => s.pendingInterests);
  const [selected, setSelected] = useState<readonly string[]>(
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
      {/* Eight tiles do not fit a short phone under the mascot, so the column
          centres when there is room and scrolls when there is not. */}
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
          <MascotImage size={132} glow="cosmic" />

          <Text className="text-[24px] leading-8 font-bold text-foreground text-center mt-5">
            {t('onboarding.interests.title')}
          </Text>
          <Text className="text-base text-muted-foreground text-center mt-1">
            {t('onboarding.interests.subtitle', { count: MIN_SELECTED })}
          </Text>

          <View
            className="w-full flex-row flex-wrap mt-6"
            style={{ justifyContent: 'space-between', rowGap: 12 }}
          >
            {INTEREST_OPTIONS.map((option) => {
              const isSelected = selected.includes(option.key);
              const label = t(option.labelKey);
              return (
                <Pressable
                  key={option.key}
                  onPress={() => toggle(option.key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={label}
                  style={{ width: '48%' }}
                  className={`rounded-2xl px-3 py-4 items-center active:opacity-80 ${
                    isSelected
                      ? 'bg-primary/5 border-2 border-primary'
                      : 'bg-white border border-primary/10'
                  }`}
                >
                  {/* The well fills in on selection, so the choice is legible
                      from the icon alone rather than only from the border. */}
                  <View
                    className="w-12 h-12 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: isSelected
                        ? option.color
                        : tint(option.color, 0.12),
                    }}
                  >
                    <option.Icon
                      size={24}
                      color={isSelected ? '#FFFFFF' : option.color}
                      strokeWidth={2}
                    />
                  </View>

                  <Text
                    className={`text-sm text-center mt-2 ${
                      isSelected
                        ? 'text-primary font-semibold'
                        : 'text-foreground font-medium'
                    }`}
                    numberOfLines={2}
                  >
                    {label}
                  </Text>

                  {isSelected && (
                    <View className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary items-center justify-center">
                      <Check size={12} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* How far off the minimum is, without making the child count tiles. */}
          <View className="flex-row items-center gap-2 mt-5">
            {Array.from({ length: MIN_SELECTED }).map((_, i) => (
              <View
                key={i}
                className={`h-1.5 rounded-full ${
                  i < selected.length ? 'w-6 bg-primary' : 'w-3 bg-primary/15'
                }`}
              />
            ))}
          </View>
          <Text
            className={`text-sm text-center mt-2 ${
              canContinue ? 'text-primary font-medium' : 'text-muted-foreground'
            }`}
          >
            {canContinue
              ? t('onboarding.interests.ready')
              : t('onboarding.interests.selected', { count: selected.length })}
          </Text>

          <View className="w-full mt-5">
            <PrimaryButton
              onPress={handleContinue}
              disabled={!canContinue}
              accessibilityLabel={t('common.continue')}
            >
              {t('common.continue')}
            </PrimaryButton>
          </View>
        </View>
      </ScrollView>
    </ScreenGradient>
  );
}
