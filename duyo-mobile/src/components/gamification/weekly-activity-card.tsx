import { Star } from 'lucide-react-native';
import { View } from 'react-native';
import { Text } from '@/components/text';

import { useBallsHistory, useStreak } from '@/hooks/use-gamification';
import { buildWeeklyActivity } from '@/lib/weekly-activity';

import { PANEL_MUTED, Panel } from './panel';

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
    <Panel title="Haftalik faollik" icon={<Star size={18} color="#60A5FA" />}>
      <View className="flex-row items-end justify-between" style={{ height: BAR_MAX_HEIGHT + 18 }}>
        {week.days.map((day) => {
          const height = day.xp > 0 && peakXp > 0
            ? Math.max(BAR_PRESENCE_HEIGHT, (day.xp / peakXp) * BAR_MAX_HEIGHT)
            : day.active
              ? BAR_PRESENCE_HEIGHT
              : BAR_MIN_HEIGHT;
          return (
            <View key={day.label} className="items-center gap-1 flex-1">
              <View
                style={{
                  width: 20,
                  height,
                  borderRadius: 4,
                  backgroundColor: day.active
                    ? '#60A5FA'
                    : day.isFuture
                      ? 'rgba(96,165,250,0.10)'
                      : 'rgba(96,165,250,0.20)',
                }}
              />
              <Text
                style={{
                  fontSize: 10,
                  color: day.isToday ? '#60A5FA' : PANEL_MUTED,
                  fontWeight: day.isToday ? '700' : '400',
                }}
              >
                {day.label}
              </Text>
            </View>
          );
        })}
      </View>
      <View className="flex-row items-center gap-1 mt-3">
        <Text style={{ fontSize: 14 }}>⚡</Text>
        <Text style={{ color: PANEL_MUTED, fontSize: 12, flex: 1 }}>{summary}</Text>
      </View>
    </Panel>
  );
}
