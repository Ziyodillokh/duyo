import { Award } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useAchievements } from '@/hooks/use-gamification';
import { glass } from '@/lib/glass';

import { PANEL_MUTED, PANEL_TEXT, Panel } from './panel';

// The badge gold, deepened for the light page. The old #FDC700 was picked to
// glow on a navy ground and is barely visible on white glass.
const GOLD = '#E0A21C';
const GOLD_WASH = 'rgba(232,180,70,0.22)';
const GOLD_EDGE = 'rgba(224,162,28,0.42)';

export function AchievementsCard() {
  const achievements = useAchievements();
  const items = achievements.data ?? [];
  const earned = items.filter((a) => a.earned).length;

  return (
    <Panel
      title="Yutuqlar"
      icon={<Award size={18} color={GOLD} />}
      trailing={
        items.length > 0 ? (
          <Text style={styles.count}>
            {earned}/{items.length}
          </Text>
        ) : null
      }
    >
      {achievements.isPending ? (
        <Text style={styles.note}>Yuklanmoqda...</Text>
      ) : items.length === 0 ? (
        <Text style={styles.note}>Yutuqlar hozircha mavjud emas</Text>
      ) : (
        <View style={styles.grid}>
          {items.map((a) => (
            <View
              key={a.key}
              style={[styles.tile, a.earned ? styles.tileEarned : styles.tileLocked]}
            >
              {/* Locked badges keep their shape but lose their colour, so the
                  child can see what is still ahead of them. An earned one also
                  sits a step higher off the page than a locked one — the ratio
                  is what makes the earned row read as won rather than just
                  tinted. */}
              <Text style={[styles.emoji, !a.earned && styles.emojiLocked]}>
                {a.emoji}
              </Text>
              <Text
                style={[styles.name, !a.earned && styles.nameLocked]}
                numberOfLines={2}
              >
                {a.name}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  count: { fontSize: 12, fontWeight: '700', color: GOLD },
  note: { fontSize: 12, color: PANEL_MUTED },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '30.5%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    gap: 4,
  },
  tileEarned: {
    ...glass(16, 'sm', 0.55),
    backgroundColor: GOLD_WASH,
    borderColor: GOLD_EDGE,
  },
  // Locked badges are part of the panel they sit on, not objects resting on
  // it — 'flush', so nothing casts a shadow onto its own parent.
  tileLocked: glass(16, 'flush', 0.34),

  emoji: { fontSize: 26 },
  emojiLocked: { opacity: 0.35 },
  name: { fontSize: 11, textAlign: 'center', color: PANEL_TEXT },
  nameLocked: { color: PANEL_MUTED, opacity: 0.7 },
});
