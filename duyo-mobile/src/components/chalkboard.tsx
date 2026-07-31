import { X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { BoardSolution } from '@/api/endpoints/board';

// Chalkboard palette — kept local: these are physical-object colours (slate,
// wood, chalk), not app theme tokens, and should not shift with light/dark.
const SLATE = '#20372E';
const SLATE_EDGE = '#16261F';
const WOOD = '#8A5A33';
const WOOD_DARK = '#6B4526';
const CHALK = '#F2EFE4';
const CHALK_DIM = '#A9BDAF';
const CHALK_YELLOW = '#FFE08A';

// Writing pace. Per-character so a long line takes longer to "write" than a
// short one, which is what makes it read as handwriting rather than a fade-in.
const MS_PER_CHAR = 42;
const MIN_WRITE_MS = 380;
const LINE_GAP_MS = 260;
const START_DELAY_MS = 420;

function writeDuration(text: string): number {
  return Math.max(MIN_WRITE_MS, text.length * MS_PER_CHAR);
}

interface ChalkLineProps {
  text: string;
  delay: number;
  size: number;
  color?: string;
  bold?: boolean;
  /** Fires once this line has finished being written. */
  onDone?: () => void;
}

/**
 * One line of chalk, revealed left-to-right.
 *
 * The text is laid out once (invisible) to measure its width, then a clipping
 * wrapper is widened 0 → measured. That produces a true writing wipe; animating
 * opacity instead would just fade the whole line in at once.
 */
function ChalkLine({
  text,
  delay,
  size,
  color = CHALK,
  bold = false,
  onDone,
}: ChalkLineProps) {
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    if (width <= 0) return;
    const duration = writeDuration(text);
    const timers = [
      setTimeout(() => setWriting(true), delay),
      setTimeout(() => {
        setWriting(false);
        onDone?.();
      }, delay + duration),
    ];
    progress.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.linear }),
    );
    return () => timers.forEach(clearTimeout);
    // onDone is a fresh closure each render; re-running on it would restart
    // the animation mid-write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, text, delay, progress]);

  const clipStyle = useAnimatedStyle(() => ({ width: width * progress.value }));

  const textStyle = {
    fontSize: size,
    lineHeight: size * 1.45,
    color,
    fontWeight: (bold ? '700' : '500') as '700' | '500',
    letterSpacing: 0.5,
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {/* Measurer — never visible, only reports its natural width. */}
      <Text
        numberOfLines={1}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[textStyle, { position: 'absolute', opacity: 0 }]}
      >
        {text}
      </Text>

      <Animated.View style={[{ overflow: 'hidden' }, clipStyle]}>
        <Text numberOfLines={1} style={textStyle}>
          {text}
        </Text>
      </Animated.View>

      {writing && <ChalkTip height={size} />}
    </View>
  );
}

/**
 * Fades (and optionally lifts) its children in after `delay`.
 *
 * Deliberately built from useSharedValue/useAnimatedStyle rather than
 * Reanimated's `entering={FadeIn}` layout animations: the shared-value pattern
 * is already proven on device by DuyoAvatar, whereas no screen in this app has
 * ever mounted a layout animation.
 */
function FadeInView({
  delay,
  duration = 320,
  rise = 0,
  style,
  children,
  accessibilityLabel,
}: {
  delay: number;
  duration?: number;
  rise?: number;
  style?: ViewStyle;
  children: React.ReactNode;
  accessibilityLabel?: string;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration }));
  }, [delay, duration, progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * rise }],
  }));

  return (
    <Animated.View style={[style, animated]} accessibilityLabel={accessibilityLabel}>
      {children}
    </Animated.View>
  );
}

/** The chalk stub at the write head — a soft pulsing nub, not a text caret. */
function ChalkTip({ height }: { height: number }) {
  const pulse = useSharedValue(0.45);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 260 }),
        withTiming(0.45, { duration: 260 }),
      ),
      -1,
      true,
    );
  }, [pulse]);

  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[
        {
          width: 3,
          height: height * 0.9,
          marginLeft: 3,
          borderRadius: 2,
          backgroundColor: CHALK,
        },
        style,
      ]}
    />
  );
}

interface ChalkboardProps {
  solution: BoardSolution;
  onClose: () => void;
  /** Compact layout for shorter screens. */
  compact?: boolean;
}

/**
 * The board DUYO writes on when a child asks a solvable problem mid-chat.
 *
 * Lines are scheduled sequentially — heading, problem, each step, answer — so
 * the child watches the working appear at reading pace instead of being handed
 * a finished wall of text.
 */
export function Chalkboard({ solution, onClose, compact = false }: ChalkboardProps) {
  const { title, problem, steps, answer } = solution;

  const problemSize = compact ? 22 : 26;
  const stepSize = compact ? 18 : 21;
  const noteSize = compact ? 11 : 12;
  const answerSize = compact ? 22 : 26;

  // Walk the lines once, accumulating each one's start time.
  let cursor = START_DELAY_MS;
  const problemDelay = cursor;
  cursor += writeDuration(problem) + LINE_GAP_MS;

  const stepDelays = steps.map((s) => {
    const at = cursor;
    cursor += writeDuration(s.expr) + LINE_GAP_MS;
    return at;
  });

  const answerDelay = cursor;

  return (
    <FadeInView
      delay={0}
      duration={420}
      rise={14}
      style={{
        width: '100%',
        borderRadius: 18,
        padding: 7,
        backgroundColor: WOOD,
        borderWidth: 2,
        borderColor: WOOD_DARK,
        shadowColor: '#000',
        shadowOpacity: 0.32,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 12,
      }}
      accessibilityLabel={`Doska: ${problem}. Javob: ${answer}`}
    >
      {/* Slate */}
      <View
        style={{
          borderRadius: 12,
          backgroundColor: SLATE,
          borderWidth: 1,
          borderColor: SLATE_EDGE,
          paddingHorizontal: compact ? 16 : 22,
          paddingTop: compact ? 12 : 16,
          paddingBottom: compact ? 14 : 18,
          overflow: 'hidden',
        }}
      >
        {/* Heading row — chalk-dust rule underneath */}
        <View className="flex-row items-center justify-between">
          <Text
            style={{
              fontSize: noteSize + 1,
              color: CHALK_DIM,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              fontWeight: '600',
            }}
          >
            {title || 'Masala'}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Doskani yopish"
            hitSlop={12}
            className="p-1"
          >
            <X size={16} color={CHALK_DIM} />
          </Pressable>
        </View>
        <View
          style={{
            height: 1,
            backgroundColor: CHALK_DIM,
            opacity: 0.18,
            marginTop: 6,
            marginBottom: compact ? 10 : 14,
          }}
        />

        {/* The problem */}
        <ChalkLine text={problem} delay={problemDelay} size={problemSize} bold />

        {/* Working */}
        <View style={{ marginTop: compact ? 8 : 12, gap: compact ? 6 : 9 }}>
          {steps.map((step, i) => (
            <View key={`${step.expr}-${i}`}>
              <ChalkLine text={step.expr} delay={stepDelays[i]} size={stepSize} />
              {!!step.note && (
                <FadeInView
                  delay={stepDelays[i] + writeDuration(step.expr)}
                  duration={300}
                >
                  <Text
                    style={{
                      fontSize: noteSize,
                      color: CHALK_DIM,
                      marginTop: 1,
                      fontStyle: 'italic',
                    }}
                  >
                    {step.note}
                  </Text>
                </FadeInView>
              )}
            </View>
          ))}
        </View>

        {/* Answer — underscored in yellow chalk, the way a teacher would */}
        {!!answer && (
          <FadeInView
            delay={answerDelay}
            duration={360}
            style={{
              marginTop: compact ? 12 : 16,
              alignSelf: 'flex-start',
              borderTopWidth: 2,
              borderTopColor: CHALK_YELLOW,
              paddingTop: 8,
            }}
          >
            <ChalkLine
              text={answer}
              delay={answerDelay + 120}
              size={answerSize}
              color={CHALK_YELLOW}
              bold
            />
          </FadeInView>
        )}
      </View>

      {/* Chalk tray */}
      <View
        style={{
          height: 6,
          marginTop: 6,
          marginHorizontal: 10,
          borderRadius: 3,
          backgroundColor: WOOD_DARK,
        }}
      />
    </FadeInView>
  );
}
