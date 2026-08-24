import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import Svg, { Circle } from 'react-native-svg';

import { glass } from '@/lib/glass';

/**
 * The week's linking activity condensed into one glanceable pulse — a ring for
 * the overall percentage and a bar per weekday. Purely presentational: the
 * screen computes the numbers so this card stays dumb and reusable.
 */

const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
/** The purple a tag wears on the map (#C27AFF) is built for the dark sky and
 *  washes out on a white pane, so the bars carry the same hue several steps
 *  deeper — the move the Miya palette already makes for its blue. */
const VIOLET = '#7A4BD6';
/** The unfilled parts of the pulse: the ring track, and the days with nothing
 *  on them. PRIMARY at low alpha, so empty still belongs to the same light
 *  rather than reading as grey dirt on the glass. */
const TRACK = 'rgba(47,111,228,0.12)';
const BAR_EMPTY = 'rgba(47,111,228,0.16)';
const BAR_FUTURE = 'rgba(47,111,228,0.07)';

export interface PulseDay {
  label: string;
  count: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface KnowledgePulseCardProps {
  pulse: number | null;
  days: PulseDay[];
  weekTotal: number;
}

const RING_SIZE = 84;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const BAR_MAX_HEIGHT = 26;
// A zero day keeps a stub so the week reads as seven slots, not gaps.
const BAR_STUB_HEIGHT = 3;

function barColour(day: PulseDay): string {
  if (day.isToday) return PRIMARY;
  if (day.isFuture) return BAR_FUTURE;
  return day.count > 0 ? VIOLET : BAR_EMPTY;
}

export function KnowledgePulseCard({ pulse, days, weekTotal }: KnowledgePulseCardProps) {
  const pct = pulse === null ? 0 : Math.min(100, Math.max(0, pulse));
  const peak = Math.max(...days.map((d) => d.count), 1);

  return (
    <View style={[glass(22, 'md'), styles.card]}>
      <Text style={styles.eyebrow}>BILIM PULSI</Text>

      <View style={styles.ringBlock}>
        <View style={styles.ring}>
          {/* Rotated so the arc grows clockwise from twelve o'clock. */}
          <Svg
            width={RING_SIZE}
            height={RING_SIZE}
            style={{ transform: [{ rotate: '-90deg' }] }}
          >
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke={TRACK}
              strokeWidth={RING_STROKE}
              fill="none"
            />
            {pulse !== null && (
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={PRIMARY}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - pct / 100)}
              />
            )}
          </Svg>
          <View style={[StyleSheet.absoluteFill, styles.ringCentre]}>
            <Text style={styles.pulseValue}>{pulse ?? '—'}</Text>
            {pulse !== null && <Text style={styles.pulseUnit}>%</Text>}
          </View>
        </View>

        <Text style={styles.caption}>bog'langan qaydlar</Text>
        <Text style={styles.total}>{weekTotal} ta qayd shu hafta</Text>
      </View>

      <View style={styles.week}>
        {days.map((day, index) => (
          <View key={index} style={styles.day}>
            <View
              style={{
                width: 8,
                height:
                  day.count > 0
                    ? Math.max(BAR_STUB_HEIGHT, (day.count / peak) * BAR_MAX_HEIGHT)
                    : BAR_STUB_HEIGHT,
                borderRadius: 4,
                backgroundColor: barColour(day),
              }}
            />
            <Text
              style={{
                fontSize: 8,
                color: day.isToday ? INK : MUTED,
                fontWeight: day.isToday ? '700' : '400',
              }}
            >
              {day.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, padding: 16 },

  eyebrow: { fontSize: 10, fontWeight: '700', color: MUTED, letterSpacing: 1.5 },

  ringBlock: { alignItems: 'center', marginTop: 12 },
  ring: { width: RING_SIZE, height: RING_SIZE },
  ringCentre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  pulseValue: { fontSize: 20, fontWeight: '700', color: INK },
  pulseUnit: { fontSize: 10, fontWeight: '700', color: MUTED },

  caption: { fontSize: 10, marginTop: 8, color: MUTED },
  total: { fontSize: 11, marginTop: 2, color: INK },

  week: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 12,
    height: BAR_MAX_HEIGHT + 14,
  },
  day: { flex: 1, alignItems: 'center', gap: 4 },
});
