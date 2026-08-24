import { Star } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useBallsHistory, useStreak } from '@/hooks/use-gamification';
import { buildWeeklyActivity } from '@/lib/weekly-activity';

import { PANEL_MUTED, Panel } from './panel';

const PRIMARY = '#2F6FE4';

const BAR_MAX_HEIGHT = 56;
const BAR_MIN_HEIGHT = 6;
// A day the child showed up on but earned no XP still deserves a visible bar.
const BAR_PRESENCE_HEIGHT = 26;

export function WeeklyActivityCard() {
  const streak = useStreak();
  const history = useBallsHistory();

  const week = buildWeeklyActivity(streak.data, history.data);
  const peakXp = Math.max(...week.days.map((d) => d.xp));
  const loading = streak.isPending || history.isPending;

  const summary = (() => {
    if (loading) return 'Yuklanmoqda...';
    if (week.activeDays === 0) {
      return "Bu hafta hali faollik yo'q — DUYO bilan suhbatlashing";
    }
    const base = `Bu hafta: ${week.activeDays} kun faol`;
    return week.totalXp > 0
      ? `${base} · o'rtacha ${week.averageXp} XP/kun`
      : base;
  })();

  return (
    <Panel title="Haftalik faollik" icon={<Star size={18} color={PRIMARY} />}>
      <View style={styles.chart}>
        {week.days.map((day) => {
          const height = day.xp > 0 && peakXp > 0
            ? Math.max(BAR_PRESENCE_HEIGHT, (day.xp / peakXp) * BAR_MAX_HEIGHT)
            : day.active
              ? BAR_PRESENCE_HEIGHT
              : BAR_MIN_HEIGHT;
          return (
            <View key={day.label} style={styles.day}>
              {/* The bars stay flat: they are data drawn on the panel, not
                  objects resting on it, and giving seven of them their own
                  shadow would say they float above the card they measure. */}
              <View
                style={[
                  styles.bar,
                  day.active
                    ? styles.barOn
                    : day.isFuture
                      ? styles.barFuture
                      : styles.barOff,
                  { height },
                ]}
              />
              <Text style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}>
                {day.label}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.bolt}>⚡</Text>
        <Text style={styles.summary}>{summary}</Text>
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  chart: {
    height: BAR_MAX_HEIGHT + 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  day: { flex: 1, alignItems: 'center', gap: 4 },

  bar: { width: 20, borderRadius: 4 },
  barOn: { backgroundColor: PRIMARY },
  barOff: { backgroundColor: 'rgba(47,111,228,0.20)' },
  barFuture: { backgroundColor: 'rgba(47,111,228,0.10)' },

  dayLabel: { fontSize: 10, fontWeight: '400', color: PANEL_MUTED },
  dayLabelToday: { fontWeight: '700', color: PRIMARY },

  summaryRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bolt: { fontSize: 14 },
  summary: { flex: 1, fontSize: 12, color: PANEL_MUTED },
});
