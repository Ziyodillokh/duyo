/**
 * The cosmos's shaders. Everything that moves per frame moves here: update()
 * in cosmos.ts only writes uniforms.
 *
 * DEPTH. The far sky and the nebula are drawn ON the far plane (z = w): they
 * are behind whatever is in the scene, at whatever far distance the stage
 * uses, and the robot and phone hide them through the ordinary depth test.
 * World stars and dust have real depths and are hidden the same way.
 *
 * INTERACTION happens in screen space, measured in viewport heights so the
 * lens is round on any aspect: the stars are projected, then the pointer's
 * lens, its wake and any pulse rings bend and brighten them where they land.
 * That is why it keeps working while the camera flies.
 */

import { NOISE_CELLS } from './cosmosSky';

export const PULSES = 3;
/** Seconds a pulse ring takes to run out and fade. */
export const PULSE_SECONDS = 1.2;

const f = (n: number) => n.toFixed(5);

// ── Interaction, shared by every layer ──────────────────────────────────
/** Lens radius (1σ, viewport heights): 0.15 heights out, a star still feels a fifth of the effect. */
const LENS_SIGMA = 0.085;
/** Magnification at the lens centre. Under 2.2 the push never folds stars over each other. */
const LENS_MAG = 0.42;
const WAKE_SIGMA = 0.06;
/** How far a pulse ring runs, in viewport heights: most of the way to the frame's edge, not past it. */
const PULSE_REACH = 0.62;
/** How far a ring nudges the stars it passes, in viewport heights. */
const PULSE_PUSH = 0.012;

const INTERACT = /* glsl */ `
  uniform float uTime;
  uniform vec2 uViewport;
  uniform vec4 uLens;          // xy pointer (NDC), z presence 0..1, w how far stars may move 0..1
  uniform vec2 uWake;          // where the pointer was a moment ago (NDC)
  uniform vec4 uPulse[${PULSES}]; // xy origin (NDC), z start (t), w strength

  // NDC → viewport heights from the centre, so a circle stays round on any aspect.
  vec2 heights() { return vec2(uViewport.x / uViewport.y, 1.0) * 0.5; }

  // The ring of pulse i at screen point s: its strength, and the outward direction in 'away'.
  float pulseRing(int i, vec2 s, vec2 k, float widen, out vec2 away) {
    vec4 P = uPulse[i];
    float age = (uTime - P.z) * ${f(1 / PULSE_SECONDS)};
    away = vec2(0.0);
    if (P.w <= 0.0 || age < 0.0 || age >= 1.0) return 0.0;
    vec2 q = s - P.xy * k;
    float len = length(q), fall = 1.0 - age;
    // On a portrait screen the width is the short side: sized by height, the ring would leave it.
    float r = len / min(1.0, uViewport.x / uViewport.y);
    // The front runs out fast and slows, the way a ripple spends itself.
    float x = (r - ${f(PULSE_REACH)} * (1.0 - pow(fall, 1.7))) / (mix(0.025, 0.085, age) * widen);
    away = q / max(len, 1e-4);
    return P.w * fall * (0.4 + 0.6 * fall) * exp(-x * x);
  }
`;

/**
 * Star-side interaction: bends `ndc`, returns the brightness gain, and in
 * `reveal` how much light to add outright. Multiplying alone leaves a faint
 * star faint; the reveal is what lets the lens and the ring bring up stars
 * the eye had not noticed.
 */
const INTERACT_STARS = /* glsl */ `
  ${INTERACT}
  float interact(inout vec2 ndc, out float reveal) {
    vec2 k = heights(), s = ndc * k, d = s - uLens.xy * k;
    float lens = uLens.z * exp(-dot(d, d) * ${f(1 / (2 * LENS_SIGMA ** 2))});
    // The wake: a fading capsule from the pointer back to where it was.
    vec2 back = (uWake - uLens.xy) * k;
    float h = clamp(dot(d, back) / max(dot(back, back), 1e-6), 0.0, 1.0);
    vec2 e = d - back * h;
    float wake = uLens.z * min(length(back) * 6.0, 1.0) * sqrt(1.0 - h) * exp(-dot(e, e) * ${f(1 / (2 * WAKE_SIGMA ** 2))});
    // A soft magnifier: stars under the lens spread away from its centre.
    vec2 push = d * (${f(LENS_MAG)} * lens);
    float ring = 0.0;
    for (int i = 0; i < ${PULSES}; i++) {
      vec2 away;
      float w = pulseRing(i, s, k, 1.0, away);
      ring += w;
      push += away * (w * ${f(PULSE_PUSH)});
    }
    ndc = (s + push * uLens.w) / k;
    reveal = lens + wake + 2.4 * ring;
    return 1.0 + 2.2 * lens + 2.2 * wake + 4.5 * ring;
  }
`;

// ── Stars ─────────────────────────────────────────────────────────────────
/** Where a layer's point is, as a function returning clip space; `fade` scales its light. */
export type Placement = 'far' | 'world' | 'dust';

const PLACE: Record<Placement, string> = {
  // A direction with the camera's translation dropped: at infinity, never parallaxing.
  far: /* glsl */ `
    vec4 place(out float fade) {
      fade = 1.0;
      vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 0.0);
      clip.z = clip.w * 0.99999; // on the far plane, behind everything
      return clip;
    }`,
  // Real positions. Nearer is brighter, as in a real field; nothing crowds the lens,
  // and a stage whose far plane is still short fades them out instead of clipping.
  world: /* glsl */ `
    vec4 place(out float fade) {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float d = length(mv.xyz), far = projectionMatrix[3][2] / (projectionMatrix[2][2] + 1.0);
      fade = clamp(70.0 / d, 0.5, 1.7) * smoothstep(3.0, 14.0, d) * (1.0 - smoothstep(0.8 * far, 0.96 * far, -mv.z));
      return projectionMatrix * mv;
    }`,
  // One box of drifting motes, wrapped around a point ahead of the camera: always dust
  // near the eye, world-anchored so it parallaxes, faded at the box's walls so a wrap
  // never pops, and kept beyond uClear so no mote ever crosses the robot or the phone.
  dust: /* glsl */ `
    attribute vec3 aVel;
    uniform float uBox, uAhead, uClear;
    vec4 place(out float fade) {
      vec3 ahead = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
      vec3 centre = cameraPosition + ahead * uAhead;
      vec3 rel = mod((position - 0.5) * uBox + aVel * uTime - centre + 0.5 * uBox, uBox) - 0.5 * uBox;
      vec4 mv = viewMatrix * vec4(centre + rel, 1.0);
      vec3 a = abs(rel) / (0.5 * uBox);
      fade = (1.0 - smoothstep(0.7, 1.0, max(a.x, max(a.y, a.z)))) * smoothstep(uClear, uClear + 5.0, -mv.z);
      return projectionMatrix * mv;
    }`,
};

export function starVertex(kind: Placement): string {
  return /* glsl */ `
    ${INTERACT_STARS}
    uniform float uDpr, uPointCap, uGain, uTwinkle, uReveal;
    attribute vec3 aColor;
    attribute vec2 aStar; // x size (CSS px), y seed
    varying vec3 vColor;
    varying float vPx, vHalo, vSpike;
    ${PLACE[kind]}

    // Scintillation: two beating sines per star, on about half the stars. Frozen with t.
    float twinkle(float seed) {
      float amp = step(0.45, fract(seed * 13.7)) * (0.15 + 0.3 * fract(seed * 7.13));
      float w = 0.6 + 2.0 * fract(seed * 3.31);
      return 1.0 + uTwinkle * amp * sin(uTime * w + seed * 40.0) * (0.6 + 0.4 * sin(uTime * w * 2.37 + seed * 17.0));
    }

    void main() {
      float fade;
      vec4 clip = place(fade);
      vec2 ndc = clip.xy / max(clip.w, 1e-5);
      float reveal;
      float gain = interact(ndc, reveal);
      // Revealed light keeps the star's own tint, and varies star to star so the lens shows a field, not a disc.
      vec3 tint = aColor / max(max(aColor.r, max(aColor.g, aColor.b)), 1e-4);
      float own = 0.25 + 0.75 * fract(aStar.y * 5.77);
      vColor = uGain * fade * (aColor * gain * twinkle(aStar.y) + tint * (uReveal * reveal * own));
      vHalo = smoothstep(3.8, 14.0, aStar.x);
      vSpike = smoothstep(13.0, 15.4, aStar.x);
      // A brightened star opens its sprite a little, so its halo is not cropped.
      gl_PointSize = min(aStar.x * uDpr * min(1.0 + 0.25 * (gain - 1.0), 1.6), uPointCap);
      vPx = gl_PointSize;
      bool hidden = clip.w <= 0.0 || max(vColor.r, max(vColor.g, vColor.b)) < 0.0012;
      gl_Position = hidden ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(ndc * clip.w, clip.zw);
    }
  `;
}

/**
 * A star as a lens records one: a core about a CSS pixel across (sized in CSS
 * pixels, so it is as crisp at DPR 1.75 as at 1), a soft halo on the bright
 * ones, and faint four-point spikes on the very brightest.
 */
export const STAR_FRAG = /* glsl */ `
  uniform float uDpr, uCoreK;
  varying vec3 vColor;
  varying float vPx, vHalo, vSpike;
  void main() {
    vec2 q = gl_PointCoord - 0.5, c = q * (vPx / uDpr);
    float r2 = dot(c, c);
    // A point-spread, not a ball: a tight halo and a much fainter wide wing, both small beside the core.
    float light = exp(-r2 * uCoreK) + vHalo * (0.045 * exp(-r2 * 0.22) + 0.008 * exp(-r2 * 0.045));
    light += vSpike * 0.16 * (exp(-abs(c.x) * 0.5 - c.y * c.y * 2.5) + exp(-abs(c.y) * 0.5 - c.x * c.x * 2.5));
    light *= 1.0 - smoothstep(0.16, 0.25, dot(q, q)); // round, and dark before the sprite's square edge
    gl_FragColor = vec4(vColor * light, 0.0); // alpha 0: added as light, never covering the ground
    #include <colorspace_fragment>
  }
`;

// ── Shooting star ─────────────────────────────────────────────────────────
/** Share of the path the tail trails behind the head. */
const METEOR_TAIL = 0.42;

/**
 * One quad, built in screen space between the head and the end of the tail.
 * Its two ends are directions at infinity, so a streak stays put against the
 * sky if the camera moves while it burns.
 */
export const METEOR_VERT = /* glsl */ `
  uniform float uTime, uDpr;
  uniform vec2 uViewport;
  uniform vec3 uFrom, uTo;   // world directions of the path's two ends
  uniform vec3 uMeteor;      // x start (t), y duration (s), z brightness; 0 = none
  // position.xy is the quad corner: x 0 tail … 1 head, y −1 … 1 across.
  varying vec2 vAlong;       // x 0 tail … 1 head, y across (CSS px)
  varying float vLen, vLife;

  vec2 toPx(vec3 dir, out float w) {
    vec4 c = projectionMatrix * vec4(mat3(viewMatrix) * dir, 0.0);
    w = c.w;
    return c.xy / max(c.w, 1e-5) * uViewport * 0.5;
  }

  void main() {
    float age = (uTime - uMeteor.x) / max(uMeteor.y, 1e-3);
    float head = 1.0 - (1.0 - age) * (1.0 - age); // fast, then slowing as it burns out
    float wH, wT;
    vec2 pH = toPx(normalize(mix(uFrom, uTo, clamp(head, 0.0, 1.0))), wH);
    vec2 pT = toPx(normalize(mix(uFrom, uTo, clamp(head - ${f(METEOR_TAIL)}, 0.0, 1.0))), wT);
    vec2 axis = pH - pT;
    float len = max(length(axis), 1e-3), pad = 4.0 * uDpr;
    vec2 dir = axis / len, across = vec2(-dir.y, dir.x);
    float along = position.x * (len + 2.0 * pad) - pad;
    vec2 p = pT + dir * along + across * (position.y * pad);
    vAlong = vec2(along / len, position.y * pad / uDpr);
    vLen = len / uDpr;
    vLife = uMeteor.z * smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.5, 1.0, age));
    bool hidden = uMeteor.z <= 0.0 || age < 0.0 || age >= 1.0 || wH <= 0.0 || wT <= 0.0;
    gl_Position = hidden ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(p / (uViewport * 0.5), 0.99999, 1.0);
  }
`;

export const METEOR_FRAG = /* glsl */ `
  uniform vec3 uHead, uTail;
  varying vec2 vAlong;
  varying float vLen, vLife;
  void main() {
    float a = clamp(vAlong.x, 0.0, 1.0), y2 = vAlong.y * vAlong.y;
    // A hair-thin core in a faint sheath, fading to nothing along the tail.
    float trail = a * a * (exp(-y2 * 1.4) + 0.18 * exp(-y2 * 0.2)) * step(vAlong.x, 1.0);
    float dh = (vAlong.x - 1.0) * vLen, head = exp(-(dh * dh + y2) * 0.5);
    gl_FragColor = vec4((mix(uTail, uHead, a) * trail + uHead * head) * vLife, 0.0);
    #include <colorspace_fragment>
  }
`;

// ── Nebula ────────────────────────────────────────────────────────────────
/** Share of the gas held down across the mid-height band where copy and subject sit. */
const COPY_CALM = 0.72;
/** How far round the pointer the gas lifts (1σ, viewport heights): wider and softer than the star lens. */
const NEB_LENS_SIGMA = 0.16;
/** Envelope below which the nebula's octaves are skipped. */
const NEB_GATE = 0.03;

/**
 * One full-screen triangle pair on the far plane. Its ray is reconstructed
 * per vertex (linear in NDC, so interpolation is exact), and the gas is read
 * from the baked volume along it: at infinity, like the far stars.
 */
export const NEBULA_VERT = /* glsl */ `
  varying vec3 vRay;
  varying vec2 vNdc;
  void main() {
    vNdc = position.xy;
    vec3 view = vec3((position.x + projectionMatrix[2][0]) / projectionMatrix[0][0],
                     (position.y + projectionMatrix[2][1]) / projectionMatrix[1][1], -1.0);
    vRay = view * mat3(viewMatrix); // view → world: the rotation's transpose
    gl_Position = vec4(position.xy, 0.99999, 1.0);
  }
`;

/**
 * Domain-warped value noise, one fetch per octave, gated by a cheap envelope
 * so the empty sky (most of it) costs a single fetch. Held down behind where
 * copy sits, lifted a little near the pointer and by a passing pulse — a
 * lift of gas that is already there, so black stays black.
 */
export const NEBULA_FRAG = /* glsl */ `
  ${INTERACT}
  uniform sampler3D uNoise;
  uniform vec3 uDeep, uViolet, uSky, uAmber, uGlow, uFront;
  uniform float uGain, uGlowGain;
  varying vec3 vRay;
  varying vec2 vNdc;

  // Each octave is turned before it is scaled, so no two octaves' lattices line up: value noise
  // read straight off one lattice shows its axes as boxy, rectilinear features.
  const mat3 TURN = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);

  vec4 noise(vec3 p) {
    vec3 i = floor(p), t = fract(p);
    return textureLod(uNoise, (i + t * t * (3.0 - 2.0 * t) + 0.5) * ${f(1 / NOISE_CELLS)}, 0.0);
  }

  void main() {
    vec2 k = heights(), s = vNdc * k, dp = s - uLens.xy * k;
    float near = uLens.z * exp(-dot(dp, dp) * ${f(1 / (2 * NEB_LENS_SIGMA ** 2))});
    float ring = 0.0;
    for (int i = 0; i < ${PULSES}; i++) { vec2 away; ring += pulseRing(i, s, k, 2.0, away); }
    vec3 rgb = uGlow * uGlowGain * (near * near + 0.5 * ring);

    // Copy sits to one side at mid height and the subject to the other, so the gas is held
    // down across that whole band — a little more at the sides — and the top and bottom of
    // the frame carry it. Held down, not cut out: a mask with an edge would show.
    float mid = 1.0 - smoothstep(0.25, 0.8, abs(vNdc.y));
    float calm = 1.0 - ${f(COPY_CALM)} * mid * (0.7 + 0.3 * smoothstep(0.1, 0.45, abs(vNdc.x)));
    vec3 d = normalize(vRay);
    // Richest ahead of the stations, thinner everywhere else.
    float placed = 0.35 + 0.65 * smoothstep(-0.2, 0.85, dot(d, uFront));
    vec3 p = d * 2.2 + vec3(3.7, 11.2, 5.3);
    vec4 w = noise(TURN * p * 0.8 + vec3(uTime * 0.004, uTime * 0.0025, 0.0));
    float env = smoothstep(0.3, 0.72, w.a) * placed * calm * (1.0 + 1.5 * near + 2.0 * ring);
    // Below the gate the gas could only add a level or two of light: skip the octaves there,
    // fading to it rather than cutting, so no edge shows. Most of the sky stops here.
    if (env > ${f(NEB_GATE)}) {
      // Domain-warped fbm: the warp bends the octaves into billows and wisps.
      vec3 x = TURN * (p + (w.xyz - 0.5) * 1.8) * 2.1;
      vec4 o1 = noise(x);
      x = TURN * x * 2.17;
      vec4 o2 = noise(x + 11.3);
      x = TURN * x * 2.13;
      vec4 o3 = noise(x + 5.1);
      x = TURN * x * 2.21;
      vec4 o4 = noise(x + 2.9);
      float n = 0.5 * o1.x + 0.26 * o2.y + 0.15 * o3.z + 0.09 * o4.w;
      // Fractal edges: the cloud ends wherever its detail says, not along a smooth outline.
      float body = clamp((n - 0.38) * 2.6, 0.0, 1.0);
      // Broad, soft patches of dust dimming the glow from in front.
      float dust = mix(1.0, 0.3, smoothstep(0.55, 0.8, o2.w));
      float gas = env * body * body * dust;
      // Whole clouds lean blue or violet; the densest cores pale towards sky; a rare warm knot.
      vec3 c = mix(uDeep, uViolet, smoothstep(0.35, 0.65, 0.6 * w.y + 0.4 * o1.w));
      c = mix(c, uSky, 0.6 * smoothstep(0.6, 0.9, n));
      c += uAmber * 0.5 * smoothstep(0.82, 0.95, o1.z) * smoothstep(0.55, 0.8, n);
      rgb += c * (gas * uGain * smoothstep(${f(NEB_GATE)}, ${f(NEB_GATE * 2.5)}, env));
    }
    gl_FragColor = vec4(rgb, 0.0);
    #include <colorspace_fragment>
    // Interleaved-gradient dither against banding in the faint gradients, only where there is light.
    if (rgb.r + rgb.g + rgb.b > 0.0)
      gl_FragColor.rgb = max(gl_FragColor.rgb + (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0, 0.0);
  }
`;
