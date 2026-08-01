import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Award, BookOpen, MessageCircle, Package, PenLine } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MascotImage } from '@/components/v2/mascot-image';
import { useBalls, useStreak } from '@/hooks/use-gamification';
import { useTamagochi } from '@/hooks/use-tamagochi';
import type { TamagochiState } from '@/api/endpoints/tamagochi';
import { useChildStore } from '@/store/child';
import { useIsDark } from '@/store/theme';

// Strict Figma fidelity — Figma node 9:21565 (ChildHome, Explorer age 11-13)
// Background: linear-gradient(104deg, rgba(96,165,250,0.20), rgba(252,211,77,0.20))

// Emoji/label are static config; the percentage comes from the live
// tamagochi metric of the same key (Concept §4).
const STAT_CONFIG: ReadonlyArray<{
  key: keyof TamagochiState;
  emoji: string;
  label: string;
}> = [
  { key: 'energy', emoji: '⚡', label: 'Energiya' },
  { key: 'learning', emoji: '🧠', label: "O'rganish" },
  { key: 'joy', emoji: '💖', label: 'Quvonch' },
  { key: 'health', emoji: '⭐', label: "Sog'liq" },
];

interface ChildActionCard {
  key: string;
  Icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  iconColor: string;
  href:
    | '/(main)/(tabs)/chat'
    | '/(main)/library'
    | '/(main)/inventory'
    | '/(main)/lesson-help';
}

const ACTION_CARDS: ReadonlyArray<ChildActionCard> = [
  {
    key: 'chat',
    Icon: MessageCircle,
    label: 'DUYO bilan gaplash',
    iconColor: '#60A5FA',
    href: '/(main)/(tabs)/chat',
  },
  {
    key: 'poem',
    Icon: BookOpen,
    label: "She'r o'qish",
    iconColor: '#FDC700',
    href: '/(main)/library',
  },
  {
    key: 'lessons',
    Icon: PenLine,
    label: 'Dars yordami',
    iconColor: '#05DF72',
    href: '/(main)/lesson-help',
  },
  {
    key: 'inventory',
    Icon: Package,
    label: 'Inventar',
    iconColor: '#FB64B6',
    href: '/(main)/inventory',
  },
];

export function ChildHome() {
  const childName = useChildStore((s) => s.child?.name ?? 'Foydalanuvchi');
  const isDark = useIsDark();

  const balls = useBalls();
  const streak = useStreak();
  const tamagochi = useTamagochi();

  const levelName = balls.data?.level_name ?? '—';
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
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' }]} />
      <LinearGradient
        colors={['rgba(96, 165, 250, 0.20)', 'rgba(252, 211, 77, 0.20)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.97, y: 0.24 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="pt-4 items-center gap-2">
            <Text className="text-[24px] leading-8 font-bold text-foreground dark:text-dark-text text-center tracking-tight">
              Salom, {childName}!
            </Text>
            <Text className="text-base text-muted-foreground dark:text-dark-muted text-center">
              Bugun ajoyib kunni boshlaymiz
            </Text>
          </View>

          <View
            className="bg-card dark:bg-dark-surface rounded-xl border border-neon-blue/20"
            style={{ padding: 25 }}
          >
            <View className="items-center mb-6">
              <View style={{ width: 270, height: 270 }}>
                <MascotImage size={270} glow="cosmic" />
              </View>
            </View>

            <View className="flex-row flex-wrap" style={{ gap: 16 }}>
              {STAT_CONFIG.map((stat) => {
                const percent = tamagochi.data?.[stat.key] ?? 0;
                return (
                  <View
                    key={stat.key}
                    className="flex-row items-center gap-2"
                    style={{ width: '47%' }}
                  >
                    <Text className="text-xl">{stat.emoji}</Text>
                    <View className="flex-1">
                      <Text className="text-xs text-muted-foreground dark:text-dark-muted leading-4">
                        {stat.label}
                      </Text>
                      <View
                        className="bg-neon-blue/20 rounded-full overflow-hidden mt-1"
                        style={{ height: 8 }}
                      >
                        <View
                          className="bg-neon-blue h-full"
                          style={{ width: `${percent}%` }}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View
            className="bg-card dark:bg-dark-surface rounded-xl border border-neon-blue/20"
            style={{ padding: 16 }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <Award size={20} color="#60A5FA" />
                <Text className="text-base font-medium text-foreground dark:text-dark-text">
                  {levelName} • Level {level}
                </Text>
              </View>
              <Text className="text-sm text-muted-foreground dark:text-dark-muted">{balance} XP</Text>
            </View>
            <View
              className="bg-neon-blue/20 rounded-full overflow-hidden"
              style={{ height: 12 }}
            >
              <View
                className="bg-neon-blue h-full"
                style={{ width: `${xpProgress * 100}%` }}
              />
            </View>
            <Text className="text-xs text-muted-foreground dark:text-dark-muted text-right mt-3">
              {isMaxLevel
                ? 'Eng yuqori daraja 🎉'
                : `${ballsToNext} XP keyingi darajaga`}
            </Text>
          </View>

          <View
            className="rounded-xl overflow-hidden"
            style={{ borderWidth: 1, borderColor: '#9F2D00' }}
          >
            <LinearGradient
              colors={['rgba(68, 19, 6, 0.50)', 'rgba(67, 32, 4, 0.50)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ padding: 16 }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1">
                  <Text className="text-3xl">🔥</Text>
                  <View>
                    <Text className="text-lg font-bold text-foreground dark:text-dark-text tracking-tight">
                      {currentStreak} kunlik seriya!
                    </Text>
                    <Text className="text-sm text-muted-foreground dark:text-dark-muted">
                      Davom eting!
                    </Text>
                  </View>
                </View>
                <View
                  className="rounded-md"
                  style={{
                    backgroundColor: 'rgba(126, 42, 12, 0.50)',
                    paddingHorizontal: 9,
                    paddingVertical: 3,
                  }}
                >
                  <Text className="text-xs font-medium" style={{ color: '#FFB86A' }}>
                    Ajoyib!
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View
            className="bg-card dark:bg-dark-surface rounded-xl border border-neon-blue/20"
            style={{ padding: 25 }}
          >
            <View className="flex-row items-center gap-3 mb-10">
              <Text className="text-xl">🎯</Text>
              <Text className="text-lg font-bold text-foreground dark:text-dark-text tracking-tight">
                Bugungi missiya
              </Text>
            </View>
            <View
              className="rounded-lg flex-row items-center justify-between"
              style={{
                backgroundColor: 'rgba(252, 211, 77, 0.10)',
                paddingHorizontal: 12,
                paddingVertical: 12,
              }}
            >
              <Text className="text-sm text-foreground dark:text-dark-text">
                5 daqiqa inglizcha gaplash
              </Text>
              <View
                className="rounded-md border border-neon-blue/20"
                style={{ paddingHorizontal: 9, paddingVertical: 3 }}
              >
                <Text className="text-xs font-medium text-foreground dark:text-dark-text">
                  +50 XP
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => router.push('/(main)/(tabs)/chat')}
              accessibilityRole="button"
              accessibilityLabel="Boshlash"
              className="rounded-md bg-neon-blue mt-3 active:opacity-80"
              style={{ height: 36 }}
            >
              <Text
                className="text-sm font-medium text-center"
                style={{ color: '#0A1628', lineHeight: 36 }}
              >
                Boshlash
              </Text>
            </Pressable>
          </View>

          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {ACTION_CARDS.map((card) => (
              <Pressable
                key={card.key}
                onPress={() => router.push(card.href)}
                accessibilityRole="button"
                accessibilityLabel={card.label}
                className="bg-card dark:bg-dark-surface rounded-xl border border-neon-blue/20 active:opacity-80"
                style={{
                  width: '47%',
                  padding: 25,
                  gap: 32,
                  minHeight: 138,
                }}
              >
                <card.Icon size={32} color={card.iconColor} />
                <Text className="text-base font-medium text-foreground dark:text-dark-text">
                  {card.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
