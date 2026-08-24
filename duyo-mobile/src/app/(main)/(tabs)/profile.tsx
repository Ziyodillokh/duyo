import { LinearGradient } from 'expo-linear-gradient';
import { router, useNavigation } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  ChevronRight,
  Crown,
  Flame,
  PenLine,
  Settings as SettingsIcon,
  Star,
  Trophy,
} from 'lucide-react-native';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InventorySummary } from '@/components/inventory-summary';
import { useNavClearance } from '@/components/v2/dark/bottom-nav';
import { MascotImage } from '@/components/v2/mascot-image';
import {
  useAchievements,
  useBalls,
  useBallsHistory,
  useStreak,
} from '@/hooks/use-gamification';
import { useUnreadNotificationCount } from '@/hooks/use-notifications';
import { glass, lift } from '@/lib/glass';
import { buildWeeklyActivity } from '@/lib/weekly-activity';
import { useChildStore } from '@/store/child';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
// Same family as settings and notifications: frosted panes on pale blue. The
// screen commits to the light look the way its siblings do — the old navy
// build predated the glass system and read as a different app bolted on.
const PRIMARY = '#2F6FE4';
const TITLE = '#2A63DC';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const HAIRLINE = 'rgba(47,111,228,0.10)';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

/* The three stat icons and the two doorways keep their colour coding — it is
   what makes the row scannable before it is read — but each is deepened from
   its old neon-on-navy value. #FDC700 and #05DF72 were chosen to glow on a
   dark ground; on white glass they are barely there. */
const FLAME = '#F0812F';
const GOLD = '#E0A21C';
const TROPHY = '#C7519C';
const GREEN = '#22B573';

/** Deep warm brown reads on the gold gradient the way navy ink does not. */
const PREMIUM_INK = '#4A2E05';

// Achievements, weekly activity and recent rewards moved to the dashboard
// (screens/home/companion-home.tsx) where they are the main content. What
// stays here is the identity card: who the child is, their level and streak.

export default function ProfileScreen() {
  // Sibling tabs go through this screen's navigator; router.push into
  // the (tabs) group from inside it is a silent no-op on web.
  const navigation = useNavigation() as { navigate(name: string): void };
  const navClearance = useNavClearance();
  const child = useChildStore((s) => s.child);
  const childName = child?.name ?? 'Foydalanuvchi';
  const childAge = child?.age;

  const balls = useBalls();
  const streak = useStreak();
  const achievements = useAchievements();
  const history = useBallsHistory();
  const unreadNotifications = useUnreadNotificationCount();
  const unreadCount = unreadNotifications.data?.count ?? 0;

  const balance = balls.data?.balance ?? 0;
  const level = balls.data?.level ?? 1;
  const levelName = balls.data?.level_name ?? '—';
  const currentThreshold = balls.data?.current_threshold ?? 0;
  const nextThreshold = balls.data?.next_threshold ?? null;
  const ballsToNext = balls.data?.balls_to_next ?? null;
  const isMaxLevel = nextThreshold === null;
  // Progress within the current level segment (floor → next threshold).
  const levelProgress =
    nextThreshold !== null && nextThreshold > currentThreshold
      ? (balance - currentThreshold) / (nextThreshold - currentThreshold)
      : 1;
  const currentStreak = streak.data?.current_streak ?? 0;
  const earnedCount = (achievements.data ?? []).filter((a) => a.earned).length;
  // The week strip below marks the days the child actually showed up.
  const week = buildWeeklyActivity(streak.data, history.data);

  // The old ProgressBar clamped for us; the glass track is drawn here, so the
  // clamp comes with it — a level segment can read slightly over 1 mid-refetch.
  const levelPct = Math.max(0, Math.min(1, levelProgress)) * 100;

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: navClearance + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            {/* The dock is three doors now; the hub is reached by going back,
                so every section carries this. */}
            <Pressable
              onPress={() => navigation.navigate('index')}
              accessibilityRole="button"
              accessibilityLabel="Bosh sahifa"
              style={[glass(22, 'sm'), styles.headerButton, styles.focusable]}
            >
              <ArrowLeft size={22} color={PRIMARY} strokeWidth={2} />
            </Pressable>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => router.push('/(main)/notifications')}
                accessibilityRole="button"
                accessibilityLabel="Bildirishnomalar"
                style={[glass(22, 'sm'), styles.headerButton, styles.focusable]}
              >
                <Bell size={22} color={PRIMARY} strokeWidth={1.9} />
                {unreadCount > 0 ? <View style={styles.bellDot} /> : null}
              </Pressable>
              <Pressable
                onPress={() => router.push('/(main)/settings')}
                accessibilityRole="button"
                accessibilityLabel="Sozlamalar"
                style={[glass(22, 'sm'), styles.headerButton, styles.focusable]}
              >
                <SettingsIcon size={22} color={PRIMARY} strokeWidth={1.9} />
              </Pressable>
            </View>
          </View>

          {/* ── Identity: the one hero this screen leads with ─────────── */}
          <View style={[glass(28, 'lg'), styles.hero]}>
            <MascotImage size={180} glow="cosmic" />
            <Text style={styles.heroName}>{childName}</Text>
            {childAge !== undefined ? (
              <Text style={styles.heroAge}>{childAge} yosh</Text>
            ) : null}
            <View style={styles.levelPill}>
              <Text style={styles.levelText}>
                ⭐ Level {level} · {levelName}
              </Text>
            </View>
          </View>

          <View style={[glass(22, 'md'), styles.card]}>
            <View style={styles.levelHead}>
              <Text style={styles.caption}>
                {isMaxLevel ? 'Eng yuqori daraja' : 'Keyingi daraja'}
              </Text>
              <Text style={styles.levelXp}>
                {isMaxLevel ? `${balance} XP` : `${balance}/${nextThreshold} XP`}
              </Text>
            </View>
            {/* The old ProgressBar was a dark-theme part — a navy track under a
                neon fill. Same shape, lit for this page. */}
            <View style={styles.track}>
              <LinearGradient
                colors={['#4F86EE', '#7FB2FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.trackFill, { width: `${levelPct}%` }]}
              />
            </View>
            <Text style={styles.levelHint}>
              {isMaxLevel
                ? "Barcha darajalar ochilgan 🎉"
                : `${ballsToNext} XP keyingi darajaga`}
            </Text>
          </View>

          <View style={styles.statRow}>
            <View style={[glass(22, 'md'), styles.statCard]}>
              <Flame size={28} color={FLAME} />
              <Text style={styles.statValue}>{currentStreak}</Text>
              <Text style={styles.statLabel}>Kun seriya</Text>
            </View>
            <View style={[glass(22, 'md'), styles.statCard]}>
              <Star size={28} color={GOLD} />
              <Text style={styles.statValue}>{balance}</Text>
              <Text style={styles.statLabel}>Jami XP</Text>
            </View>
            <View style={[glass(22, 'md'), styles.statCard]}>
              <Trophy size={28} color={TROPHY} />
              <Text style={styles.statValue}>{earnedCount}</Text>
              <Text style={styles.statLabel}>Yutuqlar</Text>
            </View>
          </View>

          {/* Week streak calendar */}
          <View style={[glass(22, 'md'), styles.card]}>
            <View style={styles.week}>
              {week.days.map((day) => (
                <View key={day.label} style={styles.day}>
                  <View
                    style={[
                      styles.dayDisc,
                      day.active && styles.dayDiscOn,
                      day.isToday && styles.dayDiscToday,
                    ]}
                  >
                    {day.active ? <Text style={styles.dayCheck}>✓</Text> : null}
                  </View>
                  <Text style={styles.dayLabel}>{day.label}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.weekCaption}>
              {currentStreak > 0
                ? `${currentStreak} kunlik seriya davom etmoqda!`
                : 'Seriyani boshlash uchun DUYO bilan suhbatlashing'}
            </Text>
          </View>

          <View style={styles.inventoryWrap}>
            <InventorySummary />
          </View>

          {/* Kutubxona left the tab bar on the promise it stays reachable
              from home — the glass dashboard dropped those cards, so the
              doorway lives here now (and lesson-help with it). */}
          <View style={[glass(22, 'md'), styles.doorCard]}>
            {(
              [
                {
                  key: 'library',
                  Icon: BookOpen,
                  colour: GOLD,
                  label: 'Kutubxona',
                  hint: "She'r, ertak va darsliklar",
                  href: '/(main)/library',
                },
                {
                  key: 'lessons',
                  Icon: PenLine,
                  colour: GREEN,
                  label: 'Dars yordami',
                  hint: 'Uy vazifasiga qadamma-qadam yordam',
                  href: '/(main)/lesson-help',
                },
              ] as const
            ).map(({ key, Icon, colour, label, hint, href }, i) => (
              <Pressable
                key={key}
                onPress={() => router.push(href)}
                accessibilityRole="button"
                accessibilityLabel={label}
                style={[styles.door, i > 0 && styles.doorDivider]}
              >
                <View style={[styles.doorWell, { backgroundColor: `${colour}22` }]}>
                  <Icon size={20} color={colour} strokeWidth={2} />
                </View>
                <View style={styles.doorText}>
                  <Text style={styles.doorLabel}>{label}</Text>
                  <Text style={styles.doorHint}>{hint}</Text>
                </View>
                <ChevronRight size={18} color={MUTED} strokeWidth={2.2} />
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => router.push('/(main)/subscription')}
            accessibilityRole="button"
            accessibilityLabel="Premium'ga o'tish"
            style={[styles.premium, styles.focusable]}
          >
            <LinearGradient
              colors={['#FDC700', '#FF8904']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.premiumFill}
            >
              <Crown size={20} color={PREMIUM_INK} strokeWidth={2.2} />
              <Text style={styles.premiumText}>Premium'ga o'tish</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 14 },

  header: { flexDirection: 'row', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', gap: 10 },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The browser's default focus ring is a black rectangle around a round
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#F04438',
  },

  hero: { alignItems: 'center', paddingVertical: 22, paddingHorizontal: 20 },
  heroName: { marginTop: 8, fontSize: 24, fontWeight: '700', color: TITLE },
  heroAge: { marginTop: 2, fontSize: 13, color: MUTED },
  levelPill: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(47,111,228,0.12)',
  },
  levelText: { fontSize: 13.5, fontWeight: '700', color: PRIMARY },

  card: { padding: 18 },
  caption: { fontSize: 13, color: MUTED },
  levelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  levelXp: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  track: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(79,134,238,0.16)',
    overflow: 'hidden',
  },
  trackFill: { height: 12, borderRadius: 6 },
  levelHint: { marginTop: 8, fontSize: 12, textAlign: 'right', color: MUTED },

  statRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statValue: { marginTop: 8, fontSize: 24, fontWeight: '700', color: INK },
  statLabel: { marginTop: 2, fontSize: 12, color: MUTED },

  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  day: { alignItems: 'center', gap: 6 },
  dayDisc: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47,111,228,0.10)',
  },
  dayDiscOn: { backgroundColor: PRIMARY },
  dayDiscToday: { borderWidth: 2, borderColor: PRIMARY },
  dayCheck: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  dayLabel: { fontSize: 12, color: MUTED },
  weekCaption: { fontSize: 13, textAlign: 'center', color: MUTED },

  inventoryWrap: { marginBottom: 2 },

  doorCard: { paddingHorizontal: 16 },
  door: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  doorDivider: { borderTopWidth: 1, borderTopColor: HAIRLINE },
  doorWell: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorText: { flex: 1 },
  doorLabel: { fontSize: 15, fontWeight: '600', color: INK },
  doorHint: { marginTop: 2, fontSize: 12, color: MUTED },

  premium: { borderRadius: 22, overflow: 'hidden', boxShadow: lift('md') },
  premiumFill: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  premiumText: { fontSize: 16, fontWeight: '700', color: PREMIUM_INK },
});
