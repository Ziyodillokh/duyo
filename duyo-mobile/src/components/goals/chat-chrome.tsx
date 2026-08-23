import { Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, Rect } from 'react-native-svg';

/**
 * The furniture that makes a thread read as a chat rather than a list:
 * a patterned wallpaper, floating header pills, day pills and bubble tails.
 *
 * Modelled on Telegram, which is the shape a child already knows — but in
 * this app's daylight palette. A photographic wallpaper and dark bubbles
 * would make one screen a stranger to the rest of the product, and the
 * thing worth copying is the ANATOMY, not the colour scheme.
 */

export const CHAT_INK = '#22406F';
export const CHAT_MUTED = '#8CA3CB';
export const CHAT_PRIMARY = '#2F6FE4';
/** Their bubble: opaque white so it sits ON the wallpaper instead of
 *  dissolving into it — frosted glass over a pattern has no readable edge. */
export const BUBBLE_THEIRS = '#FFFFFF';

/**
 * A faint doodle wallpaper. Telegram's is a photograph or a pattern; a photo
 * behind a child's conversation is noise, so this is the product's own marks
 * — stars, sparks and orbits — at an opacity you notice only when you look.
 */
export function ChatWallpaper() {
  return (
    <Svg width="100%" height="100%" style={{ position: 'absolute' }} pointerEvents="none">
      <Defs>
        <Pattern
          id="doodle"
          x={0}
          y={0}
          width={104}
          height={104}
          patternUnits="userSpaceOnUse"
        >
          <G opacity={0.5} fill="none" stroke="#7FA6E0" strokeWidth={1.1}>
            {/* four-pointed spark */}
            <Path d="M22 10 q3 9 9 12 q-9 3 -12 9 q-3 -9 -9 -12 q9 -3 12 -9 Z" />
            {/* small orbit */}
            <Circle cx={74} cy={30} r={9} />
            <Path d="M62 30 q12 -7 24 0" />
            {/* crescent */}
            <Path d="M30 74 a11 11 0 1 0 14 14 a13 13 0 1 1 -14 -14 Z" />
            {/* dot cluster */}
            <Circle cx={78} cy={80} r={1.8} />
            <Circle cx={88} cy={72} r={1.4} />
            <Circle cx={90} cy={88} r={1.2} />
          </G>
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#doodle)" opacity={0.13} />
    </Svg>
  );
}

/**
 * The little curve where a bubble meets its speaker. Telegram draws it on the
 * LAST bubble of a run only, which is what makes a group of messages read as
 * one turn rather than three separate ones.
 */
export function Tail({ side, colour }: { side: 'left' | 'right'; colour: string }) {
  const style: ViewStyle =
    side === 'left'
      ? { position: 'absolute', left: -6, bottom: 0 }
      : { position: 'absolute', right: -6, bottom: 0 };
  return (
    <View style={style} pointerEvents="none">
      <Svg width={9} height={14}>
        {side === 'left' ? (
          <Path d="M9 14 L9 0 Q9 10 0 14 Z" fill={colour} />
        ) : (
          <Path d="M0 14 L0 0 Q0 10 9 14 Z" fill={colour} />
        )}
      </Svg>
    </View>
  );
}

/** A translucent capsule — the shape Telegram floats over its wallpaper. */
export const pill = (radius = 22): ViewStyle => ({
  backgroundColor: 'rgba(255,255,255,0.78)',
  borderRadius: radius,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.9)',
  boxShadow: '0 6px 18px rgba(90,130,200,0.22)',
});

export function DayPill({ label }: { label: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 10 }}>
      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderRadius: 12,
          backgroundColor: 'rgba(47,111,228,0.14)',
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#41649B' }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/** "Bugun" / "Kecha" / "17-avgust", the way the reference reads. */
const MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (same(d, now)) return 'Bugun';
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (same(d, y)) return 'Kecha';
  return `${d.getDate()}-${MONTHS[d.getMonth()]}`;
}

export function clockOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
