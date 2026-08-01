import { Award } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { useAchievements } from '@/hooks/use-gamification';

import { PANEL_MUTED, PANEL_TEXT, Panel } from './panel';

export function AchievementsCard() {
  const achievements = useAchievements();
  const items = achievements.data ?? [];
  const earned = items.filter((a) => a.earned).length;

  return (
    <Panel
      title="Yutuqlar"
      icon={<Award size={18} color="#FDC700" />}
      trailing={
        items.length > 0 ? (
          <Text style={{ color: '#FDC700', fontSize: 12, fontWeight: '700' }}>
            {earned}/{items.length}
          </Text>
        ) : null
      }
    >
      {achievements.isPending ? (
        <Text style={{ color: PANEL_MUTED, fontSize: 12 }}>Yuklanmoqda...</Text>
      ) : items.length === 0 ? (
        <Text style={{ color: PANEL_MUTED, fontSize: 12 }}>
          Yutuqlar hozircha mavjud emas
        </Text>
      ) : (
        <View className="flex-row flex-wrap" style={{ gap: 10 }}>
          {items.map((a) => (
            <View
              key={a.key}
              className="rounded-lg items-center"
              style={{
                width: '30.5%',
                paddingVertical: 12,
                paddingHorizontal: 6,
                gap: 4,
                backgroundColor: a.earned
                  ? 'rgba(253,199,0,0.12)'
                  : 'rgba(255,255,255,0.04)',
                borderWidth: 1,
                borderColor: a.earned
                  ? 'rgba(253,199,0,0.35)'
                  : 'rgba(148,163,184,0.15)',
              }}
            >
              {/* Locked badges keep their shape but lose their colour, so the
                  child can see what is still ahead of them. */}
              <Text style={{ fontSize: 26, opacity: a.earned ? 1 : 0.35 }}>
                {a.emoji}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  color: a.earned ? PANEL_TEXT : PANEL_MUTED,
                  opacity: a.earned ? 1 : 0.7,
                }}
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
