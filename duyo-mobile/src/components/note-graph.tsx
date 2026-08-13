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
  Defs,
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
  type OrbitedNode,
} from '@/lib/galaxy-layout';

const EDGE = 'rgba(160, 190, 255, 0.22)';
const EDGE_ON = 'rgba(200, 220, 255, 0.85)';
/** Muted, the way Obsidian's labels sit under their dots. */
const LABEL = '#A9B4CC';
const DIM = 0.16;

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

/** Gradient ids have to be unique per colour, and colours arrive as hex. */
const idFor = (colour: string, prefix: string) =>
  `${prefix}-${colour.replace('#', '')}`;

/** A four-pointed sparkle, centred on (x, y). Tags are drawn as stars rather
 *  than planets so a landmark never reads as one more note. */
function sparkle(x: number, y: number, r: number): string {
  const w = r * 0.32;
  return (
    `M ${x} ${y - r} Q ${x + w} ${y - w} ${x + r} ${y} ` +
    `Q ${x + w} ${y + w} ${x} ${y + r} ` +
    `Q ${x - w} ${y + w} ${x - r} ${y} ` +
    `Q ${x - w} ${y - w} ${x} ${y - r} Z`
  );
}

/** Stable per-note number, so a planet keeps its character (ring, tilt)
 *  across every visit. */
function seedOf(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return h;
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

  const stars = useMemo(
    () => (size.width > 0 ? starField(size.width, size.height) : []),
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

  // Every distinct body colour, so one planet gradient is defined per colour
  // rather than one per node.
  const palette = useMemo(
    () => [...new Set((galaxy?.nodes ?? []).map((n) => n.colour))],
    [galaxy],
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
    // A three-note sky must not zoom into cartoon-sized discs.
    const s = Math.min(2.1, Math.max(MIN_ZOOM, fit));
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

  // A tap opens; press-and-hold lights up the neighbourhood. Obsidian opens a
  // node on click too — making the first tap only "select" meant every note
  // cost two taps, which is the wrong trade on a phone.
  const tap = useCallback(
    (node: OrbitedNode) => {
      if (Date.now() - panEndedAt.current < 250) return;
      onSelect(node);
    },
    [onSelect],
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

                {/* One sphere per colour: an off-centre highlight is the whole
                    trick that turns a flat disc into a planet. */}
                {palette.map((colour) => (
                  <RadialGradient
                    key={idFor(colour, 'planet')}
                    id={idFor(colour, 'planet')}
                    cx="35%"
                    cy="30%"
                    r="75%"
                  >
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.9} />
                    <Stop offset="35%" stopColor={colour} stopOpacity={1} />
                    <Stop offset="100%" stopColor="#0B1020" stopOpacity={0.94} />
                  </RadialGradient>
                ))}
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

              {/* ── Constellations ─────────────────────────────────────── */}
              {galaxy.edges.map((e, i) => {
                const lit =
                  !neighbours ||
                  (neighbours.has(e.sourceTitle.toLowerCase()) &&
                    neighbours.has(e.targetTitle.toLowerCase()));
                // Endpoints follow the bodies they join, so a line never
                // detaches from the dot it belongs to while the system moves.
                const a = drawnAt(e.sourceTitle, e.x1, e.y1);
                const b = drawnAt(e.targetTitle, e.x2, e.y2);
                // Straight, hairline, faint — Obsidian's edges recede so the
                // dots carry the picture. A mention is something we inferred,
                // not something the child typed, so it is dashed and fainter
                // still, never overstating how deliberate a connection was.
                const guessed = e.kind === 'mention';
                return (
                  <Path
                    key={`e${i}`}
                    d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}
                    stroke={lit ? EDGE_ON : EDGE}
                    strokeWidth={guessed ? 0.8 : lit ? 1.4 : 1}
                    strokeDasharray={guessed ? '4,4' : undefined}
                    strokeOpacity={(lit ? 1 : DIM) * (guessed ? 0.6 : 1)}
                    fill="none"
                  />
                );
              })}

              {/* ── Bodies. A little solar system: the hub is the sun, every
                  note is a planet with a lit hemisphere, and roughly a third
                  of them carry a Saturn ring — decided by the note's name, so
                  a planet keeps its character forever. Drawn smaller than
                  their physics radius (`n.r` still spaces the simulation and
                  the touch targets), which is what gives the graph its air. */}
              {liveNodes.map((n) => {
                const a = alpha(n.title);
                const { x, y } = n;

                if (n.ring === 0) {
                  const rd = Math.max(8, n.r * 0.72);
                  return (
                    <G key={`n-${n.title}`} opacity={a}>
                      <Circle cx={x} cy={y} r={rd * 2.5} fill="url(#sun-glow)" />
                      <Circle cx={x} cy={y} r={rd} fill="url(#sun-core)" />
                    </G>
                  );
                }

                const rd = Math.max(4, n.r * 0.62);

                // A #tag joins notes but is not one — a sparkle, never a
                // planet, so a landmark cannot be mistaken for a note.
                if (n.kind === 'tag') {
                  return (
                    <Path
                      key={`n-${n.title}`}
                      d={sparkle(x, y, rd * 1.4)}
                      fill={n.colour}
                      opacity={a}
                    />
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

                const lit = focus === n.title;
                const seed = seedOf(n.title);
                const ringed = seed % 3 === 0;
                const tilt = -24 + (seed % 5) * 10;
                const rx = rd * 1.95;
                const ry = rd * 0.62;
                const ringW = Math.max(1.4, rd * 0.26);

                return (
                  <G key={`n-${n.title}`} opacity={a}>
                    {/* Ring, far half — slips behind the planet. In SVG's
                        y-down plane sweep=1 arcs above the midline. */}
                    {ringed && (
                      <G transform={`translate(${x}, ${y}) rotate(${tilt})`}>
                        <Path
                          d={`M ${-rx} 0 A ${rx} ${ry} 0 0 1 ${rx} 0`}
                          stroke={n.colour}
                          strokeOpacity={0.4}
                          strokeWidth={ringW}
                          fill="none"
                        />
                      </G>
                    )}
                    <Circle
                      cx={x}
                      cy={y}
                      r={rd}
                      fill={`url(#${idFor(n.colour, 'planet')})`}
                      stroke={lit ? '#FFFFFF' : 'none'}
                      strokeWidth={lit ? 1.6 : 0}
                      strokeOpacity={0.9}
                    />
                    {/* Ring, near half — crosses in front. */}
                    {ringed && (
                      <G transform={`translate(${x}, ${y}) rotate(${tilt})`}>
                        <Path
                          d={`M ${-rx} 0 A ${rx} ${ry} 0 0 0 ${rx} 0`}
                          stroke={n.colour}
                          strokeOpacity={0.85}
                          strokeWidth={ringW}
                          strokeLinecap="round"
                          fill="none"
                        />
                      </G>
                    )}
                  </G>
                );
              })}

              {/* ── Names ──────────────────────────────────────────────── */}
              {liveNodes.map((n) => (
                <SvgText
                  key={`t-${n.title}`}
                  x={n.x}
                  y={
                    n.y +
                    (n.ring === 0
                      ? Math.max(8, n.r * 0.72) + 15
                      : Math.max(4, n.r * 0.62) + 13)
                  }
                  fill={n.ring === 0 ? '#FFE9B8' : LABEL}
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
