import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  LayoutChangeEvent,
  PixelRatio,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { Text } from '@/components/text';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import type { GraphEdge, GraphNode } from '@/api/endpoints/notes';
import {
  DustRing,
  SunBreath,
  TwinkleField,
  useWanderClock,
  Wanderer,
  type Camera,
} from '@/components/sky-ambient';
import { SETTLE_MS, useGraphSim } from '@/hooks/use-graph-sim';
import {
  wanderAt,
  WANDER_MAX,
  WANDER_MIN_NODES,
  WANDER_REACH,
} from '@/lib/ambient';
import {
  FIELD_PAD,
  galaxyRadius,
  layoutGalaxy,
  starField,
  UNFORMED,
  UNTAGGED,
  type Galaxy,
  type OrbitedNode,
} from '@/lib/galaxy-layout';
import { lift } from '@/lib/glass';
import {
  ANIMATED_SETTLE_MAX_ELEMENTS,
  PLANET_DETAIL_ABOVE,
  sceneElements,
} from '@/lib/scene-cost';
import { hash32, rand01 } from '@/lib/seeded';

/** As close to invisible as a line can be and still be findable — the
 *  threads are a secret the selection reveals. */
const EDGE = 'rgba(160, 190, 255, 0.10)';
/** A selected constellation's threads burn neon green — the one moment the
 *  wiring is meant to be unmissable. */
const EDGE_ON = '#3BFF7E';
const EDGE_GLOW = 'rgba(59, 255, 126, 0.22)';
/** Neon rings: green for the chosen planet, red for everyone joined to it. */
const NEON_SELECTED = '#3BFF7E';
const NEON_LINKED = '#FF3B5C';
/** Muted, the way Obsidian's labels sit under their dots. */
const LABEL = '#A9B4CC';
/** The canvas is deep space in both themes, so the prose over it is always
 *  light — the pale-blue MUTED of the glass pages would sink into the nebula. */
const CANVAS_TEXT = '#94A3B8';
/** The reset pill's lavender, borrowed from the violet it sits in. */
const RESET_TEXT = '#DAB2FF';
/** How far outsiders fade while a constellation is selected. Bodies keep a
 *  third of their light — the child asked to still watch the whole sky
 *  mingle — while edges drop to barely-there. */
const DIM = 0.3;

/** Up to this many notes, every name is drawn: they fit, and the map is
 *  something you read. Past it the labels overlap into an unreadable band
 *  — which is what the map already looks like — and each one costs a glyph
 *  measure and layout per node per frame. */
const LABEL_ALL_BELOW = 40;

/** Past that threshold, how many landmarks keep their names. Radius already
 *  encodes how connected a note is, so the biggest bodies are the ones worth
 *  naming — the same choice a crowded star chart makes.
 *
 *  The geometric culler in `visibleLabels` is the real limit — it drops any
 *  name whose box lands on another's, which is what actually keeps the map
 *  readable. This cap only exists to bound the culler's O(k^2) pass, and at 18
 *  it was doing the culler's job badly: on a roomier sky most of those 18 now
 *  survive, and the map showed a hundred planets with ten names. Forty-eight
 *  candidates is ~2300 comparisons, under a millisecond, run once at rest
 *  (never during a settle — see `sim.settling`). */
const LABEL_TOP_N = 48;

const EDGE_DIM = 0.5;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

/**
 * The hard ceiling on the sky's canvas, in DEVICE pixels.
 *
 * The <Svg> is a native view and Android rasterises it into one ARGB_8888
 * bitmap of its own pixel size, so the field cannot simply grow with the
 * notebook: four bytes a pixel means today's 390x700pt canvas is already
 * 9.8 MB on a 3x phone, and a field twice as wide would be an OOM on a 2 GB
 * device. So the cap is expressed in pixels rather than in points — every
 * phone then pays the same memory for the largest sky it can draw, and a 2x
 * phone gets a bigger galaxy in points, which is right, because it has a
 * bigger screen to pan it with.
 *
 * 2048 is also the safe maximum texture dimension on old GPUs, and it costs
 * 16.8 MB — 1.7x what the screen-sized canvas costs today. That is the price
 * of the fix and there is no version of it that is free: a hundred planets
 * cannot be uncramped inside 390 points however they are arranged.
 *
 * (The alternative — keeping the Svg screen-sized and panning via `viewBox` —
 * makes every pan frame a prop change on the SvgView, which is a full-canvas
 * repaint per frame. That is the exact cost this whole file exists to avoid.)
 */
const FIELD_MAX_PX = 2048;

/**
 * The scale the map OPENS at, and the floor under fit-to-content.
 *
 * Fitting the whole galaxy into one screenful is what made a hundred notes
 * look squeezed: at 0.42 a planet is a 2.8pt speck and its name is 5pt of
 * unreadable grey. Below about 0.85 the map stops being a reading surface, so
 * past that size it becomes a map instead — it opens on the sun at a legible
 * scale and the child pans, which is what the pan and pinch on this screen
 * have always been for. At 0.85 a hundred-note sky shows about three quarters
 * of its width, so what the child lands on is still most of their notebook.
 */
const READABLE_ZOOM = 0.85;

/** How long the whole sky takes to fade and scale in. Cheap at any N: a
 *  parent transform and alpha never dirty the SvgView's bitmap. */
const INTRO_MS = 520;

/** One frozen empty set, so "this notebook has landed nothing" is a stable
 *  reference and every memo keyed on it keeps its bail-out. */
const EMPTY_TITLES: ReadonlySet<string> = new Set<string>();
/** And the same for "nothing drifts", so reduce-motion does not hand every
 *  memo below it a fresh array on every render. */
const NO_BODIES: OrbitedNode[] = [];

/** What a screen reader says. A tag is not an unwritten note — it has no note
 *  behind it by design, and calling it "unwritten" would invite the child to
 *  write one. */
function labelOf(node: { title: string; kind: GraphNode['kind'] }): string {
  if (node.kind === 'tag') return `${node.title} tegi`;
  if (node.kind === 'unwritten') return `${node.title} — hali yozilmagan`;
  return node.title;
}

/**
 * The eight planets a note can be, each with the one or two features a child
 * recognises it by: Mercury's craters, Earth's continents, Jupiter's bands
 * and spot, Saturn's ring. Which planet a note becomes is a hash of its
 * title, so a note keeps its planet forever. Gradient stops are
 * light → base → limb.
 */
const PLANET_TYPES = [
  { key: 'mercury', stops: ['#E7EAEF', '#9FA6B2', '#454C59'] },
  { key: 'venus', stops: ['#FFF3D6', '#E8C27A', '#7A5A2B'] },
  { key: 'earth', stops: ['#9CD3FF', '#2E7CD6', '#0B2B66'] },
  { key: 'mars', stops: ['#FFC9A3', '#D1603D', '#5C1F10'] },
  { key: 'jupiter', stops: ['#FFE9C7', '#D8A05C', '#6B3E1D'] },
  { key: 'saturn', stops: ['#FFF0C4', '#E3C580', '#77602A'] },
  { key: 'uranus', stops: ['#E5FBFC', '#9BE0E5', '#2E6E74'] },
  { key: 'neptune', stops: ['#A9C0FF', '#3B5BD6', '#14245F'] },
] as const;

type PlanetKey = (typeof PLANET_TYPES)[number]['key'];

/** The colour each world catches along its dark limb. Warm worlds take a warm
 *  rim and icy ones a cold one — a single white rim on all eight makes them
 *  look like the same ball in different paint. */
const RIM_LIGHT: Record<PlanetKey, string> = {
  mercury: '#CBD5E1',
  venus: '#FFE3A8',
  earth: '#8FD0FF',
  mars: '#FFAE86',
  jupiter: '#FFD9A0',
  saturn: '#FFE9B0',
  uranus: '#C8F7FA',
  neptune: '#9FB6FF',
};

/** A wanderer's own canvas: room for a 5.5pt disc and the name under it.
 *  96 x 56pt is 194 KB on a 3x phone — the whole four-planet drift costs
 *  less bitmap than one twinkle cluster and a half. */
const WANDER_W = 96;
const WANDER_H = 56;
/** Where the disc's centre sits in it, leaving the label its 13pt drop. */
const WANDER_TOP = 22;

/** A shooting star every ~11 seconds. */
const METEOR_GAP_MS = 11000;
const METEOR_FLY_MS = 900;
/** The streak's own canvas. Fixed and tiny: the flight is a parent-view
 *  transform over it, so this bitmap is rasterised ONCE per shot and never
 *  again — 120x40pt is 43 KB on a 3x phone against the 11.8 MB a
 *  viewport-sized canvas used to re-rasterise thirty times a second. */
const STREAK_W = 120;
const STREAK_H = 40;

/** One meteor's whole flight, decided before it starts. */
function meteorShot(i: number, w: number, h: number) {
  const toRight = rand01(i * 15485863 + 1) < 0.5;
  const runX = (0.3 + 0.25 * rand01(i * 6151 + 9)) * w * (toRight ? 1 : -1);
  const runY = 0.14 * h + 0.1 * h * rand01(i * 3571 + 5);
  return {
    // Where the streak's canvas starts, top-left, in the parent's coordinates.
    x0: rand01(i * 104729 + 7) * w - STREAK_W / 2,
    y0: rand01(i * 130363 + 3) * h * 0.55 - STREAK_H / 2,
    runX,
    runY,
    // The streak is drawn pointing right; the flight angle turns it.
    angle: (Math.atan2(runY, runX) * 180) / Math.PI,
    // 0.6s to 1.4s of waiting past the base gap, so meteors do not arrive
    // on a metronome.
    waitMs: METEOR_GAP_MS * (0.6 + 0.8 * rand01(i * 7919 + 13)),
  };
}

/**
 * The shooting star.
 *
 * It used to keep a 30fps tick and recompute its head and tail positions per
 * frame. Three elements is not what that cost: an SvgView repaint
 * re-rasterises the WHOLE canvas, and that canvas was viewport-sized — 11.8 MB
 * allocated, zeroed and painted, thirty times a second, for 0.9s out of every
 * 11. It was the most expensive thing on this screen.
 *
 * Now the streak is a fixed drawing in a 120x40 canvas and the flight is a
 * translate/rotate/fade on the parent View, which Android composites without
 * redrawing a pixel. Per frame: zero elements, zero allocations, no JS. React
 * renders once per meteor — about five times a minute — to pick the next
 * flight, and that render re-rasterises 43 KB.
 */
function Meteor({
  width,
  height,
  dim,
  on,
}: {
  width: number;
  height: number;
  dim: boolean;
  on: boolean;
}) {
  const [shot, setShot] = useState(0);
  const t = useSharedValue(0);
  const m = useMemo(() => meteorShot(shot, width, height), [shot, width, height]);

  useEffect(() => {
    if (!on) {
      cancelAnimation(t);
      t.set(0);
      return;
    }
    const next = shot + 1;
    t.set(0);
    t.set(
      withDelay(
        m.waitMs,
        withTiming(
          1,
          { duration: METEOR_FLY_MS, easing: Easing.linear },
          (finished) => {
            'worklet';
            // The next flight is chosen on the JS thread, once, when this one
            // lands — not thirty times a second to discover nothing is due.
            if (finished) runOnJS(setShot)(next);
          },
        ),
      ),
    );
    return () => cancelAnimation(t);
  }, [on, m, t, shot]);

  const style = useAnimatedStyle(() => {
    const u = t.get();
    // Bright near the head, gone by the tail; fades in fast, out slow.
    const fade = u <= 0 || u >= 1 ? 0 : u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85;
    return {
      opacity: Math.max(0, fade) * (dim ? 0.5 : 1),
      transform: [
        { translateX: m.x0 + m.runX * u },
        { translateY: m.y0 + m.runY * u },
        { rotate: `${m.angle}deg` },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      // Explicit: an alpha under 1 on a view Android thinks has overlapping
      // children is drawn through an offscreen buffer, which would put back
      // the per-frame allocation this rewrite exists to remove. One child, no
      // overlap, so alpha is applied straight into the draw.
      needsOffscreenAlphaCompositing={false}
      style={[
        { position: 'absolute', left: 0, top: 0, width: STREAK_W, height: STREAK_H },
        style,
      ]}
    >
      <Svg width={STREAK_W} height={STREAK_H}>
        <Path
          d={`M 6 ${STREAK_H / 2} L ${STREAK_W - 8} ${STREAK_H / 2}`}
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={1.4}
          strokeLinecap="round"
          fill="none"
        />
        <Circle cx={STREAK_W - 8} cy={STREAK_H / 2} r={1.8} fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
}

/** The two halves of a planetary ring. In SVG's y-down plane sweep=1 arcs
 *  above the midline — the far side — so `back` goes behind the sphere and
 *  `front` crosses over it. */
function ringHalves(
  x: number,
  y: number,
  tilt: number,
  rx: number,
  ry: number,
  w: number,
  colour: string,
) {
  const transform = `translate(${x}, ${y}) rotate(${tilt})`;
  return {
    back: (
      <G transform={transform}>
        <Path
          d={`M ${-rx} 0 A ${rx} ${ry} 0 0 1 ${rx} 0`}
          stroke={colour}
          strokeOpacity={0.4}
          strokeWidth={w}
          fill="none"
        />
      </G>
    ),
    front: (
      <G transform={transform}>
        <Path
          d={`M ${-rx} 0 A ${rx} ${ry} 0 0 0 ${rx} 0`}
          stroke={colour}
          strokeOpacity={0.85}
          strokeWidth={w}
          strokeLinecap="round"
          fill="none"
        />
      </G>
    ),
  };
}

/** The bright hairline along a sphere's shadowed limb.
 *
 *  This is the one detail that separates "coloured circle with a gradient"
 *  from "ball". Real spheres catch light around their dark edge — the eye
 *  reads that arc as curvature, and without it no amount of gradient work
 *  looks three-dimensional.
 *
 *  Anchored to the same upper-left light as `pg-*`, `planet-night` and
 *  `planet-spec`: the lit face sits around 225 degrees, so the shadowed limb
 *  is centred on 45 and the arc sweeps -25 -> 115 through it. Change the light
 *  in one place and this must move with it, or the planet reads as lit by two
 *  suns.
 */
function rimLight(x: number, y: number, R: number, colour: string) {
  // Too small to resolve an arc — drawing one just muddies the silhouette.
  if (R < 5) return null;
  const at = (deg: number) => {
    const t = (deg * Math.PI) / 180;
    return [x + R * Math.cos(t), y + R * Math.sin(t)];
  };
  const [sx, sy] = at(-25);
  const [ex, ey] = at(115);
  return (
    <Path
      d={`M ${sx} ${sy} A ${R} ${R} 0 0 1 ${ex} ${ey}`}
      stroke={colour}
      strokeOpacity={0.5}
      strokeWidth={Math.max(0.8, R * 0.075)}
      strokeLinecap="round"
      fill="none"
    />
  );
}

/** The surface details that make a planet nameable at a glance, drawn in
 *  absolute coordinates and clipped to the sphere by the caller. */
function planetFeatures(key: PlanetKey, x: number, y: number, R: number) {
  switch (key) {
    case 'mercury':
      return (
        <>
          <Circle cx={x - 0.3 * R} cy={y - 0.2 * R} r={0.16 * R} fill="rgba(20,26,40,0.32)" />
          <Circle cx={x + 0.25 * R} cy={y + 0.12 * R} r={0.12 * R} fill="rgba(20,26,40,0.28)" />
          <Circle cx={x - 0.05 * R} cy={y + 0.38 * R} r={0.1 * R} fill="rgba(20,26,40,0.28)" />
        </>
      );
    case 'venus':
      return (
        <>
          <Path
            d={`M ${x - 0.8 * R} ${y - 0.15 * R} Q ${x} ${y - 0.45 * R} ${x + 0.8 * R} ${y - 0.05 * R}`}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={0.1 * R}
            fill="none"
          />
          <Path
            d={`M ${x - 0.75 * R} ${y + 0.32 * R} Q ${x} ${y + 0.05 * R} ${x + 0.78 * R} ${y + 0.36 * R}`}
            stroke="rgba(122,90,43,0.4)"
            strokeWidth={0.09 * R}
            fill="none"
          />
        </>
      );
    case 'earth':
      return (
        <>
          <G transform={`rotate(-20 ${x - 0.2 * R} ${y - 0.1 * R})`}>
            <Ellipse
              cx={x - 0.2 * R}
              cy={y - 0.1 * R}
              rx={0.42 * R}
              ry={0.22 * R}
              fill="#3FA654"
            />
          </G>
          <G transform={`rotate(15 ${x + 0.32 * R} ${y + 0.3 * R})`}>
            <Ellipse
              cx={x + 0.32 * R}
              cy={y + 0.3 * R}
              rx={0.26 * R}
              ry={0.14 * R}
              fill="#3FA654"
            />
          </G>
          <Ellipse cx={x} cy={y - 0.82 * R} rx={0.4 * R} ry={0.16 * R} fill="rgba(241,247,255,0.9)" />
        </>
      );
    case 'mars':
      return (
        <>
          <G transform={`rotate(-10 ${x - 0.15 * R} ${y + 0.12 * R})`}>
            <Ellipse
              cx={x - 0.15 * R}
              cy={y + 0.12 * R}
              rx={0.45 * R}
              ry={0.2 * R}
              fill="rgba(60,20,8,0.28)"
            />
          </G>
          <Ellipse
            cx={x + 0.3 * R}
            cy={y - 0.28 * R}
            rx={0.2 * R}
            ry={0.12 * R}
            fill="rgba(60,20,8,0.24)"
          />
          <Ellipse cx={x} cy={y - 0.78 * R} rx={0.35 * R} ry={0.14 * R} fill="rgba(255,255,255,0.85)" />
        </>
      );
    case 'jupiter':
    case 'saturn': {
      const soft = key === 'saturn' ? 0.16 : 0.32;
      return (
        <>
          <Path
            d={`M ${x - R} ${y - 0.34 * R} Q ${x} ${y - 0.26 * R} ${x + R} ${y - 0.34 * R}`}
            stroke={`rgba(120,66,28,${soft})`}
            strokeWidth={0.2 * R}
            fill="none"
          />
          <Path
            d={`M ${x - R} ${y - 0.04 * R} Q ${x} ${y + 0.04 * R} ${x + R} ${y - 0.04 * R}`}
            stroke={`rgba(255,255,255,${soft * 0.8})`}
            strokeWidth={0.18 * R}
            fill="none"
          />
          <Path
            d={`M ${x - R} ${y + 0.3 * R} Q ${x} ${y + 0.38 * R} ${x + R} ${y + 0.3 * R}`}
            stroke={`rgba(120,66,28,${soft * 0.9})`}
            strokeWidth={0.16 * R}
            fill="none"
          />
          {key === 'jupiter' && (
            <Ellipse
              cx={x + 0.34 * R}
              cy={y + 0.4 * R}
              rx={0.18 * R}
              ry={0.11 * R}
              fill="rgba(195,74,54,0.9)"
            />
          )}
        </>
      );
    }
    case 'uranus':
      return (
        <Path
          d={`M ${x - 0.7 * R} ${y - 0.1 * R} Q ${x} ${y - 0.24 * R} ${x + 0.7 * R} ${y - 0.08 * R}`}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={0.12 * R}
          fill="none"
        />
      );
    case 'neptune':
      return (
        <>
          <Path
            d={`M ${x - 0.7 * R} ${y - 0.12 * R} Q ${x} ${y - 0.28 * R} ${x + 0.7 * R} ${y - 0.1 * R}`}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={0.12 * R}
            fill="none"
          />
          <Ellipse
            cx={x - 0.3 * R}
            cy={y + 0.26 * R}
            rx={0.16 * R}
            ry={0.1 * R}
            fill="rgba(10,16,60,0.5)"
          />
        </>
      );
  }
}

/**
 * The tap targets. They follow the simulation — a body IS its touch target,
 * so wherever physics carries a note, the finger finds it there, including
 * mid-drift.
 */
function TouchLayer({
  nodes,
  onTap,
  onHold,
}: {
  nodes: OrbitedNode[];
  onTap: (n: OrbitedNode) => void;
  onHold: (n: OrbitedNode) => void;
}) {
  return (
    <>
      {nodes.map((n) => {
        const hit = Math.max(n.r + 12, 24);
        return (
          <Pressable
            key={`p-${n.title}`}
            onPress={() => onTap(n)}
            onLongPress={() => onHold(n)}
            accessibilityRole="button"
            accessibilityLabel={labelOf(n)}
            style={[
              styles.touch,
              styles.focusable,
              {
                left: n.x - hit,
                top: n.y - hit,
                width: hit * 2,
                height: hit * 2,
                borderRadius: hit,
              },
            ]}
          />
        );
      })}
    </>
  );
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** A tap. Opens the note — the map is for getting somewhere, not admiring. */
  onSelect: (node: GraphNode) => void;
  /** Fixed height. Omit to fill the parent, which is how the full-screen map
   *  uses it; a card embedding the graph passes a number. */
  height?: number;
  /**
   * A thumbnail, not a map: draw the sky and skip the names.
   *
   * The Miya home card is about 330x230 with twenty-odd planets in it.
   * Names there are unreadable whatever is done about collisions between
   * them, and the survivors land on the card’s own overlay — "2-Miyya",
   * "Bilimlaringiz olami", the link count, the + button — which the graph
   * cannot see and so cannot avoid. The full-screen map is where names
   * are read, and it is one tap away.
   */
  preview?: boolean;
}

/**
 * The brain as a solar system that moves the way Obsidian's graph does.
 *
 * `layoutGalaxy` still seeds the sky — most-linked note largest, colours from
 * #tags, sizes from links — but from there the map is a live force simulation
 * (`lib/graph-physics.ts`): bodies repel, [[links]] pull like springs, and the
 * system settles over a few seconds into a slow ambient drift that never
 * quite stops — the sky keeps breathing, and a wandering star tows its
 * constellation along. The physics is deterministic, so the same notebook
 * still settles into the same sky.
 *
 * A child can grab any body and drag it: its constellation stretches, follows,
 * and relaxes again on release. Grabs are told apart from canvas pans by what
 * the finger lands on — a body drags it, empty space pans the sky. Pinch to
 * zoom. A tap opens the note; press-and-hold lights up its constellation and
 * fades the rest.
 *
 * Under the OS "reduce motion" setting the same physics chooses the layout,
 * but it runs to rest instantly and the sky never animates — and dragging is
 * off, because a drag's whole feedback is motion.
 */
export function NoteGraph({
  nodes,
  edges,
  onSelect,
  height,
  preview = false,
}: Props) {
  const [size, setSize] = useState({ width: 0, height: height ?? 0 });
  const [focus, setFocus] = useState<string | null>(null);

  /**
   * The canvas the sky is DRAWN on, which is not the viewport it is seen
   * through.
   *
   * These used to be the same thing, and that was the crowding. <Svg width
   * height> is a real native view and clips its children to those bounds, so a
   * galaxy that settles wider than the phone was not merely off-screen, it was
   * cut off — and panning could not reveal it, because the Svg panned with the
   * content. At a hundred notes roughly half the sky was outside a 390-point
   * boundary that nothing in the code mentions.
   *
   * A thumbnail is exempt: it is a picture of the notebook rather than a place
   * to navigate, so it keeps the card's own bounds and the physics compresses
   * the sky to fit them.
   */
  const field = useMemo(() => {
    if (size.width === 0 || size.height === 0 || preview) return size;
    // Floored, not rounded up: FIELD_MAX_PX is a texture limit, and a canvas
    // one point over it is a canvas the GPU will not take.
    const span = Math.floor(
      Math.min(
        FIELD_MAX_PX / PixelRatio.get(),
        2 * (galaxyRadius(nodes.length) + FIELD_PAD),
      ),
    );
    return {
      width: Math.max(size.width, span),
      height: Math.max(size.height, span),
    };
  }, [size, nodes.length, preview]);

  const galaxy = useMemo(
    () =>
      field.width > 0 && field.height > 0
        ? layoutGalaxy(nodes, edges, field.width, field.height)
        : null,
    [nodes, edges, field],
  );

  // Twice the field in every direction, so panning or pinching out never
  // reveals a bare gradient at the edges.
  //
  // The count follows the field's AREA rather than being fixed. The field now
  // grows with the notebook, and a fixed 170 would thin the sky out at exactly
  // the size it gets big enough to pan around in — what the eye reads is
  // density, not the number. It stays four <Path>s either way; only the
  // subpath count moves.
  const stars = useMemo(() => {
    if (field.width === 0) return [];
    const viewport = Math.max(1, size.width * size.height);
    const density = Math.min(4, (field.width * field.height) / viewport);
    return starField(
      field.width * 2,
      field.height * 2,
      Math.round(170 * density),
    ).map((s) => ({
      ...s,
      x: s.x - field.width / 2,
      y: s.y - field.height / 2,
    }));
  }, [field, size]);

  /**
   * The field as four <Path>s instead of one <Circle> a star.
   *
   * `starField` gives each star an opacity in [0.25, 0.75]; quantising that
   * to four levels is invisible against a black sky and is what lets stars
   * share an element. A circle as a path is two half-arcs, which is the only
   * reason this is not simply a list of dots.
   */
  const starField4 = useMemo(() => {
    if (stars.length === 0) return null;
    const buckets: string[][] = [[], [], [], []];
    for (const s of stars) {
      const level = Math.max(0, Math.min(3, Math.floor(((s.o - 0.25) / 0.5) * 4)));
      buckets[level].push(
        `M ${s.x} ${s.y} m ${-s.r} 0 a ${s.r} ${s.r} 0 1 0 ${2 * s.r} 0 a ${s.r} ${s.r} 0 1 0 ${-2 * s.r} 0`,
      );
    }
    return buckets.map((d, i) =>
      d.length === 0 ? null : (
        <Path
          key={`sb${i}`}
          d={d.join(' ')}
          fill="#FFFFFF"
          opacity={(0.3 + i * 0.15) * (focus ? 0.45 : 1)}
        />
      ),
    );
  }, [stars, focus]);

  /**
   * Wanderers a finger has landed, and the notebook they belong to.
   *
   * Keyed by the galaxy object rather than reset from an effect: a rebuilt
   * notebook is a different object, so the set simply stops matching and the
   * derived `landedTitles` below is empty again. Nothing has to run to clear
   * it, and no render is spent discovering that it should have.
   */
  const [landed, setLanded] = useState<{
    of: Galaxy | null;
    titles: ReadonlySet<string>;
  }>(() => ({ of: null, titles: new Set<string>() }));
  const landedTitles = landed.of === galaxy ? landed.titles : EMPTY_TITLES;

  /**
   * Which bodies are allowed to drift.
   *
   * Unlinked notes only, and never more than four. An edge lives in the shared
   * canvas, so a linked planet cannot move without its thread being redrawn —
   * and redrawing one thread repaints all five hundred elements of the sky.
   * A note nothing links to has no thread, so it is free to go.
   *
   * Computed from the galaxy alone, ABOVE the scene cost, and that ordering is
   * load-bearing: the cost feeds `canAnimate`, which feeds `sim`, so anything
   * derived from `sim` cannot also be an input to the cost. Reduce-motion is
   * therefore not consulted here — `drifting` below is what actually lifts
   * bodies out of the canvas, and it keeps them in when motion is off.
   */
  const wanderers = useMemo(() => {
    if (preview || !galaxy) return [];
    if (galaxy.nodes.length < WANDER_MIN_NODES) return [];
    const linked = new Set<string>();
    for (const e of galaxy.edges) {
      linked.add(e.sourceTitle.toLowerCase());
      linked.add(e.targetTitle.toLowerCase());
    }
    return galaxy.nodes
      .filter(
        (n) =>
          n.ring !== 0 &&
          // Written notes only. A #tag is a star and an unwritten [[link]] is
          // a ghost — each is drawn by a branch of its own in the canvas, and
          // a body lifted out has to be one the small canvas below can draw.
          // Both always carry an edge in practice, so this only ever costs the
          // scene-cost subtraction its right to be wrong.
          n.kind === 'note' &&
          !linked.has(n.title.toLowerCase()) &&
          !landedTitles.has(n.title),
      )
      // Hash order, so which four wander is stable for a given notebook.
      .sort((a, b) => hash32(a.title) - hash32(b.title))
      .slice(0, WANDER_MAX);
  }, [galaxy, preview, landedTitles]);

  /** What one repaint of this sky costs, in native views. It is what decides
   *  whether the settle can be animated at all — see lib/scene-cost. Counted
   *  without labels, because none are drawn while the sky is in flight, and
   *  minus the bodies that leave for a canvas of their own. */
  const sceneCost = useMemo(
    () => (galaxy ? sceneElements(galaxy, false, 0, wanderers.length) : 0),
    [galaxy, wanderers.length],
  );

  // `still` for the thumbnail: nobody drags a 330x230 card, so it never
  // starts the one loop the sim has left.
  const sim = useGraphSim(galaxy, {
    still: preview,
    canAnimate: !preview && sceneCost <= ANIMATED_SETTLE_MAX_ELEMENTS,
  });

  /** Where a body is this frame — physics first, layout as the fallback. */
  const drawnAt = (title: string, x: number, y: number) =>
    sim.positionOf(title) ?? { x, y };

  /** The bodies with their live coordinates — what both the SVG and the
   *  touch layer draw from, so they can never disagree. */
  const liveNodes = useMemo(
    () =>
      (galaxy?.nodes ?? []).map((n) => {
        const p = sim.positionOf(n.title);
        return p ? { ...n, x: p.x, y: p.y } : n;
      }),
    // sim.version changes only when the settled layout does — a build or a
    // drag. This used to key on a 30fps tick, which rebuilt N objects and
    // called toLowerCase() N times every frame for the whole settle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [galaxy, sim.version],
  );

  /**
   * Whether the sky's ambient layers exist, and whether they are moving.
   *
   * `lifted` is the shape of the scene. With it false — a thumbnail, or
   * reduce-motion — the sun keeps its glow inside the main canvas, no body
   * leaves it, and not one ambient view is mounted: the still sky is exactly
   * what ships today.
   *
   * `ambient` waits for the arrival to finish, and that is not taste. During
   * the intro the canvas view carries an alpha under 1, and an alpha under 1
   * over overlapping children is composited through an offscreen buffer.
   * Mounting seventeen more layers into that buffer would make the one
   * animation that is already free stop being free.
   *
   * `moving` parks when the app leaves the foreground. Nothing here touches
   * the JS thread, but a screen that never reaches an idle frame never lets
   * the display drop its refresh rate, and that is battery a backgrounded app
   * has no business spending. The layers stay MOUNTED across it — unmounting
   * would re-rasterise every one of them on the way back in.
   */
  const lifted = !preview && !sim.reduceMotion;
  const [arrived, setArrived] = useState(false);
  const [foreground, setForeground] = useState(true);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) =>
      setForeground(next === 'active'),
    );
    return () => sub.remove();
  }, []);
  // Armed on a timer rather than off the intro's own callback, so that
  // reduce-motion being switched OFF with the map already open still wakes the
  // sky: the arrival that would have armed it is never going to replay.
  useEffect(() => {
    if (preview || sim.settling || arrived) return;
    const id = setTimeout(() => setArrived(true), INTRO_MS);
    return () => clearTimeout(id);
  }, [preview, sim.settling, arrived]);
  const ambient = lifted && arrived;
  const moving = ambient && foreground;

  /** The bodies that actually leave the main canvas. Lifted from the first
   *  paint, not from the moment the drift starts: moving them out later would
   *  cost the one full re-rasterisation of the main sky this whole design
   *  exists to avoid. */
  const drifting = lifted ? wanderers : NO_BODIES;
  const driftSet = useMemo(
    () => new Set(drifting.map((n) => n.title)),
    [drifting],
  );
  /** Their LIVE positions — a wanderer follows the settle film and any drag
   *  its neighbours cause, exactly as it did inside the canvas. */
  const driftBodies = useMemo(
    () => liveNodes.filter((n) => driftSet.has(n.title)),
    [liveNodes, driftSet],
  );
  const wanderClock = useWanderClock(moving && drifting.length > 0);

  /** Read by the pan gesture on the JS thread, so a finger finds a wanderer
   *  where it is DRAWN. Refs, not closures: `pan` is memoised on the viewport
   *  and must not be rebuilt every time the sky moves. */
  const driftRef = useRef(driftBodies);
  const landRef = useRef<(title: string) => void>(() => {});
  useEffect(() => {
    driftRef.current = driftBodies;
    landRef.current = (title: string) =>
      setLanded((prev) => ({
        of: galaxy,
        titles:
          prev.of === galaxy ? new Set(prev.titles).add(title) : new Set([title]),
      }));
  });

  /** The sun with its live position. Its corona and its dust belt are drawn
   *  BESIDE the canvas rather than in it, so they can breathe and turn. */
  const sunBody = useMemo(
    () => liveNodes.find((n) => n.ring === 0) ?? null,
    [liveNodes],
  );
  const sunRd = sunBody ? Math.max(8, sunBody.r * 0.72) : 0;

  // Which titles are one hop from the focused note.
  const neighbours = useMemo(() => {
    if (!focus) return null;
    const key = focus.toLowerCase();
    const set = new Set<string>([key]);
    for (const e of edges) {
      if (e.source.toLowerCase() === key) set.add(e.target.toLowerCase());
      if (e.target.toLowerCase() === key) set.add(e.source.toLowerCase());
    }
    return set;
  }, [focus, edges]);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  /** The zoom floor. Fixed at 0.5 it was a wall: at a hundred notes the whole
   *  galaxy needs 0.42 and the child could not pull back far enough to see it.
   *  It now tracks the fit, so "show me everything" is always reachable, and
   *  never rises above the old 0.5 for a small notebook. */
  const minZoom = useSharedValue(MIN_ZOOM);
  /** The whole sky arriving, as ONE view property.
   *
   *  This is the floor under the settle: it costs nothing at any N, because a
   *  parent transform and alpha never dirty the SvgView's bitmap — the same
   *  reason pinch-zoom on this canvas is smooth. When the scene is too big to
   *  animate the settle, this is the whole animation, and it is still the sky
   *  arriving rather than appearing. */
  const intro = useSharedValue(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  /** Where the fit parked the camera. The ambient layers decline to follow a
   *  fraction of the child's pan, and that fraction has to be measured from
   *  HERE: the fit leaves tx/ty a long way from the origin, and a layer
   *  counting from zero would open displaced by the whole of it. */
  const camX = useSharedValue(0);
  const camY = useSharedValue(0);
  const skyCam = useMemo<Camera>(
    () => ({ tx, ty, x0: camX, y0: camY, scale }),
    [tx, ty, camX, camY, scale],
  );

  // .set()/.get() rather than .value: React Compiler can prove these are
  // shared-value accessors, where a bare `.value =` reads as mutating state.
  //
  // Memoised, and that is not cosmetic. This was a bare expression, so it was
  // a new object on every render — which made `gesture` below a new object on
  // every render, which made RNGH re-attach its native handlers on every
  // render. The elaborate memo on `pan` was defeated by being composed with
  // this one. Shared values are stable, so an empty-ish dep list is honest.
  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onUpdate((e) => {
          scale.set(
            Math.min(MAX_ZOOM, Math.max(minZoom.get(), savedScale.get() * e.scale)),
          );
        })
        .onEnd(() => {
          savedScale.set(scale.get());
        }),
    [scale, savedScale, minZoom],
  );

  /**
   * The live sim, behind a ref.
   *
   * `sim` is deliberately a fresh object every render (see use-graph-sim),
   * so a gesture that closed over it could never be memoised — and an
   * unmemoised gesture is rebuilt on every physics step, which makes
   * RNGH re-attach its native handlers thirty times a second INSIDE the
   * gesture it is meant to serve.
   */
  const simRef = useRef(sim);
  // In an effect, not during render: the React Compiler forbids touching
  // a ref while rendering, and it is right to — a gesture handler only
  // ever reads this after a commit, so there is nothing to gain by
  // writing it earlier. No dep array: it must track every render.
  useEffect(() => {
    simRef.current = sim;
  });

  /** Screen point → canvas point, inverting the pan/zoom transform. Events
   *  arrive in viewport coordinates; the field is centred on the viewport and
   *  scales about its own centre, so those two centres coincide. */
  const toCanvas = (ex: number, ey: number) => {
    const s = scale.get();
    return {
      x: field.width / 2 + (ex - tx.get() - size.width / 2) / s,
      y: field.height / 2 + (ey - ty.get() - size.height / 2) / s,
    };
  };

  /** What this pan is: dragging a body, or panning the sky. Also carries the
   *  grab offset so a body follows the finger without jumping to it. */
  const panMode = useRef<
    { kind: 'node'; dx: number; dy: number } | { kind: 'canvas' } | null
  >(null);
  /** Set when a pan ends. On web a drag can still deliver a click to the
   *  touch target under the finger; taps arriving right after a pan are that
   *  ghost, not the child's intent. */
  const panEndedAt = useRef(0);

  // On the JS thread (.runOnJS): the grab has to hit-test against simulation
  // state, which lives on this side.
  //
  // The rule below fires on `simRef.current` inside onStart/onUpdate/onEnd.
  // It cannot tell that those are event callbacks rather than render code —
  // they run when a finger moves, long after the commit. This is the
  // standard latest-ref pattern, and it is what lets the gesture be
  // memoised at all: closing over `sim` directly would rebuild it on every
  // physics step, and RNGH re-attaches its native handlers whenever the
  // gesture object changes identity.
  /* eslint-disable react-hooks/refs, react-hooks/purity */
  const pan = useMemo(() =>
    Gesture.Pan()
    .runOnJS(true)
    .averageTouches(true)
    .onStart((e) => {
      // The gesture activates a few points in; grab from where it BEGAN.
      const origin = toCanvas(e.x - e.translationX, e.y - e.translationY);

      // A wanderer first: it is drawn away from its physics home, so it has to
      // be hit-tested where the eye sees it. `wanderAt` is the same function
      // the animated style calls on the UI thread — a worklet is an ordinary
      // function on this side — so the two can never disagree about where the
      // planet is.
      // Reading a shared value from this side is a blocking hop to the UI
      // runtime, so it is not paid on a sky that has nothing adrift.
      if (e.numberOfPointers === 1 && driftRef.current.length > 0) {
        const u = wanderClock.get();
        for (const w of driftRef.current) {
          const o = wanderAt(u, hash32(w.title), WANDER_REACH);
          const dx = w.x + o.x - origin.x;
          const dy = w.y + o.y - origin.y;
          if (dx * dx + dy * dy > 24 * 24) continue;
          if (!simRef.current.grabTitleAt(w.title, w.x + o.x, w.y + o.y)) continue;
          // Retired from the drift for this notebook: a planet the child has
          // touched belongs to them now.
          landRef.current(w.title);
          panMode.current = { kind: 'node', dx, dy };
          return;
        }
      }

      const grabbed =
        e.numberOfPointers === 1 ? simRef.current.grabAt(origin.x, origin.y) : null;
      if (grabbed) {
        const p = simRef.current.positionOf(grabbed);
        panMode.current = p
          ? { kind: 'node', dx: p.x - origin.x, dy: p.y - origin.y }
          : { kind: 'canvas' };
      } else {
        panMode.current = { kind: 'canvas' };
      }
    })
    .onUpdate((e) => {
      const mode = panMode.current;
      if (mode?.kind === 'node') {
        const p = toCanvas(e.x, e.y);
        simRef.current.dragTo(p.x + mode.dx, p.y + mode.dy);
      } else {
        tx.set(savedTx.get() + e.translationX);
        ty.set(savedTy.get() + e.translationY);
      }
    })
    .onEnd(() => {
      if (panMode.current?.kind === 'node') {
        simRef.current.release();
      } else {
        savedTx.set(tx.get());
        savedTy.set(ty.get());
      }
      panMode.current = null;
      panEndedAt.current = Date.now();
    }),
    // Everything it closes over is either a ref or a stable shared value.
    // The viewport and the field are the real dependencies, through toCanvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size.width, size.height, field.width, field.height],
  );
  /* eslint-enable react-hooks/refs, react-hooks/purity */

  const gesture = useMemo(
    () => Gesture.Simultaneous(pinch, pan),
    [pinch, pan],
  );

  const canvasStyle = useAnimatedStyle(() => {
    const i = intro.get();
    return {
      opacity: i,
      transform: [
        { translateX: tx.get() },
        { translateY: ty.get() },
        { scale: scale.get() * (0.94 + 0.06 * i) },
      ],
    };
  });

  /** The camera the map opened on. `reset` returns to it rather than to scale
   *  1: past about a hundred notes the fitted scale is well under 1, so
   *  resetting to 1 would zoom PAST the sky instead of showing all of it. */
  const fittedCam = useRef({ s: 1, x: 0, y: 0 });

  const reset = useCallback(() => {
    const cam = fittedCam.current;
    scale.set(withTiming(cam.s));
    savedScale.set(cam.s);
    tx.set(withTiming(cam.x));
    ty.set(withTiming(cam.y));
    savedTx.set(cam.x);
    savedTy.set(cam.y);
    setFocus(null);
  }, [scale, savedScale, tx, ty, savedTx, savedTy]);

  /** Which notebook the camera was last fitted to. Keyed by content, not by
   *  object identity, so a refetch that changes nothing keeps the child's
   *  pan/zoom instead of yanking the camera back. */
  const fittedTo = useRef<string | null>(null);

  // Obsidian opens its graph filled to the view, and that is most of what
  // makes it feel like a map rather than a diagram floating in a void. Fit
  // once per notebook — but measured off the SETTLED simulation, not the
  // seeded layout: the seeds are spread over the whole canvas and the springs
  // then pull everything into a much tighter shape, so a seed-time fit leaves
  // the very emptiness it exists to remove. Waiting ~40 ticks (a second and
  // change) also means the camera glides in as the sky finds its shape.
  // After that the camera belongs to the child's fingers.
  // Gated on the sim having STOPPED rather than on a tick count. It used
  // to depend on sim.tick, so it re-ran on every physics step forever —
  // and worse, it built its own cache key (an N-element map, an
  // O(N log N) sort and a join) BEFORE the early-out that discards it.
  // That was a full string sort per node per frame, in perpetuity, to
  // discover it had nothing to do.
  const settled = sim.reduceMotion || preview || sim.resting;
  useEffect(() => {
    if (!galaxy || galaxy.nodes.length === 0 || size.width === 0) return;
    if (!settled) return;
    const key = `${size.width}x${size.height}:${galaxy.nodes
      .map((n) => n.title)
      .sort()
      .join('|')}`;
    if (fittedTo.current === key) return;
    fittedTo.current = key;

    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const n of galaxy.nodes) {
      // The SETTLED position, not the drawn one: the film may still be
      // playing, and the camera should land on the answer at frame zero
      // rather than chase the sky across the second it takes to arrive.
      const p = sim.settledPositionOf(n.title) ?? n;
      x0 = Math.min(x0, p.x - n.r);
      x1 = Math.max(x1, p.x + n.r);
      y0 = Math.min(y0, p.y - n.r);
      // Labels hang below their body and count as content.
      y1 = Math.max(y1, p.y + n.r + 18);
    }
    // Room for the ambient drift (~50px of wander) and the floating chrome.
    const PAD = 64;
    const bw = Math.max(1, x1 - x0);
    const bh = Math.max(1, y1 - y0);
    const fit = Math.min((size.width - PAD) / bw, (size.height - PAD) / bh);
    minZoom.set(Math.min(MIN_ZOOM, fit * 0.85));

    // A thumbnail still fits everything; the map stops at a readable size and
    // hands the rest to the child's fingers.
    const floor = preview ? MIN_ZOOM : READABLE_ZOOM;
    // A three-note sky must not zoom into cartoon-sized discs — and labels
    // are drawn in screen-constant font under a scaled canvas, so past ~1.4x
    // a hub's name lands on top of the sun rather than under it. Verified on
    // the dashboard hero with a one-note, one-tag, one-ghost notebook.
    const s = Math.min(1.4, Math.max(floor, fit));

    // When the whole sky does not fit at a size worth reading, open on the sun
    // rather than on the bounding box's centre — the anchor of the child's
    // system, not the middle of a rectangle.
    const middle = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    const sun = galaxy.nodes.find((n) => n.ring === 0);
    const at =
      fit < floor && sun ? (sim.settledPositionOf(sun.title) ?? middle) : middle;
    const fx = -(at.x - field.width / 2) * s;
    const fy = -(at.y - field.height / 2) * s;
    fittedCam.current = { s, x: fx, y: fy };

    // The camera glides for exactly as long as the settle plays, so the sky
    // and the view it is seen through arrive together.
    const glide = preview ? undefined : { duration: SETTLE_MS };
    scale.set(sim.reduceMotion ? s : withTiming(s, glide));
    savedScale.set(s);
    tx.set(sim.reduceMotion ? fx : withTiming(fx, glide));
    savedTx.set(fx);
    ty.set(sim.reduceMotion ? fy : withTiming(fy, glide));
    savedTy.set(fy);
    camX.set(fx);
    camY.set(fy);
    // The reveal is the floor under everything: it costs no SVG repaint, so
    // even a notebook too big to animate its settle still arrives.
    intro.set(
      sim.reduceMotion || preview ? 1 : withTiming(1, { duration: INTRO_MS }),
    );
    // sim is deliberately a fresh object each render; the effect reads its
    // positions ONCE, at the moment settled flips true. Listing it would
    // re-run this every frame — the exact per-frame cost this gate ended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    galaxy,
    size,
    field,
    preview,
    settled,
    scale,
    savedScale,
    tx,
    ty,
    savedTx,
    savedTy,
    camX,
    camY,
    minZoom,
    intro,
  ]);

  // The first tap SELECTS: the planet's constellation lights up and the rest
  // of the sky fades to a murmur, exactly Obsidian's click-to-highlight. A
  // second tap on the same planet opens it, so a decided child still pays
  // only one extra tap and an exploring one gets to look before leaping.
  // Press-and-hold keeps toggling the highlight directly.
  const tap = useCallback(
    (node: OrbitedNode) => {
      if (Date.now() - panEndedAt.current < 250) return;
      if (focus !== node.title) {
        setFocus(node.title);
        return;
      }
      onSelect(node);
    },
    [onSelect, focus],
  );
  const hold = useCallback(
    (node: OrbitedNode) => setFocus((f) => (f === node.title ? null : node.title)),
    [],
  );

  const alpha = (title: string) =>
    !neighbours || neighbours.has(title.toLowerCase()) ? 1 : DIM;

  /**
   * Which bodies get their name drawn.
   *
   * Every node used to, unconditionally. Two things go wrong with that as
   * a notebook grows. It is the most expensive element in the scene — the
   * software rasteriser measures and lays out glyphs per node, per frame —
   * and long before the cost matters the labels have already collided into
   * a band of overlapping text that nobody can read anyway.
   *
   * So: below the threshold every name is drawn, because at that size they
   * fit and the map is a reading surface. Above it, names are drawn for the
   * hub, for whatever is focused and its neighbours (the reason you looked),
   * and for the biggest bodies — radius already encodes how connected a note
   * is, so this is "the landmarks", which is what a crowded star chart
   * labels too.
   */
  const labelled = useMemo(() => {
    const all = galaxy?.nodes ?? [];
    if (all.length <= LABEL_ALL_BELOW) return null; // null = label everything
    const keep = new Set<string>();
    for (const n of all) if (n.ring === 0) keep.add(n.title.toLowerCase());
    if (neighbours) for (const t of neighbours) keep.add(t);
    for (const n of [...all].sort((a, b) => b.r - a.r).slice(0, LABEL_TOP_N)) {
      keep.add(n.title.toLowerCase());
    }
    return keep;
  }, [galaxy, neighbours]);

  /**
   * The labels that actually get drawn, after dropping the ones that would
   * land on top of another.
   *
   * The map draws a name under every body it is allowed to, and bodies do
   * not know about each other’s text — so names collided into unreadable
   * piles, which is what the map looked like in the field. Culling by node
   * COUNT does not fix that: twelve notes already overlap if two of them
   * drift close together.
   *
   * So it is resolved geometrically, the way a cartographer does it: walk
   * the candidates in order of importance and keep a name only if its box
   * is still clear. The hub goes first, then the focused note and its
   * neighbours (the reason you are looking), then the biggest bodies.
   * Whatever loses simply has no name until the sky drifts apart or you
   * tap it — and a name you cannot read was never doing any work.
   *
   * Recomputed per physics step, but only over the labels, and the sim now
   * sleeps — so this is a bounded cost on a scene that stops moving.
   */
  const visibleLabels = useMemo(() => {
    // Names are held back while the sky is in flight. An SvgText is the most
    // expensive element in the scene — the software rasteriser measures and
    // lays out glyphs per node, per frame — and a name you cannot read because
    // it is moving was never doing any work. They arrive in the frame the sky
    // stops in, which reads as the map labelling itself.
    if (preview || sim.settling) return new Set<string>();
    const cand = liveNodes
      .filter((n) => !labelled || labelled.has(n.title.toLowerCase()))
      .map((n) => {
        const focusRank =
          n.ring === 0 ? 0 : neighbours?.has(n.title.toLowerCase()) ? 1 : 2;
        return { n, focusRank };
      })
      .sort((a, b) => a.focusRank - b.focusRank || b.n.r - a.n.r);

    const placed: { x: number; y: number; hw: number; hh: number }[] = [];
    const keep = new Set<string>();
    for (const { n } of cand) {
      const size = n.ring === 0 ? 11 : 10;
      const chars = Math.min(n.title.length, 14);
      // Average advance per glyph, per face. The labels now render in
      // real Inter on BOTH platforms (embedded on Android, @font-face on
      // web), so the estimate finally measures the font the screen
      // draws: Bold runs a touch wider than Medium. It only has to be
      // right enough to detect a collision.
      const em = n.ring === 0 ? 0.58 : 0.53;
      const hw = (chars * size * em) / 2;
      const hh = size * 0.6;
      const y =
        n.y +
        (n.ring === 0
          ? Math.max(8, n.r * 0.72) + 15
          : Math.max(5.5, n.r * 0.74) + 13);
      const clear = placed.every(
        (q) => Math.abs(q.x - n.x) > q.hw + hw || Math.abs(q.y - y) > q.hh + hh,
      );
      if (!clear) continue;
      placed.push({ x: n.x, y, hw, hh });
      keep.add(n.title);
    }
    return keep;
  }, [liveNodes, labelled, neighbours, preview, sim.settling]);

  const onLayout = (e: LayoutChangeEvent) => {
    const l = e.nativeEvent.layout;
    setSize((prev) =>
      prev.width === l.width && prev.height === (height ?? l.height)
        ? prev
        : { width: l.width, height: height ?? l.height },
    );
  };

  return (
    <GestureDetector gesture={gesture}>
      <View
        onLayout={onLayout}
        style={[styles.canvas, height === undefined ? styles.fill : { height }]}
        accessibilityLabel="Qaydlar olami"
      >
        {/* The canvas is field-sized and centred on the viewport, so it still
            scales about the viewport's centre — and so nothing the physics
            settles into lands outside the <Svg>'s own bounds, which is a
            native view boundary and cuts rather than merely hides. */}
        {galaxy && nodes.length > 0 && (
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: (size.width - field.width) / 2,
                top: (size.height - field.height) / 2,
                width: field.width,
                height: field.height,
              },
              canvasStyle,
            ]}
          >
            <Svg width={field.width} height={field.height}>
              <Defs>
                {/* The sun — a warm core burning out to nothing. */}
                <RadialGradient id="sun-core" cx="42%" cy="38%" r="65%">
                  <Stop offset="0%" stopColor="#FFFDF2" stopOpacity={1} />
                  <Stop offset="35%" stopColor="#FFE066" stopOpacity={1} />
                  <Stop offset="75%" stopColor="#F59E0B" stopOpacity={1} />
                  <Stop offset="100%" stopColor="#C2410C" stopOpacity={0.9} />
                </RadialGradient>
                {/* The corona's gradient, and the corona itself further
                    down, are here ONLY while the sky is still — a thumbnail or
                    reduce-motion. Otherwise both live in sky-ambient's own
                    canvas, where the glow can breathe, and this canvas is five
                    elements cheaper for every repaint it ever does. */}
                {!lifted && (
                  <RadialGradient id="sun-glow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor="#FFD86B" stopOpacity={0.4} />
                    <Stop offset="55%" stopColor="#F59E0B" stopOpacity={0.14} />
                    <Stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                  </RadialGradient>
                )}

                {/* One sphere per planet: an off-centre highlight is the
                    trick that turns a flat disc into a globe, and each
                    archetype keeps its own daylight, base and limb colours. */}
                {PLANET_TYPES.map((p) => (
                  <RadialGradient
                    key={`pg-${p.key}`}
                    id={`pg-${p.key}`}
                    cx="35%"
                    cy="30%"
                    r="75%"
                  >
                    <Stop offset="0%" stopColor={p.stops[0]} stopOpacity={1} />
                    <Stop offset="42%" stopColor={p.stops[1]} stopOpacity={1} />
                    <Stop offset="100%" stopColor={p.stops[2]} stopOpacity={1} />
                  </RadialGradient>
                ))}

                {/* ── Lighting, shared by every sphere ──────────────────
                    A single flat gradient reads as a coloured disc. Three
                    cheap layers turn it into a lit ball, and all three key
                    off the SAME light position (upper-left, 33%/28%) that
                    the per-planet gradients above use — if these ever
                    disagree, the planet looks lit from two suns at once.

                    All are unit-space (objectBoundingBox), so one definition
                    serves every planet at every radius. */}

                {/* Night side. Transparent across the lit face, deepening to
                    near-black at the far limb — this is what makes surface
                    features look like they lie ON a sphere rather than on a
                    sticker. */}
                <RadialGradient id="planet-night" cx="33%" cy="28%" r="82%">
                  <Stop offset="52%" stopColor="#03060F" stopOpacity={0} />
                  <Stop offset="78%" stopColor="#03060F" stopOpacity={0.34} />
                  <Stop offset="100%" stopColor="#010309" stopOpacity={0.74} />
                </RadialGradient>

                {/* Specular. The wet/icy glint at the light point. Small and
                    weak on purpose: oversized, it turns every world into a
                    billiard ball. */}
                <RadialGradient id="planet-spec" cx="31%" cy="26%" r="30%">
                  <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.42} />
                  <Stop offset="45%" stopColor="#FFFFFF" stopOpacity={0.1} />
                  <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
                </RadialGradient>
              </Defs>

              {/* ── Starfield ────────────────────────────────────────────
                  Hundreds of stars, four elements. Each star used to be its
                  own <Circle>, which is a real native view on Android and made
                  the field 170 of the ~300 views in the whole sky — more
                  than the planets, the edges and the labels put together,
                  for something that never moves. Bucketing by brightness and
                  emitting one <Path> of circular subpaths per bucket draws
                  the identical picture: opacity is the only property that
                  differed between them, and there are four levels of it. */}
              {starField4}

              {/* ── A shooting star, now and then. Timed off the simulation
                  clock, so it only flies while the sky itself is alive —
                  reduce-motion never sees one. It keeps flying at half
                  light while a constellation is selected: the sky must not
                  hold its breath just because the child is looking. */}

              {/* ── Constellations. With nothing selected, every edge is a
                  faint hairline — Obsidian's lines recede so the dots carry
                  the picture. Selecting a planet splits the sky: its own
                  edges rise on top with a soft glow, everyone else's stay as
                  barely-there threads, and a mention is dashed in either
                  world so the map never overstates how deliberate a
                  connection was. Lit edges render after dim ones on purpose:
                  the selection must never pass underneath a stranger. */}
              {(() => {
                const isLit = (e: (typeof galaxy.edges)[number]) =>
                  !!neighbours &&
                  neighbours.has(e.sourceTitle.toLowerCase()) &&
                  neighbours.has(e.targetTitle.toLowerCase());
                const renderEdge = (
                  e: (typeof galaxy.edges)[number],
                  i: number,
                  lit: boolean,
                ) => {
                  // Endpoints follow the bodies they join, so a line never
                  // detaches from the dot it belongs to while the system
                  // moves.
                  const a = drawnAt(e.sourceTitle, e.x1, e.y1);
                  const b = drawnAt(e.targetTitle, e.x2, e.y2);
                  const guessed = e.kind === 'mention';
                  const d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
                  if (lit) {
                    return (
                      <G key={`e${i}`}>
                        <Path
                          d={d}
                          stroke={EDGE_GLOW}
                          strokeWidth={guessed ? 3.4 : 4.6}
                          strokeLinecap="round"
                          fill="none"
                        />
                        <Path
                          d={d}
                          stroke={EDGE_ON}
                          strokeWidth={guessed ? 1.2 : 1.8}
                          strokeDasharray={guessed ? '4,4' : undefined}
                          strokeOpacity={guessed ? 0.75 : 1}
                          fill="none"
                        />
                      </G>
                    );
                  }
                  return (
                    <Path
                      key={`e${i}`}
                      d={d}
                      stroke={EDGE}
                      strokeWidth={guessed ? 0.8 : 1}
                      strokeDasharray={guessed ? '4,4' : undefined}
                      strokeOpacity={(neighbours ? EDGE_DIM : 1) * (guessed ? 0.6 : 1)}
                      fill="none"
                    />
                  );
                };
                return (
                  <>
                    {galaxy.edges.map((e, i) =>
                      isLit(e) ? null : renderEdge(e, i, false),
                    )}
                    {galaxy.edges.map((e, i) =>
                      isLit(e) ? renderEdge(e, i, true) : null,
                    )}
                  </>
                );
              })()}

              {/* ── Bodies. A little solar system: the hub is the sun, every
                  note is a planet with a lit hemisphere, and roughly a third
                  of them carry a Saturn ring — decided by the note's name, so
                  a planet keeps its character forever. Drawn smaller than
                  their physics radius (`n.r` still spaces the simulation and
                  the touch targets), which is what gives the graph its air. */}
              {/* The drifting bodies are drawn below, in canvases of their
                  own — they cannot be in here and move. */}
              {liveNodes.filter((n) => !driftSet.has(n.title)).map((n) => {
                const a = alpha(n.title);
                const { x, y } = n;
                // The neon verdicts: gold for the chosen planet, cyan for
                // everyone joined to it — the connected suddenly wear a
                // different light while the sky keeps wandering around them.
                const selected = focus === n.title;
                const linked =
                  !!focus && !selected && !!neighbours?.has(n.title.toLowerCase());
                const neonRings = (r: number) =>
                  selected || linked ? (
                    <>
                      <Circle
                        cx={x}
                        cy={y}
                        r={r + 5}
                        fill="none"
                        stroke={selected ? NEON_SELECTED : NEON_LINKED}
                        strokeOpacity={0.22}
                        strokeWidth={5}
                      />
                      <Circle
                        cx={x}
                        cy={y}
                        r={r + 3}
                        fill="none"
                        stroke={selected ? NEON_SELECTED : NEON_LINKED}
                        strokeOpacity={0.95}
                        strokeWidth={1.7}
                      />
                    </>
                  ) : null;

                if (n.ring === 0) {
                  const rd = Math.max(8, n.r * 0.72);
                  return (
                    <G key={`n-${n.title}`} opacity={a}>
                      {!lifted && (
                        <Circle cx={x} cy={y} r={rd * 2.5} fill="url(#sun-glow)" />
                      )}
                      <Circle cx={x} cy={y} r={rd} fill="url(#sun-core)" />
                      {neonRings(rd)}
                    </G>
                  );
                }

                const rd = Math.max(5.5, n.r * 0.74);

                // A #tag joins notes but is not one, so it is a STAR, never
                // a planet — a landmark must not be mistakeable for a note.
                //
                // It used to be a four-pointed sparkle. That shape is now the
                // Gemini logo, so a tag on the map read as "AI did this" — a
                // meaning nobody intended, on a screen where DUYO writing
                // things for you is a real feature and the confusion is
                // therefore expensive.
                //
                // A star is round like everything else in this sky, and
                // separates from a planet by LIGHT rather than by outline:
                // planets are shaded spheres lit from one side, a star emits.
                if (n.kind === 'tag') {
                  const core = rd * 0.62;
                  return (
                    <G key={`n-${n.title}`} opacity={a}>
                      {/* Outer halo — what makes it read as emitting rather
                          than as one more coloured dot. */}
                      <Circle cx={x} cy={y} r={core * 3.1} fill={n.colour} opacity={0.1} />
                      <Circle cx={x} cy={y} r={core * 2.1} fill={n.colour} opacity={0.18} />
                      {/* Corona in the tag's own colour, so the map stays a
                          legend for the chips above it. */}
                      <Circle cx={x} cy={y} r={core * 1.35} fill={n.colour} opacity={0.5} />
                      {/* White-hot centre: a real star's core burns out to
                          white whatever colour its corona is. */}
                      <Circle cx={x} cy={y} r={core} fill="#FFFFFF" opacity={0.92} />
                    </G>
                  );
                }

                // Not written yet — a ghost planet: outline only, waiting to
                // be born the day the child writes it.
                if (n.kind === 'unwritten') {
                  return (
                    <Circle
                      key={`n-${n.title}`}
                      cx={x}
                      cy={y}
                      r={rd}
                      fill={UNFORMED}
                      fillOpacity={0.18}
                      stroke={UNFORMED}
                      strokeWidth={1.2}
                      strokeDasharray="3,3"
                      opacity={a}
                    />
                  );
                }

                const seed = hash32(n.title);
                const planet = PLANET_TYPES[seed % PLANET_TYPES.length];
                const clipId = `pc-${seed.toString(36)}`;

                // Too small to show a sphere: draw the disc and stop.
                // This is the common case, not the exception — bodies
                // shrink as the notebook grows, so on a big map EVERY
                // planet takes this path and the scene drops from ~13
                // elements a node to 2.
                if (rd < PLANET_DETAIL_ABOVE) {
                  return (
                    <G key={`n-${n.title}`} opacity={a}>
                      <Circle
                        cx={x}
                        cy={y}
                        r={rd}
                        fill={`url(#pg-${planet.key})`}
                      />
                      {neonRings(rd)}
                    </G>
                  );
                }

                // Only the truly ringed worlds carry one — a ring IS Saturn's
                // (and, tipped on its side, Uranus's) identity.
                const ring =
                  planet.key === 'saturn'
                    ? ringHalves(x, y, -18, rd * 1.95, rd * 0.62, Math.max(1.4, rd * 0.26), '#D9C08A')
                    : planet.key === 'uranus'
                      ? ringHalves(x, y, -76, rd * 1.7, rd * 0.55, Math.max(1, rd * 0.12), 'rgba(229,251,252,0.8)')
                      : null;

                return (
                  <G key={`n-${n.title}`} opacity={a}>
                    {ring?.back}
                    <Defs>
                      <ClipPath id={clipId}>
                        <Circle cx={x} cy={y} r={rd} />
                      </ClipPath>
                    </Defs>
                    {/* Albedo — the planet's own colour. */}
                    <Circle cx={x} cy={y} r={rd} fill={`url(#pg-${planet.key})`} />

                    {/* Surface, clipped to the disc. */}
                    <G clipPath={`url(#${clipId})`}>
                      {planetFeatures(planet.key, x, y, rd)}
                    </G>

                    {/* Night side, over the features rather than under them —
                        a continent that stays bright as it wraps past the
                        terminator is the exact tell that kills the illusion.
                        This replaced a uniform 1px outline that was labelled
                        a limb shadow but shaded nothing. */}
                    <Circle cx={x} cy={y} r={rd} fill="url(#planet-night)" />

                    {/* Specular glint, faded in with size rather than switched
                        on at a threshold.

                        The threshold used to be `rd >= 9`, and it was set
                        without checking what radii actually occur. A body is
                        drawn at `max(5.5, n.r * 0.74)`, and `n.r` runs from
                        MIN_R (7) to MAX_R (17) scaled by a density factor that
                        falls to 0.42 as the notebook fills. So the drawn radius
                        tops out near 12.6 for the most-linked note in a SMALL
                        notebook — and past about 24 notes density pins every
                        single body to the 5.5 floor. In other words the glint
                        never once drew for a real child's map, and the sphere
                        shading it belongs to read as a flat disc.

                        The original worry was sound — a full-strength highlight
                        on an 11px ball is a grey smudge — so it ramps instead of
                        popping: a hint at the floor, the whole thing by 8px. */}
                    <Circle
                      cx={x}
                      cy={y}
                      r={rd}
                      fill="url(#planet-spec)"
                      opacity={Math.min(1, (rd - 4) / 4)}
                    />

                    {/* Rim light along the dark limb — the curvature cue. */}
                    {rimLight(x, y, rd, RIM_LIGHT[planet.key])}
                    {ring?.front}
                    {neonRings(rd)}
                  </G>
                );
              })}

              {/* ── Names. The tag's colour lives here now — the spheres wear
                  their planet faces, so the label is what still says which
                  collection a note belongs to. */}
              {liveNodes
                .filter((n) => visibleLabels.has(n.title) && !driftSet.has(n.title))
                .map((n) => (
                <SvgText
                  key={`t-${n.title}`}
                  x={n.x}
                  y={
                    n.y +
                    (n.ring === 0
                      ? Math.max(8, n.r * 0.72) + 15
                      : Math.max(5.5, n.r * 0.74) + 13)
                  }
                  fill={
                    n.ring === 0
                      ? '#FFE9B8'
                      : n.colour !== UNTAGGED
                        ? n.colour
                        : LABEL
                  }
                  fontSize={n.ring === 0 ? 11 : 10}
                  // A real family, not a bare fontWeight. With no family,
                  // Android drew these in the system font — the one part of
                  // the app not in Inter, and wider than the 0.55em/char the
                  // collision pass assumes, which is how labels the pass had
                  // cleared still collided on the phone. The weight lives in
                  // the family name; rnsvg resolves it from the embedded
                  // assets/fonts/<family>.ttf by filename (TSpanView.java),
                  // and on web expo-font registers the same names as
                  // @font-face, so both platforms now agree with the
                  // estimator.
                  fontFamily={n.ring === 0 ? 'Inter_700Bold' : 'Inter_500Medium'}
                  textAnchor="middle"
                  opacity={alpha(n.title) * 0.9}
                >
                  {n.title.length > 14 ? `${n.title.slice(0, 13)}…` : n.title}
                </SvgText>
              ))}
            </Svg>

            {/* ── The living sky ───────────────────────────────────────
                Everything that moves forever, and none of it inside the canvas
                above. Each of these is a small <Svg> whose contents never
                change, under an Animated.View that does — a RenderNode
                property, which Android composites without redrawing a pixel.
                Per frame the whole stack repaints zero elements and does no JS
                work at all, which is why it is safe at any notebook size and
                why it can simply never stop. See components/sky-ambient.tsx. */}
            {ambient && (
              <>
                <TwinkleField
                  width={field.width}
                  height={field.height}
                  on={moving}
                  cam={skyCam}
                />
                {sunBody && (
                  <>
                    <SunBreath
                      x={sunBody.x}
                      y={sunBody.y}
                      r={sunRd}
                      on={moving}
                      dim={!!focus}
                    />
                    <DustRing
                      x={sunBody.x}
                      y={sunBody.y}
                      r={sunRd * 4.2}
                      on={moving}
                      dim={!!focus}
                    />
                  </>
                )}
              </>
            )}

            {/* The unlinked planets, each with its name, adrift in a canvas of
                its own. Mounted from the first paint rather than when the
                drift starts: moving a body between canvases costs a full
                re-rasterisation of the main sky, and it should be paid once at
                most. Until `moving`, the clock stands still and they are
                ordinary planets that happen to be drawn elsewhere. */}
            {driftBodies.map((n) => {
              const seed = hash32(n.title);
              const gradient = `amb-w-${seed.toString(36)}`;
              const planet = PLANET_TYPES[seed % PLANET_TYPES.length];
              // The same expression the canvas draws with. An unlinked body is
              // always at the 5.5 floor — `n.r` for a note nothing links to is
              // minBody, and 0.74 of that never reaches it — so this is always
              // the flat branch, which is what makes the canvas below seven
              // elements and 194 KB.
              const rd = Math.max(5.5, n.r * 0.74);
              return (
                <Wanderer
                  key={`w-${n.title}`}
                  x={n.x}
                  y={n.y}
                  w={WANDER_W}
                  h={WANDER_H}
                  seed={seed}
                  clock={wanderClock}
                >
                  <Svg width={WANDER_W} height={WANDER_H} pointerEvents="none">
                    <Defs>
                      <RadialGradient id={gradient} cx="35%" cy="30%" r="75%">
                        <Stop offset="0%" stopColor={planet.stops[0]} stopOpacity={1} />
                        <Stop offset="42%" stopColor={planet.stops[1]} stopOpacity={1} />
                        <Stop offset="100%" stopColor={planet.stops[2]} stopOpacity={1} />
                      </RadialGradient>
                    </Defs>
                    <Circle
                      cx={WANDER_W / 2}
                      cy={WANDER_TOP}
                      r={rd}
                      fill={`url(#${gradient})`}
                      opacity={alpha(n.title)}
                    />
                    {/* The chosen planet's ring, drawn here because a drifting
                        body is not in the canvas that draws everyone else's —
                        without it a tap on a wanderer dims the whole sky and
                        gives no sign of what was picked. Only the green one:
                        a wanderer has no links, so it can never be the red
                        `linked` case. */}
                    {focus === n.title && (
                      <>
                        <Circle
                          cx={WANDER_W / 2}
                          cy={WANDER_TOP}
                          r={rd + 5}
                          fill="none"
                          stroke={NEON_SELECTED}
                          strokeOpacity={0.22}
                          strokeWidth={5}
                        />
                        <Circle
                          cx={WANDER_W / 2}
                          cy={WANDER_TOP}
                          r={rd + 3}
                          fill="none"
                          stroke={NEON_SELECTED}
                          strokeOpacity={0.95}
                          strokeWidth={1.7}
                        />
                      </>
                    )}
                    {visibleLabels.has(n.title) && (
                      <SvgText
                        x={WANDER_W / 2}
                        y={WANDER_TOP + rd + 13}
                        fill={n.colour !== UNTAGGED ? n.colour : LABEL}
                        fontSize={10}
                        fontFamily="Inter_500Medium"
                        textAnchor="middle"
                        opacity={alpha(n.title) * 0.9}
                      >
                        {n.title.length > 14 ? `${n.title.slice(0, 13)}…` : n.title}
                      </SvgText>
                    )}
                  </Svg>
                  {!sim.settling && (
                    <Pressable
                      onPress={() => tap(n)}
                      onLongPress={() => hold(n)}
                      accessibilityRole="button"
                      accessibilityLabel={labelOf(n)}
                      style={[
                        styles.touch,
                        styles.focusable,
                        {
                          left: WANDER_W / 2 - 24,
                          top: WANDER_TOP - 24,
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                        },
                      ]}
                    />
                  )}
                </Wanderer>
              );
            })}

            {/* The shooting star lives in its own canvas, deliberately.
                Android rasterises an SvgView's children into ONE bitmap and
                repaints the whole thing when any child changes — so a meteor
                animating inside the sky above would repaint all ~500 of its
                elements every frame, which is exactly the cost the settled
                sim exists to remove. */}
            {lifted && (
              // The wrapper is viewport-sized and centred on the field, but it
              // is a plain View: it holds no bitmap, it only gives the flight
              // the coordinates the old canvas used to give it. The streak's
              // own canvas is 120x40.
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: (field.width - size.width) / 2,
                  top: (field.height - size.height) / 2,
                  width: size.width,
                  height: size.height,
                }}
              >
                <Meteor
                  width={size.width}
                  height={size.height}
                  dim={!!focus}
                  on={moving}
                />
              </View>
            )}

            {/* N absolutely-positioned Views, re-laid-out whenever a body
                moves — and there is nothing to tap on a planet that has not
                landed yet. It arms when the sky stops. */}
            {!sim.settling && (
              <TouchLayer
                nodes={liveNodes.filter((n) => !driftSet.has(n.title))}
                onTap={tap}
                onHold={hold}
              />
            )}
          </Animated.View>
        )}

        {/* `focus` is a title, so `focus && …` would render the empty string as
            a bare text node and react-native-web would throw. */}
        {focus ? (
          <Pressable
            onPress={reset}
            accessibilityRole="button"
            accessibilityLabel="Ko'rinishni tiklash"
            style={[styles.reset, styles.focusable]}
          >
            <Text style={styles.resetText}>Tiklash</Text>
          </Pressable>
        ) : null}

        {nodes.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyGlyph}>🌌</Text>
            <Text style={styles.emptyText}>
              Olaming hali bo'sh. Birinchi qaydni yozsang, shu yerda birinchi
              yulduzing yonadi.
            </Text>
          </View>
        )}

        {/* Notes but no lines yet. Loose bodies are the honest picture of an
            unlinked notebook — a child who doesn't know what makes the lines
            appear will just think the map is broken. */}
        {nodes.length > 0 && edges.length === 0 && (
          <View style={styles.hint}>
            <Text style={styles.hintText}>
              Qaydlarda #teg yoz yoki bir qaydda boshqasining nomini eslat —
              yulduzlar o'zaro bog'lana boshlaydi.
            </Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  canvas: { overflow: 'hidden' },
  fill: { flex: 1 },

  /** A body IS its touch target — position and size follow the simulation. */
  touch: { position: 'absolute' },

  // A chip resting on the sky: 'sm', the lowest rung that is still an object.
  // It does NOT use `glass()` — that pane is white-on-pale-blue, and over deep
  // space a 55%-white fill is a milky blob. The violet wash stays and only the
  // light comes from the ladder, which is what `lift` is for.
  reset: {
    position: 'absolute',
    right: 10,
    top: 10,
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(130,0,219,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(224,231,255,0.20)',
    boxShadow: lift('sm'),
  },
  resetText: { fontSize: 12, color: RESET_TEXT },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyGlyph: { fontSize: 36, marginBottom: 8 },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    color: CANVAS_TEXT,
  },

  hint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 74,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  hintText: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 40,
    color: CANVAS_TEXT,
  },
});
