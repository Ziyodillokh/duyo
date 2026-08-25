import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Lock } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { type AchievementWire } from '@/api/endpoints/gamification';
import { Badge, BADGE_FOR, BADGE_RULE, topBadge } from '@/components/badges/badge';
import { Text } from '@/components/text';
import { useAchievements } from '@/hooks/use-gamification';
import { glass } from '@/lib/glass';

const PRIMARY = '#2563EB';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

/**
 * Yutuqlar — the badge shelf.
 *
 * ## Why the locked ones are shown
 *
 * A collection you cannot see the shape of is not a collection. Every badge is
 * on the shelf from the first day, greyed until earned, each with the rule that
 * earns it written underneath — so the page answers "what else is there and how
 * do I get it", which is the only question a child brings to it. Hiding the
 * unearned ones would leave a page that says nothing until it is already too
 * late to motivate anyone.
 *
 * ## Why one of them is marked
 *
 * The top card names the badge currently standing beside the child's name in
 * Maqsaddoshlar. That is what most of these are FOR, and without saying so the
 * shelf is a page of stickers with no consequence.
 */
export default function AchievementsScreen() {
  const achievements = useAchievements();
  const insets = useSafeAreaInsets();

  const all: AchievementWire[] = achievements.data ?? [];
  const earned = all.filter((a) => a.earned);
  // Rarest last, so the shelf reads as a ladder rather than as the order the
  // server happened to serialise them in. Not memoised: it is seven items,
  // and a useMemo around a sort is something the React Compiler reports it
  // cannot preserve anyway.
  const shown = [...all].sort(
    (a, b) => (BADGE_FOR[a.key]?.rank ?? 99) - (BADGE_FOR[b.key]?.rank ?? 99),
  );

  const top = topBadge(earned.map((a) => a.key));
  const topName = earned.reduce<AchievementWire | null>((best, a) => {
    const r = BADGE_FOR[a.key]?.rank ?? -1;
    const br = best ? (BADGE_FOR[best.key]?.rank ?? -1) : -1;
    return r > br ? a : best;
  }, null);

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
          <Text style={styles.headerTitle}>Yutuqlar</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 12) + 20 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── What is beside your name right now ──────────────────────── */}
          <View style={[glass(26, 'lg'), styles.card]}>
            <Text style={styles.cardLabel}>ISMINGIZ YONIDA</Text>
            {top && topName ? (
              <View style={styles.currentRow}>
                <Badge kind={top.kind} tier={top.tier} size={56} />
                <View style={styles.currentBody}>
                  <Text style={styles.currentName}>{topName.name}</Text>
                  <Text style={styles.currentHint}>
                    Maqsaddoshlar ro‘yxatida ismingiz oldida shu belgi turadi
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.empty}>
                Hali belgi yo‘q — birinchisini quyidagi ro‘yxatdan oching
              </Text>
            )}

            <Text style={styles.progress}>
              <Text style={styles.progressCount}>{earned.length}</Text>
              <Text style={styles.progressTotal}> / {all.length}</Text>
              <Text style={styles.progressWord}>  ochilgan</Text>
            </Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.trackFill,
                  { width: `${all.length ? (earned.length / all.length) * 100 : 0}%` },
                ]}
              />
            </View>
          </View>

          {/* ── The shelf ───────────────────────────────────────────────── */}
          {shown.map((a) => {
            const art = BADGE_FOR[a.key];
            if (!art) return null;
            return (
              <View
                key={a.key}
                style={[glass(22, a.earned ? 'md' : 'sm', a.earned ? 0.62 : 0.42), styles.row]}
              >
                <Badge kind={art.kind} tier={art.tier} size={46} locked={!a.earned} />
                <View style={styles.rowBody}>
                  <Text style={[styles.rowName, !a.earned && styles.rowNameLocked]}>
                    {a.name}
                  </Text>
                  <Text style={styles.rowRule}>{BADGE_RULE[a.key] ?? ''}</Text>
                </View>
                {!a.earned && <Lock size={16} color={MUTED} strokeWidth={2.2} />}
              </View>
            );
          })}

          {all.length === 0 && (
            <Text style={styles.empty}>Ma‘lumot yuklanmoqda…</Text>
          )}
        </ScrollView>
      </SafeAreaView>
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

  content: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  card: { padding: 18, gap: 14 },
  cardLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1.6, color: MUTED },
  empty: { fontSize: 13.5, color: MUTED },

  currentRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  currentBody: { flex: 1, gap: 3 },
  currentName: { fontSize: 18, fontWeight: '700', color: INK },
  currentHint: { fontSize: 12.5, lineHeight: 17, color: MUTED },

  progress: { marginTop: 2 },
  progressCount: { fontSize: 22, fontWeight: '700', color: PRIMARY },
  progressTotal: { fontSize: 15, fontWeight: '700', color: MUTED },
  progressWord: { fontSize: 13, color: MUTED },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(37,99,235,0.12)',
    overflow: 'hidden',
  },
  trackFill: { height: 8, borderRadius: 4, backgroundColor: PRIMARY },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontSize: 16, fontWeight: '700', color: INK },
  rowNameLocked: { color: MUTED },
  rowRule: { fontSize: 12.5, lineHeight: 17, color: MUTED },
});
