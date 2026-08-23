import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

/**
 * A portrait for a peer circle.
 *
 * The mock uses photographs. A children's product cannot: the backend hands
 * the app a pseudonym and an age band and nothing else (see PeerCard), and
 * no real child's face belongs in these circles. So these are drawn to read
 * the way a photo thumbnail reads at 84px — an out-of-focus backdrop, a lit
 * side and a shadow side, hair with volume, a jaw rather than a ball — not
 * as flat cartoon faces.
 */

export type Scene = 'studio' | 'mountains' | 'city' | 'gym' | 'library' | 'street';

export interface PortraitSpec {
  scene: Scene;
  /** Base skin tone; the shadow side is derived from it. */
  skin: string;
  hair: string;
  /** 0 short crop · 1 side part · 2 curls · 3 long straight · 4 bun */
  hairStyle: 0 | 1 | 2 | 3 | 4;
  top: string;
  /** Where the key light comes from. Mixing these stops a row of portraits
   *  from looking stamped from one template. */
  lightFromLeft?: boolean;
  /** Slight head turn, in degrees; the mock's people rarely face dead on. */
  turn?: number;
}

/** Darken a #rrggbb by `f` (0..1) — the shadow side of the same tone. */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - f));
  const g = Math.round(((n >> 8) & 255) * (1 - f));
  const b = Math.round((n & 255) * (1 - f));
  return `rgb(${r},${g},${b})`;
}

function Backdrop({ scene, s, id }: { scene: Scene; s: number; id: string }) {
  // Backdrops are drawn soft and low-contrast on purpose: a portrait lens
  // throws the background out of focus, and hard shapes behind a 84px head
  // read as clutter.
  switch (scene) {
    case 'mountains':
      return (
        <>
          <Rect x={0} y={0} width={s} height={s} fill={`url(#${id}sky)`} />
          <Path
            d={`M ${-s * 0.1} ${s * 0.72} L ${s * 0.26} ${s * 0.3} L ${s * 0.58} ${s * 0.72} Z`}
            fill="#8AA6CE"
            opacity={0.85}
          />
          <Path
            d={`M ${s * 0.3} ${s * 0.72} L ${s * 0.68} ${s * 0.36} L ${s * 1.08} ${s * 0.72} Z`}
            fill="#6E8CB8"
            opacity={0.9}
          />
          <Path
            d={`M ${s * 0.2} ${s * 0.38} L ${s * 0.26} ${s * 0.3} L ${s * 0.33} ${s * 0.39} Z`}
            fill="#EEF4FC"
            opacity={0.9}
          />
          <Rect x={0} y={s * 0.68} width={s} height={s * 0.4} fill="#6F8F76" opacity={0.55} />
        </>
      );
    case 'city':
      return (
        <>
          <Rect x={0} y={0} width={s} height={s} fill={`url(#${id}sky)`} />
          {[
            [0.0, 0.34, 0.19],
            [0.2, 0.24, 0.15],
            [0.37, 0.42, 0.13],
            [0.52, 0.3, 0.17],
            [0.71, 0.38, 0.14],
            [0.87, 0.28, 0.18],
          ].map(([x, y, w], i) => (
            <Rect
              key={i}
              x={s * x}
              y={s * y}
              width={s * w}
              height={s}
              fill="#7E96BC"
              opacity={0.28 + (i % 3) * 0.1}
            />
          ))}
          <Rect x={0} y={s * 0.74} width={s} height={s * 0.3} fill="#93A7C6" opacity={0.5} />
        </>
      );
    case 'gym':
      return (
        <>
          <Rect x={0} y={0} width={s} height={s} fill="#2B3340" />
          <Rect x={0} y={s * 0.26} width={s} height={s * 0.035} fill="#8E9AAC" opacity={0.35} />
          <Rect x={s * 0.06} y={s * 0.3} width={s * 0.12} height={s * 0.4} fill="#1E242E" opacity={0.8} />
          <Rect x={s * 0.82} y={s * 0.3} width={s * 0.12} height={s * 0.4} fill="#1E242E" opacity={0.8} />
          <Circle cx={s * 0.16} cy={s * 0.13} r={s * 0.07} fill="#FFF3D0" opacity={0.28} />
        </>
      );
    case 'library':
      return (
        <>
          <Rect x={0} y={0} width={s} height={s} fill="#C9A97E" opacity={0.55} />
          {[0.16, 0.42, 0.68].map((y, r) => (
            <G key={r}>
              {[0.02, 0.14, 0.26, 0.38, 0.5, 0.62, 0.74, 0.86].map((x, i) => (
                <Rect
                  key={i}
                  x={s * x}
                  y={s * (y - 0.16)}
                  width={s * 0.09}
                  height={s * 0.16}
                  rx={s * 0.008}
                  fill={['#B4593F', '#4A6EA8', '#3F7F63', '#B08A34', '#7B4E86'][(r * 3 + i) % 5]}
                  opacity={0.8}
                />
              ))}
              <Rect x={0} y={s * y} width={s} height={s * 0.028} fill="#8A6844" opacity={0.85} />
            </G>
          ))}
        </>
      );
    case 'street':
      return (
        <>
          <Rect x={0} y={0} width={s} height={s} fill={`url(#${id}sky)`} />
          <Ellipse cx={s * 0.2} cy={s * 0.6} rx={s * 0.3} ry={s * 0.36} fill="#6F8F76" opacity={0.45} />
          <Ellipse cx={s * 0.86} cy={s * 0.55} rx={s * 0.26} ry={s * 0.34} fill="#6F8F76" opacity={0.35} />
          <Rect x={0} y={s * 0.78} width={s} height={s * 0.3} fill="#9AA7B8" opacity={0.5} />
        </>
      );
    case 'studio':
      return <Rect x={0} y={0} width={s} height={s} fill={`url(#${id}sky)`} />;
  }
}

export function Portrait({
  spec,
  size,
  seed = 0,
}: {
  spec: PortraitSpec;
  size: number;
  seed?: number;
}) {
  const s = size;
  const id = `p${seed}s${size}`;
  const left = spec.lightFromLeft ?? true;
  const turn = spec.turn ?? 0;

  // Head geometry — an egg, not a ball. Chin sits below the eye line by more
  // than the crown sits above it, which is most of why a drawn face reads as
  // a face at thumbnail size.
  const cx = s * 0.5 + (turn / 90) * s * 0.02;
  const eyeY = s * 0.46;
  const hw = s * 0.2; // half width at cheekbones
  const crown = eyeY - s * 0.2;
  const chin = eyeY + s * 0.26;

  const skinLit = spec.skin;
  const skinMid = shade(spec.skin, 0.1);
  const skinShadow = shade(spec.skin, 0.26);
  const hairLit = spec.hair;
  const hairShadow = shade(spec.hair, 0.35);
  const topShadow = shade(spec.top, 0.3);

  const headPath =
    `M ${cx - hw} ${eyeY - s * 0.03} ` +
    `C ${cx - hw} ${crown - s * 0.03}, ${cx - hw * 0.62} ${crown}, ${cx} ${crown} ` +
    `C ${cx + hw * 0.62} ${crown}, ${cx + hw} ${crown - s * 0.03}, ${cx + hw} ${eyeY - s * 0.03} ` +
    `C ${cx + hw} ${eyeY + s * 0.1}, ${cx + hw * 0.66} ${chin}, ${cx} ${chin} ` +
    `C ${cx - hw * 0.66} ${chin}, ${cx - hw} ${eyeY + s * 0.1}, ${cx - hw} ${eyeY - s * 0.03} Z`;

  return (
    <Svg width={s} height={s}>
      <Defs>
        <RadialGradient id={`${id}sky`} cx="38%" cy="26%" r="95%">
          <Stop offset="0%" stopColor="#EAF1FB" />
          <Stop offset="100%" stopColor="#A9C0DD" />
        </RadialGradient>
        {/* Key light across the face */}
        <LinearGradient
          id={`${id}face`}
          x1={left ? '0%' : '100%'}
          y1="0%"
          x2={left ? '100%' : '0%'}
          y2="70%"
        >
          <Stop offset="0%" stopColor={skinLit} />
          <Stop offset="52%" stopColor={skinMid} />
          <Stop offset="100%" stopColor={skinShadow} />
        </LinearGradient>
        <LinearGradient
          id={`${id}hair`}
          x1={left ? '10%' : '90%'}
          y1="0%"
          x2={left ? '90%' : '10%'}
          y2="100%"
        >
          <Stop offset="0%" stopColor={hairLit} />
          <Stop offset="100%" stopColor={hairShadow} />
        </LinearGradient>
        <LinearGradient id={`${id}top`} x1="0%" y1="0%" x2="100%" y2="60%">
          <Stop offset="0%" stopColor={spec.top} />
          <Stop offset="100%" stopColor={topShadow} />
        </LinearGradient>
        {/* Vignette — the darkened rim every portrait thumbnail has */}
        <RadialGradient id={`${id}vig`} cx="50%" cy="45%" r="62%">
          <Stop offset="70%" stopColor="#000000" stopOpacity={0} />
          <Stop offset="100%" stopColor="#10203A" stopOpacity={0.3} />
        </RadialGradient>
        <ClipPath id={`${id}clip`}>
          <Circle cx={s / 2} cy={s / 2} r={s / 2} />
        </ClipPath>
      </Defs>

      <G clipPath={`url(#${id}clip)`}>
        <Backdrop scene={spec.scene} s={s} id={id} />

        {/* ── Body ──────────────────────────────────────────────────── */}
        <Path
          d={`M ${cx - s * 0.58} ${s * 1.06} C ${cx - s * 0.54} ${s * 0.84}, ${cx - s * 0.26} ${s * 0.735}, ${cx} ${s * 0.735} C ${cx + s * 0.26} ${s * 0.735}, ${cx + s * 0.54} ${s * 0.84}, ${cx + s * 0.58} ${s * 1.06} Z`}
          fill={`url(#${id}top)`}
        />
        {/* collar opening */}
        <Path
          d={`M ${cx - s * 0.105} ${s * 0.74} Q ${cx} ${s * 0.845} ${cx + s * 0.105} ${s * 0.74}`}
          fill={shade(spec.top, 0.45)}
        />

        {/* ── Neck, with the shadow the jaw casts ───────────────────── */}
        <Path
          d={`M ${cx - s * 0.066} ${chin - s * 0.045} h ${s * 0.132} v ${s * 0.085} h ${-s * 0.132} Z`}
          fill={skinMid}
        />
        <Path
          d={`M ${cx - s * 0.066} ${chin - s * 0.045} h ${s * 0.132} v ${s * 0.05} h ${-s * 0.132} Z`}
          fill={skinShadow}
          opacity={0.85}
        />

        {/* ── Head ──────────────────────────────────────────────────── */}
        <G transform={`rotate(${turn} ${cx} ${eyeY})`}>
          <Path d={headPath} fill={`url(#${id}face)`} />
          {/* ears */}
          <Ellipse cx={cx - hw * 0.99} cy={eyeY + s * 0.015} rx={s * 0.019} ry={s * 0.03} fill={skinMid} />
          <Ellipse cx={cx + hw * 0.99} cy={eyeY + s * 0.015} rx={s * 0.019} ry={s * 0.03} fill={skinMid} />

          {/* brows */}
          <Path
            d={`M ${cx - hw * 0.68} ${eyeY - s * 0.042} q ${hw * 0.32} ${-s * 0.019} ${hw * 0.6} ${s * 0.002}`}
            stroke={hairShadow}
            strokeWidth={s * 0.019}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d={`M ${cx + hw * 0.08} ${eyeY - s * 0.04} q ${hw * 0.32} ${-s * 0.021} ${hw * 0.6} ${s * 0.004}`}
            stroke={hairShadow}
            strokeWidth={s * 0.019}
            strokeLinecap="round"
            fill="none"
          />
          {/* eyes — almond, iris, catchlight */}
          {[-1, 1].map((k) => (
            <G key={k}>
              <Ellipse
                cx={cx + k * hw * 0.46}
                cy={eyeY + s * 0.006}
                rx={s * 0.032}
                ry={s * 0.018}
                fill="#F6F1EC"
              />
              <Circle cx={cx + k * hw * 0.46} cy={eyeY + s * 0.006} r={s * 0.016} fill="#4A3A2E" />
              <Circle cx={cx + k * hw * 0.46} cy={eyeY + s * 0.006} r={s * 0.0072} fill="#181210" />
              <Circle
                cx={cx + k * hw * 0.46 - s * 0.006}
                cy={eyeY - s * 0.001}
                r={s * 0.005}
                fill="#FFFFFF"
              />
              {/* upper lid line gives the eye its shape at small sizes */}
              <Path
                d={`M ${cx + k * hw * 0.46 - s * 0.03} ${eyeY - s * 0.006} q ${k * s * 0.03} ${-s * 0.015} ${k * s * 0.06} 0`}
                stroke={shade(spec.skin, 0.5)}
                strokeWidth={s * 0.0075}
                strokeLinecap="round"
                fill="none"
              />
            </G>
          ))}
          {/* nose — one shadow stroke, no outline */}
          <Path
            d={`M ${cx + (left ? s * 0.008 : -s * 0.008)} ${eyeY + s * 0.03} q ${left ? s * 0.012 : -s * 0.012} ${s * 0.042} ${left ? -s * 0.012 : s * 0.012} ${s * 0.05}`}
            stroke={skinShadow}
            strokeWidth={s * 0.011}
            strokeLinecap="round"
            fill="none"
            opacity={0.75}
          />
          {/* mouth — a soft closed line, not a smiley arc */}
          <Path
            d={`M ${cx - s * 0.032} ${eyeY + s * 0.113} q ${s * 0.032} ${s * 0.014} ${s * 0.064} 0`}
            stroke={shade(spec.skin, 0.45)}
            strokeWidth={s * 0.011}
            strokeLinecap="round"
            fill="none"
          />
          {/* cheek warmth on the lit side */}
          <Ellipse
            cx={cx + (left ? -hw * 0.5 : hw * 0.5)}
            cy={eyeY + s * 0.058}
            rx={s * 0.036}
            ry={s * 0.024}
            fill="#D9836B"
            opacity={0.16}
          />

          {/* ── Hair ─────────────────────────────────────────────────── */}
          {spec.hairStyle === 0 && (
            <Path
              d={`M ${cx - hw * 1.03} ${eyeY - s * 0.022} C ${cx - hw * 1.02} ${crown - s * 0.05}, ${cx + hw * 1.02} ${crown - s * 0.05}, ${cx + hw * 1.03} ${eyeY - s * 0.022} C ${cx + hw * 0.8} ${eyeY - s * 0.075}, ${cx - hw * 0.8} ${eyeY - s * 0.075}, ${cx - hw * 1.03} ${eyeY - s * 0.022} Z`}
              fill={`url(#${id}hair)`}
            />
          )}
          {spec.hairStyle === 1 && (
            <Path
              d={`M ${cx - hw * 1.04} ${eyeY - s * 0.012} C ${cx - hw * 1.04} ${crown - s * 0.055}, ${cx + hw * 1.04} ${crown - s * 0.055}, ${cx + hw * 1.04} ${eyeY - s * 0.012} C ${cx + hw * 0.9} ${eyeY - s * 0.05}, ${cx + hw * 0.2} ${eyeY - s * 0.105}, ${cx - hw * 0.55} ${eyeY - s * 0.055} Z`}
              fill={`url(#${id}hair)`}
            />
          )}
          {spec.hairStyle === 2 && (
            <G>
              {[-0.85, -0.45, 0, 0.45, 0.85].map((k, i) => (
                <Circle
                  key={i}
                  cx={cx + hw * k}
                  cy={crown + s * (i % 2 === 0 ? 0.012 : -0.012)}
                  r={s * 0.052}
                  fill={i % 2 === 0 ? hairLit : hairShadow}
                />
              ))}
              <Path
                d={`M ${cx - hw * 1.02} ${eyeY - s * 0.02} C ${cx - hw} ${crown}, ${cx + hw} ${crown}, ${cx + hw * 1.02} ${eyeY - s * 0.02} C ${cx + hw * 0.8} ${eyeY - s * 0.07}, ${cx - hw * 0.8} ${eyeY - s * 0.07}, ${cx - hw * 1.02} ${eyeY - s * 0.02} Z`}
                fill={`url(#${id}hair)`}
              />
            </G>
          )}
          {spec.hairStyle === 3 && (
            <G>
              {/* long fall behind the shoulders, drawn first */}
              <Path
                d={`M ${cx - hw * 1.12} ${eyeY - s * 0.04} C ${cx - hw * 1.35} ${eyeY + s * 0.2}, ${cx - hw * 1.2} ${s * 0.7}, ${cx - hw * 0.95} ${s * 0.78} L ${cx - hw * 0.55} ${s * 0.7} C ${cx - hw * 0.85} ${eyeY + s * 0.16}, ${cx - hw * 0.95} ${eyeY}, ${cx - hw * 1.12} ${eyeY - s * 0.04} Z`}
                fill={hairShadow}
              />
              <Path
                d={`M ${cx + hw * 1.12} ${eyeY - s * 0.04} C ${cx + hw * 1.35} ${eyeY + s * 0.2}, ${cx + hw * 1.2} ${s * 0.7}, ${cx + hw * 0.95} ${s * 0.78} L ${cx + hw * 0.55} ${s * 0.7} C ${cx + hw * 0.85} ${eyeY + s * 0.16}, ${cx + hw * 0.95} ${eyeY}, ${cx + hw * 1.12} ${eyeY - s * 0.04} Z`}
                fill={hairShadow}
              />
              <Path
                d={`M ${cx - hw * 1.08} ${eyeY - s * 0.01} C ${cx - hw * 1.06} ${crown - s * 0.06}, ${cx + hw * 1.06} ${crown - s * 0.06}, ${cx + hw * 1.08} ${eyeY - s * 0.01} C ${cx + hw * 0.86} ${eyeY - s * 0.062}, ${cx - hw * 0.86} ${eyeY - s * 0.062}, ${cx - hw * 1.08} ${eyeY - s * 0.01} Z`}
                fill={`url(#${id}hair)`}
              />
            </G>
          )}
          {spec.hairStyle === 4 && (
            <G>
              <Ellipse
                cx={cx + (left ? hw * 0.72 : -hw * 0.72)}
                cy={crown + s * 0.03}
                rx={s * 0.055}
                ry={s * 0.05}
                fill={hairShadow}
              />
              <Path
                d={`M ${cx - hw * 1.04} ${eyeY - s * 0.014} C ${cx - hw * 1.02} ${crown - s * 0.045}, ${cx + hw * 1.02} ${crown - s * 0.045}, ${cx + hw * 1.04} ${eyeY - s * 0.014} C ${cx + hw * 0.84} ${eyeY - s * 0.066}, ${cx - hw * 0.84} ${eyeY - s * 0.066}, ${cx - hw * 1.04} ${eyeY - s * 0.014} Z`}
                fill={`url(#${id}hair)`}
              />
            </G>
          )}
          {/* hair sheen — the single highlight that reads as volume */}
          <Ellipse
            cx={cx + (left ? -hw * 0.42 : hw * 0.42)}
            cy={crown + s * 0.028}
            rx={hw * 0.42}
            ry={s * 0.022}
            fill="#FFFFFF"
            opacity={0.16}
            transform={`rotate(${left ? -14 : 14} ${cx} ${crown})`}
          />
        </G>

        <Rect x={0} y={0} width={s} height={s} fill={`url(#${id}vig)`} />
      </G>
    </Svg>
  );
}
