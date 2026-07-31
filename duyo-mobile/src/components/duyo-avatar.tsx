import { Image } from 'expo-image';
import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useMascotVariant, type MascotVariant } from '@/store/mascot';

// 12 emotional states map onto 8 hand-drawn mascot PNGs (the missing
// shades fall back to a sibling that matches the same affect).
export type DuyoState =
  | 'idle'
  | 'talking'
  | 'thinking'
  | 'sleeping'
  | 'happy'
  | 'sad'
  | 'low-energy'
  | 'reading'
  | 'celebrating'
  | 'encouraging'
  | 'crisis-support'
  | 'puzzled';

export type DuyoSize = 'sm' | 'md' | 'lg' | 'xl';

interface DuyoAvatarProps {
  state?: DuyoState;
  size?: DuyoSize;
  style?: StyleProp<ViewStyle>;
}

const SIZE_PX: Record<DuyoSize, number> = {
  sm: 64,
  md: 96,
  lg: 160,
  xl: 256,
};

// Slots, not states: several states share one drawing.
type Slot =
  | 'idle'
  | 'happy'
  | 'sad'
  | 'sleeping'
  | 'thinking'
  | 'excited'
  | 'concerned'
  | 'puzzled';

const DUYO_ASSETS: Record<Slot, number> = {
  idle: require('@/assets/duyo/idle.png'),
  happy: require('@/assets/duyo/happy.png'),
  sad: require('@/assets/duyo/sad.png'),
  sleeping: require('@/assets/duyo/sleeping.png'),
  thinking: require('@/assets/duyo/thinking.png'),
  excited: require('@/assets/duyo/excited.png'),
  concerned: require('@/assets/duyo/concerned.png'),
  puzzled: require('@/assets/images/duyo-puzzled.png'),
};

// The raccoon comes in three poses, so the quieter slots share the seated one
// (the calmest of the three) and the upbeat ones share the arms-up cheer.
const RACCOON_ASSETS: Record<Slot, number> = {
  idle: require('@/assets/duyo/raccoon/idle.png'),
  happy: require('@/assets/duyo/raccoon/excited.png'),
  excited: require('@/assets/duyo/raccoon/excited.png'),
  sad: require('@/assets/duyo/raccoon/thinking.png'),
  sleeping: require('@/assets/duyo/raccoon/thinking.png'),
  thinking: require('@/assets/duyo/raccoon/thinking.png'),
  concerned: require('@/assets/duyo/raccoon/thinking.png'),
  puzzled: require('@/assets/duyo/raccoon/thinking.png'),
};

const ASSETS: Record<MascotVariant, Record<Slot, number>> = {
  duyo: DUYO_ASSETS,
  raccoon: RACCOON_ASSETS,
};

function slotFor(state: DuyoState): Slot {
  switch (state) {
    case 'idle':
      return 'idle';
    case 'happy':
    case 'encouraging':
      return 'happy';
    case 'sad':
      return 'sad';
    case 'low-energy':
    case 'sleeping':
      return 'sleeping';
    case 'thinking':
    case 'reading':
      return 'thinking';
    case 'talking':
    case 'celebrating':
      return 'excited';
    case 'crisis-support':
      return 'concerned';
    case 'puzzled':
      return 'puzzled';
  }
}

export function DuyoAvatar({
  state = 'idle',
  size = 'md',
  style,
}: DuyoAvatarProps) {
  const sizePx = SIZE_PX[size];
  const variant = useMascotVariant();

  // Subtle "breathing" — always on, all states.
  const breath = useSharedValue(1);
  // Celebrating gets an extra bounce on top of the breath.
  const bounce = useSharedValue(0);

  useEffect(() => {
    breath.value = withRepeat(
      withSequence(
        withTiming(1.03, {
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(1, {
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
        }),
      ),
      -1,
      false,
    );
  }, [breath]);

  useEffect(() => {
    bounce.value =
      state === 'celebrating'
        ? withRepeat(
            withSequence(
              withTiming(-8, {
                duration: 360,
                easing: Easing.out(Easing.quad),
              }),
              withTiming(0, {
                duration: 360,
                easing: Easing.in(Easing.quad),
              }),
            ),
            -1,
            false,
          )
        : withTiming(0, { duration: 200 });
  }, [bounce, state]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value }, { translateY: bounce.value }],
  }));

  return (
    <View
      style={[
        {
          width: sizePx,
          height: sizePx,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Animated.View style={animatedStyle}>
        <Image
          source={ASSETS[variant][slotFor(state)]}
          style={{ width: sizePx, height: sizePx }}
          contentFit="contain"
          accessibilityLabel={`${variant === 'raccoon' ? 'Yenot' : 'DUYO'} ${state}`}
        />
      </Animated.View>

      {state === 'crisis-support' && (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 16,
            height: 16,
            backgroundColor: '#FACC15',
            borderRadius: 9999,
            borderWidth: 2,
            borderColor: '#FFFFFF',
          }}
        />
      )}

      {state === 'low-energy' && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: '15%',
            right: '15%',
            height: 4,
            backgroundColor: 'rgba(239, 68, 68, 0.25)',
            borderRadius: 9999,
          }}
        />
      )}
    </View>
  );
}
