import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  CheckCircle2,
  User,
} from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { useNavClearance } from '@/components/v2/dark/bottom-nav';
import { MascotHead } from '@/components/v2/mascot-image';
import { glass } from '@/lib/glass';
import { useAchievements, useBalls } from '@/hooks/use-gamification';
import { useUnreadNotificationCount } from '@/hooks/use-notifications';
import { useTamagochi } from '@/hooks/use-tamagochi';

// ── The glass sky palette ────────────────────────────────────────────────────
// One family of blues: ink for headings, primary for the numbers and icons,
// muted for captions. The background is a pale morning sky and every card is
// a pane of frosted glass floating on it.
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const BG_TOP = '#D6E6FA';
const BG_MID = '#E7EEFC';
const BG_BOTTOM = '#EEEFFA';

/* Every pane on this screen used to cast the same `0 14px 30px`, which is
   what made the glass look drawn rather than lit. Depth now comes from
   lib/glass.ts, where each level is a contact shadow plus an ambient one
   and the ratio between them is the height cue. What each surface IS
   decides its level, so the hierarchy below is the screen's hierarchy:
   the credit card is the hero, the stat tiles are cards, the header
   buttons rest on the page, and the icon wells are flush against the
   card they belong to. */

/** Space-grouped integer, the way uz locale reads big numbers. */
const fmt = (n: number): string =>
  String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// ── The listening orb ────────────────────────────────────────────────────────

/** The orb's glow diameter at full (932pt-canvas) scale, and the sphere's
 *  share of it — both straight off the mock. */
const GLOW_MAX = 316;
const ORB_RATIO = 236 / 316;

/**
 * DUYO itself, breathing, over the halo it lights the sky with.
 *
 * This slot used to hold an abstract sphere with an audio waveform drawn
 * across it. It was a nice sphere, and it was also the one place the home
 * screen said nothing about whose app this is — a glowing orb is what every
 * assistant draws. The mascot already exists, children already know its
 * face, and the caption underneath carries the "listening" that the
 * waveform used to carry.
 *
 * The halo stays: it is what stops the robot reading as a sticker dropped
 * on the page, and it is the brightest thing on the screen, which is how a
 * child finds the one control that starts a conversation.
 */
function ListeningOrb({ size }: { size: number }) {
  const breath = useSharedValue(1);
  // Breathe only while the home tab is on screen — an infinite repeat behind
  // another tab is a JS-thread tick nobody sees (native animated module is
  // absent on web, so this never rides the UI thread there).
  useFocusEffect(
    useCallback(() => {
      breath.set(
        withRepeat(
          withTiming(1.03, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
          -1,
          true,
        ),
      );
      return () => {
        cancelAnimation(breath);
        breath.set(1);
      };
    }, [breath]),
  );
  const breathing = useAnimatedStyle(() => ({
    transform: [{ scale: breath.get() }],
  }));

  const c = size / 2;
  // The radius the sphere used to occupy — the stardust is still placed
  // against it, so the grains sit where the mock has them.
  const r = (size * ORB_RATIO) / 2;

  return (
    <Animated.View style={[breathing, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Halo — the orb lights the sky around itself. */}
          <RadialGradient id="orb-halo" cx="50%" cy="50%" r="50%">
            <Stop offset="42%" stopColor="#CFE2FC" stopOpacity={0.92} />
            <Stop offset="72%" stopColor="#CFE2FC" stopOpacity={0.34} />
            <Stop offset="100%" stopColor="#CFE2FC" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Circle cx={c} cy={c} r={size / 2} fill="url(#orb-halo)" />

        {/* A few grains of stardust around DUYO. */}
        <Circle cx={c - r * 1.18} cy={c - r * 0.42} r={2.2} fill="#FFFFFF" opacity={0.9} />
        <Circle cx={c + r * 1.12} cy={c - r * 0.65} r={1.6} fill="#FFFFFF" opacity={0.7} />
        <Circle cx={c + r * 1.24} cy={c + r * 0.38} r={1.9} fill="#FFFFFF" opacity={0.6} />
        <Circle cx={c - r * 0.9} cy={c + r * 1.05} r={1.4} fill="#FFFFFF" opacity={0.5} />
      </Svg>

      {/* Centred in the square the halo occupies. MascotHead letterboxes the
          head inside the box it is given, so passing a share of the WIDTH
          keeps DUYO the same size whatever the phone, and the leftover
          height above and below is what the halo shows through. */}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <MascotHead size={Math.round(size * 0.86)} />
      </View>
    </Animated.View>
  );
}

// ── Soft clouds behind everything ────────────────────────────────────────────

function Clouds() {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="cloud" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.85} />
          <Stop offset="70%" stopColor="#FFFFFF" stopOpacity={0.35} />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx="2%" cy="47%" rx="26%" ry="6%" fill="url(#cloud)" opacity={0.7} />
      <Ellipse cx="102%" cy="40%" rx="24%" ry="5%" fill="url(#cloud)" opacity={0.7} />
      <Ellipse cx="14%" cy="88%" rx="42%" ry="9%" fill="url(#cloud)" />
      <Ellipse cx="92%" cy="96%" rx="40%" ry="10%" fill="url(#cloud)" />
    </Svg>
  );
}

// ── Proportional sizing ──────────────────────────────────────────────────────

/**
 * The dock is fixed chrome at the spec's 350x80; everything ABOVE it scales
 * by k so the column always fits without a scroll view. DESIGN_CONTENT is
 * that upper block's natural height at k = 1. Every vertical number on this screen is the design
 * value times `k`, so the whole column compresses uniformly and the dock —
 * home's only navigation — lands above the fold on ANY phone. There is no
 * scroll view to fall back to, on purpose. The floor keeps text legible on
 * the very smallest screens.
 */
// 750 is the block's natural height; the margin absorbs the rounding that
// s() adds across a dozen stacked values on the shortest phones.
const DESIGN_CONTENT = 762;
/** The dock is the global bar now (components/v2/dark/bottom-nav.tsx); the
 *  column just leaves its footprint clear. */

interface Sizes {
  k: number;
  s: (n: number) => number;
}

function makeStyles({ s }: Sizes) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 22,
    },
    headerButton: {
      width: s(56),
      height: s(56),
      alignItems: 'center',
      justifyContent: 'center',
    },
    wordmark: {
      fontSize: s(34),
      fontWeight: '600',
      letterSpacing: s(10),
      color: PRIMARY,
      // The tracking after the O would push the mark off-centre; swallow it.
      marginRight: -s(10),
    },
    bellDot: {
      position: 'absolute',
      top: s(13),
      right: s(14),
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: '#F04438',
    },

    orbWrap: { alignItems: 'center', marginTop: -s(12) },
    speaking: {
      marginTop: -s(24),
      textAlign: 'center',
      fontSize: s(20),
      fontWeight: '700',
      color: PRIMARY,
    },
    listening: {
      marginTop: s(6),
      textAlign: 'center',
      fontSize: s(15),
      color: MUTED,
    },

    creditCard: {
      marginTop: s(22),
      marginHorizontal: 20,
      paddingVertical: s(16),
      paddingHorizontal: 26,
      flexDirection: 'row',
      alignItems: 'center',
    },
    creditText: { flex: 1 },
    creditLabel: {
      fontSize: s(13),
      fontWeight: '700',
      letterSpacing: 2.5,
      color: '#4A83E8',
    },
    creditValue: {
      marginTop: s(4),
      fontSize: s(50),
      lineHeight: s(56),
      fontWeight: '700',
      color: PRIMARY,
    },
    creditHint: { marginTop: s(2), fontSize: s(16), color: MUTED },
    creditArrow: {
      width: s(64),
      height: s(64),
      alignItems: 'center',
      justifyContent: 'center',
    },

    statRow: {
      flexDirection: 'row',
      gap: 14,
      marginTop: s(16),
      marginHorizontal: 20,
    },
    statCard: { flex: 1, padding: s(16), paddingBottom: s(14) },
    statHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    statTitle: { fontSize: s(17), fontWeight: '600', color: INK },
    cardIcon: {
      width: s(40),
      height: s(40),
      alignItems: 'center',
      justifyContent: 'center',
    },
    statValue: {
      marginTop: s(10),
      fontSize: s(40),
      lineHeight: s(46),
      fontWeight: '700',
      color: PRIMARY,
    },
    statUnit: { fontSize: s(24), fontWeight: '700' } as TextStyle,
    track: {
      marginTop: s(10),
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(79,134,238,0.16)',
      overflow: 'hidden',
    },
    fill: { height: 8, borderRadius: 4 },
    statCaption: { marginTop: s(10), fontSize: Math.max(11, s(13)), color: MUTED },
    statCaptionStrong: { color: PRIMARY, fontWeight: '700' } as TextStyle,

    spacer: { flex: 1, minHeight: s(10) },
  });
}

// ── The screen ───────────────────────────────────────────────────────────────

/**
 * The home dashboard as a pane of morning sky: a listening orb, one credit
 * card, two stat tiles and a glass dock. Everything on it is live — credits
 * are the child's balls balance, activity is the tamagochi's average
 * well-being, achievements come from the real ledger — but the layout,
 * spacing and light are the glassmorphism mock, down to the bell's red dot.
 *
 * There is deliberately NO scroll view here: the whole column is scaled by
 * `k` to the phone it is on (see DESIGN_CONTENT), so the dock — home's only
 * navigation — is always on screen. The screen brings its own dock
 * (Bir maqsad · DUYO · Neo Miyya), so the global tab bar hides itself while
 * the home tab is focused — two bars would double-announce the same places.
 */
export function GlassHome() {
  const balls = useBalls();
  const tamagochi = useTamagochi();
  const achievements = useAchievements();
  const unread = useUnreadNotificationCount();
  const insets = useSafeAreaInsets();
  const navClearance = useNavClearance();
  // Sibling tabs are reached the way the tab bar itself reaches them —
  // navigate() on this screen's navigator. router.push into a (tabs) group
  // from inside the group is a silent no-op on web.
  const navigation = useNavigation();
  const toTab = (route: 'profile' | 'goals' | 'chat' | 'brain') =>
    (navigation as { navigate(name: string): void }).navigate(route);

  const { height: windowH } = useWindowDimensions();
  const topPad = Math.max(insets.top, 44);
  const k = Math.min(
    1,
    Math.max(0.6, (windowH - topPad - navClearance) / DESIGN_CONTENT),
  );
  const sizes = useMemo<Sizes>(() => ({ k, s: (n: number) => Math.round(n * k) }), [k]);
  const styles = useMemo(() => makeStyles(sizes), [sizes]);
  const orbSize = sizes.s(GLOW_MAX);

  const credit = balls.data?.balance;
  const activity = useMemo(() => {
    const t = tamagochi.data;
    if (!t) return null;
    return Math.round((t.energy + t.joy + t.learning + t.health) / 4);
  }, [tamagochi.data]);
  const earned = achievements.data?.filter((a) => a.earned).length ?? null;
  const total = achievements.data?.length ?? null;
  const hasUnread = (unread.data?.count ?? 0) > 0;

  return (
    <View style={rootStyles.root}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Clouds />

      <View
        style={[
          rootStyles.column,
          {
            paddingTop: topPad + sizes.s(10),
            // The system gesture bar owns the bottom edge now that the global
            // tab bar hides itself here — the dock must clear it.
            paddingBottom: navClearance,
          },
        ]}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => toTab('profile')}
            accessibilityRole="button"
            accessibilityLabel="Profil"
            style={[glass(28, 'sm'), styles.headerButton]}
          >
            <User size={sizes.s(24)} color={PRIMARY} strokeWidth={1.8} />
          </Pressable>

          <Text style={styles.wordmark}>DUYO</Text>

          <Pressable
            onPress={() => router.push('/(main)/notifications')}
            accessibilityRole="button"
            accessibilityLabel="Bildirishnomalar"
            style={[glass(28, 'sm'), styles.headerButton]}
          >
            <Bell size={sizes.s(23)} color={PRIMARY} strokeWidth={1.8} />
            {hasUnread && <View style={styles.bellDot} />}
          </Pressable>
        </View>

        {/* ── The listening orb ──────────────────────────────────────── */}
        <Pressable
          onPress={() => router.push('/(main)/voice')}
          accessibilityRole="button"
          accessibilityLabel="Ovozli suhbatni boshlash"
          style={styles.orbWrap}
        >
          <ListeningOrb size={orbSize} />
        </Pressable>
        <Text style={styles.speaking}>boshlash uchun bosing</Text>
        <Text style={styles.listening}>men sizni tinglayapman</Text>

        {/* ── AI kredit ──────────────────────────────────────────────── */}
        <Pressable
          onPress={() => router.push('/(main)/subscription')}
          accessibilityRole="button"
          accessibilityLabel="AI kredit — limitni oshirish"
          style={[glass(30, 'lg'), styles.creditCard]}
        >
          <View style={styles.creditText}>
            <Text style={styles.creditLabel}>AI KREDIT</Text>
            <Text style={styles.creditValue}>
              {credit === undefined ? '—' : fmt(credit)}
            </Text>
            <Text style={styles.creditHint}>limitni oshirish</Text>
          </View>
          <View style={[glass(22, 'flush'), styles.creditArrow]}>
            <ArrowUpRight size={sizes.s(30)} color={PRIMARY} strokeWidth={2.2} />
          </View>
        </Pressable>

        {/* ── Faollik · Yutuqlar ─────────────────────────────────────── */}
        <View style={styles.statRow}>
          <View style={[glass(28, 'md'), styles.statCard]}>
            <View style={styles.statHead}>
              <Text style={styles.statTitle}>Faollik</Text>
              <View style={[glass(20, 'flush'), styles.cardIcon]}>
                <BarChart3 size={sizes.s(19)} color={PRIMARY} strokeWidth={2} />
              </View>
            </View>
            <Text style={styles.statValue}>
              {activity === null ? (
                '—'
              ) : (
                <>
                  {activity}
                  <Text style={styles.statUnit}>%</Text>
                </>
              )}
            </Text>
            <View style={styles.track}>
              <LinearGradient
                colors={['#4F86EE', '#7FB2FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.fill, { width: `${activity ?? 0}%` }]}
              />
            </View>
            <Text style={styles.statCaption}>Bugungi faolligingiz</Text>
          </View>

          <View style={[glass(28, 'md'), styles.statCard]}>
            <View style={styles.statHead}>
              <Text style={styles.statTitle}>Yutuqlar</Text>
              <View style={[glass(20, 'flush'), styles.cardIcon]}>
                <CheckCircle2 size={sizes.s(19)} color={PRIMARY} strokeWidth={2} />
              </View>
            </View>
            <Text style={styles.statValue}>{total === null ? '—' : total}</Text>
            <Text style={styles.statCaption}>
              {earned === null ? (
                'Yutuqlar yuklanmoqda'
              ) : (
                <>
                  Yutuqlardan{' '}
                  <Text style={styles.statCaptionStrong}>{earned}</Text> tasi
                  ochilgan
                </>
              )}
            </Text>
          </View>
        </View>

        <View style={styles.spacer} />

      </View>
    </View>
  );
}

const rootStyles = StyleSheet.create({
  root: { flex: 1 },
  column: { flex: 1, overflow: 'hidden' },
});
