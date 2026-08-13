import { Pause, Play, RotateCcw } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

/**
 * A 25-minute Pomodoro card for the brain dashboard. Remaining time is derived
 * from a wall-clock deadline rather than a decremented counter — JS timers
 * freeze while the app is backgrounded, and coming back to a stretched timer
 * would teach the child that focus time is negotiable.
 */

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
    <View
      className="rounded-2xl p-4 items-center"
      style={{
        backgroundColor: 'rgba(11, 16, 32, 0.72)',
        borderColor: 'rgba(150, 180, 255, 0.18)',
        borderWidth: 1,
      }}
    >
      <Text
        className="text-[10px] font-bold self-start"
        style={{ color: '#8FA3C8', letterSpacing: 2 }}
      >
        FOKUS TAYMER
      </Text>

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
          stroke="rgba(150,180,255,0.15)"
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke="#C27AFF"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
        />
      </Svg>

      <Text
        className="text-3xl font-bold mt-2"
        style={{ color: '#E8EEFF', fontVariant: ['tabular-nums'] }}
      >
        {formatRemaining(remainingMs)}
      </Text>

      {phase === 'done' ? (
        <Text className="text-[11px] font-bold mt-1" style={{ color: '#05DF72' }}>
          Bo'ldi! Ajoyib ish ✨
        </Text>
      ) : (
        <Text className="text-[11px] mt-1" style={{ color: '#8FA3C8' }}>
          Chuqur ish
        </Text>
      )}

      <View className="flex-row gap-2.5 mt-3">
        {(phase === 'idle' || phase === 'paused') && (
          <TimerButton
            label={phase === 'idle' ? 'Boshlash' : 'Davom ettirish'}
            onPress={start}
          >
            <Play size={16} color="#E8EEFF" />
          </TimerButton>
        )}
        {phase === 'running' && (
          <TimerButton label="Pauza" onPress={pause}>
            <Pause size={16} color="#E8EEFF" />
          </TimerButton>
        )}
        {(phase === 'paused' || phase === 'done') && (
          <TimerButton label="Qayta boshlash" onPress={reset}>
            <RotateCcw size={16} color="#E8EEFF" />
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
      className="items-center justify-center active:opacity-80"
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(150,180,255,0.22)',
        backgroundColor: 'rgba(96,165,250,0.12)',
      }}
    >
      {children}
    </Pressable>
  );
}
