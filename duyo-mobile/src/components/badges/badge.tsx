import { LinearGradient } from 'expo-linear-gradient';
import {
  Brain,
  Flame,
  Heart,
  Rocket,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react-native';

/**
 * The achievement badges.
 *
 * ## Why the glyphs are lucide icons and not drawn here
 *
 * They were hand-authored SVG paths first. Rendered at 46pt on the shelf, the
 * flame read as a droplet, the rocket read as a map pin, and the brain read as
 * two blobs — a badge nobody can name is worse than no badge. Drawing a
 * recognisable brain in one path is a real illustration job, and the app
 * already depends on a set that has done it: every icon in DUYO is lucide, so
 * these are lucide too. They are correct at any size and they match the rest
 * of the interface instead of looking like art from somewhere else.
 *
 * The disc stays ours — that is what makes a badge a badge rather than an
 * icon — and each one gets a hue, so the set is still distinguishable at 16pt
 * beside a name where the glyph itself is only ~9pt.
 *
 * ## Why six icons cover seven achievements
 *
 * The catalogue has seven (gamification/achievements.py) and two of them are
 * the same thing at different depths: a 3-day streak and a 7-day streak.
 * Separate artwork would say they are unrelated. They share the flame and
 * differ by TIER — the 7-day wears a ring — which is how a child reads "the
 * same badge, further along".
 */

/** Every achievement key the backend can send, mapped to the art it wears. */
export type BadgeKind =
  | 'spark'
  | 'brain'
  | 'rocket'
  | 'flame'
  | 'ascent'
  | 'heart';

interface BadgeArt {
  /** Two steps of one hue: lit upper-left, deeper lower-right. */
  from: string;
  to: string;
  Icon: LucideIcon;
}

const ART: Record<BadgeKind, BadgeArt> = {
  // First conversation — a struck spark.
  spark: { from: '#5FA8FF', to: '#2563EB', Icon: Sparkles },
  // Ten messages — curiosity.
  brain: { from: '#9B8CFF', to: '#6D46D9', Icon: Brain },
  // Fifty messages — going a long way.
  rocket: { from: '#5FD6C2', to: '#0E9F6E', Icon: Rocket },
  // A streak — the flame, tiered.
  flame: { from: '#FFB25F', to: '#DE6B12', Icon: Flame },
  // A level gained.
  ascent: { from: '#7FC4FF', to: '#1D6FD6', Icon: TrendingUp },
  // DUYO's friend — the rarest.
  heart: { from: '#FF9BC7', to: '#DB2777', Icon: Heart },
};

/** Which art an achievement key wears, and how rare it is.
 *
 *  `rank` is what decides the ONE badge shown beside a name: the highest a
 *  child has earned. A row of seven marks before a nickname is a wall, not a
 *  distinction — the point of a badge beside a name is that it is singular.
 *
 *  The same order lives on the server (`_RANK` in gamification/achievements.py),
 *  which is what actually picks a PEER's badge; this copy picks the child's
 *  own, from the achievements the app already has in hand. */
export const BADGE_FOR: Record<
  string,
  { kind: BadgeKind; rank: number; tier: 1 | 2 }
> = {
  first_chat: { kind: 'spark', rank: 1, tier: 1 },
  streak_3: { kind: 'flame', rank: 2, tier: 1 },
  curious: { kind: 'brain', rank: 3, tier: 1 },
  level_up: { kind: 'ascent', rank: 4, tier: 1 },
  explorer: { kind: 'rocket', rank: 5, tier: 1 },
  streak_7: { kind: 'flame', rank: 6, tier: 2 },
  duyo_dust: { kind: 'heart', rank: 7, tier: 2 },
};

/** What earns each one, in the child's words. The predicates themselves live
 *  in gamification/achievements.py; this is the same rule, said out loud. */
export const BADGE_RULE: Record<string, string> = {
  first_chat: 'DUYO bilan birinchi marta gaplashing',
  curious: '10 ta xabar yozing',
  explorer: '50 ta xabar yozing',
  streak_3: '3 kun ketma-ket kiring',
  streak_7: '7 kun ketma-ket kiring',
  level_up: '2-darajaga chiqing',
  duyo_dust: '3-darajaga chiqing',
};

/**
 * The single badge that stands beside a name.
 *
 * The highest-ranked one the child has earned, or nothing at all if they have
 * earned none — an empty slot, not a grey placeholder. A placeholder next to
 * every unbadged name would put a mark on the majority and make the
 * distinction meaningless.
 */
export function topBadge(
  earnedKeys: readonly string[],
): { kind: BadgeKind; tier: 1 | 2 } | null {
  let best: { kind: BadgeKind; tier: 1 | 2; rank: number } | null = null;
  for (const key of earnedKeys) {
    const art = BADGE_FOR[key];
    if (!art) continue;
    if (!best || art.rank > best.rank) best = { ...art };
  }
  return best ? { kind: best.kind, tier: best.tier } : null;
}

const LOCKED_FROM = '#C9D5E8';
const LOCKED_TO = '#A7B8D2';

export function Badge({
  kind,
  size = 24,
  tier = 1,
  locked = false,
}: {
  kind: BadgeKind;
  size?: number;
  /** 2 adds the ring that marks the deeper version of the same badge. */
  tier?: 1 | 2;
  /** Not earned yet: the same glyph on a grey disc, still legible as which
   *  one it is. Greyed rather than hidden — see the achievements screen. */
  locked?: boolean;
}) {
  const { from, to, Icon } = ART[kind];
  const start = locked ? LOCKED_FROM : from;
  const end = locked ? LOCKED_TO : to;

  // Tier 2 — the same badge, further along. A ring, not a different colour:
  // a colour change would say "a different achievement".
  const ring = tier === 2 ? Math.max(1.5, size * 0.07) : 0;

  // 0.56 leaves the disc reading as a disc. Larger and the glyph touches the
  // rim, which at 16pt beside a name turns the whole badge into a smudge.
  const glyph = Math.round(size * 0.56);

  return (
    // The gradient IS the disc rather than an absolutely-positioned fill
    // behind the glyph. On react-native-web a positioned child paints
    // above its static siblings, so the fill covered the icon and every
    // badge rendered as a plain coloured circle.
    <LinearGradient
      colors={[start, end]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: ring,
        borderColor: end,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Thicker than the app's usual 2: the glyph is a fraction of an
          already small badge, and a hairline disappears against the fill. */}
      <Icon
        size={glyph}
        color={locked ? 'rgba(255,255,255,0.9)' : '#FFFFFF'}
        strokeWidth={2.5}
      />
    </LinearGradient>
  );
}
