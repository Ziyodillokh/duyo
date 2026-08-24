import { Pause, Play, RotateCcw } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from '@/components/text';
import Svg, { Circle } from 'react-native-svg';

import { glass } from '@/lib/glass';

/**
 * A 25-minute Pomodoro card for the brain dashboard. Remaining time is derived
 * from a wall-clock deadline rather than a decremented counter — JS timers
 * freeze while the app is backgrounded, and coming back to a stretched timer
 * would teach the child that focus time is negotiable.
 */

const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const GREEN = '#22B573';
/** The arc's purple. #C27AFF is built for the dark sky and goes to pastel on a
 *  white pane, so the ring carries the same hue several steps deeper. */
const VIOLET = '#7A4BD6';
/** The unrun part of the ring: PRIMARY at low alpha, so the track belongs to
 *  the page's light instead of reading as a grey groove. */
const TRACK = 'rgba(47,111,228,0.12)';

const TOTAL_MS = 25 * 60 * 1000;

const RING_SIZE = 84;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type Phase = 'idle' | 'running' | 'paused' | 'done';

// Ceiling, so the display holds 25:00 until a full second has really passed.
function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function FocusTimerCard() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [remainingMs, setRemainingMs] = useState(TOTAL_MS);
  const endAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== 'running') return;
    const tick = () => {
      const endAt = endAtRef.current;
      if (endAt === null) return;
      const left = endAt - Date.now();
      if (left <= 0) {
        setRemainingMs(0);
        setPhase('done');
      } else {
        setRemainingMs(left);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const start = () => {
    endAtRef.current = Date.now() + remainingMs;
    setPhase('running');
  };

  const pause = () => {
    if (endAtRef.current !== null) {
      setRemainingMs(Math.max(0, endAtRef.current - Date.now()));
    }
    setPhase('paused');
  };

  const reset = () => {
    endAtRef.current = null;
    setRemainingMs(TOTAL_MS);
    setPhase('idle');
  };

  const progress = 1 - remainingMs / TOTAL_MS;

  return (
    <View style={[glass(22, 'md'), styles.card]}>
      <Text style={styles.eyebrow}>FOKUS TAYMER</Text>

      {/* Rotated so the arc grows clockwise from 12 o'clock. */}
      <Svg
        width={RING_SIZE}
        height={RING_SIZE}
        style={{ marginTop: 12, transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={TRACK}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={VIOLET}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
        />
      </Svg>

      <Text style={styles.clock}>{formatRemaining(remainingMs)}</Text>

      {phase === 'done' ? (
        <Text style={styles.done}>Bo'ldi! Ajoyib ish ✨</Text>
      ) : (
        <Text style={styles.hint}>Chuqur ish</Text>
      )}

      <View style={styles.controls}>
        {(phase === 'idle' || phase === 'paused') && (
          <TimerButton
            label={phase === 'idle' ? 'Boshlash' : 'Davom ettirish'}
            onPress={start}
          >
            <Play size={16} color={PRIMARY} />
          </TimerButton>
        )}
        {phase === 'running' && (
          <TimerButton label="Pauza" onPress={pause}>
            <Pause size={16} color={PRIMARY} />
          </TimerButton>
        )}
        {(phase === 'paused' || phase === 'done') && (
          <TimerButton label="Qayta boshlash" onPress={reset}>
            <RotateCcw size={16} color={PRIMARY} />
          </TimerButton>
        )}
      </View>
    </View>
  );
}

function TimerButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        // An icon well sitting ON the card is 'sm' — it belongs to the card it
        // rests on, and a control that cast the card's own shadow would read as
        // floating free of it.
        glass(20, 'sm', 0.86),
        styles.button,
        pressed && styles.pressed,
        styles.focusable,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  card: { padding: 16, alignItems: 'center' },

  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 2,
    alignSelf: 'flex-start',
  },

  clock: {
    fontSize: 30,
    fontWeight: '700',
    marginTop: 8,
    color: INK,
    fontVariant: ['tabular-nums'],
  },

  done: { fontSize: 11, fontWeight: '700', marginTop: 4, color: GREEN },
  hint: { fontSize: 11, marginTop: 4, color: MUTED },

  controls: { flexDirection: 'row', gap: 10, marginTop: 12 },
  button: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
});
