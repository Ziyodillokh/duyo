import { Gift } from 'lucide-react-native';
import { View } from 'react-native';
import { Text } from '@/components/text';

import type { BallsTransactionWire } from '@/api/endpoints/gamification';
import { useBallsHistory } from '@/hooks/use-gamification';

import { PANEL_MUTED, PANEL_TEXT, Panel } from './panel';

const MAX_ROWS = 4;

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
    <Panel title="Oxirgi mukofotlar" icon={<Gift size={18} color="#FB64B6" />}>
      {history.isPending ? (
        <Text style={{ color: PANEL_MUTED, fontSize: 12 }}>Yuklanmoqda...</Text>
      ) : rewards.length === 0 ? (
        <Text style={{ color: PANEL_MUTED, fontSize: 12, lineHeight: 18 }}>
          Hozircha mukofot yo'q. DUYO bilan suhbatlashing va maqsadlarni
          bajaring — XP shu yerda ko'rinadi.
        </Text>
      ) : (
        <View style={{ gap: 10 }}>
          {rewards.map((tx, i) => {
            const meta = metaFor(tx.reason);
            return (
              <View
                key={`${tx.created_at}-${i}`}
                className="flex-row items-center justify-between rounded-lg"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              >
                <View className="flex-row items-center gap-3 flex-1">
                  <Text style={{ fontSize: 20 }}>{meta.emoji}</Text>
                  <View className="flex-1">
                    <Text style={{ color: PANEL_TEXT, fontSize: 14 }} numberOfLines={1}>
                      {meta.label}
                    </Text>
                    <Text style={{ color: PANEL_MUTED, fontSize: 11, marginTop: 1 }}>
                      {whenLabel(tx.created_at, now)}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: '#FDC700', fontSize: 13, fontWeight: '700' }}>
                  +{tx.amount} XP
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Panel>
  );
}
