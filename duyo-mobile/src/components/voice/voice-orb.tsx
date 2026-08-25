import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { MascotImage } from '@/components/v2/mascot-image';

/**
 * DUYO inside its sphere, breathing with whoever is talking.
 *
 * ## What drives it
 *
 * `level` is the loudness of the audio moving through the session right now —
 * the child's microphone while they speak, DUYO's own output while it answers —
 * as a 0..1 value the caller measures off the PCM stream. Everything here is a
 * function of that and of the phase: rings widen and brighten with volume,
 * the sphere swells slightly, and in silence the whole thing settles into a
 * slow breath so the screen never looks frozen.
 *
 * ## Why the rings are Views and the sphere is SVG
 *
 * A ring is a circle of one colour — a bordered View with a radius, animated on
 * the UI thread by transform and opacity alone, which is the cheapest thing
 * React Native can animate. The sphere is a gradient, and a radial gradient has
 * no View equivalent; it needs SVG. Splitting them keeps the per-frame work on
 * two transforms and two opacities rather than on a re-rendered SVG.
 *
 * ## Why the level is smoothed by the caller, not here
 *
 * Audio arrives in chunks — about four a second from a 16kHz microphone — so a
 * raw level steps rather than flows. The caller eases each new reading into the
 * shared value; by the time it reaches this component it is already a curve,
 * and this component never re-renders for it.
 */

/** How many rings, and how long one takes to travel out. */
const RINGS = 3;
const PERIOD_MS = 2400;

export type OrbPhase = 'idle' | 'recording' | 'processing' | 'responding' | 'error';

/** The rings carry the phase; the sphere stays DUYO's own colour throughout, so
 *  the character never changes hue, only its aura does. */
const TINT: Record<OrbPhase, string> = {
  idle: '#9FC2F3',
  recording: '#2F6FE4',
  processing: '#8CA3CB',
  responding: '#7C6CF5',
  error: '#E0455E',
};

function PulseRing({
  size,
  index,
  level,
  wave,
  tint,
}: {
  size: number;
  index: number;
  level: SharedValue<number>;
  wave: SharedValue<number>;
  tint: string;
}) {
  const style = useAnimatedStyle(() => {
    // Each ring runs the same loop a third of a turn apart, so one is always
    // leaving as another is born.
    const p = (wave.get() + index / RINGS) % 1;
    const l = level.get();
    return {
      // Fades as it travels out, and only exists at all when there is sound:
      // a ring pulsing over silence would be saying something untrue.
      opacity: (1 - p) * (0.08 + 0.5 * l),
      transform: [{ scale: 0.82 + p * (0.26 + 0.6 * l) }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, borderColor: tint },
        style,
      ]}
    />
  );
}

export function VoiceOrb({
  size,
  level,
  phase,
}: {
  size: number;
  level: SharedValue<number>;
  phase: OrbPhase;
}) {
  const wave = useSharedValue(0);
  const breath = useSharedValue(0);

  useEffect(() => {
    wave.set(withRepeat(withTiming(1, { duration: PERIOD_MS, easing: Easing.linear }), -1));
    breath.set(
      withRepeat(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );
    return () => {
      cancelAnimation(wave);
      cancelAnimation(breath);
    };
  }, [wave, breath]);

  const sphere = Math.round(size * 0.62);
  const mascot = Math.round(sphere * 0.74);
  const tint = TINT[phase];

  const sphereStyle = useAnimatedStyle(() => ({
    // Breath keeps it alive in silence; level is what the voice adds on top.
    transform: [{ scale: 1 + 0.02 * breath.get() + 0.1 * level.get() }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + 0.55 * level.get(),
    transform: [{ scale: 0.95 + 0.12 * level.get() }],
  }));

  return (
    <View style={[styles.host, { width: size, height: size }]}>
      {Array.from({ length: RINGS }, (_, i) => (
        <PulseRing key={i} size={size} index={i} level={level} wave={wave} tint={tint} />
      ))}

      <Animated.View style={[styles.halo, { width: size, height: size }, haloStyle]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="vo-halo" cx="50%" cy="50%" r="50%">
              <Stop offset="40%" stopColor={tint} stopOpacity={0.22} />
              <Stop offset="72%" stopColor={tint} stopOpacity={0.09} />
              <Stop offset="100%" stopColor={tint} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#vo-halo)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.sphereWrap, sphereStyle]}>
        <Svg width={sphere} height={sphere}>
          <Defs>
            {/* Lit upper-left, like every other sphere in the app. */}
            <RadialGradient id="vo-body" cx="34%" cy="28%" r="82%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.98} />
              <Stop offset="38%" stopColor="#E4EEFD" stopOpacity={0.96} />
              <Stop offset="76%" stopColor="#BFD5F7" stopOpacity={0.95} />
              <Stop offset="100%" stopColor="#9FBAEC" stopOpacity={0.98} />
            </RadialGradient>
          </Defs>
          <Circle cx={sphere / 2} cy={sphere / 2} r={sphere / 2} fill="url(#vo-body)" />
          {/* The window-light gloss that sells the curve. */}
          <Circle
            cx={sphere * 0.34}
            cy={sphere * 0.28}
            r={sphere * 0.13}
            fill="#FFFFFF"
            opacity={0.55}
          />
        </Svg>

        <View style={styles.mascot} pointerEvents="none">
          <MascotImage size={mascot} glow="none" />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2 },
  halo: { position: 'absolute' },
  sphereWrap: { alignItems: 'center', justifyContent: 'center' },
  mascot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
