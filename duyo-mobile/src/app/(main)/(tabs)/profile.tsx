import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Crown, Flame, Settings as SettingsIcon, Star, Trophy } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DarkCard } from '@/components/v2/dark/dark-card';
import { ProgressBar } from '@/components/v2/dark/progress-bar';
import { MascotImage } from '@/components/v2/mascot-image';
import {
  useAchievements,
  useBalls,
  useBallsHistory,
  useStreak,
} from '@/hooks/use-gamification';
import { buildWeeklyActivity } from '@/lib/weekly-activity';
import { useChildStore } from '@/store/child';
import { useIsDark } from '@/store/theme';

// Achievements, weekly activity and recent rewards moved to the dashboard
// (screens/home/companion-home.tsx) where they are the main content. What
// stays here is the identity card: who the child is, their level and streak.

export default function ProfileScreen() {
  const isDark = useIsDark();
  const child = useChildStore((s) => s.child);
  const childName = child?.name ?? 'Foydalanuvchi';
  const childAge = child?.age;

  const balls = useBalls();
  const streak = useStreak();
  const achievements = useAchievements();
  const history = useBallsHistory();

  const balance = balls.data?.balance ?? 0;
  const level = balls.data?.level ?? 1;
  const levelName = balls.data?.level_name ?? '—';
  const currentThreshold = balls.data?.current_threshold ?? 0;
  const nextThreshold = balls.data?.next_threshold ?? null;
  const ballsToNext = balls.data?.balls_to_next ?? null;
  const isMaxLevel = nextThreshold === null;
  // Progress within the current level segment (floor → next threshold).
  const levelProgress =
    nextThreshold !== null && nextThreshold > currentThreshold
      ? (balance - currentThreshold) / (nextThreshold - currentThreshold)
      : 1;
  const currentStreak = streak.data?.current_streak ?? 0;
  const earnedCount = (achievements.data ?? []).filter((a) => a.earned).length;
  // The week strip below marks the days the child actually showed up.
  const week = buildWeeklyActivity(streak.data, history.data);

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' }]} />
      <LinearGradient
        colors={['rgba(96, 165, 250, 0.20)', 'rgba(252, 211, 77, 0.15)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row justify-end">
            <Pressable
              onPress={() => router.push('/(main)/settings')}
              accessibilityRole="button"
              accessibilityLabel="Sozlamalar"
              className="w-10 h-10 rounded-md items-center justify-center bg-card dark:bg-dark-surface border border-neon-blue/20"
            >
              <SettingsIcon size={20} color="#94A3B8" />
            </Pressable>
          </View>

          <DarkCard className="items-center">
            <MascotImage size={180} glow="cosmic" />
            <Text className="text-2xl font-bold text-foreground dark:text-dark-text mt-2">
              {childName}
            </Text>
            {childAge !== undefined && (
              <Text className="text-sm text-muted-foreground dark:text-dark-muted">{childAge} yosh</Text>
            )}
            <View className="bg-neon-purple rounded-md px-4 py-1.5 mt-3">
              <Text className="text-sm font-medium text-dark-bg-to">
                ⭐ Level {level} · {levelName}
              </Text>
            </View>
          </DarkCard>

          <DarkCard>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm text-muted-foreground dark:text-dark-muted">
                {isMaxLevel ? 'Eng yuqori daraja' : 'Keyingi daraja'}
              </Text>
              <Text className="text-sm font-bold text-neon-cyan">
                {isMaxLevel
                  ? `${balance} XP`
                  : `${balance}/${nextThreshold} XP`}
              </Text>
            </View>
            <ProgressBar value={levelProgress} color="blue" />
            <Text className="text-xs text-muted-foreground dark:text-dark-muted text-right mt-2">
              {isMaxLevel
                ? "Barcha darajalar ochilgan 🎉"
                : `${ballsToNext} XP keyingi darajaga`}
            </Text>
          </DarkCard>

          <View className="flex-row gap-3">
            <DarkCard className="flex-1 items-center">
              <Flame size={28} color="#FF8904" />
              <Text className="text-2xl font-bold text-foreground dark:text-dark-text mt-2">
                {currentStreak}
              </Text>
              <Text className="text-xs text-muted-foreground dark:text-dark-muted">Kun seriya</Text>
            </DarkCard>
            <DarkCard className="flex-1 items-center">
              <Star size={28} color="#FDC700" />
              <Text className="text-2xl font-bold text-foreground dark:text-dark-text mt-2">
                {balance}
              </Text>
              <Text className="text-xs text-muted-foreground dark:text-dark-muted">Jami XP</Text>
            </DarkCard>
            <DarkCard className="flex-1 items-center">
              <Trophy size={28} color="#FB64B6" />
              <Text className="text-2xl font-bold text-foreground dark:text-dark-text mt-2">
                {earnedCount}
              </Text>
              <Text className="text-xs text-muted-foreground dark:text-dark-muted">Yutuqlar</Text>
            </DarkCard>
          </View>

          {/* Week streak calendar */}
          <DarkCard>
            <View className="flex-row justify-between mb-3">
              {week.days.map((day) => (
                <View key={day.label} className="items-center gap-1">
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: day.active
                        ? '#60A5FA'
                        : 'rgba(96,165,250,0.12)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: day.isToday ? 2 : 0,
                      borderColor: '#60A5FA',
                    }}
                  >
                    {day.active && (
                      <Text style={{ color: '#0A1628', fontSize: 14, fontWeight: '700' }}>✓</Text>
                    )}
                  </View>
                  <Text className="text-xs text-muted-foreground dark:text-dark-muted">
                    {day.label}
                  </Text>
                </View>
              ))}
            </View>
            <Text className="text-sm text-muted-foreground dark:text-dark-muted text-center">
              {currentStreak > 0
                ? `${currentStreak} kunlik seriya davom etmoqda!`
                : 'Seriyani boshlash uchun DUYO bilan suhbatlashing'}
            </Text>
          </DarkCard>

          <Pressable
            onPress={() => router.push('/(main)/subscription')}
            accessibilityRole="button"
            accessibilityLabel="Premium'ga o'tish"
            className="bg-gradient-to-r rounded-xl overflow-hidden"
          >
            <LinearGradient
              colors={['#FDC700', '#FF8904']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: 16,
                paddingHorizontal: 24,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Crown size={20} color="#0A1628" />
              <Text className="text-base font-bold text-dark-bg-to">
                Premium'ga o'tish
              </Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
