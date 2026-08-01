import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { DarkCard } from '@/components/v2/dark/dark-card';
import { ScreenDark } from '@/components/v2/dark/screen-dark';
import { StatRow } from '@/components/v2/dark/stat-row';
import { XPBadge } from '@/components/v2/dark/xp-badge';
import { MascotImage } from '@/components/v2/mascot-image';
import { useBalls, useStreak } from '@/hooks/use-gamification';
import { useTamagochi } from '@/hooks/use-tamagochi';
import type { TamagochiState } from '@/api/endpoints/tamagochi';
import { useChildStore } from '@/store/child';

// Emoji/label/color are static config; percent comes from the live tamagochi
// metric of the matching key (Concept §4).
const STAT_CONFIG: ReadonlyArray<{
  key: keyof TamagochiState;
  emoji: string;
  label: string;
  color: 'gold' | 'blue' | 'pink' | 'green';
}> = [
  { key: 'energy', emoji: '⚡', label: 'Energiya', color: 'gold' },
  { key: 'learning', emoji: '🧠', label: "O'rganish", color: 'blue' },
  { key: 'joy', emoji: '💖', label: 'Quvonch', color: 'pink' },
  { key: 'health', emoji: '⭐', label: "Sog'liq", color: 'green' },
];

interface ActionCard {
  key: string;
  emoji: string;
  label: string;
  colors: readonly [string, string];
  href: '/(main)/(tabs)/chat' | '/(main)/library' | '/(main)/inventory';
}

const ACTION_CARDS: ReadonlyArray<ActionCard> = [
  {
    key: 'chat',
    emoji: '🎨',
    label: 'DUYO bilan gaplash',
    colors: ['#C27AFF', '#FB64B6'],
    href: '/(main)/(tabs)/chat',
  },
  {
    key: 'poem',
    emoji: '📚',
    label: "She'r o'qish",
    colors: ['#51A2FF', '#00D3F3'],
    href: '/(main)/library',
  },
  {
    key: 'story',
    emoji: '🎵',
    label: 'Ertak tinglash',
    colors: ['#05DF72', '#00D492'],
    href: '/(main)/library',
  },
  {
    key: 'game',
    emoji: '🎮',
    label: "O'yinlar",
    colors: ['#FF8904', '#FF6467'],
    href: '/(main)/inventory',
  },
];

export function JuniorHome() {
  const childName = useChildStore((s) => s.child?.name ?? 'Dunyo');

  const balls = useBalls();
  const streak = useStreak();
  const tamagochi = useTamagochi();

  const level = balls.data?.level ?? 1;
  const balance = balls.data?.balance ?? 0;
  const nextThreshold = balls.data?.next_threshold ?? null;
  const currentThreshold = balls.data?.current_threshold ?? 0;
  const ballsToNext = balls.data?.balls_to_next ?? null;
  const isMaxLevel = nextThreshold === null;
  const xpProgress =
    nextThreshold !== null && nextThreshold > currentThreshold
      ? (balance - currentThreshold) / (nextThreshold - currentThreshold)
      : 1;
  const currentStreak = streak.data?.current_streak ?? 0;

  return (
    <ScreenDark>
      <ScrollView
        contentContainerStyle={{ padding: 24, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center gap-1">
          <Text className="text-4xl">👋</Text>
          <Text className="text-[24px] leading-8 font-bold text-primary dark:text-dark-heading text-center tracking-tight">
            Salom, {childName}!
          </Text>
          <Text className="text-xl text-muted-foreground dark:text-dark-subtitle text-center">
            Bugun nima qilamiz?
          </Text>
        </View>

        <DarkCard glow="purple" className="items-center">
          <MascotImage size={200} glow="cosmic" />
          <View className="items-center mt-2 gap-2">
            <Text className="text-2xl font-bold text-muted-foreground dark:text-dark-subtitle">DUYO</Text>
            <View className="bg-neon-purple rounded-md px-6 py-2">
              <Text className="text-lg font-medium text-dark-bg-to">
                Level {level}
              </Text>
            </View>
          </View>
        </DarkCard>

        <DarkCard glow="magenta">
          <Text className="text-xl font-bold text-neon-pink text-center mb-6">
            DUYO'ning holati
          </Text>
          <View className="flex-row flex-wrap gap-x-4 gap-y-4">
            {STAT_CONFIG.map((stat) => (
              <View key={stat.key} className="w-[45%]">
                <StatRow
                  emoji={stat.emoji}
                  label={stat.label}
                  color={stat.color}
                  percent={tamagochi.data?.[stat.key] ?? 0}
                />
              </View>
            ))}
          </View>
        </DarkCard>

        <DarkCard glow="orange">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1">
              <Text className="text-5xl">🔥</Text>
              <View>
                <Text className="text-3xl font-bold text-neon-orange">
                  {currentStreak} kun!
                </Text>
                <Text className="text-sm text-neon-orange/80">
                  Seriya davom etmoqda!
                </Text>
              </View>
            </View>
            <Text className="text-4xl">🎉</Text>
          </View>
        </DarkCard>

        <DarkCard glow="green">
          <View className="flex-row items-center gap-3 mb-6">
            <Text className="text-4xl">🎯</Text>
            <Text className="text-xl font-bold text-neon-green">
              Bugungi vazifa
            </Text>
          </View>
          <View className="bg-neon-green/10 rounded-lg p-4 items-center gap-2">
            <Text className="text-lg font-medium text-foreground dark:text-dark-text text-center">
              DUYO bilan 5 daqiqa gaplash
            </Text>
            <XPBadge amount={50} />
          </View>
          <Pressable
            onPress={() => router.push('/(main)/(tabs)/chat')}
            accessibilityRole="button"
            accessibilityLabel="Boshlash"
            className="mt-4 bg-neon-green rounded-md h-16 items-center justify-center"
          >
            <Text className="text-xl font-medium text-dark-bg-to">
              Boshlash!
            </Text>
          </Pressable>
        </DarkCard>

        <View className="flex-row flex-wrap gap-3">
          {ACTION_CARDS.map((card) => (
            <Pressable
              key={card.key}
              onPress={() => router.push(card.href)}
              accessibilityRole="button"
              accessibilityLabel={card.label}
              className="w-[48%] rounded-xl overflow-hidden"
              style={{
                shadowColor: '#000',
                shadowOpacity: 0.1,
                shadowRadius: 7.5,
                shadowOffset: { width: 0, height: 10 },
                elevation: 4,
              }}
            >
              <LinearGradient
                colors={card.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  padding: 24,
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 176,
                  opacity: 0.9,
                }}
              >
                <Text className="text-6xl">{card.emoji}</Text>
                <Text className="text-lg font-bold text-white text-center">
                  {card.label}
                </Text>
              </LinearGradient>
            </Pressable>
          ))}
        </View>

        <DarkCard glow="blue">
          <View className="flex-row items-center gap-3 mb-6">
            <Text className="text-3xl">🏆</Text>
            <Text className="text-2xl font-bold text-neon-cyan">
              {balance} XP
            </Text>
          </View>
          <View className="h-6 bg-glow-blue/30 rounded-full overflow-hidden">
            <LinearGradient
              colors={['#2B7FFF', '#AD46FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ height: '100%', width: `${xpProgress * 100}%` }}
            />
          </View>
          <Text className="text-center text-neon-cyan font-bold mt-4">
            {isMaxLevel
              ? 'Eng yuqori daraja! 🎉'
              : `Keyingi darajaga ${ballsToNext} XP qoldi!`}
          </Text>
        </DarkCard>

        <DarkCard glow="pink" className="items-center gap-3">
          <Text className="text-4xl">🌟</Text>
          <Text className="text-xl font-bold text-muted-foreground dark:text-dark-subtitle text-center">
            Sen ajoyibsan! Davom et!
          </Text>
        </DarkCard>
      </ScrollView>
    </ScreenDark>
  );
}
