import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import type { GraphEdge, GraphNode } from '@/api/endpoints/notes';
import { layoutGraph, type PositionedNode } from '@/lib/graph-layout';

// One colour per node kind, mirroring Obsidian's --graph-node /
// --graph-node-unresolved / --graph-node-tag. Colour is what turns a mass of
// identical dots into something readable at a glance.
const WRITTEN = '#60A5FA';   // a note that exists
const GHOST = '#5C7599';     // a [[link]] not yet written
const TAG = '#FDC700';       // a #tag
const EDGE = 'rgba(96, 165, 250, 0.30)';
const EDGE_ON = 'rgba(147, 197, 253, 0.85)';
const LABEL = '#C7D6EC';
const DIM = 0.18;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

function colourOf(kind: GraphNode['kind']): string {
  if (kind === 'tag') return TAG;
  if (kind === 'unwritten') return GHOST;
  return WRITTEN;
}

/** What a screen reader says. A tag is not an unwritten note — it has no note
 *  behind it by design, and calling it "unwritten" would invite the child to
 *  write one. */
function labelOf(node: { title: string; kind: GraphNode['kind'] }): string {
  if (node.kind === 'tag') return `${node.title} tegi`;
  if (node.kind === 'unwritten') return `${node.title} — hali yozilmagan`;
  return node.title;
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
 * The brain: notes as dots, [[links]] as lines.
 *
 * Reads like Obsidian's graph rather than a scatter plot: each dot carries a
 * soft halo, links are curved rather than straight, and holding a note pulls
 * it and its neighbours forward while everything else fades back — which is
 * how you actually read a graph, one neighbourhood at a time.
 *
 * Pinch to zoom, drag to pan. A tap opens the note; press-and-hold isolates
 * its neighbourhood.
 */
export function NoteGraph({ nodes, edges, onSelect, height }: Props) {
  const [size, setSize] = useState({ width: 0, height: height ?? 0 });
  const [focus, setFocus] = useState<string | null>(null);

  const layout = useMemo(
    () =>
      size.width > 0 && size.height > 0
        ? layoutGraph(nodes, edges, size.width, size.height)
        : null,
    [nodes, edges, size],
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
  const tap = (node: PositionedNode) => onSelect(node);
  const hold = (node: PositionedNode) =>
    setFocus((f) => (f === node.title ? null : node.title));

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
      accessibilityLabel="Qaydlar tarmog'i"
    >
      {layout && nodes.length > 0 && (
        <GestureDetector gesture={gesture}>
          <Animated.View style={[{ width: size.width, height: size.height }, canvasStyle]}>
            <Svg width={size.width} height={size.height}>
              {layout.edges.map((e, i) => {
                const lit =
                  !neighbours ||
                  (neighbours.has(e.sourceTitle.toLowerCase()) &&
                    neighbours.has(e.targetTitle.toLowerCase()));
                // A shallow arc, bowed perpendicular to the line — straight
                // lines read as a diagram, curves as a web.
                const mx = (e.x1 + e.x2) / 2;
                const my = (e.y1 + e.y2) / 2;
                const dx = e.x2 - e.x1;
                const dy = e.y2 - e.y1;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const bow = Math.min(18, len * 0.12);
                const cx = mx - (dy / len) * bow;
                const cy = my + (dx / len) * bow;
                // A mention is something we inferred, not something the child
                // typed — drawn thinner and dashed so the map never overstates
                // how deliberate a connection was.
                const guessed = e.kind === 'mention';
                return (
                  <Path
                    key={`e${i}`}
                    d={`M ${e.x1} ${e.y1} Q ${cx} ${cy} ${e.x2} ${e.y2}`}
                    stroke={lit ? EDGE_ON : EDGE}
                    strokeWidth={guessed ? 1 : lit ? 1.8 : 1.2}
                    strokeDasharray={guessed ? '4,4' : undefined}
                    strokeOpacity={(lit ? 1 : DIM) * (guessed ? 0.6 : 1)}
                    fill="none"
                  />
                );
              })}

              {/* Halo — a wide, faint disc under each dot. */}
              {layout.nodes.map((n) => (
                <Circle
                  key={`h-${n.title}`}
                  cx={n.x}
                  cy={n.y}
                  r={n.r * 2.4}
                  fill={colourOf(n.kind)}
                  opacity={0.13 * alpha(n.title)}
                />
              ))}

              {layout.nodes.map((n) => {
                const solid = n.kind !== 'unwritten';
                return (
                  <Circle
                    key={`c-${n.title}`}
                    cx={n.x}
                    cy={n.y}
                    r={n.r}
                    fill={solid ? colourOf(n.kind) : 'transparent'}
                    stroke={solid ? '#BFDBFE' : GHOST}
                    strokeWidth={solid ? (focus === n.title ? 2.5 : 1) : 1.5}
                    strokeDasharray={solid ? undefined : '3,3'}
                    opacity={alpha(n.title)}
                  />
                );
              })}

              {layout.nodes.map((n) => (
                <SvgText
                  key={`t-${n.title}`}
                  x={n.x}
                  y={n.y + n.r + 14}
                  fill={LABEL}
                  fontSize={11}
                  textAnchor="middle"
                  opacity={alpha(n.title)}
                >
                  {n.title.length > 14 ? `${n.title.slice(0, 13)}…` : n.title}
                </SvgText>
              ))}
            </Svg>

            {/* Tap targets over the SVG: svg press handling is inconsistent
                across platforms, and a finger needs more than the dot. */}
            {layout.nodes.map((n) => {
              const hit = Math.max(n.r + 12, 24);
              return (
                <Pressable
                  key={`p-${n.title}`}
                  onPress={() => tap(n)}
                  onLongPress={() => hold(n)}
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
            backgroundColor: 'rgba(96,165,250,0.18)',
          }}
        >
          <Text className="text-xs text-neon-blue">Tiklash</Text>
        </Pressable>
      )}

      {nodes.length === 0 && (
        <View className="flex-1 items-center justify-center">
          <Text className="text-4xl mb-2">🧠</Text>
          <Text className="text-sm text-muted-foreground dark:text-dark-muted text-center px-8">
            Hali qayd yo'q. Birinchi qaydni yozsang, miyang shu yerda o'sa
            boshlaydi.
          </Text>
        </View>
      )}

      {/* Notes but no lines yet. Loose dots are the honest picture of an
          unlinked notebook — a child who doesn't know what makes the lines
          appear will just think the map is broken. */}
      {nodes.length > 0 && edges.length === 0 && (
        <View
          className="absolute left-0 right-0 items-center"
          style={{ bottom: 74, pointerEvents: 'none' }}
        >
          <Text className="text-xs text-muted-foreground dark:text-dark-muted text-center px-10">
            Qaydlarda #teg yoz yoki bir qaydda boshqasining nomini eslat —
            chiziqlar o'zi paydo bo'ladi.
          </Text>
        </View>
      )}
    </View>
  );
}
