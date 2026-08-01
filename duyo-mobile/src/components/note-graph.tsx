import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import type { GraphEdge, GraphNode } from '@/api/endpoints/notes';
import { layoutGraph } from '@/lib/graph-layout';

const WRITTEN = '#60A5FA';
const GHOST = '#5C7599';
const EDGE = 'rgba(96, 165, 250, 0.28)';
const LABEL = '#C7D6EC';

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelect: (node: GraphNode) => void;
  height?: number;
}

/**
 * The brain: notes as dots, [[links]] as lines.
 *
 * Dots grow with how many notes point at them, so the ideas the child keeps
 * returning to are visibly the centre of their map. Unwritten links are drawn
 * hollow — they're an invitation, and tapping one starts that note.
 */
export function NoteGraph({ nodes, edges, onSelect, height = 340 }: Props) {
  const [width, setWidth] = useState(0);

  const layout = useMemo(
    () => (width > 0 ? layoutGraph(nodes, edges, width, height) : null),
    [nodes, edges, width, height],
  );

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  return (
    <View onLayout={onLayout} style={{ height }} accessibilityLabel="Qaydlar tarmog'i">
      {layout && (
        <>
          <Svg width={width} height={height}>
            {layout.edges.map((e, i) => (
              <Line
                key={`e${i}`}
                x1={e.x1}
                y1={e.y1}
                x2={e.x2}
                y2={e.y2}
                stroke={EDGE}
                strokeWidth={1.5}
              />
            ))}
            {layout.nodes.map((n) => (
              <Circle
                key={`c-${n.title}`}
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill={n.exists ? WRITTEN : 'transparent'}
                stroke={n.exists ? WRITTEN : GHOST}
                strokeWidth={n.exists ? 0 : 1.5}
                strokeDasharray={n.exists ? undefined : '3,3'}
              />
            ))}
            {layout.nodes.map((n) => (
              <SvgText
                key={`t-${n.title}`}
                x={n.x}
                y={n.y + n.r + 13}
                fill={LABEL}
                fontSize={11}
                textAnchor="middle"
              >
                {n.title.length > 14 ? `${n.title.slice(0, 13)}…` : n.title}
              </SvgText>
            ))}
          </Svg>

          {/* Tap targets sit above the SVG: react-native-svg press handling is
              inconsistent across platforms, and a child's finger needs a
              bigger target than the dot anyway. */}
          {layout.nodes.map((n) => {
            const hit = Math.max(n.r + 10, 22);
            return (
              <Pressable
                key={`p-${n.title}`}
                onPress={() => onSelect(n)}
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
        </>
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
