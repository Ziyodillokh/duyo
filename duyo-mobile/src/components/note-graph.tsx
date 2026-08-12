import { useCallback, useMemo, useRef, useState } from 'react';
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
  type OrbitedNode,
} from '@/lib/galaxy-layout';

const EDGE = 'rgba(160, 190, 255, 0.22)';
const EDGE_ON = 'rgba(200, 220, 255, 0.85)';
const LABEL = '#DCE6FA';
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

/** A four-pointed sparkle, centred on (x, y). Tags are drawn as stars rather
 *  than discs so a landmark never reads as one more note. */
function sparkle(x: number, y: number, r: number): string {
  const w = r * 0.32;
  return (
    `M ${x} ${y - r} Q ${x + w} ${y - w} ${x + r} ${y} ` +
    `Q ${x + w} ${y + w} ${x} ${y + r} ` +
    `Q ${x - w} ${y + w} ${x - r} ${y} ` +
    `Q ${x - w} ${y - w} ${x} ${y - r} Z`
  );
}

/** Gradient ids have to be unique per colour, and colours arrive as hex. */
const idFor = (colour: string, prefix: string) =>
  `${prefix}-${colour.replace('#', '')}`;

/**
 * The tap targets. They follow the simulation — a body IS its touch target,
 * so wherever physics carries a note, the finger finds it there. While the
 * system is asleep (which is the steady state) nothing here re-renders.
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
 * whole system settles over a few seconds into stillness, exactly the
 * open-then-calm rhythm of Obsidian's graph view. The physics is
 * deterministic, so the same notebook still settles into the same sky.
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

  // Every distinct body colour, so one gradient is defined per colour rather
  // than one per node.
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
                {/* Nebula — two wide, soft clouds. Stacked radial gradients
                    rather than a blur filter: blur is expensive on native and
                    a gradient is exactly as convincing at this softness. */}
                <RadialGradient id="nebula-a" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#8200DB" stopOpacity={0.30} />
                  <Stop offset="60%" stopColor="#5B21B6" stopOpacity={0.10} />
                  <Stop offset="100%" stopColor="#3C0366" stopOpacity={0} />
                </RadialGradient>
                <RadialGradient id="nebula-b" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#C6005C" stopOpacity={0.22} />
                  <Stop offset="65%" stopColor="#510424" stopOpacity={0.08} />
                  <Stop offset="100%" stopColor="#162456" stopOpacity={0} />
                </RadialGradient>

                {/* The centre star. */}
                <RadialGradient id="sun-core" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
                  <Stop offset="35%" stopColor="#DAB2FF" stopOpacity={0.95} />
                  <Stop offset="75%" stopColor="#8200DB" stopOpacity={0.75} />
                  <Stop offset="100%" stopColor="#3C0366" stopOpacity={0.15} />
                </RadialGradient>
                <RadialGradient id="sun-glow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#C27AFF" stopOpacity={0.42} />
                  <Stop offset="100%" stopColor="#8200DB" stopOpacity={0} />
                </RadialGradient>

                {palette.map((colour) => (
                  <RadialGradient
                    key={idFor(colour, 'body')}
                    id={idFor(colour, 'body')}
                    /* Lit from the upper-left, which is what makes a flat disc
                       read as a sphere. */
                    cx="35%"
                    cy="32%"
                    r="72%"
                  >
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.85} />
                    <Stop offset="38%" stopColor={colour} stopOpacity={1} />
                    <Stop offset="100%" stopColor="#0B1020" stopOpacity={0.92} />
                  </RadialGradient>
                ))}
                {palette.map((colour) => (
                  <RadialGradient
                    key={idFor(colour, 'halo')}
                    id={idFor(colour, 'halo')}
                    cx="50%"
                    cy="50%"
                    r="50%"
                  >
                    <Stop offset="0%" stopColor={colour} stopOpacity={0.34} />
                    <Stop offset="55%" stopColor={colour} stopOpacity={0.12} />
                    <Stop offset="100%" stopColor={colour} stopOpacity={0} />
                  </RadialGradient>
                ))}
              </Defs>

              {/* ── Deep space ─────────────────────────────────────────── */}
              <Ellipse
                cx={size.width * 0.24}
                cy={size.height * 0.26}
                rx={size.width * 0.62}
                ry={size.height * 0.34}
                fill="url(#nebula-a)"
              />
              <Ellipse
                cx={size.width * 0.78}
                cy={size.height * 0.74}
                rx={size.width * 0.58}
                ry={size.height * 0.30}
                fill="url(#nebula-b)"
              />

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
                // A shallow arc, bowed perpendicular to the line — straight
                // lines read as a diagram, curves as a web.
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const bow = Math.min(18, len * 0.12);
                const bx = mx - (dy / len) * bow;
                const by = my + (dx / len) * bow;
                // A mention is something we inferred, not something the child
                // typed — drawn thinner and dashed so the map never overstates
                // how deliberate a connection was.
                const guessed = e.kind === 'mention';
                return (
                  <Path
                    key={`e${i}`}
                    d={`M ${a.x} ${a.y} Q ${bx} ${by} ${b.x} ${b.y}`}
                    stroke={lit ? EDGE_ON : EDGE}
                    strokeWidth={guessed ? 1 : lit ? 1.6 : 1.1}
                    strokeDasharray={guessed ? '4,4' : undefined}
                    strokeOpacity={(lit ? 1 : DIM) * (guessed ? 0.6 : 1)}
                    fill="none"
                  />
                );
              })}

              {/* ── Bodies ─────────────────────────────────────────────── */}
              {liveNodes.map((n) => {
                const a = alpha(n.title);
                const { x, y } = n;

                if (n.ring === 0) {
                  return (
                    <G key={`n-${n.title}`} opacity={a}>
                      <Circle cx={x} cy={y} r={n.r * 2.6} fill="url(#sun-glow)" />
                      <Circle cx={x} cy={y} r={n.r} fill="url(#sun-core)" />
                    </G>
                  );
                }

                if (n.kind === 'tag') {
                  return (
                    <G key={`n-${n.title}`} opacity={a}>
                      <Circle
                        cx={x}
                        cy={y}
                        r={n.r * 2.2}
                        fill={`url(#${idFor(n.colour, 'halo')})`}
                      />
                      <Path d={sparkle(x, y, n.r * 1.5)} fill={n.colour} />
                    </G>
                  );
                }

                // Not written yet — an outline with nothing inside it, so the
                // map shows the child where a note is missing.
                if (n.kind === 'unwritten') {
                  return (
                    <Circle
                      key={`n-${n.title}`}
                      cx={x}
                      cy={y}
                      r={n.r}
                      fill="none"
                      stroke={UNFORMED}
                      strokeWidth={1.4}
                      strokeDasharray="3,3"
                      opacity={a}
                    />
                  );
                }

                const lit = focus === n.title;
                return (
                  <G key={`n-${n.title}`} opacity={a}>
                    <Circle
                      cx={x}
                      cy={y}
                      r={n.r * 2.5}
                      fill={`url(#${idFor(n.colour, 'halo')})`}
                    />
                    <Circle
                      cx={x}
                      cy={y}
                      r={n.r}
                      fill={`url(#${idFor(n.colour, 'body')})`}
                      stroke={lit ? '#FFFFFF' : n.colour}
                      strokeWidth={lit ? 2 : 0.8}
                      strokeOpacity={lit ? 0.9 : 0.5}
                    />
                  </G>
                );
              })}

              {/* ── Names ──────────────────────────────────────────────── */}
              {liveNodes.map((n) => (
                <SvgText
                  key={`t-${n.title}`}
                  x={n.x}
                  y={n.y + n.r + (n.ring === 0 ? 18 : 14)}
                  fill={n.ring === 0 ? '#F2E9FF' : LABEL}
                  fontSize={n.ring === 0 ? 12 : 11}
                  fontWeight={n.ring === 0 ? 'bold' : 'normal'}
                  textAnchor="middle"
                  opacity={alpha(n.title)}
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
