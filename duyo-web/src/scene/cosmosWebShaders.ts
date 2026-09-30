/**
 * The knowledge web's shaders: its nodes, which are stars, and its links,
 * which are threads of light between them. cosmosWeb.ts decides which links
 * exist and how lit each is; everything here is placement and light.
 *
 * Both are drawn at infinity on the far plane, like the far sky, so DUYO and
 * the phone hide them through the depth test and a thread that passes
 * behind the robot is cut by its silhouette, as a real one would be.
 *
 * A LINK is one instanced quad, built in screen space between its two ends,
 * so a thread is the same thickness wherever it lies and however long it
 * is. Its cross-section is a Gaussian a CSS pixel across in a much fainter
 * sheath: anti-aliased at any pixel ratio, never a hard GL line.
 */

import { INTERACT_STARS, PULSES, PULSE_SECONDS, f } from './cosmosShaders';

/** Half the width of a link's quad, in CSS px: room for the sheath, and no more fill. */
const LINK_HALF_PX = 5;
/** The thread's core and sheath, as 1 / (2σ²) with σ in CSS px. */
const CORE_K = 1 / (2 * 0.5 ** 2);
const SHEATH_K = 1 / (2 * 1.9 ** 2);
/** A thread stops this far short of a node (CSS px), so the node reads as a point, not a bead on a wire. */
const NODE_GAP_PX = 3.5;
/** How far a pulse's light runs along the links (viewport heights) before it is spent. */
const SPARK_REACH = 0.75;
/** The spark's head and tail, in viewport heights. */
const SPARK_HEAD = 0.012;
const SPARK_TAIL = 0.07;

/** Node hues, by the code cosmosWeb.ts writes: sky, blue, violet, amber, and the pointer's own. */
export const HUES = 5;
/** Two hue codes share one float: from + HUE_PACK · to. */
export const HUE_PACK = 8;
/**
 * While the hand rests the web still lives: a glint runs down each thread
 * once every GLINT_SECONDS, each at its own phase, as if what one star knows
 * were passing to the next. It is small and soft (CSS px), and it stops
 * under reduced motion.
 */
const GLINT_SECONDS = 2.8;
const GLINT_PX = 9;

// ── Nodes ─────────────────────────────────────────────────────────────────
/** Extra sprite a fully lit node opens, in CSS px, for its halo. */
const LIT_PX = 10;

export const NODE_VERT = /* glsl */ `
  ${INTERACT_STARS}
  uniform float uDpr, uPointCap, uReveal, uLit;
  attribute vec3 aColor;  // resting light: a faint star
  attribute vec3 aHue;    // the colour it lights up in
  attribute vec2 aStar;   // x resting sprite (CSS px), y seed
  attribute float aGlow;  // 0..1, how lit its links make it
  varying vec3 vColor;
  varying float vPx, vGlow;
  void main() {
    // A lit node breathes a little, each at its own pace; still when the stars may not move.
    float glow = aGlow * (1.0 + 0.2 * uLens.w * sin(uTime * (1.7 + aStar.y) + aStar.y * 40.0));
    // A direction at infinity, as the far sky: the camera's translation dropped.
    vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 0.0);
    vec2 ndc = clip.xy / max(clip.w, 1e-5);
    float reveal;
    float gain = interact(ndc, reveal);
    vColor = aColor * gain + aHue * (uReveal * reveal + uLit * glow);
    vGlow = aGlow;
    gl_PointSize = min((aStar.x + ${f(LIT_PX)} * aGlow) * uDpr, uPointCap);
    vPx = gl_PointSize;
    gl_Position = clip.w <= 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(ndc * clip.w, clip.w * 0.99999, clip.w);
  }
`;

/** A star at rest; lit, a slightly wider core in a soft halo of its hue. */
export const NODE_FRAG = /* glsl */ `
  uniform float uDpr, uCoreK;
  varying vec3 vColor;
  varying float vPx, vGlow;
  void main() {
    vec2 q = gl_PointCoord - 0.5, c = q * (vPx / uDpr);
    float r2 = dot(c, c);
    // Lit, the core opens to about twice its width and gathers a halo: a node, not just a brighter star.
    float light = exp(-r2 * uCoreK * (1.0 - 0.7 * vGlow)) + vGlow * (0.3 * exp(-r2 * 0.3) + 0.05 * exp(-r2 * 0.05));
    light *= 1.0 - smoothstep(0.16, 0.25, dot(q, q));
    gl_FragColor = vec4(vColor * light, 0.0);
    #include <colorspace_fragment>
  }
`;

// ── Links ─────────────────────────────────────────────────────────────────
const pulseIndex = Array.from({ length: PULSES }, (_, i) => i);

/**
 * position.xy is the quad corner: x 0 at aFrom … 1 at aTo, y −1 … 1 across.
 * For each pulse, the vertex also finds how far light has to travel to get
 * here — to the nearer end of the link, then along it — which is linear
 * along the quad, so the fragment gets it exactly by interpolation.
 */
export const LINK_VERT = /* glsl */ `
  ${INTERACT_STARS}
  uniform float uDpr;
  uniform vec3 uHue[${HUES}];
  attribute vec3 aFrom, aTo; // world directions of the two ends
  attribute vec4 aLink;      // x light 0..1, y reach 0..1 (how far from aFrom it has grown), z hue codes, w seed
  varying vec2 vAt;          // x 0 at aFrom … 1 at the thread's tip, y across (CSS px)
  varying float vLen, vLight, vToPointer, vSeed;
  varying vec3 vFromHue, vToHue;
  varying vec3 vPath;        // per pulse: the light's path length to here, in viewport heights

  vec4 toClip(vec3 dir) { return projectionMatrix * vec4(mat3(viewMatrix) * dir, 0.0); }

  void main() {
    vec4 cA = toClip(aFrom), cB = toClip(aTo);
    vec2 halfPx = uViewport * 0.5; // 'half' is reserved in GLSL
    // The ends go where the lens and the rings move their stars, so a thread stays on its nodes.
    vec2 nA = cA.xy / max(cA.w, 1e-5), nB = cB.xy / max(cB.w, 1e-5);
    float unused;
    interact(nA, unused);
    interact(nB, unused);
    nB = mix(nA, nB, aLink.y); // a growing thread reaches only this far
    vec2 pA = nA * halfPx, pB = nB * halfPx;
    vec2 axis = pB - pA;
    float len = max(length(axis), 1e-3), pad = ${f(LINK_HALF_PX)} * uDpr;
    vec2 dir = axis / len, across = vec2(-dir.y, dir.x);
    float along = position.x * (len + 2.0 * pad) - pad;
    vec2 p = pA + dir * along + across * (position.y * pad);
    vAt = vec2(along / len, position.y * pad / uDpr);
    vLen = len / uDpr;
    vLight = aLink.x;
    vSeed = aLink.w;
    float toCode = floor((aLink.z + 0.5) * ${f(1 / HUE_PACK)});
    vToPointer = step(${f(HUES - 1.5)}, toCode);
    vFromHue = uHue[int(aLink.z - toCode * ${f(HUE_PACK)} + 0.5)];
    vToHue = uHue[int(toCode + 0.5)];

    vec2 k = heights(), sA = nA * k, sB = nB * k;
    float lenH = length(sB - sA), u = along / len;
    ${pulseIndex.map((i) => /* glsl */ `{
      vec2 o = uPulse[${i}].xy * k;
      float dA = length(sA - o), dB = length(sB - o);
      vPath[${i}] = dA <= dB ? dA + u * lenH : dB + (1.0 - u) * lenH;
    }`).join('\n    ')}

    bool hidden = aLink.x <= 0.0 || cA.w <= 0.0 || cB.w <= 0.0;
    gl_Position = hidden ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(p / halfPx, 0.99999, 1.0);
  }
`;

/**
 * A thread of light: a white-hot core in its hues, a faint sheath, gaps at
 * the nodes, and a thread to the pointer that thins away into the hand. A
 * pulse sends a spark down each link, away from where the click landed,
 * with a short tail behind it.
 */
export const LINK_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec4 uLens;
  uniform vec4 uPulse[${PULSES}];
  varying vec2 vAt;
  varying float vLen, vLight, vToPointer, vSeed;
  varying vec3 vFromHue, vToHue;
  varying vec3 vPath;

  float spark(float path, vec4 P) {
    float age = (uTime - P.z) * ${f(1 / PULSE_SECONDS)};
    if (P.w <= 0.0 || age < 0.0 || age >= 1.0) return 0.0;
    // The front runs out fast and slows, as the star ring does.
    float x = path - ${f(SPARK_REACH)} * (1.0 - (1.0 - age) * (1.0 - age));
    float head = x > 0.0 ? exp(-x * x * ${f(1 / SPARK_HEAD ** 2)}) : exp(x * ${f(1 / SPARK_TAIL)});
    return P.w * (1.0 - age) * head;
  }

  void main() {
    float a = vAt.x, y2 = vAt.y * vAt.y;
    float fromEnd = a * vLen, toEnd = (1.0 - a) * vLen;
    float ends = smoothstep(${f(NODE_GAP_PX)}, ${f(NODE_GAP_PX + 2.5)}, fromEnd)
      * mix(smoothstep(${f(NODE_GAP_PX)}, ${f(NODE_GAP_PX + 2.5)}, toEnd), smoothstep(0.0, 0.7 * vLen, toEnd), vToPointer);
    float core = exp(-y2 * ${f(CORE_K)}), sheath = exp(-y2 * ${f(SHEATH_K)});
    float s = 0.0;
    ${pulseIndex.map((i) => `s += spark(vPath[${i}], uPulse[${i}]);`).join('\n    ')}
    // The glint: from the first star to the second, starting a little before it and ending a little past.
    float g = (fract(uTime * ${f(1 / GLINT_SECONDS)} + vSeed) * 1.4 - 0.2) * vLen - fromEnd;
    s += 0.25 * uLens.w * exp(-g * g * ${f(1 / GLINT_PX ** 2)});
    vec3 hue = mix(vFromHue, vToHue, clamp(a, 0.0, 1.0));
    // The core runs white-hot, the sheath keeps the hue: light, not paint.
    vec3 rgb = mix(hue, vec3(1.0), 0.35 * core) * (0.27 * core + 0.045 * sheath);
    rgb *= vLight * (1.0 + 5.0 * s);
    rgb += hue * (s * 0.12 * sheath * vLight);
    gl_FragColor = vec4(rgb * ends, 0.0);
    #include <colorspace_fragment>
  }
`;
