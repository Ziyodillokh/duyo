import { memo, useCallback, useMemo, useState } from 'react';
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
import { useGraphClock } from '@/hooks/use-graph-clock';
import {
  layoutGalaxy,
  starField,
  UNFORMED,
  type OrbitedNode,
} from '@/lib/galaxy-layout';
import { driftAt, driftSeed, type DriftSeed } from '@/lib/graph-drift';

const EDGE = 'rgba(160, 190, 255, 0.22)';
const EDGE_ON = 'rgba(200, 220, 255, 0.85)';
const LABEL = '#DCE6FA';
const ORBIT = 'rgba(150, 180, 255, 0.13)';
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
 * The tap targets, at the STATIC layout positions.
 *
 * Memoised and split out on purpose: the drift clock re-renders NoteGraph
 * ~20 times a second, and re-mounting a Pressable per node at that rate is
 * both wasted work and a way to lose an in-flight long press. These sit
 * still while only the drawing moves — see the drift note in NoteGraph's
 * docstring for why that stays accurate.
 */
const TouchLayer = memo(function TouchLayer({
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
});

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
 * The brain as a solar system: the note you link to most burns at the centre,
 * everything else orbits it, #tags hang as coloured stars and [[links]] draw
 * the constellations between them.
 *
 * The metaphor is doing real work, not decoration. Distance from the centre is
 * how connected a note is; colour is the #tag it is filed under; a note that is
 * only a [[link]] so far is drawn as a body that has not finished forming. A
 * child can read all three without being told.
 *
 * Bodies drift — a small, never-repeating wobble around the position the
 * layout gave them (see lib/graph-drift.ts), so the sky reads as alive rather
 * than printed. The LAYOUT itself is still fixed: a note keeps its place in
 * the sky, and the touch targets stay at that fixed place while only the
 * drawing moves. The drift amplitude is small enough that a dot never leaves
 * its own hit area, which is what lets the map move without becoming harder
 * to tap. Drift stops entirely under the OS "reduce motion" setting.
 *
 * Pinch to zoom, drag to pan. A tap opens the note; press-and-hold lights up
 * its constellation and fades the rest of the sky.
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

  // ── Drift ────────────────────────────────────────────────────────────────
  // A seed per node, recomputed only when the node set changes; the clock
  // ticks independently. Splitting them this way keeps the per-frame work to
  // arithmetic — no hashing, no allocation of the seed table.
  const seeds = useMemo(() => {
    const map = new Map<string, DriftSeed>();
    for (const n of galaxy?.nodes ?? []) map.set(n.title, driftSeed(n.title));
    return map;
  }, [galaxy]);

  const clock = useGraphClock((galaxy?.nodes.length ?? 0) > 0);

  /** Where a body is DRAWN this frame. The tap target stays at (n.x, n.y). */
  const drawnAt = (title: string, x: number, y: number) => {
    const seed = seeds.get(title);
    if (!seed || clock === 0) return { x, y };
    const { dx, dy } = driftAt(seed, clock);
    return { x: x + dx, y: y + dy };
  };

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

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      tx.set(savedTx.get() + e.translationX);
      ty.set(savedTy.get() + e.translationY);
    })
    .onEnd(() => {
      savedTx.set(tx.get());
      savedTy.set(ty.get());
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
  // Stable identities, or TouchLayer's memo never holds and the drift clock
  // re-renders every Pressable 20 times a second after all.
  const tap = useCallback((node: OrbitedNode) => onSelect(node), [onSelect]);
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
    <View
      onLayout={onLayout}
      style={height === undefined ? { flex: 1, overflow: 'hidden' } : { height, overflow: 'hidden' }}
      accessibilityLabel="Qaydlar olami"
    >
      {galaxy && nodes.length > 0 && (
        <GestureDetector gesture={gesture}>
          <Animated.View style={[{ width: size.width, height: size.height }, canvasStyle]}>
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

              {/* ── Orbits ─────────────────────────────────────────────── */}
              {galaxy.orbits.map((o, i) => (
                <Ellipse
                  key={`o${i}`}
                  cx={galaxy.cx}
                  cy={galaxy.cy}
                  rx={o.rx}
                  ry={o.ry}
                  stroke={ORBIT}
                  strokeWidth={1}
                  fill="none"
                />
              ))}

              {/* ── Constellations ─────────────────────────────────────── */}
              {galaxy.edges.map((e, i) => {
                const lit =
                  !neighbours ||
                  (neighbours.has(e.sourceTitle.toLowerCase()) &&
                    neighbours.has(e.targetTitle.toLowerCase()));
                // Endpoints follow the bodies they join, so a line never
                // detaches from the dot it belongs to while the sky drifts.
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
              {galaxy.nodes.map((n) => {
                const a = alpha(n.title);
                const { x, y } = drawnAt(n.title, n.x, n.y);

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
              {galaxy.nodes.map((n) => {
                const { x, y } = drawnAt(n.title, n.x, n.y);
                return (
                  <SvgText
                    key={`t-${n.title}`}
                    x={x}
                    y={y + n.r + (n.ring === 0 ? 18 : 14)}
                    fill={n.ring === 0 ? '#F2E9FF' : LABEL}
                    fontSize={n.ring === 0 ? 12 : 11}
                    fontWeight={n.ring === 0 ? 'bold' : 'normal'}
                    textAnchor="middle"
                    opacity={alpha(n.title)}
                  >
                    {n.title.length > 14 ? `${n.title.slice(0, 13)}…` : n.title}
                  </SvgText>
                );
              })}
            </Svg>

            <TouchLayer nodes={galaxy.nodes} onTap={tap} onHold={hold} />
          </Animated.View>
        </GestureDetector>
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
  );
}