/**
 * The galaxy the phone floats in — and the brain map that becomes it.
 *
 * disc: a plane whose shader lights the arms per pixel from a noise field baked
 * once. core: one camera-facing quad with an analytic warm glow. stars: ~8.4k
 * points (arms, disc, bulge, halo) so it holds up from inside. nodes + links:
 * 128 knowledge nodes in 16 clusters, placed in the vertex shader from the
 * emergence uniform — a frame is a few uniform writes. PALETTE colours only.
 *
 * ORIENTATION belongs to the caller: the root is an untilted disc in its XZ
 * plane. The module spins the disc about its own axis with `t`; callers must
 * not add a spin of their own. COMPOSITING: the stage canvas is transparent
 * over a CSS ground, so every layer adds light and leaves destination alpha
 * alone — on paper a faint brightening, over space the whole picture.
 */

import * as THREE from 'three';
import { PALETTE, hex } from './contract';
import type { Galaxy, GalaxyInput } from './contract';

// ── Shape ─────────────────────────────────────────────────────────────────
const [DISC_RADIUS, ARMS, ARM_START] = [30, 2, 1.4];
/** 1 / tan(pitch angle). 2.7 ≈ a 20° pitch: open, grand-design arms. */
const ARM_WIND = 2.7;
/** Radians per second of `t`. One turn every ~13 minutes: felt, not seen. */
const SPIN = 0.008;
const COUNT = { arm: 4600, disc: 1500, bulge: 900, halo: 1400 };
/** Halo shell: outside the disc's edge-dimming, inside the stage's far plane (100). */
const HALO = { inner: 40, depth: 36 };
/** Knowledge nodes: topic clusters of a hub and its satellites. */
const [CLUSTERS, PER_CLUSTER] = [16, 8];
/** Emergence: each node waits up to MAX_DELAY, then travels for TRAVEL. */
const MAX_DELAY = 0.52;
const TRAVEL = 1 - MAX_DELAY;
/** Darkness 0 (the paper page) leaves this much light. */
const PAPER_GLOW = 0.06;
/** Resolution of the baked noise field that textures the disc. */
const FIELD_PX = 512;

// ── Deterministic randomness — the same galaxy on every load ─────────────
type Rng = { next: () => number; gauss: () => number };
function rng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => { // mulberry32
    let t = (a = (a + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, next()))) * Math.cos(2 * Math.PI * next());
  return { next, gauss };
}

const col = (h: string) => new THREE.Color(hex(h));
const C = { white: col(PALETTE.white), sky: col(PALETTE.sky), blueBright: col(PALETTE.blueBright),
  violet: col(PALETTE.violet), amber: col(PALETTE.amber) };

// ── Shaders ───────────────────────────────────────────────────────────────
const COMMON = /* glsl */ `
  uniform float uViewH, uDpr, uBright, uPointCap;
  float pxSize(float worldSize, float depth) { return worldSize * projectionMatrix[1][1] * 0.5 * uViewH / max(depth, 1e-3); }
`;

/** Stars. Below the minimum size a point keeps its size and loses energy. */
const POINT_VERT = /* glsl */ `
  ${COMMON}
  attribute float aSize; attribute vec3 aColor; varying vec3 vColor;
  uniform float uMinPx, uMaxPx, uEdge; uniform vec2 uNear;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float d = -mv.z, px = pxSize(aSize, d), minPx = uMinPx * uDpr;
    float gain = uBright * clamp((px * px) / (minPx * minPx), 0.0, 1.0) * smoothstep(uNear.x, uNear.y, d);
    // Edge-on, a thin disc stacks every sprite on the line of sight and burns out: dim by how grazing.
    float face = abs(dot(normalize(normalMatrix[1]), normalize(mv.xyz))), inDisc = step(length(position), ${DISC_RADIUS + 8}.0);
    gain *= mix(1.0, mix(uEdge, 1.0, smoothstep(0.0, 0.45, face)), inDisc);
    vColor = aColor * gain;
    gl_PointSize = min(clamp(px, minPx, uMaxPx * uDpr), uPointCap);
    gl_Position = gain < 0.003 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
  }
`;

/** A round sprite whose colour is `rgb`, written in terms of r2 (0 centre, 1 edge). */
const spriteFrag = (rgb: string) => /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0; float r2 = dot(c, c); if (r2 > 1.0) discard;
    gl_FragColor = vec4(${rgb}, 0.0); // alpha 0: added as light, never covering the ground
    #include <colorspace_fragment>
  }
`;
/** A star: a tight core with a soft bloom around it, as a lens records one. */
const STAR_FRAG = spriteFrag('vColor * (0.62 * exp(-r2 * 16.0) + 0.38 * exp(-r2 * 4.5)) * (1.0 - r2)');

/** Interleaved-gradient noise: a cheap, precision-safe dither against banding. */
const DITHER = /* glsl */ `
  gl_FragColor.rgb = max(gl_FragColor.rgb + (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0, 0.0);
`;

const DISC_VERT = /* glsl */ `
  varying vec2 vP; varying vec3 vView, vN;
  void main() {
    vP = vec2(position.x, -position.y); // the plane is laid flat: local -y is disc +z
    vView = (modelViewMatrix * vec4(position, 1.0)).xyz; vN = normalMatrix * vec3(0.0, 0.0, 1.0);
    gl_Position = projectionMatrix * vec4(vView, 1.0);
  }
`;

/** Field channels: r arm clumping, g arm hue, b star-forming knots, a lane raggedness. */
const DISC_FRAG = /* glsl */ `
  uniform sampler2D uField; uniform float uBright; uniform vec3 uArmA, uArmB, uKnot, uWarm;
  varying vec2 vP; varying vec3 vView, vN;
  void main() {
    vec4 f = texture2D(uField, vP / ${(DISC_RADIUS * 2).toFixed(1)} + 0.5);
    // Fine mottling: the same field again at 3x, mirrored so it never seams.
    float fine = texture2D(uField, vP / ${((DISC_RADIUS * 2) / 3).toFixed(1)} + 0.5).a;
    float r = length(vP), period = ${((2 * Math.PI) / ARMS).toFixed(5)};
    float phase = atan(vP.y, vP.x) - log(max(r, ${ARM_START.toFixed(2)}) / ${ARM_START.toFixed(2)}) * ${ARM_WIND.toFixed(3)};
    float da = mod(phase + 0.5 * period, period) - 0.5 * period;
    float across = da * r * ${Math.sin(Math.atan(1 / ARM_WIND)).toFixed(4)} / (0.8 + 0.085 * r);
    float arm = exp(-across * across);
    // A dark dust lane hugging the inner, trailing edge of each arm.
    float lane = (across + 0.95) / 0.38, dust = 1.0 - (0.4 + 0.35 * f.a) * exp(-lane * lane) * smoothstep(3.0, 7.0, r);
    float radial = smoothstep(2.2, 6.0, r) * (1.0 - smoothstep(19.0, 29.0, r)) * exp(-r / 16.0);
    float light = (arm * (0.45 + 0.7 * smoothstep(0.25, 0.85, f.r)) * (0.7 + 0.6 * fine) + 0.05) * radial * dust;
    vec3 c = mix(mix(uArmA, uArmB, f.g), uKnot, smoothstep(0.62, 0.8, f.b) * arm * 0.75);
    vec3 rgb = c * light * 0.26 + uWarm * exp(-r / 2.6) * 0.05;
    // Thin away edge-on, and near the eye, where a plane would read as a floor.
    float fade = smoothstep(0.03, 0.3, abs(dot(normalize(vN), normalize(vView)))) * smoothstep(3.0, 16.0, length(vView));
    gl_FragColor = vec4(rgb * uBright * fade, 0.0);
    #include <colorspace_fragment>
    ${DITHER}
  }
`;

/** The bulge: one quad facing the camera, flattened along the disc's axis. */
const CORE_VERT = /* glsl */ `
  uniform float uBright, uSize; varying vec2 vOff, vAxis, vQuad; varying float vGain;
  void main() {
    vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vQuad = position.xy; vOff = position.xy * uSize;
    vAxis = (normalMatrix * vec3(0.0, 1.0, 0.0)).xy; // the disc's axis, on screen
    vGain = uBright * smoothstep(0.5, 4.0, -c.z);
    gl_Position = projectionMatrix * vec4(c.xy + vOff, c.z, 1.0);
  }
`;
const CORE_FRAG = /* glsl */ `
  uniform vec3 uWarm, uHot; varying vec2 vOff, vAxis, vQuad; varying float vGain;
  void main() {
    float along = dot(vOff, vAxis), r2 = dot(vOff, vOff) + 1.4 * along * along;
    vec3 rgb = uWarm * (0.045 * exp(-r2 * 0.45) + 0.035 * exp(-r2 * 0.65)) + uHot * 0.025 * exp(-r2 * 3.3);
    gl_FragColor = vec4(rgb * vGain * (1.0 - smoothstep(0.6, 1.0, length(vQuad))), 0.0);
    #include <colorspace_fragment>
    ${DITHER}
  }
`;

/** The emergence path, shared by nodes and the links that travel with them. */
const PATH = /* glsl */ `
  uniform float uEmergence, uTime; uniform vec3 uOrigin, uToward;
  attribute vec3 aBend; attribute float aDelay;
  float progress(float delay) { return clamp((uEmergence - delay) / ${TRAVEL.toFixed(4)}, 0.0, 1.0); }
  float easeInOut(float p) { return p < 0.5 ? 4.0 * p * p * p : 1.0 - pow(-2.0 * p + 2.0, 3.0) * 0.5; }
  // A cubic that first leaves the screen toward the viewer, out in front of the glass, then leans along the spin into the disc.
  vec3 pathPos(vec3 target, vec3 bend, float s) {
    float len = length(target - uOrigin), u = 1.0 - s;
    vec3 p1 = uOrigin + uToward * min(0.35 * len, 3.0) + bend * len * 0.15;
    vec3 p2 = mix(uOrigin, target, 0.7) + bend * len * 0.3;
    return u * u * u * uOrigin + 3.0 * u * u * s * p1 + 3.0 * u * s * s * p2 + s * s * s * target;
  }
`;

const NODE_VERT = /* glsl */ `
  ${COMMON} ${PATH}
  attribute float aSize, aSeed; attribute vec3 aColor; varying vec3 vColor;
  void main() {
    float p = progress(aDelay), s = easeInOut(p);
    vec4 mv = modelViewMatrix * vec4(pathPos(position, aBend, s), 1.0);
    // Tiny as it leaves the screen, full size as it lands.
    float grow = mix(0.1, 1.0, smoothstep(0.0, 1.0, s)), breathe = 1.0 + 0.07 * sin(uTime * 1.1 + aSeed * 6.2832);
    float px = pxSize(aSize * grow * breathe, -mv.z);
    float gain = uBright * smoothstep(0.0, 0.15, p) * smoothstep(0.6, 3.0, -mv.z);
    vColor = aColor * gain;
    gl_PointSize = min(clamp(px, 2.5 * uDpr, 28.0 * uDpr), uPointCap);
    gl_Position = gain < 0.003 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
  }
`;

/** A node: a bright pinpoint, its own colour around it, a wide faint halo. */
const NODE_FRAG = spriteFrag(
  'vColor * (0.9 * exp(-r2 * 10.0) + 0.22 * exp(-r2 * 3.2) * (1.0 - r2)) + vec3(0.35 * exp(-r2 * 60.0) * length(vColor))',
);

const LINK_VERT = /* glsl */ `
  ${COMMON} ${PATH} uniform float uPulse;
  attribute vec3 aOther, aOtherBend, aColor; attribute float aOtherDelay, aT, aSeed, aBridge;
  varying vec3 vColor; varying float vT, vSeed, vPulse;
  void main() {
    float pSelf = progress(aDelay), pOther = progress(aOtherDelay);
    vec4 mv = modelViewMatrix * vec4(pathPos(position, aBend, easeInOut(pSelf)), 1.0);
    vec3 other = (modelViewMatrix * vec4(pathPos(aOther, aOtherBend, easeInOut(pOther)), 1.0)).xyz;
    // The later end decides: a barely-there thread while it travels, full once it lands.
    float late = min(pSelf, pOther), a = 0.08 * smoothstep(0.0, 1.0, late) + 0.92 * smoothstep(0.75, 1.0, late);
    // Long spans (threads still in flight) fade out; so does the end nearest the eye.
    a *= (1.0 - smoothstep(4.0, 8.0, length(mv.xyz - other))) * smoothstep(1.5, 5.0, -mv.z);
    // Bridges between clusters appear only once the map has fully arrived.
    a *= mix(1.0, 0.3 * smoothstep(0.9, 1.0, uEmergence), aBridge);
    // GL lines are one device pixel: keep their energy per CSS pixel.
    vColor = aColor * a * uBright * min(uDpr, 2.0);
    vT = aT; vSeed = aSeed; vPulse = step(0.62, aSeed) * uPulse;
    gl_Position = projectionMatrix * mv;
  }
`;

/** Every few links carries a slow pulse, end to end: the map is thinking. */
const LINK_FRAG = /* glsl */ `
  uniform float uTime; varying vec3 vColor; varying float vT, vSeed, vPulse;
  void main() {
    float head = fract(uTime * 0.09 + vSeed * 7.0) * 1.6 - 0.3, pulse = vPulse * exp(-pow((vT - head) * 7.0, 2.0));
    gl_FragColor = vec4(vColor * (0.18 + 1.1 * pulse), 0.0);
    #include <colorspace_fragment>
  }
`;

// ── Geometry plumbing ─────────────────────────────────────────────────────
/** Attribute name → [values, item size]. */
type Attrs = Record<string, [ArrayLike<number>, number]>;
function geometry(attrs: Attrs): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const [name, [data, size]] of Object.entries(attrs))
    g.setAttribute(name, new THREE.BufferAttribute(Float32Array.from(data), size));
  return g;
}

type Cloud = { pos: number[]; color: number[]; size: number[] };
const cloudGeometry = (c: Cloud) => geometry({ position: [c.pos, 3], aColor: [c.color, 3], aSize: [c.size, 1] });
function push(c: Cloud, x: number, y: number, z: number, rgb: THREE.Color, k: number, size: number) {
  c.pos.push(x, y, z);
  c.color.push(rgb.r * k, rgb.g * k, rgb.b * k);
  c.size.push(size);
}

// ── The disc's noise field, baked once ───────────────────────────────────
/** Smooth value noise over the disc, from a precomputed lattice of `freq` cells per unit. */
function lattice(freq: number, seed: number): (x: number, y: number) => number {
  const n = Math.ceil(DISC_RADIUS * 2 * freq) + 2;
  const r = rng(seed);
  const v = Float32Array.from({ length: n * n }, () => r.next());
  const fade = (f: number) => f * f * (3 - 2 * f);
  return (x, y) => {
    const [fx, fy] = [(x + DISC_RADIUS) * freq, (y + DISC_RADIUS) * freq];
    const [ix, iy] = [Math.floor(fx), Math.floor(fy)];
    const [tx, ty] = [fade(fx - ix), fade(fy - iy)];
    const i = iy * n + ix;
    const [lo, hi] = [v[i] + (v[i + 1] - v[i]) * tx, v[i + n] + (v[i + n + 1] - v[i + n]) * tx];
    return lo + (hi - lo) * ty;
  };
}

function bakeField(): THREE.DataTexture {
  const [clumpA, clumpB, hue, knot, rag] = [[0.55, 1], [1.4, 2], [0.25, 3], [0.8, 4], [2.2, 5]].map(([f, s]) => lattice(f, s));
  const data = new Uint8Array(FIELD_PX * FIELD_PX * 4);
  for (let j = 0; j < FIELD_PX; j++) {
    const y = ((j + 0.5) / FIELD_PX - 0.5) * DISC_RADIUS * 2;
    for (let i = 0; i < FIELD_PX; i++) {
      const x = ((i + 0.5) / FIELD_PX - 0.5) * DISC_RADIUS * 2;
      const f = [0.6 * clumpA(x, y) + 0.4 * clumpB(x, y), hue(x, y), knot(x, y), rag(x, y)];
      data.set(f.map((c) => 255 * c), (j * FIELD_PX + i) * 4);
    }
  }
  return Object.assign(new THREE.DataTexture(data, FIELD_PX, FIELD_PX), {
    minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true,
    wrapS: THREE.MirroredRepeatWrapping, wrapT: THREE.MirroredRepeatWrapping, needsUpdate: true,
  });
}

// ── Stars ────────────────────────────────────────────────────────────
/** The angle of an arm's spine at radius `rad`. */
const armAngle = (arm: number, rad: number) =>
  (arm * 2 * Math.PI) / ARMS + Math.log(Math.max(rad, ARM_START) / ARM_START) * ARM_WIND;

/** Young arms are blue and violet; the old core is warm. */
function starColour(r: Rng, rad: number, out: THREE.Color): THREE.Color {
  const roll = r.next();
  if (roll < 0.42) out.copy(C.white).lerp(C.sky, 0.5 + 0.5 * r.next());
  else if (roll < 0.7) out.copy(C.sky).lerp(C.blueBright, r.next());
  else if (roll < 0.9) out.copy(C.blueBright).lerp(C.violet, 0.4 + 0.6 * r.next());
  else out.copy(C.white);
  const warmth = Math.exp(-rad / 4.5) * 0.9;
  return out.lerp(C.white, warmth * 0.5).lerp(C.amber, warmth * 0.45);
}

function buildStars(): Cloud {
  const [r, c, tmp] = [rng(7), { pos: [], color: [], size: [] } as Cloud, new THREE.Color()];
  for (let i = 0; i < COUNT.arm; i++) {
    const rad = 2.2 + 27 * Math.pow(r.next(), 1.1);
    const [a, spread] = [armAngle(i % ARMS, rad) + r.gauss() * 0.12, 0.6 + rad * 0.09];
    const y = r.gauss() * (0.25 + 0.5 * Math.exp(-rad / 6));
    // Most stars faint, a few bright: the range a photograph has.
    const k = 0.5 + 2.2 * Math.pow(r.next(), 5);
    const size = 0.07 + 0.12 * Math.pow(r.next(), 2.5);
    push(c, Math.cos(a) * rad + r.gauss() * spread, y, Math.sin(a) * rad + r.gauss() * spread, starColour(r, rad, tmp), k, size);
  }
  for (let i = 0; i < COUNT.disc; i++) {
    const [rad, a] = [1.5 - 11 * Math.log(1 - 0.92 * r.next()), r.next() * Math.PI * 2]; // exponential, cut at the rim
    const y = r.gauss() * (0.4 + 0.6 * Math.exp(-rad / 5));
    push(c, Math.cos(a) * rad, y, Math.sin(a) * rad, starColour(r, rad, tmp), 0.3 + 0.35 * r.next(), 0.06 + 0.06 * r.next());
  }
  for (let i = 0; i < COUNT.bulge; i++) {
    const [rad, a, phi] = [Math.abs(r.gauss()) * 2.6, r.next() * Math.PI * 2, Math.acos(2 * r.next() - 1)];
    tmp.copy(C.white).lerp(C.amber, 0.25 + 0.5 * r.next());
    const [x, z] = [Math.sin(phi) * Math.cos(a) * rad, Math.sin(phi) * Math.sin(a) * rad];
    push(c, x, Math.cos(phi) * rad * 0.55, z, tmp, 0.12 + 0.16 * r.next(), 0.05 + 0.05 * r.next());
  }
  for (let i = 0; i < COUNT.halo; i++) {
    const [rad, a, cy] = [HALO.inner + HALO.depth * r.next(), r.next() * Math.PI * 2, 2 * r.next() - 1];
    const [sy, warm] = [Math.sqrt(1 - cy * cy), r.next() > 0.7];
    tmp.copy(C.white).lerp(warm ? C.amber : C.sky, warm ? 0.35 : 0.4 * r.next());
    const k = 0.35 + 1.1 * Math.pow(r.next(), 4);
    push(c, Math.cos(a) * sy * rad, cy * rad, Math.sin(a) * sy * rad, tmp, k, 0.18 + 0.2 * r.next());
  }
  return c;
}

// ── Knowledge nodes and their links ───────────────────────────────────────
// Topic clusters along the arms: a hub whose satellites branch from it, as on the
// phone's brain map, each bridged to the cluster before it once the map has arrived.
type NodeAttr = 'position' | 'aBend' | 'aColor' | 'aDelay' | 'aSize' | 'aSeed';
const NODE_ATTRS: Record<NodeAttr, number> = { position: 3, aBend: 3, aColor: 3, aDelay: 1, aSize: 1, aSeed: 1 };
const NODE_ENTRIES = Object.entries(NODE_ATTRS) as [NodeAttr, number][];
type Nodes = Record<NodeAttr, Float32Array>;
/** [from, to, isBridge] */
type Link = [number, number, number];
type Dist = (i: number, j: number) => number;

function clusterHue(k: number, r: Rng, out: THREE.Color): THREE.Color {
  if (k % 6 === 3) return out.copy(C.amber);
  if (k % 5 === 1 || k % 5 === 4) return out.copy(C.violet).lerp(C.white, 0.1);
  return out.copy(C.blueBright).lerp(C.sky, 0.3 * r.next());
}

/** A mind map: satellites hang off the hub, or off a nearer satellite that lies well on the way to it. */
function clusterTree(hub: number, d2: Dist): Link[] {
  const byReach = Array.from({ length: PER_CLUSTER - 1 }, (_, j) => hub + 1 + j).sort((a, b) => d2(hub, a) - d2(hub, b));
  return byReach.map((node, n): Link => {
    const via = byReach.slice(0, n).find((c) => d2(node, c) < 0.3 * d2(node, hub));
    return [via ?? hub, node, 0];
  });
}

function closestPair(a0: number, b0: number, d2: Dist): Link {
  let best: Link = [a0, b0, 1];
  for (let i = a0; i < a0 + PER_CLUSTER; i++)
    for (let j = b0; j < b0 + PER_CLUSTER; j++) if (d2(i, j) < d2(best[0], best[1])) best = [i, j, 1];
  return best;
}

function buildNodes(): { nodes: Nodes; links: Link[] } {
  const [r, n] = [rng(23), CLUSTERS * PER_CLUSTER];
  const nodes = Object.fromEntries(NODE_ENTRIES.map(([k, size]) => [k, new Float32Array(n * size)])) as Nodes;
  const [links, hue, tmp, v, p]: [Link[], THREE.Color, THREE.Color, THREE.Vector3, Float32Array] =
    [[], new THREE.Color(), new THREE.Color(), new THREE.Vector3(), nodes.position];
  const d2: Dist = (i, j) =>
    (p[i * 3] - p[j * 3]) ** 2 + (p[i * 3 + 1] - p[j * 3 + 1]) ** 2 + (p[i * 3 + 2] - p[j * 3 + 2]) ** 2;
  for (let k = 0; k < CLUSTERS; k++) {
    const rad = 4.5 + (20 * (k + 0.3 + 0.4 * r.next())) / CLUSTERS;
    const [a, first] = [armAngle(k % ARMS, rad) + r.gauss() * 0.08, k * PER_CLUSTER];
    clusterHue(k, r, hue);
    for (let j = 0; j < PER_CLUSTER; j++) {
      const i = first + j;
      const [sp, ang] = [j === 0 ? 0 : 1.0 + 1.7 * Math.sqrt(r.next()), r.next() * Math.PI * 2];
      const [x, z] = [Math.cos(a) * rad + Math.cos(ang) * sp, Math.sin(a) * rad + Math.sin(ang) * sp];
      p.set([x, r.gauss() * 0.35, z], i * 3);
      // Lean along the spin tangent, a little upward, a little each its own.
      v.set(-z, 0, x).normalize().multiplyScalar(0.8);
      nodes.aBend.set([v.x + r.gauss() * 0.2, 0.15 + r.gauss() * 0.15, v.z + r.gauss() * 0.2], i * 3);
      // Inner clusters leave first — the map unfolds outward from the phone.
      nodes.aDelay[i] = MAX_DELAY * ((0.82 * k) / CLUSTERS + (j === 0 ? 0 : 0.18 * r.next()));
      tmp.copy(hue).lerp(C.white, 0.15 * r.next()).multiplyScalar(1.3);
      nodes.aColor.set([tmp.r, tmp.g, tmp.b], i * 3);
      nodes.aSize[i] = j === 0 ? 0.95 : 0.4 + 0.2 * Math.pow(r.next(), 2);
      nodes.aSeed[i] = r.next();
    }
    links.push(...clusterTree(first, d2));
    if (k >= ARMS) links.push(closestPair(first, first - ARMS * PER_CLUSTER, d2));
  }
  return { nodes, links };
}

/** Each link endpoint carries its own node's path and its partner's, so both ride the same curves. */
function linkGeometry(nodes: Nodes, links: Link[]): THREE.BufferGeometry {
  // Per endpoint: [attribute, item size, value for (self, other, end, link)].
  type Pick = (self: number, other: number, end: number, l: number) => ArrayLike<number>;
  const vec = (a: Float32Array) => (i: number) => a.subarray(i * 3, i * 3 + 3);
  const spec: [string, number, Pick][] = [
    ['position', 3, (s) => vec(nodes.position)(s)], ['aBend', 3, (s) => vec(nodes.aBend)(s)],
    ['aColor', 3, (s) => vec(nodes.aColor)(s)], ['aDelay', 1, (s) => [nodes.aDelay[s]]],
    ['aOther', 3, (_, o) => vec(nodes.position)(o)], ['aOtherBend', 3, (_, o) => vec(nodes.aBend)(o)],
    ['aOtherDelay', 1, (_, o) => [nodes.aDelay[o]]], ['aT', 1, (_, __, e) => [e]],
    ['aSeed', 1, (_, __, ___, l) => [(nodes.aSeed[links[l][0]] * 0.618 + nodes.aSeed[links[l][1]]) % 1]],
    ['aBridge', 1, (_, __, ___, l) => [links[l][2]]],
  ];
  return geometry(Object.fromEntries(spec.map(([name, size, pick]) => {
    const out = new Float32Array(links.length * 2 * size);
    links.forEach(([a, b], l) => {
      out.set(pick(a, b, 0, l), l * 2 * size);
      out.set(pick(b, a, 1, l), (l * 2 + 1) * size);
    });
    return [name, [out, size]];
  })));
}

// ── Assembly ──────────────────────────────────────────────────────────────
/** Colour adds as light; destination alpha (the CSS ground showing through) is left alone. */
const ADD_LIGHT = {
  transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
} as const;

export function buildGalaxy(): Galaxy {
  const u = <T,>(value: T) => ({ value });
  const shared = {
    uViewH: u(900), uDpr: u(1), uBright: u(1), uPointCap: u(511), uTime: u(0), uEmergence: u(0),
    uOrigin: u(new THREE.Vector3()), uToward: u(new THREE.Vector3(0, 0, 1)), uPulse: u(1),
  };
  const material = (vertexShader: string, fragmentShader: string, extra: Record<string, THREE.IUniform> = {}) =>
    new THREE.ShaderMaterial({ uniforms: { ...shared, ...extra }, vertexShader, fragmentShader, ...ADD_LIGHT });
  const sprites = (minPx: number, maxPx: number, near: [number, number], edge: number) =>
    ({ uMinPx: u(minPx), uMaxPx: u(maxPx), uNear: u(new THREE.Vector2(...near)), uEdge: u(edge) });
  const warm = C.white.clone().lerp(C.amber, 0.6);

  const field = bakeField();
  const { nodes, links } = buildNodes();
  const nodeAttrs: Attrs = Object.fromEntries(NODE_ENTRIES.map(([k, size]) => [k, [nodes[k], size]]));
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(DISC_RADIUS * 2, DISC_RADIUS * 2), material(DISC_VERT, DISC_FRAG, {
    uField: u(field), uArmA: u(C.sky.clone().lerp(C.white, 0.35)), uWarm: u(warm),
    // Pale blue-white arm light; saturated colour is kept for the star-forming knots.
    uArmB: u(C.blueBright.clone().lerp(C.violet, 0.35).multiplyScalar(0.7)), uKnot: u(C.blueBright.clone().lerp(C.violet, 0.2)),
  }));
  disc.material.side = THREE.DoubleSide;
  disc.rotation.x = -Math.PI / 2;
  const core = new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
    material(CORE_VERT, CORE_FRAG, { uSize: u(3.2), uWarm: u(warm), uHot: u(warm.clone().lerp(C.white, 0.25)) }));
  const layers = [
    disc, core,
    // Stars stay pinpoints however close: a near star is brighter, not bigger.
    new THREE.Points(cloudGeometry(buildStars()), material(POINT_VERT, STAR_FRAG, sprites(1.6, 3.4, [0.3, 1.2], 0.5))),
    new THREE.LineSegments(linkGeometry(nodes, links), material(LINK_VERT, LINK_FRAG)),
    new THREE.Points(geometry(nodeAttrs), material(NODE_VERT, NODE_FRAG)),
  ];

  const spin = new THREE.Group();
  const [localOrigin, toward] = [shared.uOrigin.value, shared.uToward.value];
  // Point sizes are in pixels: the shaders need the buffer height, pixel ratio and the GPU's largest
  // point. The emergence path needs the direction from the screen to the viewer, in the disc's space.
  const bufferSize = new THREE.Vector2();
  let pointCap = 0;
  const measure: THREE.Object3D['onBeforeRender'] = (renderer, _scene, camera) => {
    shared.uViewH.value = renderer.getDrawingBufferSize(bufferSize).y;
    shared.uDpr.value = renderer.getPixelRatio();
    const gl = renderer.getContext(); // queried once: `||=` skips the call after the first frame
    pointCap ||= shared.uPointCap.value = (gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array)[1] || 64;
    spin.worldToLocal(camera.getWorldPosition(toward)).sub(localOrigin);
    if (toward.lengthSq() < 1e-8) toward.set(0, 0, 1);
    toward.normalize();
  };
  layers.forEach((o, i) => {
    o.frustumCulled = false; // node positions are computed in the shader
    o.renderOrder = i;
    o.onBeforeRender = measure;
    spin.add(o);
  });
  const root = Object.assign(new THREE.Group().add(spin), { name: 'galaxy' });

  let lastT = Number.NaN;
  return {
    root,
    update({ t, emergence, darkness, origin }: GalaxyInput) {
      spin.rotation.y = t * SPIN;
      // The path shaders work in the spinning disc's space; bring the origin in.
      spin.updateWorldMatrix(true, false);
      spin.worldToLocal(localOrigin.copy(origin));
      const d = Math.min(1, Math.max(0, darkness));
      shared.uBright.value = PAPER_GLOW + (1 - PAPER_GLOW) * d * d;
      // The link pulse is motion: a frozen clock (reduced motion) fades it out.
      shared.uPulse.value += ((t !== lastT ? 1 : 0) - shared.uPulse.value) * 0.1;
      lastT = t;
      shared.uTime.value = t;
      shared.uEmergence.value = Math.min(1, Math.max(0, emergence));
    },
    dispose() {
      layers.forEach((o) => (o.geometry.dispose(), o.material.dispose()));
      field.dispose();
      root.removeFromParent();
    },
  };
}
