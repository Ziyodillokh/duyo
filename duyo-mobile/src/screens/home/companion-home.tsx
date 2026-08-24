import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MoodValue } from '@/api/endpoints/mood';
import { AchievementsCard } from '@/components/gamification/achievements-card';
import { RecentRewardsCard } from '@/components/gamification/recent-rewards-card';
import { WeeklyActivityCard } from '@/components/gamification/weekly-activity-card';
import { useSetTodayMood, useTodayMood } from '@/hooks/use-mood';
import { glass } from '@/lib/glass';
import { useChildStore } from '@/store/child';

// Figma node 9:18782 — CompanionHome (age 14+, dark navy gradient)

// ── Why this one screen keeps the navy sky ───────────────────────────────────
// Everything else moved to the pale glass morning, but the three gamification
// cards below (Panel, in components/gamification) are deliberately literal
// against a navy ground — their own comment says so — and they are shared, not
// this screen's to repaint. So the surfaces here take the design system's
// material through `glass(radius, level, fill)` at a LOW fill, which is the
// case glass.ts documents for a pane over a dark ground: the shared height
// ladder and the lit edges, over this screen's own navy.

// ── Parked mock sections ─────────────────────────────────────────────────────
// Daily goals, weekly focus, the 2×2 action grid, focus mode and the weekly
// streak strip were all hard-coded placeholders — they showed the same numbers
// to every child and none of them had a backend. They are kept here (and their
// JSX below) so they can come back the moment there is real data behind them.
// Their slot on the dashboard now holds the live gamification cards.
// The parked JSX carries inline styles rather than `styles.*` entries, so the
// live StyleSheet below is not padded out with rules nothing renders.
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

// ── The navy palette ─────────────────────────────────────────────────────────
// Shared verbatim with components/gamification/panel.tsx, which sits on this
// same ground.
const BORDER = 'rgba(96,165,250,0.18)';
/** Panel's `rgba(255,255,255,0.06)` as a `glass()` fill — the low alpha the
 *  helper documents for a pane over a dark ground. */
const SURFACE_FILL = 0.06;
const ACCENT = '#60A5FA';
const ADVICE = '#C27AFF';
const BRIGHT = '#FFFFFF';
const TEXT = '#E0E7FF';
const BODY = '#CBD5E1';
const MUTED = '#94A3B8';
const FAINT = '#64748B';

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
          <View style={styles.header}>
            <Text style={styles.greeting}>Salom, {childName}</Text>
            <Text style={styles.greetingSub}>
              Bugun maqsadlaringizga erishamiz
            </Text>
          </View>

          {/* The DTM / IELTS / Fokus / Stress row that sat here was removed:
              every figure in it was hard-coded, so it told the child things
              about themselves that were not true. Nothing replaces it until
              there is real data behind those numbers. */}

          {/* Mood selector */}
          <View style={[glass(20, 'md', SURFACE_FILL), styles.card]}>
            <Text style={styles.cardTitle}>
              Bugun o'zingizni qanday his qilyapsiz?
            </Text>
            <View style={styles.moodRow}>
              {MOODS.map((m) => {
                const isSel = selectedMood === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setMood.mutate(m.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSel }}
                    accessibilityLabel={m.label}
                    style={[
                      styles.mood,
                      styles.focusable,
                      isSel && styles.moodOn,
                    ]}
                  >
                    <Text style={styles.moodEmoji}>{m.emoji}</Text>
                    <Text style={styles.moodLabel}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {/* Ternary, not `&&`: `selectedMood` is a string, and a `&&` on a
                string renders '' as a text node that react-native-web throws
                on. */}
            {selectedMood ? (
              <View style={styles.moodNote}>
                <Text style={styles.moodNoteText}>
                  {setMood.isError
                    ? "Saqlanmadi — internetni tekshiring."
                    : "Rahmat! DUYO sizning his-tuyg'ularingizni hisobga oladi."}
                </Text>
              </View>
            ) : null}
          </View>

          {/* DUYO Maslahat — the one thing on the page that leads, so it is
              the only surface a rung higher than the cards around it. */}
          <View style={[glass(20, 'lg', 0.04), styles.advice]}>
            <LinearGradient
              colors={['rgba(130,0,219,0.22)', 'rgba(110,17,176,0.12)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.adviceFill}
            >
              <View style={styles.adviceHead}>
                <Sparkles size={18} color={ADVICE} />
                <Text style={styles.adviceLabel}>DUYO Maslahat</Text>
              </View>
              <Text style={styles.adviceBody}>
                Matematikada yuqori natija ko'rsatyapsiz. Bugun fizikaga e'tibor
                bering.
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
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: 1,
              borderColor: BORDER,
              borderRadius: 20,
              padding: 16,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: BRIGHT, marginBottom: 12 }}>
              Bugungi maqsadlar{' '}
              <Text style={{ color: MUTED, fontWeight: '400' }}>
                {completedGoals}/{DAILY_GOALS.length} bajarildi
              </Text>
            </Text>
            <View style={{ gap: 12 }}>
              {DAILY_GOALS.map((goal) => {
                const progress = goal.total > 0 ? goal.done / goal.total : 0;
                const done = goal.done >= goal.total;
                return (
                  <View key={goal.key}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                      }}
                    >
                      <Text style={{ color: BODY, fontSize: 13 }}>{goal.title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: MUTED, fontSize: 11 }}>{goal.category}</Text>
                        <Text style={{ color: done ? '#05DF72' : ACCENT, fontSize: 11, fontWeight: '600' }}>
                          {goal.done}/{goal.total}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={{
                        height: 5,
                        borderRadius: 999,
                        overflow: 'hidden',
                        backgroundColor: 'rgba(96,165,250,0.20)',
                      }}
                    >
                      <View
                        style={{
                          height: '100%',
                          width: `${progress * 100}%`,
                          backgroundColor: done ? '#05DF72' : ACCENT,
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: 1,
              borderColor: BORDER,
              borderRadius: 20,
              padding: 16,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: BRIGHT, marginBottom: 12 }}>
              Bu haftadagi fokus
            </Text>
            <View style={{ gap: 10 }}>
              {FOCUS_SUBJECTS.map((s) => (
                <View key={s.key}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                    }}
                  >
                    <Text style={{ color: BODY, fontSize: 13 }}>{s.label}</Text>
                    {s.hours !== '' && (
                      <Text style={{ color: MUTED, fontSize: 11 }}>{s.hours}</Text>
                    )}
                  </View>
                  <View
                    style={{
                      height: 6,
                      borderRadius: 999,
                      overflow: 'hidden',
                      backgroundColor: 'rgba(96,165,250,0.15)',
                    }}
                  >
                    <View
                      style={{ height: '100%', width: `${s.percent * 100}%`, backgroundColor: s.color }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {ACTION_CARDS.map((card) => (
              <Pressable
                key={card.key}
                onPress={() => router.push(card.href)}
                accessibilityRole="button"
                accessibilityLabel={card.label}
                style={({ pressed }) => [
                  { width: '47.5%', borderRadius: 20, overflow: 'hidden' },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <LinearGradient
                  colors={card.gradientColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ padding: 18, minHeight: 110, justifyContent: 'space-between' }}
                >
                  <card.Icon size={26} color={card.iconColor} />
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ color: BRIGHT, fontSize: 14, fontWeight: '700' }}>
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
            style={({ pressed }) => [
              { borderRadius: 20, overflow: 'hidden' },
              styles.focusable,
              pressed && { opacity: 0.8 },
            ]}
          >
            <LinearGradient
              colors={['rgba(37,99,235,0.25)', 'rgba(37,99,235,0.10)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderWidth: 1,
                borderColor: 'rgba(96,165,250,0.30)',
                borderRadius: 20,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View>
                <Text style={{ color: ACCENT, fontSize: 13, fontWeight: '700' }}>Fokus rejimi</Text>
                <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>
                  25 daqiqa to'xtovsiz o'qish
                </Text>
              </View>
              <View
                style={{
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#2563EB',
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                }}
              >
                <Text style={{ color: BRIGHT, fontSize: 13, fontWeight: '600' }}>Boshlash</Text>
              </View>
            </LinearGradient>
          </Pressable>

          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: 1,
              borderColor: BORDER,
              borderRadius: 20,
              padding: 16,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <Text style={{ color: TEXT, fontSize: 14, fontWeight: '700' }}>
                Haftalik progress
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  borderRadius: 999,
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {WEEK_DAYS.map((day, i) => (
                <View key={day} style={{ alignItems: 'center', gap: 8 }}>
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
                  <Text style={{ color: MUTED, fontSize: 11 }}>{day}</Text>
                </View>
              ))}
            </View>
          </View>
          ── end parked sections ── */}

          {/* Motivatsion quote — the quietest thing here, so it barely leaves
              the page. */}
          <View style={[glass(20, 'sm', SURFACE_FILL), styles.quote]}>
            <Text style={styles.quoteText}>
              "Maqsadga erishish yo'lida har bir qadam muhim"
            </Text>
            <Text style={styles.quoteSub}>
              Davom eting, siz ajoyib ishlamoqdasiz!
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // The browser's default focus ring is a black rectangle around a rounded
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  header: { gap: 4, paddingTop: 8 },
  greeting: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: BRIGHT,
  },
  greetingSub: { fontSize: 14, color: MUTED },

  // `glass()` gives the ladder and the lit edges; the border stays this
  // screen's own, because the helper's near-white rim is meant for a pale page
  // and would read as a hard outline on navy.
  card: { borderColor: BORDER, padding: 16 },
  cardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: BRIGHT,
    marginBottom: 12,
  },

  // ── Mood ───────────────────────────────────────────────────────────────
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  mood: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 10,
    marginHorizontal: 2,
    borderWidth: 1,
    // Held even when unselected so choosing a face does not shift the row.
    borderColor: 'transparent',
  },
  moodOn: {
    backgroundColor: 'rgba(96,165,250,0.15)',
    borderColor: ACCENT,
  },
  moodEmoji: { fontSize: 28, lineHeight: 34 },
  moodLabel: { fontSize: 11, color: MUTED, marginTop: 4 },
  // Drawn on the card it belongs to, so it casts nothing — a pane that
  // shadows the pane it is part of is depth stacked rather than modelled.
  moodNote: {
    marginTop: 12,
    borderRadius: 14,
    padding: 10,
    backgroundColor: 'rgba(96,165,250,0.10)',
  },
  moodNoteText: { fontSize: 13, lineHeight: 19, color: BODY },

  // ── DUYO Maslahat ──────────────────────────────────────────────────────
  advice: { borderColor: '#6E11B0', overflow: 'hidden' },
  adviceFill: { padding: 16 },
  adviceHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  adviceLabel: { fontSize: 13, fontWeight: '700', color: ADVICE },
  adviceBody: { fontSize: 14, lineHeight: 22, color: TEXT },

  // ── Motivatsion quote ──────────────────────────────────────────────────
  quote: { borderColor: BORDER, alignItems: 'center', padding: 20 },
  quoteText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 22,
    textAlign: 'center',
    color: MUTED,
  },
  quoteSub: { marginTop: 8, fontSize: 12, color: FAINT },
});
