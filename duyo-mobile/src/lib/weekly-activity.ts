import type {
  BallsTransactionWire,
  StreakWire,
} from '@/api/endpoints/gamification';

/**
 * The week strip shown on the dashboard, derived from data the backend really
 * has: the streak tells us which days the child showed up, the XP ledger tells
 * us how much each of those days earned. Nothing here is invented — a day with
 * no evidence renders as inactive.
 */

export const WEEK_DAY_LABELS = ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya'] as const;

export interface DayActivity {
  /** 'Du' … 'Ya' */
  label: string;
  /** XP earned on this day, 0 when the ledger has nothing. */
  xp: number;
  /** The child was present (streak covers the day, or it earned XP). */
  active: boolean;
  isToday: boolean;
  /** Later this week — drawn faintly, never as a missed day. */
  isFuture: boolean;
}

export interface WeeklyActivity {
  days: DayActivity[];
  activeDays: number;
  totalXp: number;
  /** XP per day elapsed so far this week (Monday → today), rounded. */
  averageXp: number;
}

/** Local midnight, so day bucketing follows the child's own calendar. */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Monday-based index: Monday → 0 … Sunday → 6. */
function weekIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function daysBetween(from: Date, to: Date): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

/**
 * Parse a `YYYY-MM-DD` backend date as a *local* day. `new Date(str)` would
 * read it as UTC midnight, which lands on the previous day east of Greenwich.
 */
function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function buildWeeklyActivity(
  streak: StreakWire | undefined,
  history: readonly BallsTransactionWire[] | undefined,
  now: Date = new Date(),
): WeeklyActivity {
  const today = startOfDay(now);
  const monday = new Date(today);
  monday.setDate(today.getDate() - weekIndex(today));

  const days: DayActivity[] = WEEK_DAY_LABELS.map((label, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return {
      label,
      xp: 0,
      active: false,
      isToday: date.getTime() === today.getTime(),
      isFuture: date.getTime() > today.getTime(),
    };
  });

  // Streak days: `current_streak` consecutive days ending on last_active_date.
  const lastActive = streak?.last_active_date
    ? parseLocalDate(streak.last_active_date)
    : null;
  if (lastActive && streak && streak.current_streak > 0) {
    for (let back = 0; back < streak.current_streak; back += 1) {
      const day = new Date(lastActive);
      day.setDate(lastActive.getDate() - back);
      const offset = daysBetween(monday, day);
      if (offset >= 0 && offset < days.length) days[offset].active = true;
    }
  }

  // XP earned per day. Purchases are negative and must not count as activity.
  for (const tx of history ?? []) {
    if (tx.amount <= 0) continue;
    const when = new Date(tx.created_at);
    if (Number.isNaN(when.getTime())) continue;
    const offset = daysBetween(monday, when);
    if (offset < 0 || offset >= days.length) continue;
    days[offset].xp += tx.amount;
    days[offset].active = true;
  }

  const totalXp = days.reduce((sum, d) => sum + d.xp, 0);
  const elapsed = weekIndex(today) + 1;

  return {
    days,
    activeDays: days.filter((d) => d.active).length,
    totalXp,
    averageXp: Math.round(totalXp / elapsed),
  };
}
