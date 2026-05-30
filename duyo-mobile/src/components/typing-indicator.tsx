import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const DOT_COUNT = 3;
const ANIM_DURATION_MS = 500;

export function TypingIndicator() {
  return (
    <View className="flex-row justify-start">
      <View className="bg-card dark:bg-dark-surface border border-neon-blue/20 rounded-2xl px-4 py-3 flex-row gap-2 items-center">
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

  return (
    <Animated.View
      style={[
        {
          width: 8,
          height: 8,
          borderRadius: 9999,
          backgroundColor: '#60A5FA',
        },
        animatedStyle,
      ]}
    />
  );
}
