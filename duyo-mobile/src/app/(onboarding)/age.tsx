import { router } from 'expo-router';
import { Compass, Gamepad2, GraduationCap, Minus, Plus, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/text';

import { MascotImage } from '@/components/v2/mascot-image';
import { PrimaryButton } from '@/components/v2/primary-button';
import { ScreenGradient } from '@/components/v2/screen-gradient';
import { useT, type TranslationKey } from '@/i18n';
import { useOnboardingStore } from '@/store/onboarding';

const MIN_AGE = 7;
const MAX_AGE = 16;
const DEFAULT_AGE = 10;
const AGES = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => MIN_AGE + i);

interface Segment {
  key: 'junior' | 'explorer' | 'companion';
  from: number;
  to: number;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  Icon: LucideIcon;
  /** Each age band owns a colour, so the whole screen re-tints as the child
   *  crosses into it — the number, the badge, the ruler — and the change of
   *  band is felt, not just read. */
  colour: string;
}

const SEGMENTS: readonly Segment[] = [
  { key: 'junior', from: 7, to: 10, nameKey: 'onboarding.age.segment.junior', descKey: 'onboarding.age.segment.juniorDesc', Icon: Gamepad2, colour: '#F97316' },
  { key: 'explorer', from: 11, to: 13, nameKey: 'onboarding.age.segment.explorer', descKey: 'onboarding.age.segment.explorerDesc', Icon: Compass, colour: '#2563EB' },
  { key: 'companion', from: 14, to: 16, nameKey: 'onboarding.age.segment.companion', descKey: 'onboarding.age.segment.companionDesc', Icon: GraduationCap, colour: '#8B5CF6' },
];

function segmentOf(age: number): Segment {
  return SEGMENTS.find((s) => age >= s.from && age <= s.to) ?? SEGMENTS[0];
}

/** rgba() from a #rrggbb literal. */
function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export default function AgeScreen() {
  const t = useT();
  const setPendingAge = useOnboardingStore((s) => s.setPendingAge);
  const persistedAge = useOnboardingStore((s) => s.pendingAge);
  const [age, setAge] = useState(persistedAge ?? DEFAULT_AGE);
  const seg = segmentOf(age);

  const handleContinue = () => {
    setPendingAge(age);
    router.push('/(onboarding)/interests');
  };

  return (
    <ScreenGradient>
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
            {t('onboarding.age.title')}
          </Text>
          <Text className="text-base text-muted-foreground text-center mt-1">
            {t('onboarding.age.subtitle')}
          </Text>

          {/* The number, flanked by steppers. Big and coloured by band. */}
          <View className="flex-row items-center justify-center mt-7" style={{ gap: 22 }}>
            <StepButton
              Icon={Minus}
              disabled={age <= MIN_AGE}
              onPress={() => setAge((a) => Math.max(MIN_AGE, a - 1))}
              label={t('onboarding.age.decrease')}
              colour={seg.colour}
            />
            <View className="items-center" style={{ minWidth: 118 }}>
              <Text
                className="font-bold"
                style={{
                  fontSize: 84,
                  lineHeight: 92,
                  color: seg.colour,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {age}
              </Text>
              <Text className="text-sm font-medium -mt-1" style={{ color: seg.colour }}>
                {t('onboarding.age.years')}
              </Text>
            </View>
            <StepButton
              Icon={Plus}
              disabled={age >= MAX_AGE}
              onPress={() => setAge((a) => Math.min(MAX_AGE, a + 1))}
              label={t('onboarding.age.increase')}
              colour={seg.colour}
            />
          </View>

          {/* A ruler of every age, one tap each. Bands are readable from the
              tick colours alone, and the chosen age stands proud. */}
          <View
            className="w-full flex-row items-end justify-between mt-6 px-1"
            accessibilityRole="radiogroup"
          >
            {AGES.map((a) => {
              const s = segmentOf(a);
              const active = a === age;
              return (
                <Pressable
                  key={a}
                  onPress={() => setAge(a)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${a} ${t('onboarding.age.years')}`}
                  hitSlop={6}
                  className="items-center"
                  style={{ width: 28 }}
                >
                  <View
                    className="rounded-full"
                    style={{
                      width: active ? 12 : 8,
                      height: active ? 12 : 8,
                      backgroundColor: active ? s.colour : tint(s.colour, 0.28),
                      borderWidth: active ? 2 : 0,
                      borderColor: '#FFFFFF',
                    }}
                  />
                  <Text
                    className={active ? 'text-xs font-bold mt-1.5' : 'text-[11px] mt-1.5'}
                    style={{ color: active ? s.colour : '#94A3B8' }}
                  >
                    {a}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Band card — what this age unlocks. */}
          <View
            className="w-full flex-row items-center rounded-2xl px-4 py-3.5 mt-5"
            style={{
              backgroundColor: tint(seg.colour, 0.1),
              borderWidth: 1,
              borderColor: tint(seg.colour, 0.28),
              gap: 12,
            }}
          >
            <View
              className="w-11 h-11 rounded-full items-center justify-center"
              style={{ backgroundColor: seg.colour }}
            >
              <seg.Icon size={22} color="#FFFFFF" strokeWidth={2.2} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Text className="text-base font-bold text-foreground">
                  {t(seg.nameKey)}
                </Text>
                <View
                  className="rounded-full px-2 py-0.5"
                  style={{ backgroundColor: tint(seg.colour, 0.18) }}
                >
                  <Text className="text-[11px] font-semibold" style={{ color: seg.colour }}>
                    {seg.from}–{seg.to}
                  </Text>
                </View>
              </View>
              <Text className="text-[13px] text-muted-foreground mt-0.5">
                {t(seg.descKey)}
              </Text>
            </View>
          </View>

          <View className="w-full mt-6">
            <PrimaryButton
              onPress={handleContinue}
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

function StepButton({
  Icon,
  disabled,
  onPress,
  label,
  colour,
}: {
  Icon: LucideIcon;
  disabled: boolean;
  onPress: () => void;
  label: string;
  colour: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className="items-center justify-center rounded-full active:opacity-70"
      style={{
        width: 52,
        height: 52,
        backgroundColor: disabled ? 'rgba(148, 163, 184, 0.12)' : tint(colour, 0.12),
        borderWidth: 1.5,
        borderColor: disabled ? 'rgba(148, 163, 184, 0.25)' : tint(colour, 0.35),
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Icon size={22} color={disabled ? '#94A3B8' : colour} strokeWidth={2.4} />
    </Pressable>
  );
}
