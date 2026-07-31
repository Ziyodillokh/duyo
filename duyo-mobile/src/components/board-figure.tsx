import React, { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Line,
  Marker,
  Path,
  Polygon,
  Polyline,
  Text as SvgText,
} from 'react-native-svg';

import type { BoardFigure as FigureData } from '@/api/endpoints/board';

const CHALK = '#F2EFE4';
const CHALK_DIM = '#A9BDAF';
const CHALK_BLUE = '#9FD3E8';

const PAD = 22; // breathing room so labels near the edge are not clipped

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Data-space extent of everything drawn, including circle radii. */
function boundsOf(figure: FigureData): Bounds {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const item of figure.items) {
    if (item.type === 'circle') {
      const cx = item.cx ?? 0;
      const cy = item.cy ?? 0;
      const r = item.r ?? 0;
      xs.push(cx - r, cx + r);
      ys.push(cy - r, cy + r);
      continue;
    }
    for (const [x, y] of item.points) {
      xs.push(x);
      ys.push(y);
    }
  }
  // With axes on, keep the origin in frame or the graph reads wrong.
  if (figure.axes) {
    xs.push(0);
    ys.push(0);
  }
  if (!xs.length) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

interface FigureProps {
  figure: FigureData;
  width: number;
  height: number;
  /** Drawn after the working, so it fades in on its own beat. */
  delay: number;
}

/**
 * Renders a board diagram: function graphs, geometry, force vectors.
 *
 * The backend sends primitives in the problem's own units (a triangle with
 * sides 6 and 4, a parabola over x ∈ [-3, 3]); all scaling happens here, so
 * the model never has to reason about pixels — one less thing for it to get
 * wrong.
 */
export function BoardFigureView({ figure, width, height, delay }: FigureProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) }),
    );
  }, [delay, progress]);

  const animated = useAnimatedStyle(() => ({ opacity: progress.value }));

  const { minX, maxX, minY, maxY } = boundsOf(figure);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const innerW = width - PAD * 2;
  const innerH = height - PAD * 2;

  // Uniform scale keeps circles round and right angles square.
  const scale = Math.min(innerW / spanX, innerH / spanY);
  const drawnW = spanX * scale;
  const drawnH = spanY * scale;
  const offsetX = PAD + (innerW - drawnW) / 2;
  const offsetY = PAD + (innerH - drawnH) / 2;

  // Data → screen. y flips: maths grows upward, screen grows downward.
  const sx = (x: number) => offsetX + (x - minX) * scale;
  const sy = (y: number) => offsetY + (maxY - y) * scale;

  const originX = sx(0);
  const originY = sy(0);
  const showAxes =
    figure.axes &&
    originX >= 0 &&
    originX <= width &&
    originY >= 0 &&
    originY <= height;

  return (
    <Animated.View style={animated}>
      <Svg width={width} height={height}>
        <Defs>
          <Marker
            id="chalkArrow"
            markerWidth={8}
            markerHeight={8}
            refX={7}
            refY={4}
            orient="auto"
          >
            <Path d="M0,0 L8,4 L0,8 z" fill={CHALK_BLUE} />
          </Marker>
        </Defs>

        {showAxes && (
          <>
            <Line
              x1={PAD * 0.4}
              y1={originY}
              x2={width - PAD * 0.4}
              y2={originY}
              stroke={CHALK_DIM}
              strokeWidth={1}
              opacity={0.55}
            />
            <Line
              x1={originX}
              y1={height - PAD * 0.4}
              x2={originX}
              y2={PAD * 0.4}
              stroke={CHALK_DIM}
              strokeWidth={1}
              opacity={0.55}
            />
            <SvgText
              x={width - PAD * 0.4}
              y={originY - 6}
              fill={CHALK_DIM}
              fontSize={11}
              textAnchor="end"
            >
              x
            </SvgText>
            <SvgText
              x={originX + 6}
              y={PAD * 0.4 + 9}
              fill={CHALK_DIM}
              fontSize={11}
            >
              y
            </SvgText>
          </>
        )}

        {figure.items.map((item, i) => {
          const key = `${item.type}-${i}`;
          const pts = item.points.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ');

          switch (item.type) {
            case 'curve':
              return (
                <Polyline
                  key={key}
                  points={pts}
                  fill="none"
                  stroke={CHALK}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );

            case 'shape':
              return (
                <Polygon
                  key={key}
                  points={pts}
                  fill={CHALK_BLUE}
                  fillOpacity={0.1}
                  stroke={CHALK}
                  strokeWidth={2.2}
                  strokeLinejoin="round"
                />
              );

            case 'circle':
              return (
                <Circle
                  key={key}
                  cx={sx(item.cx ?? 0)}
                  cy={sy(item.cy ?? 0)}
                  r={(item.r ?? 0) * scale}
                  fill={CHALK_BLUE}
                  fillOpacity={0.08}
                  stroke={CHALK}
                  strokeWidth={2.2}
                />
              );

            case 'arrow': {
              const [from, to] = item.points;
              if (!from || !to) return null;
              return (
                <React.Fragment key={key}>
                  <Line
                    x1={sx(from[0])}
                    y1={sy(from[1])}
                    x2={sx(to[0])}
                    y2={sy(to[1])}
                    stroke={CHALK_BLUE}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    markerEnd="url(#chalkArrow)"
                  />
                  {!!item.label && (
                    <SvgText
                      x={sx(to[0])}
                      y={sy(to[1]) - 8}
                      fill={CHALK_BLUE}
                      fontSize={12}
                      textAnchor="middle"
                    >
                      {item.label}
                    </SvgText>
                  )}
                </React.Fragment>
              );
            }

            case 'label': {
              const [at] = item.points;
              if (!at) return null;
              return (
                <SvgText
                  key={key}
                  x={sx(at[0])}
                  y={sy(at[1]) - 7}
                  fill={CHALK}
                  fontSize={12.5}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {item.label}
                </SvgText>
              );
            }

            default:
              return null;
          }
        })}
      </Svg>

      {!!figure.caption && (
        <Text
          style={{
            color: CHALK_DIM,
            fontSize: 12,
            fontStyle: 'italic',
            textAlign: 'center',
            marginTop: 2,
          }}
        >
          {figure.caption}
        </Text>
      )}
    </Animated.View>
  );
}

/** Keeps the figure block out of the layout entirely when there is nothing. */
export function hasDrawableFigure(figure: FigureData | null | undefined): boolean {
  return !!figure && figure.items.length > 0;
}
