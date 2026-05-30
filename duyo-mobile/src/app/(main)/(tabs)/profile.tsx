import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Award, Crown, Flame, Settings as SettingsIcon, Star, Trophy } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DarkCard } from '@/components/v2/dark/dark-card';
import { ProgressBar } from '@/components/v2/dark/progress-bar';
import { MascotImage } from '@/components/v2/mascot-image';
import { useChildStore } from '@/store/child';
import { useIsDark } from '@/store/theme';

// Static mock per Bosqich B beta (gamification backend = Faza 1)
const MOCK_LEVEL_NAME = "Do'st";
const MOCK_NEXT_LEVEL_NAME = "Sirdosh";
const MOCK_XP = 450;
const MOCK_XP_TO_NEXT = 50;
const MOCK_XP_TOTAL_FOR_LEVEL = 500;
const MOCK_STREAK = 5;
const MOCK_ACHIEVEMENTS_COUNT = 6;
const MOCK_AVG_MINUTES = 23;

const WEEK_DAYS = ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya'] as const;
const WEEK_DONE = [true, true, true, true, true, false, false];
// Bar heights 0-1 for haftalik faollik (Mon-Fri active, weekends lower)
const WEEK_BAR_HEIGHTS = [0.85, 0.60, 0.90, 0.70, 0.80, 0.20, 0.10];

const ACHIEVEMENTS = [
  { key: 'first_chat', emoji: '🎯', label: 'Birinchi suhbat' },
  { key: 'streak', emoji: '🔥', label: '5 kunlik seriya' },
  { key: 'explorer', emoji: '🚀', label: 'Izlanuvchi' },
  { key: 'level_up', emoji: '⭐', label: 'Daraja oshish' },
  { key: 'curious', emoji: '🧠', label: 'Qiziquvchi' },
  { key: 'duyo_dust', emoji: '💛', label: "DUYO do'sti" },
] as const;

const RECENT_REWARDS = [
  { key: 'mission', emoji: '🎯', label: 'Bugungi missiya', xp: 50 },
  { key: 'poem', emoji: '📚', label: "She'r o'qish", xp: 25 },
  { key: 'streak', emoji: '🔥', label: '5 kunlik seriya', xp: 100 },
] as const;

export default function ProfileScreen() {
  const isDark = useIsDark();
  const child = useChildStore((s) => s.child);
  const childName = child?.name ?? 'Foydalanuvchi';
  const childAge = child?.age;

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
                ⭐ Level 2 · {MOCK_LEVEL_NAME}
              </Text>
            </View>
          </DarkCard>

          <DarkCard>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm text-muted-foreground dark:text-dark-muted">
                Keyingi daraja: {MOCK_NEXT_LEVEL_NAME}
              </Text>
              <Text className="text-sm font-bold text-neon-cyan">
                {MOCK_XP}/{MOCK_XP_TOTAL_FOR_LEVEL} XP
              </Text>
            </View>
            <ProgressBar value={MOCK_XP / MOCK_XP_TOTAL_FOR_LEVEL} color="blue" />
            <Text className="text-xs text-muted-foreground dark:text-dark-muted text-right mt-2">
              {MOCK_XP_TO_NEXT} XP keyingi darajaga
            </Text>
          </DarkCard>

          <View className="flex-row gap-3">
            <DarkCard className="flex-1 items-center">
              <Flame size={28} color="#FF8904" />
              <Text className="text-2xl font-bold text-foreground dark:text-dark-text mt-2">
                {MOCK_STREAK}
              </Text>
              <Text className="text-xs text-muted-foreground dark:text-dark-muted">Kun seriya</Text>
            </DarkCard>
            <DarkCard className="flex-1 items-center">
              <Star size={28} color="#FDC700" />
              <Text className="text-2xl font-bold text-foreground dark:text-dark-text mt-2">
                {MOCK_XP}
              </Text>
              <Text className="text-xs text-muted-foreground dark:text-dark-muted">Jami XP</Text>
            </DarkCard>
            <DarkCard className="flex-1 items-center">
              <Trophy size={28} color="#FB64B6" />
              <Text className="text-2xl font-bold text-foreground dark:text-dark-text mt-2">
                {MOCK_ACHIEVEMENTS_COUNT}
              </Text>
              <Text className="text-xs text-muted-foreground dark:text-dark-muted">Yutuqlar</Text>
            </DarkCard>
          </View>

          {/* Week streak calendar */}
          <DarkCard>
            <View className="flex-row justify-between mb-3">
              {WEEK_DAYS.map((day, i) => (
                <View key={day} className="items-center gap-1">
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: WEEK_DONE[i]
                        ? '#60A5FA'
                        : 'rgba(96,165,250,0.12)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {WEEK_DONE[i] && (
                      <Text style={{ color: '#0A1628', fontSize: 14, fontWeight: '700' }}>✓</Text>
                    )}
                  </View>
                  <Text className="text-xs text-muted-foreground dark:text-dark-muted">{day}</Text>
                </View>
              ))}
            </View>
            <Text className="text-sm text-muted-foreground dark:text-dark-muted text-center">
              {MOCK_STREAK} kunlik seriya davom etmoqda!
            </Text>
          </DarkCard>

          {/* Haftalik faollik + o'rtacha kunlik */}
          <DarkCard>
            <View className="flex-row items-center gap-2 mb-4">
              <Star size={18} color="#60A5FA" />
              <Text className="text-base font-bold text-foreground dark:text-dark-text">
                Haftalik faollik
              </Text>
            </View>
            <View className="flex-row items-end justify-between" style={{ height: 64 }}>
              {WEEK_DAYS.map((day, i) => (
                <View key={day} className="items-center gap-1 flex-1">
                  <View
                    style={{
                      width: 20,
                      height: Math.max(6, WEEK_BAR_HEIGHTS[i] * 56),
                      borderRadius: 4,
                      backgroundColor: WEEK_DONE[i] ? '#60A5FA' : 'rgba(96,165,250,0.20)',
                    }}
                  />
                  <Text
                    className="text-muted-foreground dark:text-dark-muted"
                    style={{ fontSize: 10 }}
                  >
                    {day}
                  </Text>
                </View>
              ))}
            </View>
            <View className="flex-row items-center gap-1 mt-3">
              <Text className="text-base">⚡</Text>
              <Text className="text-xs text-muted-foreground dark:text-dark-muted">
                O'rtacha kunlik: {MOCK_AVG_MINUTES} daqiqa
              </Text>
            </View>
          </DarkCard>

          <DarkCard>
            <View className="flex-row items-center gap-2 mb-4">
              <Award size={20} color="#FDC700" />
              <Text className="text-lg font-bold text-foreground dark:text-dark-text">Yutuqlar</Text>
            </View>
            <View className="flex-row flex-wrap gap-3">
              {ACHIEVEMENTS.map((a) => (
                <View
                  key={a.key}
                  className="w-[30%] bg-neon-yellow/10 rounded-lg p-3 items-center gap-1"
                >
                  <Text className="text-3xl">{a.emoji}</Text>
                  <Text className="text-xs text-foreground dark:text-dark-text text-center">
                    {a.label}
                  </Text>
                </View>
              ))}
            </View>
          </DarkCard>

          <DarkCard>
            <Text className="text-lg font-bold text-foreground dark:text-dark-text mb-3">
              Oxirgi mukofotlar
            </Text>
            <View className="gap-3">
              {RECENT_REWARDS.map((r) => (
                <View
                  key={r.key}
                  className="flex-row items-center justify-between bg-secondary dark:bg-card dark:bg-dark-surface-soft rounded-lg px-3 py-3"
                >
                  <View className="flex-row items-center gap-3 flex-1">
                    <Text className="text-2xl">{r.emoji}</Text>
                    <Text className="text-base text-foreground dark:text-dark-text">{r.label}</Text>
                  </View>
                  <Text className="text-sm font-bold text-neon-yellow">
                    +{r.xp} XP
                  </Text>
                </View>
              ))}
            </View>
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
