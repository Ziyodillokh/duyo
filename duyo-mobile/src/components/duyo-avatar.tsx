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

// Mirror of duyo-web-prototype/src/app/components/duyo/DuyoAvatar.tsx
// All 11 emotional states + 3 body shapes. Pure View/style — no SVG.
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
  | 'crisis-support';

export type DuyoSize = 'sm' | 'md' | 'lg' | 'xl';
export type DuyoBodyShape = 'spherical' | 'cubic' | 'vertical';

interface DuyoAvatarProps {
  state?: DuyoState;
  size?: DuyoSize;
  bodyShape?: DuyoBodyShape;
  primaryColor?: string;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
}

const SIZE_PX: Record<DuyoSize, number> = {
  sm: 64,
  md: 96,
  lg: 160,
  xl: 256,
};

const BODY_SHAPE_RADIUS: Record<DuyoBodyShape, number> = {
  spherical: 9999,
  cubic: 24,
  vertical: 32,
};

const FACE_WHITE = '#FFFFFF';
const WARNING_YELLOW = '#FACC15';
const LOW_ENERGY_BAR_RGBA = 'rgba(239, 68, 68, 0.2)';

export function DuyoAvatar({
  state = 'idle',
  size = 'md',
  bodyShape = 'spherical',
  primaryColor = '#2563EB',
  accentColor = '#FFC700',
  style,
}: DuyoAvatarProps) {
  const sizePx = SIZE_PX[size];
  const bodyWidth = bodyShape === 'vertical' ? sizePx * 0.75 : sizePx;
  const bodyRadius = BODY_SHAPE_RADIUS[bodyShape];

  const bodyTranslate = useSharedValue(0);
  const eyeOpacity = useSharedValue(1);
  const antennaOpacity = useSharedValue(1);

  useEffect(() => {
    bodyTranslate.value =
      state === 'celebrating'
        ? withRepeat(
            withSequence(
              withTiming(-10, {
                duration: 400,
                easing: Easing.out(Easing.quad),
              }),
              withTiming(0, {
                duration: 400,
                easing: Easing.in(Easing.quad),
              }),
            ),
            -1,
            false,
          )
        : withTiming(0, { duration: 200 });

    const shouldPulseEyes = state === 'thinking' || state === 'talking';
    eyeOpacity.value = shouldPulseEyes
      ? withRepeat(withTiming(0.5, { duration: 500 }), -1, true)
      : withTiming(1, { duration: 200 });

    const shouldPulseAntenna = state === 'thinking' || state === 'reading';
    antennaOpacity.value = shouldPulseAntenna
      ? withRepeat(withTiming(0.5, { duration: 600 }), -1, true)
      : withTiming(1, { duration: 200 });
  }, [state, bodyTranslate, eyeOpacity, antennaOpacity]);

  const bodyAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bodyTranslate.value }],
  }));
  const eyeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: eyeOpacity.value,
  }));
  const antennaAnimatedStyle = useAnimatedStyle(() => ({
    opacity: antennaOpacity.value,
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
      <Animated.View
        style={[
          {
            width: bodyWidth,
            height: sizePx,
            backgroundColor: primaryColor,
            borderRadius: bodyRadius,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          },
          bodyAnimatedStyle,
        ]}
      >
        {/* Antenna with star — sits above the body */}
        <Animated.View
          style={[
            { position: 'absolute', top: -8, alignItems: 'center' },
            antennaAnimatedStyle,
          ]}
        >
          <View
            style={{
              width: 4,
              height: 24,
              backgroundColor: accentColor,
              opacity: 0.7,
            }}
          />
          <View
            style={{
              width: 12,
              height: 12,
              backgroundColor: accentColor,
              transform: [{ rotate: '45deg' }],
              marginTop: -2,
            }}
          />
        </Animated.View>

        {/* Face */}
        <View style={{ alignItems: 'center', gap: 8, zIndex: 1 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Eye state={state} animatedStyle={eyeAnimatedStyle} />
            <Eye state={state} animatedStyle={eyeAnimatedStyle} />
          </View>
          <Mouth state={state} />
        </View>

        {/* Accent stripe at the lower portion of the body */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: sizePx / 4,
            backgroundColor: accentColor,
            opacity: 0.3,
          }}
        />
      </Animated.View>

      {state === 'crisis-support' && (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            width: 16,
            height: 16,
            backgroundColor: WARNING_YELLOW,
            borderRadius: 9999,
            borderWidth: 2,
            borderColor: FACE_WHITE,
          }}
        />
      )}

      {state === 'low-energy' && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 8,
            backgroundColor: LOW_ENERGY_BAR_RGBA,
            borderRadius: 9999,
          }}
        />
      )}
    </View>
  );
}

interface EyeProps {
  state: DuyoState;
  animatedStyle: ReturnType<typeof useAnimatedStyle>;
}

function Eye({ state, animatedStyle }: EyeProps) {
  let height = 12;
  let scale = 1;
  let opacity = 1;
  switch (state) {
    case 'sleeping':
      height = 4;
      break;
    case 'happy':
    case 'celebrating':
      height = 16;
      scale = 1.1;
      break;
    case 'sad':
      opacity = 0.7;
      break;
  }

  return (
    <Animated.View
      style={[
        {
          width: 12,
          height,
          borderRadius: 9999,
          backgroundColor: FACE_WHITE,
          opacity,
          transform: [{ scale }],
        },
        animatedStyle,
      ]}
    />
  );
}

function Mouth({ state }: { state: DuyoState }) {
  switch (state) {
    case 'happy':
    case 'celebrating':
      return (
        <View
          style={{
            width: 32,
            height: 16,
            borderBottomWidth: 4,
            borderBottomColor: FACE_WHITE,
            borderBottomLeftRadius: 9999,
            borderBottomRightRadius: 9999,
          }}
        />
      );
    case 'sad':
      return (
        <View
          style={{
            width: 32,
            height: 12,
            borderTopWidth: 4,
            borderTopColor: FACE_WHITE,
            borderTopLeftRadius: 9999,
            borderTopRightRadius: 9999,
            opacity: 0.6,
          }}
        />
      );
    case 'sleeping':
      return (
        <View
          style={{
            width: 24,
            height: 4,
            backgroundColor: FACE_WHITE,
            opacity: 0.5,
            borderRadius: 9999,
          }}
        />
      );
    case 'talking':
      return (
        <View
          style={{
            width: 24,
            height: 12,
            borderWidth: 2,
            borderColor: FACE_WHITE,
            borderRadius: 9999,
          }}
        />
      );
    default:
      return (
        <View
          style={{
            width: 24,
            height: 8,
            borderBottomWidth: 2,
            borderBottomColor: FACE_WHITE,
            borderBottomLeftRadius: 9999,
            borderBottomRightRadius: 9999,
          }}
        />
      );
  }
}
