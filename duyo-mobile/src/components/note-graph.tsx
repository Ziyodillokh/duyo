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

const WRITTEN = '#60A5FA';
const GHOST = '#5C7599';
const EDGE = 'rgba(96, 165, 250, 0.30)';
const EDGE_ON = 'rgba(147, 197, 253, 0.85)';
const LABEL = '#C7D6EC';
const DIM = 0.18;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelect: (node: GraphNode) => void;
  height?: number;
}

/**
 * The brain: notes as dots, [[links]] as lines.
 *
 * Reads like Obsidian's graph rather than a scatter plot: each dot carries a
 * soft halo, links are curved rather than straight, and tapping a note pulls
 * it and its neighbours forward while everything else fades back — which is
 * how you actually read a graph, one neighbourhood at a time.
 *
 * Pinch to zoom, drag to pan. A single tap selects; a second tap on the same
 * note opens it, so exploring the map never opens something by accident.
 */
export function NoteGraph({ nodes, edges, onSelect, height = 400 }: Props) {
  const [width, setWidth] = useState(0);
  const [focus, setFocus] = useState<string | null>(null);

  const layout = useMemo(
    () => (width > 0 ? layoutGraph(nodes, edges, width, height) : null),
    [nodes, edges, width, height],
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

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const gesture = Gesture.Simultaneous(pinch, pan);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  const reset = () => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
    setFocus(null);
  };

  const tap = (node: PositionedNode) => {
    if (focus === node.title) onSelect(node);
    else setFocus(node.title);
  };

  const alpha = (title: string) =>
    !neighbours || neighbours.has(title.toLowerCase()) ? 1 : DIM;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      style={{ height, overflow: 'hidden' }}
      accessibilityLabel="Qaydlar tarmog'i"
    >
      {layout && nodes.length > 0 && (
        <GestureDetector gesture={gesture}>
          <Animated.View style={[{ width, height }, canvasStyle]}>
            <Svg width={width} height={height}>
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
                return (
                  <Path
                    key={`e${i}`}
                    d={`M ${e.x1} ${e.y1} Q ${cx} ${cy} ${e.x2} ${e.y2}`}
                    stroke={lit ? EDGE_ON : EDGE}
                    strokeWidth={lit ? 1.8 : 1.2}
                    strokeOpacity={lit ? 1 : DIM}
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
                  fill={n.exists ? WRITTEN : GHOST}
                  opacity={0.13 * alpha(n.title)}
                />
              ))}

              {layout.nodes.map((n) => (
                <Circle
                  key={`c-${n.title}`}
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={n.exists ? WRITTEN : 'transparent'}
                  stroke={n.exists ? '#BFDBFE' : GHOST}
                  strokeWidth={n.exists ? (focus === n.title ? 2.5 : 1) : 1.5}
                  strokeDasharray={n.exists ? undefined : '3,3'}
                  opacity={alpha(n.title)}
                />
              ))}

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
                  accessibilityRole="button"
                  accessibilityLabel={
                    n.exists ? n.title : `${n.title} — hali yozilmagan`
                  }
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
    </View>
  );
}
