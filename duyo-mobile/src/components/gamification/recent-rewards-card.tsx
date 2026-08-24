import { Gift } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import type { BallsTransactionWire } from '@/api/endpoints/gamification';
import { useBallsHistory } from '@/hooks/use-gamification';
import { glass } from '@/lib/glass';

import { PANEL_MUTED, PANEL_TEXT, Panel } from './panel';

const MAX_ROWS = 4;

// Both accents are the navy-era neons deepened for the light page: #FB64B6
// and #FDC700 were chosen to glow on a dark ground and wash out on glass.
const PINK = '#C7519C';
const GOLD = '#E0A21C';

// Award reasons are free-form strings on the wire; these are the ones the
// backend emits today. Anything unknown still renders, just with a generic
// star — a reward the child earned must never be hidden by a missing key.
const REWARD_META: Record<string, { emoji: string; label: string }> = {
  chat: { emoji: '💬', label: 'Suhbat' },
  daily_mission: { emoji: '🎯', label: 'Bugungi missiya' },
  goal: { emoji: '✅', label: 'Maqsad bajarildi' },
  lesson: { emoji: '📚', label: 'Dars yordami' },
  level_up: { emoji: '⭐', label: 'Daraja oshdi' },
  poem: { emoji: '📖', label: "She'r o'qish" },
  quiz: { emoji: '🧠', label: 'Test' },
  streak: { emoji: '🔥', label: 'Kunlik seriya' },
};

const UZ_MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
] as const;

function metaFor(reason: string): { emoji: string; label: string } {
  const known = REWARD_META[reason];
  if (known) return known;
  const words = reason.replace(/[_:]+/g, ' ').trim();
  return {
    emoji: '⭐',
    label: words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Mukofot',
  };
}

function whenLabel(iso: string, now: Date): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  const day = new Date(when.getFullYear(), when.getMonth(), when.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diff <= 0) return 'Bugun';
  if (diff === 1) return 'Kecha';
  if (diff < 7) return `${diff} kun oldin`;
  return `${when.getDate()}-${UZ_MONTHS[when.getMonth()]}`;
}

export function RecentRewardsCard() {
  const history = useBallsHistory();
  const now = new Date();
  const rewards: BallsTransactionWire[] = (history.data ?? [])
    // Purchases are negative — this card is about what was earned.
    .filter((tx) => tx.amount > 0)
    .slice(0, MAX_ROWS);

  return (
    <Panel title="Oxirgi mukofotlar" icon={<Gift size={18} color={PINK} />}>
      {history.isPending ? (
        <Text style={styles.note}>Yuklanmoqda...</Text>
      ) : rewards.length === 0 ? (
        <Text style={[styles.note, styles.empty]}>
          Hozircha mukofot yo'q. DUYO bilan suhbatlashing va maqsadlarni
          bajaring — XP shu yerda ko'rinadi.
        </Text>
      ) : (
        <View style={styles.list}>
          {rewards.map((tx, i) => {
            const meta = metaFor(tx.reason);
            return (
              <View key={`${tx.created_at}-${i}`} style={[styles.row, styles.rowPane]}>
                <View style={styles.left}>
                  <Text style={styles.emoji}>{meta.emoji}</Text>
                  <View style={styles.lines}>
                    <Text style={styles.label} numberOfLines={1}>
                      {meta.label}
                    </Text>
                    <Text style={styles.when}>{whenLabel(tx.created_at, now)}</Text>
                  </View>
                </View>
                <Text style={styles.amount}>+{tx.amount} XP</Text>
              </View>
            );
          })}
        </View>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 12, color: PANEL_MUTED },
  empty: { lineHeight: 18 },

  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  // A row belongs to the panel it is ruled on — 'flush' keeps it from casting
  // a shadow onto its own parent.
  rowPane: glass(16, 'flush', 0.42),

  left: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  emoji: { fontSize: 20 },
  lines: { flex: 1 },
  label: { fontSize: 14, color: PANEL_TEXT },
  when: { marginTop: 1, fontSize: 11, color: PANEL_MUTED },
  amount: { fontSize: 13, fontWeight: '700', color: GOLD },
});
