import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

/**
 * The week's linking activity condensed into one glanceable pulse — a ring for
 * the overall percentage and a bar per weekday. Purely presentational: the
 * screen computes the numbers so this card stays dumb and reusable.
 */

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
  if (day.isToday) return '#60A5FA';
  if (day.isFuture) return 'rgba(150, 180, 255, 0.10)';
  return day.count > 0 ? '#8B5CF6' : 'rgba(150, 180, 255, 0.18)';
}

export function KnowledgePulseCard({ pulse, days, weekTotal }: KnowledgePulseCardProps) {
  const pct = pulse === null ? 0 : Math.min(100, Math.max(0, pulse));
  const peak = Math.max(...days.map((d) => d.count), 1);

  return (
    <View
      className="flex-1 rounded-2xl p-4"
      style={{
        backgroundColor: 'rgba(11, 16, 32, 0.72)',
        borderColor: 'rgba(150, 180, 255, 0.18)',
        borderWidth: 1,
      }}
    >
      <Text
        className="text-[10px] font-bold"
        style={{ color: '#8FA3C8', letterSpacing: 1.5 }}
      >
        BILIM PULSI
      </Text>

      <View className="items-center mt-3">
        <View style={{ width: RING_SIZE, height: RING_SIZE }}>
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
              stroke="rgba(150, 180, 255, 0.15)"
              strokeWidth={RING_STROKE}
              fill="none"
            />
            {pulse !== null && (
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke="#60A5FA"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - pct / 100)}
              />
            )}
          </Svg>
          <View className="absolute inset-0 flex-row items-center justify-center">
            <Text className="text-xl font-bold" style={{ color: '#E8EEFF' }}>
              {pulse ?? '—'}
            </Text>
            {pulse !== null && (
              <Text className="text-[10px] font-bold" style={{ color: '#8FA3C8' }}>
                %
              </Text>
            )}
          </View>
        </View>

        <Text className="text-[10px] mt-2" style={{ color: '#8FA3C8' }}>
          bog'langan qaydlar
        </Text>
        <Text className="text-[11px] mt-0.5" style={{ color: '#E8EEFF' }}>
          {weekTotal} ta qayd shu hafta
        </Text>
      </View>

      <View
        className="flex-row items-end justify-between mt-3"
        style={{ height: BAR_MAX_HEIGHT + 14 }}
      >
        {days.map((day, index) => (
          <View key={index} className="items-center gap-1 flex-1">
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
                color: day.isToday ? '#E8EEFF' : '#8FA3C8',
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
