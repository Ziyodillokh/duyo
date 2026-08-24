import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { glass } from '@/lib/glass';

const DOT_COUNT = 3;
const ANIM_DURATION_MS = 500;

const PRIMARY = '#2F6FE4';

export function TypingIndicator() {
  return (
    <View style={styles.row}>
      {/* Deliberately the same pane as an assistant bubble in chat.tsx —
          radius 22, 'sm', 0.62 — because it stands in the queue where the
          reply is about to appear. A different radius would read as a
          different kind of object arriving and then being replaced. */}
      <View style={[glass(22, 'sm', 0.62), styles.bubble]}>
        {Array.from({ length: DOT_COUNT }).map((_, i) => (
          <Dot key={i} delay={i * 150} />
        ))}
      </View>
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: ANIM_DURATION_MS }), -1, true),
    );
  }, [delay, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 9999,
    backgroundColor: PRIMARY,
  },
});
