import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Flame, Sparkles, Trophy } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { type BallsTransactionWire } from '@/api/endpoints/gamification';
import { Text } from '@/components/text';
import {
  useAchievements,
  useBalls,
  useBallsHistory,
  useStreak,
} from '@/hooks/use-gamification';
import { useTamagochi } from '@/hooks/use-tamagochi';
import { glass } from '@/lib/glass';
import { buildWeeklyActivity, type DayActivity } from '@/lib/weekly-activity';

const PRIMARY = '#2563EB';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

/**
 * Faollik — everything this app already knows about how the child is doing.
 *
 * ## Why one hue and not four
 *
 * The obvious move for "energiya · quvonch · o'rganish · salomatlik" is four
 * colours. Four hues that stay apart for every PAIR under colour-vision
 * deficiency is close to impossible — the validator put blue against violet at
 * ΔE 0.4 for deuteranopia, and blue against pink at 2.1 — and the honest read
 * is that these are not four categories anyway. They are four readings of ONE
 * quantity: how the tamagochi is doing, 0 to 100. That is a magnitude job, and
 * magnitude gets one hue. Each meter carries its own name and number, so
 * nothing here is identified by colour alone.
 *
 * ## Why there are no invented numbers
 *
 * Every figure comes off an endpoint the app already serves: the wellbeing
 * four from /tamagochi, the week from the balls ledger and the streak, the
 * level from the balls balance, the badges from the achievements catalogue
 * with the server's own `earned` flag. A stats page that pads itself with
 * plausible-looking numbers teaches a child that numbers are decoration.
 */

/** A 0–100 reading with its own name. */
interface Meter {
  label: string;
  value: number;
}

export default function ActivityScreen() {
  const tamagochi = useTamagochi();
  const balls = useBalls();
  const streak = useStreak();
  const history = useBallsHistory();
  const achievements = useAchievements();
  // This route lives outside (tabs), so no dock floats over it — the list
  // only has to clear the home indicator.
  const insets = useSafeAreaInsets();

  const t = tamagochi.data;
  const meters: Meter[] = t
    ? [
        { label: 'Energiya', value: t.energy },
        { label: 'Quvonch', value: t.joy },
        { label: "O'rganish", value: t.learning },
        { label: 'Salomatlik', value: t.health },
      ]
    : [];

  // The headline. The same average the home dashboard shows, so the tile and
  // this page can never disagree about what "faollik" means.
  const overall = t
    ? Math.round((t.energy + t.joy + t.learning + t.health) / 4)
    : null;

  const week = useMemo(
    () => buildWeeklyActivity(streak.data, history.data),
    [streak.data, history.data],
  );

  const earned = achievements.data?.filter((a) => a.earned) ?? [];
  const total = achievements.data?.length ?? 0;

  const recent = (history.data ?? []).slice(0, 6);

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.fill} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            style={[glass(24, 'sm'), styles.headerButton, styles.focusable]}
          >
            <ArrowLeft size={23} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <Text style={styles.headerTitle}>Faollik</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 12) + 20 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Today ───────────────────────────────────────────────────── */}
          <View style={[glass(26, 'lg'), styles.card]}>
            <Text style={styles.cardLabel}>BUGUNGI HOLAT</Text>
            <View style={styles.heroRow}>
              <Text style={styles.hero}>
                {overall === null ? '—' : overall}
                <Text style={styles.heroUnit}>%</Text>
              </Text>
              {!!balls.data?.level_name && (
                <View style={styles.levelPill}>
                  <Sparkles size={13} color={PRIMARY} strokeWidth={2.4} />
                  <Text style={styles.levelText}>{balls.data.level_name}</Text>
                </View>
              )}
            </View>

            <View style={styles.meters}>
              {meters.map((m) => (
                <MeterRow key={m.label} meter={m} />
              ))}
              {meters.length === 0 && (
                <Text style={styles.empty}>Ma'lumot yuklanmoqda…</Text>
              )}
            </View>
          </View>

          {/* ── This week ───────────────────────────────────────────────── */}
          <View style={[glass(26, 'md'), styles.card]}>
            <Text style={styles.cardLabel}>SHU HAFTA</Text>
            <WeekChart days={week.days} />

            {week.totalXp === 0 && (
              <Text style={styles.empty}>
                Bu hafta hali ball yig‘ilmagan — suhbat, qayd yoki mashq boshlang
              </Text>
            )}

            <View style={styles.statRow}>
              <Stat value={String(week.activeDays)} unit="/7" caption="faol kun" />
              <Stat value={String(week.totalXp)} caption="jami ball" />
              <Stat value={String(week.averageXp)} caption="kuniga o‘rtacha" />
            </View>
          </View>

          {/* ── Streak ──────────────────────────────────────────────────── */}
          <View style={[glass(26, 'md'), styles.card]}>
            <Text style={styles.cardLabel}>KETMA-KETLIK</Text>
            <View style={styles.streakRow}>
              <View style={styles.streakMain}>
                <Flame size={26} color={PRIMARY} strokeWidth={2.2} />
                <Text style={styles.streakValue}>
                  {streak.data?.current_streak ?? 0}
                  <Text style={styles.streakUnit}> kun</Text>
                </Text>
              </View>
              <Text style={styles.streakBest}>
                Eng uzuni: {streak.data?.longest_streak ?? 0} kun
              </Text>
            </View>
          </View>

          {/* ── Badges ──────────────────────────────────────────────────── */}
          <View style={[glass(26, 'md'), styles.card]}>
            <Text style={styles.cardLabel}>YUTUQLAR</Text>
            <View style={styles.badgeHead}>
              <Trophy size={20} color={PRIMARY} strokeWidth={2.2} />
              <Text style={styles.badgeCount}>
                {earned.length}
                <Text style={styles.badgeTotal}> / {total}</Text>
              </Text>
            </View>
            <Bar value={total > 0 ? (earned.length / total) * 100 : 0} />

            {earned.length > 0 && (
              <View style={styles.badgeWrap}>
                {earned.map((a) => (
                  <View key={a.key} style={styles.badge}>
                    <Text style={styles.badgeEmoji}>{a.emoji}</Text>
                    <Text style={styles.badgeName} numberOfLines={1}>
                      {a.name}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {earned.length === 0 && total > 0 && (
              <Text style={styles.empty}>Birinchi yutuq hali oldinda</Text>
            )}
          </View>

          {/* ── The ledger ──────────────────────────────────────────────── */}
          {recent.length > 0 && (
            <View style={[glass(26, 'md'), styles.card]}>
              <Text style={styles.cardLabel}>SO‘NGGI BALLAR</Text>
              {recent.map((tx, i) => (
                <LedgerRow key={`${tx.created_at}-${i}`} tx={tx} />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** A labelled 0–100 reading. The name and number are the identity; the bar is
 *  the magnitude. */
function MeterRow({ meter }: { meter: Meter }) {
  return (
    <View style={styles.meterRow}>
      <Text style={styles.meterLabel}>{meter.label}</Text>
      <View style={styles.meterBarWrap}>
        <Bar value={meter.value} />
      </View>
      <Text style={styles.meterValue}>{Math.round(meter.value)}</Text>
    </View>
  );
}

/** One hue, rounded end, sitting in a recessive track. */
function Bar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.track}>
      <View style={[styles.barFill, { width: `${pct}%` }]} />
    </View>
  );
}

/**
 * Seven days of earned balls.
 *
 * Bars grow from a shared baseline and are scaled to the best day of the week,
 * so a quiet week is still readable rather than seven stubs. Only today is
 * labelled with its number — a value over every bar is noise, and the axis
 * underneath already says which day is which.
 */
function WeekChart({ days }: { days: DayActivity[] }) {
  const peak = Math.max(1, ...days.map((d) => d.xp));
  // A week with nothing in it does not get a full-height plot. Reserving
  // 100pt for seven hairlines leaves a hand-sized hole in the card, and a
  // hole reads as a chart that failed to draw rather than as a quiet week.
  const quiet = days.every((d) => d.xp === 0);
  const plot = quiet ? 26 : 100;
  return (
    <View style={styles.chart}>
      {days.map((d) => {
        const h = d.xp > 0 ? Math.max(6, (d.xp / peak) * (plot - 4)) : 3;
        return (
          <View key={d.label} style={styles.chartCol}>
            {d.isToday && d.xp > 0 && (
              <Text style={styles.chartValue}>{d.xp}</Text>
            )}
            <View style={[styles.chartPlot, { height: plot }]}>
              <View
                style={[
                  styles.chartBar,
                  { height: h },
                  d.isFuture && styles.chartBarFuture,
                  !d.isFuture && d.xp === 0 && styles.chartBarEmpty,
                  d.isToday && styles.chartBarToday,
                ]}
              />
            </View>
            <Text style={[styles.chartDay, d.isToday && styles.chartDayToday]}>
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Stat({
  value,
  unit,
  caption,
}: {
  value: string;
  unit?: string;
  caption: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>
        {value}
        {!!unit && <Text style={styles.statUnit}>{unit}</Text>}
      </Text>
      <Text style={styles.statCaption}>{caption}</Text>
    </View>
  );
}

function LedgerRow({ tx }: { tx: BallsTransactionWire }) {
  const positive = tx.amount >= 0;
  return (
    <View style={styles.ledgerRow}>
      <Text style={styles.ledgerReason} numberOfLines={1}>
        {tx.reason}
      </Text>
      <Text style={[styles.ledgerAmount, !positive && styles.ledgerSpend]}>
        {positive ? '+' : ''}
        {tx.amount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  focusable: {
    outlineStyle: 'none',
    outlineWidth: 0,
    WebkitTapHighlightColor: 'transparent',
  } as unknown as ViewStyle,

  fill: { flex: 1 },
  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: PRIMARY,
    letterSpacing: -0.2,
  },

  content: { paddingHorizontal: 16, paddingTop: 4, gap: 14 },
  card: { padding: 18, gap: 14 },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: MUTED,
  },
  empty: { fontSize: 13.5, color: MUTED },

  // ── Today ──────────────────────────────────────────────────────────────
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hero: { fontSize: 46, lineHeight: 52, fontWeight: '700', color: PRIMARY },
  heroUnit: { fontSize: 24, fontWeight: '700' },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.10)',
  },
  levelText: { fontSize: 13, fontWeight: '700', color: PRIMARY },

  meters: { gap: 12 },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Fixed so four different-length names leave the bars starting on one line.
  meterLabel: { width: 88, fontSize: 14, fontWeight: '600', color: INK },
  meterBarWrap: { flex: 1 },
  meterValue: {
    width: 32,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    color: INK,
    fontVariant: ['tabular-nums'],
  },

  // Thin mark, rounded end, recessive track.
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(37,99,235,0.12)',
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 4, backgroundColor: PRIMARY },

  // ── Week ───────────────────────────────────────────────────────────────
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  chartCol: { flex: 1, alignItems: 'center', gap: 6 },
  chartValue: {
    fontSize: 11,
    fontWeight: '700',
    color: PRIMARY,
    fontVariant: ['tabular-nums'],
  },
  // Height comes from the data — see WeekChart. Every column shares one
  // baseline whichever height is in force.
  chartPlot: { justifyContent: 'flex-end', width: '100%' },
  chartBar: {
    width: '100%',
    borderRadius: 4,
    backgroundColor: 'rgba(37,99,235,0.45)',
  },
  chartBarToday: { backgroundColor: PRIMARY },
  // A day with nothing on it is a hairline, not a gap: the column still has to
  // exist or the week reads as six days.
  chartBarEmpty: { backgroundColor: 'rgba(37,99,235,0.22)' },
  // Not yet lived, so drawn fainter than an empty day rather than as a miss.
  chartBarFuture: { backgroundColor: 'rgba(140,163,203,0.22)' },
  chartDay: { fontSize: 11.5, fontWeight: '600', color: MUTED },
  chartDayToday: { color: PRIMARY, fontWeight: '700' },

  statRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, gap: 2 },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: INK,
    fontVariant: ['tabular-nums'],
  },
  statUnit: { fontSize: 13, fontWeight: '700', color: MUTED },
  statCaption: { fontSize: 12, color: MUTED },

  // ── Streak ─────────────────────────────────────────────────────────────
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  streakMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  streakValue: { fontSize: 30, fontWeight: '700', color: INK },
  streakUnit: { fontSize: 15, fontWeight: '600', color: MUTED },
  streakBest: { flex: 1, textAlign: 'right', fontSize: 13, color: MUTED },

  // ── Badges ─────────────────────────────────────────────────────────────
  badgeHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badgeCount: { fontSize: 22, fontWeight: '700', color: INK },
  badgeTotal: { fontSize: 15, fontWeight: '700', color: MUTED },
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.09)',
  },
  badgeEmoji: { fontSize: 14 },
  badgeName: { maxWidth: 130, fontSize: 12.5, fontWeight: '600', color: INK },

  // ── Ledger ─────────────────────────────────────────────────────────────
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 7,
  },
  ledgerReason: { flex: 1, fontSize: 14, color: INK },
  ledgerAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY,
    fontVariant: ['tabular-nums'],
  },
  ledgerSpend: { color: MUTED },
});
