import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MoodValue } from '@/api/endpoints/mood';
import { AchievementsCard } from '@/components/gamification/achievements-card';
import { RecentRewardsCard } from '@/components/gamification/recent-rewards-card';
import { WeeklyActivityCard } from '@/components/gamification/weekly-activity-card';
import { useSetTodayMood, useTodayMood } from '@/hooks/use-mood';
import { useChildStore } from '@/store/child';

// Figma node 9:18782 — CompanionHome (age 14+, dark navy gradient)

// ── Parked mock sections ─────────────────────────────────────────────────────
// Daily goals, weekly focus, the 2×2 action grid, focus mode and the weekly
// streak strip were all hard-coded placeholders — they showed the same numbers
// to every child and none of them had a backend. They are kept here (and their
// JSX below) so they can come back the moment there is real data behind them.
// Their slot on the dashboard now holds the live gamification cards.
//
// const MOCK_STREAK = 5;
// const WEEK_DAYS = ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya'] as const;
// const WEEK_DONE = [true, true, true, true, true, false, false];

// Parked with the rest: these four read as facts about the child ("DTM ball
// 18.5", "Stress 5") while being the same constants for everyone. Restore only
// once each number has a real source.
// interface TopStat {
//   key: string;
//   value: string;
//   label: string;
// }
//
// const TOP_STATS: ReadonlyArray<TopStat> = [
//   { key: 'dtm', value: '18.5', label: 'DTM ball' },
//   { key: 'ielts', value: '6.0', label: 'IELTS' },
//   { key: 'fokus', value: '85%', label: 'Fokus' },
//   { key: 'stress', value: '5', label: 'Stress' },
// ];

// interface DailyGoal {
//   key: string;
//   title: string;
//   category: string;
//   done: number;
//   total: number;
// }
//
// const DAILY_GOALS: ReadonlyArray<DailyGoal> = [
//   { key: 'dtm_math', title: 'DTM Matematika - 10 savol', category: 'DTM', done: 3, total: 10 },
//   { key: 'ielts_read', title: 'IELTS Reading mashq', category: 'IELTS', done: 0, total: 1 },
//   { key: 'fizika', title: 'Fizika - Mexanika', category: 'Fan', done: 1, total: 1 },
// ];
//
// interface FocusSubject {
//   key: string;
//   label: string;
//   hours: string;
//   color: string;
//   percent: number;
// }
//
// const FOCUS_SUBJECTS: ReadonlyArray<FocusSubject> = [
//   { key: 'dtm', label: 'DTM Tayyorgarlik', hours: '2.5 soat', color: '#2563EB', percent: 0.72 },
//   { key: 'ielts', label: 'IELTS Practice', hours: '1.5 soat', color: '#8200DB', percent: 0.45 },
//   { key: 'kasb', label: 'Kasb tanlash', hours: '', color: '#FB64B6', percent: 0.30 },
// ];
//
// interface ActionCard {
//   key: string;
//   label: string;
//   sublabel: string;
//   Icon: typeof MessageCircle;
//   iconColor: string;
//   gradientColors: readonly [string, string];
//   href: '/(main)/dtm' | '/(main)/(tabs)/chat' | '/(main)/lesson-help' | '/(main)/library';
// }
//
// const ACTION_CARDS: ReadonlyArray<ActionCard> = [
//   {
//     key: 'dtm',
//     label: 'DTM Practice',
//     sublabel: 'Imtihon tayyorligi',
//     Icon: BookOpen,
//     iconColor: '#FFFFFF',
//     gradientColors: ['#2563EB', '#155DFC'],
//     href: '/(main)/dtm',
//   },
//   {
//     key: 'ielts',
//     label: 'IELTS',
//     sublabel: 'Ingliz tili',
//     Icon: MessageCircle,
//     iconColor: '#FFFFFF',
//     gradientColors: ['#8200DB', '#6E11B0'],
//     href: '/(main)/(tabs)/chat',
//   },
//   {
//     key: 'dars',
//     label: 'Dars yordami',
//     sublabel: 'Fanlar bo\'yicha',
//     Icon: PenLine,
//     iconColor: '#FFFFFF',
//     gradientColors: ['#05DF72', '#00A63E'],
//     href: '/(main)/lesson-help',
//   },
//   {
//     key: 'karyera',
//     label: 'Karyera',
//     sublabel: 'Kasb tanlash',
//     Icon: Briefcase,
//     iconColor: '#FFFFFF',
//     gradientColors: ['#FF8904', '#F54900'],
//     href: '/(main)/library',
//   },
// ];

interface Mood {
  key: MoodValue;
  emoji: string;
  label: string;
}

// Five faces, matching the backend enum exactly. The previous three were a
// local placeholder and one of them ("stress") did not exist server-side.
const MOODS: readonly Mood[] = [
  { key: 'great', emoji: '😄', label: 'Ajoyib' },
  { key: 'good', emoji: '🙂', label: 'Yaxshi' },
  { key: 'okay', emoji: '😐', label: "O'rtacha" },
  { key: 'sad', emoji: '😔', label: 'Xafa' },
  { key: 'stressed', emoji: '😣', label: 'Stress' },
];

const SURFACE = 'rgba(255,255,255,0.06)';
const BORDER = 'rgba(96,165,250,0.18)';

export function CompanionHome() {
  const childName = useChildStore((s) => s.child?.name ?? 'Foydalanuvchi');
  // Server-backed, so today's answer survives closing the app.
  const todayMood = useTodayMood();
  const setMood = useSetTodayMood();
  const selectedMood = todayMood.data?.mood ?? null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#020618', '#162456']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.97, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="gap-1 pt-2">
            <Text className="text-[24px] leading-8 font-bold text-white tracking-tight">
              Salom, {childName}
            </Text>
            <Text style={{ color: '#94A3B8', fontSize: 14 }}>
              Bugun maqsadlaringizga erishamiz
            </Text>
          </View>

          {/* The DTM / IELTS / Fokus / Stress row that sat here was removed:
              every figure in it was hard-coded, so it told the child things
              about themselves that were not true. Nothing replaces it until
              there is real data behind those numbers. */}

          {/* Mood selector */}
          <View
            className="rounded-xl"
            style={{ backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, padding: 16 }}
          >
            <Text className="text-sm font-medium text-white mb-3">
              Bugun o'zingizni qanday his qilyapsiz?
            </Text>
            <View className="flex-row justify-between">
              {MOODS.map((m) => {
                const isSel = selectedMood === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setMood.mutate(m.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSel }}
                    accessibilityLabel={m.label}
                    className="rounded-xl items-center flex-1"
                    style={{
                      paddingVertical: 10,
                      marginHorizontal: 2,
                      backgroundColor: isSel ? 'rgba(96,165,250,0.15)' : 'transparent',
                      borderWidth: isSel ? 1 : 0,
                      borderColor: isSel ? '#60A5FA' : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 28 }}>{m.emoji}</Text>
                    <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 4 }}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {selectedMood && (
              <View
                className="mt-3 rounded-lg"
                style={{ backgroundColor: 'rgba(96,165,250,0.10)', padding: 10 }}
              >
                <Text style={{ color: '#CBD5E1', fontSize: 13 }}>
                  {setMood.isError
                    ? "Saqlanmadi — internetni tekshiring."
                    : "Rahmat! DUYO sizning his-tuyg'ularingizni hisobga oladi."}
                </Text>
              </View>
            )}
          </View>

          {/* DUYO Maslahat */}
          <View
            className="rounded-xl overflow-hidden"
            style={{ borderWidth: 1, borderColor: '#6E11B0' }}
          >
            <LinearGradient
              colors={['rgba(130,0,219,0.22)', 'rgba(110,17,176,0.12)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 16 }}
            >
              <View className="flex-row items-center gap-2 mb-2">
                <Sparkles size={18} color="#C27AFF" />
                <Text style={{ color: '#C27AFF', fontSize: 13, fontWeight: '700' }}>
                  DUYO Maslahat
                </Text>
              </View>
              <Text style={{ color: '#E0E7FF', fontSize: 14, lineHeight: 22 }}>
                Matematikada yuqori natija ko'rsatyapsiz. Bugun fizikaga e'tibor bering.
              </Text>
            </LinearGradient>
          </View>

          {/* Live gamification — moved here from the profile tab. Every number
              below comes from the backend: the streak, the XP ledger and the
              badge catalogue. */}
          <WeeklyActivityCard />
          <AchievementsCard />
          <RecentRewardsCard />

          {/* ── Parked mock sections (see the note at the top of this file) ──
          <View
            className="rounded-xl"
            style={{ backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, padding: 16 }}
          >
            <Text className="text-sm font-bold text-white mb-3">
              Bugungi maqsadlar{' '}
              <Text style={{ color: '#94A3B8', fontWeight: '400' }}>
                {completedGoals}/{DAILY_GOALS.length} bajarildi
              </Text>
            </Text>
            <View style={{ gap: 12 }}>
              {DAILY_GOALS.map((goal) => {
                const progress = goal.total > 0 ? goal.done / goal.total : 0;
                const done = goal.done >= goal.total;
                return (
                  <View key={goal.key}>
                    <View className="flex-row items-center justify-between mb-1">
                      <Text style={{ color: '#CBD5E1', fontSize: 13 }}>{goal.title}</Text>
                      <View className="flex-row items-center gap-2">
                        <Text style={{ color: '#94A3B8', fontSize: 11 }}>{goal.category}</Text>
                        <Text style={{ color: done ? '#05DF72' : '#60A5FA', fontSize: 11, fontWeight: '600' }}>
                          {goal.done}/{goal.total}
                        </Text>
                      </View>
                    </View>
                    <View
                      className="rounded-full overflow-hidden"
                      style={{ height: 5, backgroundColor: 'rgba(96,165,250,0.20)' }}
                    >
                      <View
                        style={{
                          height: '100%',
                          width: `${progress * 100}%`,
                          backgroundColor: done ? '#05DF72' : '#60A5FA',
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View
            className="rounded-xl"
            style={{ backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, padding: 16 }}
          >
            <Text className="text-sm font-bold text-white mb-3">Bu haftadagi fokus</Text>
            <View style={{ gap: 10 }}>
              {FOCUS_SUBJECTS.map((s) => (
                <View key={s.key}>
                  <View className="flex-row items-center justify-between mb-1">
                    <Text style={{ color: '#CBD5E1', fontSize: 13 }}>{s.label}</Text>
                    {s.hours !== '' && (
                      <Text style={{ color: '#94A3B8', fontSize: 11 }}>{s.hours}</Text>
                    )}
                  </View>
                  <View
                    className="rounded-full overflow-hidden"
                    style={{ height: 6, backgroundColor: 'rgba(96,165,250,0.15)' }}
                  >
                    <View
                      style={{ height: '100%', width: `${s.percent * 100}%`, backgroundColor: s.color }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {ACTION_CARDS.map((card) => (
              <Pressable
                key={card.key}
                onPress={() => router.push(card.href)}
                accessibilityRole="button"
                accessibilityLabel={card.label}
                className="rounded-xl overflow-hidden active:opacity-80"
                style={{ width: '47.5%' }}
              >
                <LinearGradient
                  colors={card.gradientColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ padding: 18, minHeight: 110, justifyContent: 'space-between' }}
                >
                  <card.Icon size={26} color={card.iconColor} />
                  <View className="mt-3">
                    <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
                      {card.label}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.70)', fontSize: 11, marginTop: 2 }}>
                      {card.sublabel}
                    </Text>
                  </View>
                </LinearGradient>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => router.push('/(main)/(tabs)/chat')}
            accessibilityRole="button"
            accessibilityLabel="Fokus rejimi boshlash"
            className="rounded-xl overflow-hidden active:opacity-80"
          >
            <LinearGradient
              colors={['rgba(37,99,235,0.25)', 'rgba(37,99,235,0.10)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderWidth: 1,
                borderColor: 'rgba(96,165,250,0.30)',
                borderRadius: 12,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View>
                <Text style={{ color: '#60A5FA', fontSize: 13, fontWeight: '700' }}>Fokus rejimi</Text>
                <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>
                  25 daqiqa to'xtovsiz o'qish
                </Text>
              </View>
              <View
                className="rounded-lg items-center justify-center"
                style={{ backgroundColor: '#2563EB', paddingHorizontal: 14, paddingVertical: 7 }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>Boshlash</Text>
              </View>
            </LinearGradient>
          </Pressable>

          <View
            className="rounded-xl"
            style={{ backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, padding: 16 }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ color: '#E0E7FF', fontSize: 14, fontWeight: '700' }}>
                Haftalik progress
              </Text>
              <View
                className="rounded-full flex-row items-center gap-1"
                style={{
                  backgroundColor: 'rgba(5,223,114,0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(5,223,114,0.30)',
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ fontSize: 12 }}>😊</Text>
                <Text style={{ color: '#05DF72', fontSize: 11, fontWeight: '600' }}>Yaxshi</Text>
              </View>
            </View>
            <View className="flex-row justify-between">
              {WEEK_DAYS.map((day, i) => (
                <View key={day} className="items-center gap-2">
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: WEEK_DONE[i]
                        ? '#05DF72'
                        : 'rgba(96,165,250,0.15)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {WEEK_DONE[i] && (
                      <Text style={{ color: '#0A1628', fontSize: 14, fontWeight: '700' }}>✓</Text>
                    )}
                  </View>
                  <Text style={{ color: '#94A3B8', fontSize: 11 }}>{day}</Text>
                </View>
              ))}
            </View>
          </View>
          ── end parked sections ── */}

          {/* Motivatsion quote */}
          <View
            className="rounded-xl items-center"
            style={{
              backgroundColor: SURFACE,
              borderWidth: 1,
              borderColor: BORDER,
              padding: 20,
            }}
          >
            <Text
              style={{
                color: '#94A3B8',
                fontSize: 13,
                fontStyle: 'italic',
                textAlign: 'center',
                lineHeight: 22,
              }}
            >
              "Maqsadga erishish yo'lida har bir qadam muhim"
            </Text>
            <Text style={{ color: '#64748B', fontSize: 12, marginTop: 8 }}>
              Davom eting, siz ajoyib ishlamoqdasiz!
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
