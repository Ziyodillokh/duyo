import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

/**
 * The little solar system behind the top of the AI conversation.
 *
 * ## Why this is drawn and not an image
 *
 * It scales to any phone width without a second asset, it costs a few
 * kilobytes of code instead of a few hundred of PNG, and — the reason that
 * actually decided it — it is lit from the SAME upper-left the rest of the app
 * is. Every sphere here shades the way the planets on Miya's map do and the
 * way the glass panes do. A stock illustration would have brought its own
 * light with it, and one object lit from the wrong side is all it takes for a
 * screen to stop looking designed.
 *
 * ## Why it is decorative and says nothing
 *
 * It carries no state: no count, no status, nothing a child could misread as
 * information. The status that matters — whether DUYO is listening or
 * thinking — is the dot next to its name, which is text. This is the sky that
 * text sits in.
 */

/** The wandering bodies, in view-box units. Colour, radius, and how long a
 *  trail each drags behind it (0 for the ones that are just sitting there). */
const BODIES: readonly {
  cx: number;
  cy: number;
  r: number;
  from: string;
  to: string;
  trail: number;
}[] = [
  { cx: 118, cy: 34, r: 11, from: '#B98CF5', to: '#6B33C9', trail: 34 },
  { cx: 62, cy: 96, r: 9, from: '#59E8C0', to: '#12A182', trail: 26 },
  { cx: 22, cy: 134, r: 5, from: '#FFA98C', to: '#E8543A', trail: 0 },
  { cx: 46, cy: 168, r: 8, from: '#FFB48C', to: '#EA5A2C', trail: 0 },
  { cx: 258, cy: 118, r: 7, from: '#7FC4FF', to: '#1D6FD6', trail: 30 },
  { cx: 236, cy: 190, r: 9, from: '#FF9BC7', to: '#E4256F', trail: 0 },
];

/** Faint specks, so the space between the bodies is not empty. */
const DUST: readonly { cx: number; cy: number; r: number; o: number }[] = [
  { cx: 96, cy: 72, r: 1.6, o: 0.5 },
  { cx: 150, cy: 62, r: 1.2, o: 0.35 },
  { cx: 108, cy: 156, r: 1.8, o: 0.4 },
  { cx: 196, cy: 44, r: 1.3, o: 0.3 },
  { cx: 78, cy: 130, r: 1.1, o: 0.35 },
  { cx: 176, cy: 176, r: 1.5, o: 0.3 },
];

const VB_W = 300;
const VB_H = 210;

/** Planet centre and radius, in view-box units. */
const P = { cx: 196, cy: 108, r: 46 };

export function ChatCosmos({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <Defs>
        {/* The planet: lit upper-left, falling to a deep limb lower-right —
            the same light every glass pane in the app is under. */}
        <RadialGradient id="cosmos-planet" cx="34%" cy="28%" r="78%">
          <Stop offset="0%" stopColor="#8FC4FF" stopOpacity={1} />
          <Stop offset="45%" stopColor="#3B7BE8" stopOpacity={1} />
          <Stop offset="100%" stopColor="#12327F" stopOpacity={1} />
        </RadialGradient>
        {/* The ring is brighter where it passes in front of the lit face and
            dimmer behind, which is what stops it reading as a flat hoop. */}
        <LinearGradient id="cosmos-ring" x1="0" y1="0" x2="1" y2="0.4">
          <Stop offset="0%" stopColor="#CFE4FF" stopOpacity={0.85} />
          <Stop offset="50%" stopColor="#7FB2FF" stopOpacity={0.45} />
          <Stop offset="100%" stopColor="#CFE4FF" stopOpacity={0.8} />
        </LinearGradient>
        <RadialGradient id="cosmos-glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#8FC4FF" stopOpacity={0.3} />
          <Stop offset="100%" stopColor="#8FC4FF" stopOpacity={0} />
        </RadialGradient>
        {BODIES.map((b, i) => (
          <RadialGradient key={i} id={`cosmos-b${i}`} cx="34%" cy="28%" r="80%">
            <Stop offset="0%" stopColor={b.from} stopOpacity={1} />
            <Stop offset="100%" stopColor={b.to} stopOpacity={1} />
          </RadialGradient>
        ))}
      </Defs>

      {DUST.map((d, i) => (
        <Circle key={`d${i}`} cx={d.cx} cy={d.cy} r={d.r} fill="#6E9BE0" opacity={d.o} />
      ))}

      {/* Planet: halo, the ring's far half, the body, then the near half — that
          order is the whole trick, because a ring that passes BEHIND a planet
          and in FRONT of it in the same stroke is what gives the scene depth. */}
      <Circle cx={P.cx} cy={P.cy} r={P.r * 1.75} fill="url(#cosmos-glow)" />

      <G opacity={0.9}>
        <Ellipse
          cx={P.cx}
          cy={P.cy}
          rx={P.r * 1.62}
          ry={P.r * 0.42}
          fill="none"
          stroke="url(#cosmos-ring)"
          strokeWidth={5}
          transform={`rotate(-18 ${P.cx} ${P.cy})`}
        />
      </G>

      <Circle cx={P.cx} cy={P.cy} r={P.r} fill="url(#cosmos-planet)" />
      {/* Specular — small and weak, the way it is on Miya's planets. Oversized,
          it turns the world into a billiard ball. */}
      <Circle cx={P.cx - P.r * 0.34} cy={P.cy - P.r * 0.38} r={P.r * 0.2} fill="#FFFFFF" opacity={0.3} />

      {/* The near half of the ring, clipped to the lower band by drawing only
          the arc that passes in front. */}
      <Path
        d={`M ${P.cx - P.r * 1.62} ${P.cy} A ${P.r * 1.62} ${P.r * 0.42} 0 0 0 ${P.cx + P.r * 1.62} ${P.cy}`}
        fill="none"
        stroke="url(#cosmos-ring)"
        strokeWidth={5}
        strokeLinecap="round"
        transform={`rotate(-18 ${P.cx} ${P.cy})`}
      />

      {BODIES.map((b, i) => (
        <G key={`b${i}`}>
          {b.trail > 0 && (
            <Path
              d={`M ${b.cx + b.r * 0.6} ${b.cy - b.r * 0.6} L ${b.cx + b.r * 0.6 + b.trail} ${b.cy - b.r * 0.6 - b.trail * 0.42}`}
              stroke={b.from}
              strokeWidth={b.r * 0.5}
              strokeLinecap="round"
              opacity={0.32}
            />
          )}
          <Circle cx={b.cx} cy={b.cy} r={b.r} fill={`url(#cosmos-b${i})`} />
          <Circle
            cx={b.cx - b.r * 0.32}
            cy={b.cy - b.r * 0.36}
            r={b.r * 0.24}
            fill="#FFFFFF"
            opacity={0.45}
          />
        </G>
      ))}
    </Svg>
  );
}
