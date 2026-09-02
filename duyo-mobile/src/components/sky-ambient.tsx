import { memo, useEffect, useMemo, type ReactNode } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import {
  CLUSTER_PT,
  twinkleClusters,
  wanderAt,
  WANDER_LAP_MS,
  WANDER_REACH,
  type Cluster,
} from '@/lib/ambient';

/**
 * The sky's ambient motion — everything that moves forever, and none of it
 * inside the main canvas.
 *
 * ## The one rule
 *
 * react-native-svg's SvgView rasterises all its children into ONE Android
 * bitmap and re-rasterises the whole thing whenever any child's prop changes.
 * So there is no cheap animation INSIDE an <Svg>: not opacity on a <G>, not a
 * gradient stop, not strokeDashoffset, not a radius. Every one of them is a
 * full-canvas repaint, which is what froze this screen for three seconds and
 * why the ambient physics drift was retired.
 *
 * A parent View's transform and alpha are a different thing entirely: they are
 * RenderNode properties, so Android re-COMPOSITES the cached bitmap without
 * redrawing a pixel of it. That is why pinch-zoom on this map has always been
 * 60fps.
 *
 * Every layer in this file is therefore the same shape: a small <Svg> whose
 * contents NEVER change, wrapped in an Animated.View that moves. Per frame,
 * each layer repaints exactly zero elements and allocates nothing, and the JS
 * thread does no work at all.
 *
 * ## Why so many small canvases instead of one big one
 *
 * Each SvgView is its own bitmap, so cost is AREA, not element count. Twelve
 * 72pt clusters are 2.24 MB on a 3x phone; the same twelve twinkles inside one
 * viewport-sized layer would be 11.8 MB. Small and many beats big and one.
 *
 * ## Gradient ids
 *
 * Deliberately prefixed `amb-`. On Android rnsvg scopes brushes per SvgView,
 * but on react-native-web these become real DOM <defs> and ids are
 * DOCUMENT-global — an `id="sun-glow"` here would silently steal the main
 * canvas's.
 */

/** The camera, as the ambient layers see it. They live INSIDE the transformed
 *  canvas view, so parallax is a counter-translate and it has to be measured
 *  from the camera the fit landed on rather than from zero. */
export interface Camera {
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  /** Where the fit parked the camera. Without it a layer would be displaced by
   *  the whole fitted offset the moment it mounted. */
  x0: SharedValue<number>;
  y0: SharedValue<number>;
  scale: SharedValue<number>;
}

/** How much of the child's pan a background layer declines to follow. 0.15 is
 *  small on purpose: a background that lags too far detaches from the sky and
 *  reads as a bug, and only ~15% is needed for the eye's parallax channel to
 *  say "this has depth".
 *
 *  Zoom parallax is deliberately not attempted — a starfield that resists the
 *  pinch separates from the planets at 3x and looks broken. */
const DEPTH = 0.85;

/* ─────────────────────────────────────────────────────────────────────────
   Twinkle
   ───────────────────────────────────────────────────────────────────────── */

/** One cluster: up to three <Path>s under a View that breathes. The Svg is
 *  rasterised once and never again; the breath is the parent's alpha. */
const TwinkleCluster = memo(function TwinkleCluster({
  cluster,
  on,
  cam,
}: {
  cluster: Cluster;
  on: boolean;
  cam: Camera;
}) {
  const a = useSharedValue(1);

  useEffect(() => {
    if (!on) {
      cancelAnimation(a);
      a.set(1);
      return;
    }
    a.set(
      withDelay(
        cluster.delayMs,
        withRepeat(
          withTiming(cluster.floor, {
            duration: cluster.periodMs,
            // Sinusoidal in and out: a linear fade has corners at both ends
            // and the eye reads a corner as a switch being thrown.
            easing: Easing.inOut(Easing.sin),
          }),
          -1,
          true, // reversing, so it breathes rather than blinks
        ),
      ),
    );
    return () => cancelAnimation(a);
  }, [on, a, cluster.delayMs, cluster.periodMs, cluster.floor]);

  const style = useAnimatedStyle(() => {
    // Divided by the scale because a child's translate happens inside the
    // parent's scale: `u` points local is `u * s` points on screen.
    const s = Math.max(0.1, cam.scale.get());
    return {
      opacity: a.get(),
      transform: [
        { translateX: ((DEPTH - 1) * (cam.tx.get() - cam.x0.get())) / s },
        { translateY: ((DEPTH - 1) * (cam.ty.get() - cam.y0.get())) / s },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      // Explicit: an alpha under 1 on a view Android thinks has overlapping
      // children is drawn through an offscreen buffer, which would put back
      // the per-frame allocation this whole file exists to remove.
      needsOffscreenAlphaCompositing={false}
      style={[
        {
          position: 'absolute',
          left: cluster.left,
          top: cluster.top,
          width: CLUSTER_PT,
          height: CLUSTER_PT,
        },
        style,
      ]}
    >
      <Svg width={CLUSTER_PT} height={CLUSTER_PT}>
        {cluster.paths.map((d, i) => (
          <Path key={i} d={d} fill="#FFFFFF" opacity={0.45 + i * 0.22} />
        ))}
      </Svg>
    </Animated.View>
  );
});

/** Twelve clusters, twelve rhythms, no two in phase. */
export const TwinkleField = memo(function TwinkleField({
  width,
  height,
  on,
  cam,
}: {
  width: number;
  height: number;
  on: boolean;
  cam: Camera;
}) {
  const clusters = useMemo(() => twinkleClusters(width, height), [width, height]);
  return (
    <>
      {clusters.map((c, i) => (
        <TwinkleCluster key={i} cluster={c} on={on} cam={cam} />
      ))}
    </>
  );
});

/* ─────────────────────────────────────────────────────────────────────────
   The sun
   ───────────────────────────────────────────────────────────────────────── */

/**
 * The sun's corona, breathing.
 *
 * This is the glow that used to be a static <Circle url(#sun-glow)> inside the
 * main canvas. Lifting it out takes five elements off every repaint of the
 * main sky (the circle, plus its gradient and three stops out of Defs) — so
 * the main canvas ends up cheaper than before, and the child gets a star that
 * swells and fades instead of a decal.
 */
export const SunBreath = memo(function SunBreath({
  x,
  y,
  r,
  on,
  dim,
}: {
  /** Centre of the sun, in field coordinates. */
  x: number;
  y: number;
  /** The sun's DRAWN radius, the same `rd` the main canvas uses. */
  r: number;
  on: boolean;
  dim: boolean;
}) {
  // The glow reaches 2.5r, and the breath scales it to 1.08 of that.
  const span = Math.ceil(r * 2.5 * 2 * 1.1);
  const k = useSharedValue(0);

  useEffect(() => {
    if (!on) {
      cancelAnimation(k);
      k.set(0);
      return;
    }
    k.set(
      withRepeat(
        // 5.2s. Slower than a child's breath on purpose: a star that breathes
        // at your own rate is unsettling, one that breathes slower is calm.
        withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(k);
  }, [on, k]);

  const style = useAnimatedStyle(() => {
    const t = k.get();
    return {
      opacity: (0.74 + 0.26 * t) * (dim ? 0.5 : 1),
      transform: [{ scale: 0.93 + 0.15 * t }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      needsOffscreenAlphaCompositing={false}
      style={[
        {
          position: 'absolute',
          left: x - span / 2,
          top: y - span / 2,
          width: span,
          height: span,
        },
        style,
      ]}
    >
      <Svg width={span} height={span}>
        <Defs>
          <RadialGradient id="amb-sun-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFD86B" stopOpacity={0.4} />
            <Stop offset="55%" stopColor="#F59E0B" stopOpacity={0.14} />
            <Stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={span / 2} cy={span / 2} r={r * 2.5} fill="url(#amb-sun-glow)" />
      </Svg>
    </Animated.View>
  );
});

/**
 * A belt of dust turning round the sun.
 *
 * Rotation is the one ambient motion that can never be mistaken for a still
 * picture. A translation can be read as the camera moving; a fade can be read
 * as a light changing; something TURNING is unambiguously in motion, and it
 * never arrives anywhere, so the sky can never look like it has stopped. That
 * is why this layer exists even though it is the faintest thing on screen:
 * it is the guarantee against `qotib qolish`.
 *
 * Ninety seconds a turn — four degrees a second. Nobody will ever catch it
 * moving, and nobody will ever believe the screen is frozen.
 */
export const DustRing = memo(function DustRing({
  x,
  y,
  r,
  on,
  dim,
}: {
  x: number;
  y: number;
  /** Radius of the outer belt. Kept small — this is the sun's own dust, not
   *  a ring round the whole galaxy: a galaxy-sized ring would need a
   *  galaxy-sized bitmap. */
  r: number;
  on: boolean;
  dim: boolean;
}) {
  const span = Math.ceil(r * 2 + 12);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (!on) {
      cancelAnimation(spin);
      spin.set(0);
      return;
    }
    spin.set(
      withRepeat(withTiming(360, { duration: 90000, easing: Easing.linear }), -1, false),
    );
    return () => cancelAnimation(spin);
  }, [on, spin]);

  const style = useAnimatedStyle(() => ({
    opacity: dim ? 0.45 : 1,
    transform: [{ rotate: `${spin.get()}deg` }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      needsOffscreenAlphaCompositing={false}
      style={[
        {
          position: 'absolute',
          left: x - span / 2,
          top: y - span / 2,
          width: span,
          height: span,
        },
        style,
      ]}
    >
      <Svg width={span} height={span}>
        {/* Dashed, because a solid ring reads as a drawn orbit line and this
            is meant to read as debris. Two radii so the belt has depth. */}
        <Circle
          cx={span / 2}
          cy={span / 2}
          r={r}
          fill="none"
          stroke="rgba(255,233,184,0.11)"
          strokeWidth={1}
          strokeDasharray="1.5,9"
          strokeLinecap="round"
        />
        <Circle
          cx={span / 2}
          cy={span / 2}
          r={r * 0.78}
          fill="none"
          stroke="rgba(169,180,204,0.09)"
          strokeWidth={0.8}
          strokeDasharray="1,14"
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
});

/* ─────────────────────────────────────────────────────────────────────────
   Wanderers
   ───────────────────────────────────────────────────────────────────────── */

/**
 * One unlinked planet, genuinely adrift.
 *
 * This is the only BODY in the sky that moves, and it can move only because it
 * has no threads. An edge is a <Path> in the shared canvas: a linked planet
 * that wandered would tow a line that stayed behind, and redrawing the line
 * means repainting the whole sky. A note nothing links to has nothing to
 * detach, so it is lifted out of the main canvas into a 96x56 canvas of its
 * own — its disc AND its name, so the label travels with it — and drifts on a
 * closed Lissajous. Sixteen points of wander, forty-eight seconds a lap, no
 * two alike.
 *
 * Its Pressable rides inside the same Animated.View, so the tap target follows
 * the planet for free and can never disagree with where it is drawn.
 */
export const Wanderer = memo(function Wanderer({
  x,
  y,
  w,
  h,
  seed,
  clock,
  children,
}: {
  /** The body's physics home, in field coordinates. */
  x: number;
  y: number;
  w: number;
  h: number;
  seed: number;
  clock: SharedValue<number>;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const o = wanderAt(clock.get(), seed, WANDER_REACH);
    return { transform: [{ translateX: o.x }, { translateY: o.y }] };
  });

  return (
    <Animated.View
      style={[
        { position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
});

/**
 * The one clock every wanderer reads.
 *
 * A shared value costs one UI-thread write per frame however many styles
 * derive from it, so four wanderers on one clock cost what one would. It is
 * also the only way the drift can be read from the JS thread — the pan gesture
 * calls `wanderAt(clock.get(), ...)` to find a planet where it is DRAWN — and
 * the only way all four can be stopped in the same instant.
 */
export function useWanderClock(
  on: boolean,
  periodMs = WANDER_LAP_MS,
): SharedValue<number> {
  const clock = useSharedValue(0);
  useEffect(() => {
    if (!on) {
      cancelAnimation(clock);
      // Back to the top of the lap, not frozen where it stood. `withRepeat`
      // captures the value it STARTED from and returns to that on every
      // repetition, so re-arming mid-lap would leave the drift cycling over a
      // fragment of its figure instead of closing.
      clock.set(0);
      return;
    }
    clock.set(
      withRepeat(withTiming(1, { duration: periodMs, easing: Easing.linear }), -1, false),
    );
    return () => cancelAnimation(clock);
  }, [on, periodMs, clock]);
  return clock;
}
