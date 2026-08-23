import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
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
import { useGraphSim } from '@/hooks/use-graph-sim';
import {
  layoutGalaxy,
  starField,
  UNFORMED,
  UNTAGGED,
  type OrbitedNode,
} from '@/lib/galaxy-layout';

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
/** How far outsiders fade while a constellation is selected. Bodies keep a
 *  third of their light — the child asked to still watch the whole sky
 *  mingle — while edges drop to barely-there. */
const DIM = 0.3;
const EDGE_DIM = 0.5;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

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

/** Stable per-note number, so a planet keeps its character across visits. */
function seedOf(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic 0..1 from an integer — mulberry32's mixing step. Meteors
 *  are timed off the simulation clock, so even they replay identically. */
function rand01(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A shooting star every ~11 seconds, each with its own moment, path and
 *  length. Returns null between meteors. */
const METEOR_PERIOD = 320;
const METEOR_LIFE = 26;
function meteorAt(tick: number, w: number, h: number) {
  const m = Math.floor(tick / METEOR_PERIOD);
  // Each meteor waits a different slice of its window before flying.
  const delay = Math.floor(rand01(m * 7919 + 13) * (METEOR_PERIOD - METEOR_LIFE - 30));
  const p = (tick % METEOR_PERIOD) - delay;
  if (p < 0 || p >= METEOR_LIFE) return null;

  const sx = rand01(m * 104729 + 7) * w;
  const sy = rand01(m * 130363 + 3) * h * 0.55;
  const toRight = rand01(m * 15485863 + 1) < 0.5;
  const run = (0.3 + 0.25 * rand01(m * 6151 + 9)) * w * (toRight ? 1 : -1);
  const fall = 0.14 * h + 0.1 * h * rand01(m * 3571 + 5);

  const t = p / METEOR_LIFE;
  const hx = sx + run * t;
  const hy = sy + fall * t;
  const tailT = Math.max(0, t - 0.22);
  // Bright near the head, gone by the tail; fades in fast, out slow.
  const fade = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
  return {
    hx,
    hy,
    tx: sx + run * tailT,
    ty: sy + fall * tailT,
    fade,
  };
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
            style={{
              position: 'absolute',
              left: n.x - hit,
              top: n.y - hit,
              width: hit * 2,
              height: hit * 2,
              borderRadius: hit,
            }}
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
export function NoteGraph({ nodes, edges, onSelect, height }: Props) {
  const [size, setSize] = useState({ width: 0, height: height ?? 0 });
  const [focus, setFocus] = useState<string | null>(null);

  const galaxy = useMemo(
    () =>
      size.width > 0 && size.height > 0
        ? layoutGalaxy(nodes, edges, size.width, size.height)
        : null,
    [nodes, edges, size],
  );

  // Twice the canvas in every direction, so panning or pinching out never
  // reveals a bare gradient at the edges — at MIN_ZOOM the visible region is
  // exactly the doubled field.
  const stars = useMemo(
    () =>
      size.width > 0
        ? starField(size.width * 2, size.height * 2, 170).map((s) => ({
            ...s,
            x: s.x - size.width / 2,
            y: s.y - size.height / 2,
          }))
        : [],
    [size],
  );

  const sim = useGraphSim(galaxy);

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
    // sim.tick is the physics clock: each step must rebuild, same step must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [galaxy, sim.tick],
  );

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
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  // .set()/.get() rather than .value: React Compiler can prove these are
  // shared-value accessors, where a bare `.value =` reads as mutating state.
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.set(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, savedScale.get() * e.scale)));
    })
    .onEnd(() => {
      savedScale.set(scale.get());
    });

  /** Screen point → canvas point, inverting the pan/zoom transform. The
   *  transform scales about the canvas centre, then translates. */
  const toCanvas = (ex: number, ey: number) => {
    const s = scale.get();
    const cxV = size.width / 2;
    const cyV = size.height / 2;
    return {
      x: cxV + (ex - tx.get() - cxV) / s,
      y: cyV + (ey - ty.get() - cyV) / s,
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
  const pan = Gesture.Pan()
    .runOnJS(true)
    .averageTouches(true)
    .onStart((e) => {
      // The gesture activates a few points in; grab from where it BEGAN.
      const origin = toCanvas(e.x - e.translationX, e.y - e.translationY);
      const grabbed =
        e.numberOfPointers === 1 ? sim.grabAt(origin.x, origin.y) : null;
      if (grabbed) {
        const p = sim.positionOf(grabbed);
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
        sim.dragTo(p.x + mode.dx, p.y + mode.dy);
      } else {
        tx.set(savedTx.get() + e.translationX);
        ty.set(savedTy.get() + e.translationY);
      }
    })
    .onEnd(() => {
      if (panMode.current?.kind === 'node') {
        sim.release();
      } else {
        savedTx.set(tx.get());
        savedTy.set(ty.get());
      }
      panMode.current = null;
      panEndedAt.current = Date.now();
    });

  const gesture = Gesture.Simultaneous(pinch, pan);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.get() },
      { translateY: ty.get() },
      { scale: scale.get() },
    ],
  }));

  const reset = () => {
    scale.set(withTiming(1));
    savedScale.set(1);
    tx.set(withTiming(0));
    ty.set(withTiming(0));
    savedTx.set(0);
    savedTy.set(0);
    setFocus(null);
  };

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
  useEffect(() => {
    if (!galaxy || galaxy.nodes.length === 0 || size.width === 0) return;
    // Under reduce-motion the sim settles synchronously, so tick 1 is final.
    if (!sim.reduceMotion && sim.tick < 40) return;
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
      const p = sim.positionOf(n.title) ?? n;
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
    // A three-note sky must not zoom into cartoon-sized discs — and labels
    // are drawn in screen-constant font under a scaled canvas, so past ~1.4x
    // a hub's name lands on top of the sun rather than under it. Verified on
    // the dashboard hero with a one-note, one-tag, one-ghost notebook.
    const s = Math.min(1.4, Math.max(MIN_ZOOM, fit));
    const fx = -((x0 + x1) / 2 - size.width / 2) * s;
    const fy = -((y0 + y1) / 2 - size.height / 2) * s;

    scale.set(withTiming(s));
    savedScale.set(s);
    tx.set(withTiming(fx));
    savedTx.set(fx);
    ty.set(withTiming(fy));
    savedTy.set(fy);
    // sim is deliberately a fresh object each render; tick is its clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galaxy, size, sim.tick, scale, savedScale, tx, ty, savedTx, savedTy]);

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
        style={
          height === undefined
            ? { flex: 1, overflow: 'hidden' }
            : { height, overflow: 'hidden' }
        }
        accessibilityLabel="Qaydlar olami"
      >
        {galaxy && nodes.length > 0 && (
          <Animated.View
            style={[{ width: size.width, height: size.height }, canvasStyle]}
          >
            <Svg width={size.width} height={size.height}>
              <Defs>
                {/* The sun — a warm core burning out to nothing. */}
                <RadialGradient id="sun-core" cx="42%" cy="38%" r="65%">
                  <Stop offset="0%" stopColor="#FFFDF2" stopOpacity={1} />
                  <Stop offset="35%" stopColor="#FFE066" stopOpacity={1} />
                  <Stop offset="75%" stopColor="#F59E0B" stopOpacity={1} />
                  <Stop offset="100%" stopColor="#C2410C" stopOpacity={0.9} />
                </RadialGradient>
                <RadialGradient id="sun-glow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#FFD86B" stopOpacity={0.4} />
                  <Stop offset="55%" stopColor="#F59E0B" stopOpacity={0.14} />
                  <Stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                </RadialGradient>

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

              {/* ── Starfield ──────────────────────────────────────────── */}
              {stars.map((s, i) => (
                <Circle
                  key={`s${i}`}
                  cx={s.x}
                  cy={s.y}
                  r={s.r}
                  fill="#FFFFFF"
                  opacity={s.o * (focus ? 0.45 : 1)}
                />
              ))}

              {/* ── A shooting star, now and then. Timed off the simulation
                  clock, so it only flies while the sky itself is alive —
                  reduce-motion never sees one. It keeps flying at half
                  light while a constellation is selected: the sky must not
                  hold its breath just because the child is looking. */}
              {!sim.reduceMotion &&
                (() => {
                  const met = meteorAt(sim.tick, size.width, size.height);
                  if (!met) return null;
                  return (
                    <G opacity={met.fade * (focus ? 0.5 : 1)}>
                      <Path
                        d={`M ${met.tx} ${met.ty} L ${met.hx} ${met.hy}`}
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth={1.4}
                        strokeLinecap="round"
                        fill="none"
                      />
                      <Circle cx={met.hx} cy={met.hy} r={1.8} fill="#FFFFFF" />
                    </G>
                  );
                })()}

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
              {liveNodes.map((n) => {
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
                      <Circle cx={x} cy={y} r={rd * 2.5} fill="url(#sun-glow)" />
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

                const seed = seedOf(n.title);
                const planet = PLANET_TYPES[seed % PLANET_TYPES.length];
                const clipId = `pc-${seed.toString(36)}`;

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
              {liveNodes.map((n) => (
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
                  fontWeight={n.ring === 0 ? 'bold' : 'normal'}
                  textAnchor="middle"
                  opacity={alpha(n.title) * 0.9}
                >
                  {n.title.length > 14 ? `${n.title.slice(0, 13)}…` : n.title}
                </SvgText>
              ))}
            </Svg>

            <TouchLayer nodes={liveNodes} onTap={tap} onHold={hold} />
          </Animated.View>
        )}

        {focus && (
          <Pressable
            onPress={reset}
            accessibilityRole="button"
            accessibilityLabel="Ko'rinishni tiklash"
            style={{
              position: 'absolute',
              right: 10,
              top: 10,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 8,
              backgroundColor: 'rgba(130,0,219,0.28)',
            }}
          >
            <Text className="text-xs text-dark-subtitle">Tiklash</Text>
          </Pressable>
        )}

        {/* The canvas is deep space in both themes, so text over it is always
            light — a theme-coloured muted grey would vanish into the nebula. */}
        {nodes.length === 0 && (
          <View className="flex-1 items-center justify-center">
            <Text className="text-4xl mb-2">🌌</Text>
            <Text className="text-sm text-center px-8" style={{ color: '#94A3B8' }}>
              Olaming hali bo'sh. Birinchi qaydni yozsang, shu yerda birinchi
              yulduzing yonadi.
            </Text>
          </View>
        )}

        {/* Notes but no lines yet. Loose bodies are the honest picture of an
            unlinked notebook — a child who doesn't know what makes the lines
            appear will just think the map is broken. */}
        {nodes.length > 0 && edges.length === 0 && (
          <View
            className="absolute left-0 right-0 items-center"
            style={{ bottom: 74, pointerEvents: 'none' }}
          >
            <Text className="text-xs text-center px-10" style={{ color: '#94A3B8' }}>
              Qaydlarda #teg yoz yoki bir qaydda boshqasining nomini eslat —
              yulduzlar o'zaro bog'lana boshlaydi.
            </Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}
