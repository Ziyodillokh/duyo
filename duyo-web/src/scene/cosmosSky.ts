/**
 * What the sky is made of, generated once from fixed seeds: the same sky on
 * every load. Nothing here runs per frame; cosmos.ts turns these arrays into
 * attributes and never touches them again.
 *
 * THREE STAR POPULATIONS, each with a different relationship to the camera:
 *   far    unit directions. The shader drops the camera's translation, so
 *          they sit at infinity and never parallax: the sky itself.
 *   world  real positions in a thick shell around the whole set. They move
 *          against the far sky as the camera flies between stations, which
 *          is what makes the space read as deep rather than painted.
 *   dust   motes in one box of world space that the shader wraps around the
 *          camera, so there is always dust near the eye, wherever it goes.
 *
 * Both skies are gathered towards FRONT, where the stations' cameras look:
 * at 32° the lens sees about 4% of the sphere, so a uniform sky would spend
 * most of its points where nobody looks. The rest stay spread everywhere so
 * a camera that turns never finds an empty patch.
 */

import * as THREE from 'three';
import { PALETTE, hex } from './contract';

// ── Deterministic randomness ──────────────────────────────────────────────
type Rng = { next: () => number; gauss: () => number };
export function rng(seed: number): Rng {
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

// ── Layout ────────────────────────────────────────────────────────────────
/** Where both stations' cameras look: down −z, a touch right (the phone's side) and down. */
export const FRONT = new THREE.Vector3(0.12, -0.04, -1).normalize();
/** The middle of the set: between the robot (≈ origin) and the phone (≈ x 14, z −18). */
const SET_CENTRE = new THREE.Vector3(7, 0.5, -9);
/**
 * No world star inside this radius of SET_CENTRE. The ball holds both
 * stations' cameras and subjects, and a ball is convex, so no star can ever
 * sit on a line between a camera and what it is looking at.
 */
const CLEAR_RADIUS = 36;
/** Outermost world star: with the camera within ~40 of the origin, well inside a 450 far plane. */
const WORLD_REACH = 230;

const COUNT = { far: 6600, world: 3900, dust: 480 } as const;

/** Share of each sky gathered towards FRONT, and how tightly (radians, 1σ). */
const FAR_GATHER = { share: 0.55, spread: 0.5 };
const WORLD_GATHER = { share: 0.6, spread: 0.55 };

// ── Colour ────────────────────────────────────────────────────────────────
const col = (h: string) => new THREE.Color(hex(h));
export const C = {
  white: col(PALETTE.white), sky: col(PALETTE.sky), blue: col(PALETTE.blue),
  blueBright: col(PALETTE.blueBright), violet: col(PALETTE.violet), amber: col(PALETTE.amber),
};

/**
 * Colour temperature as a sky has it: mostly white and blue-white, some
 * blue, a few warm, a few violet. Pale, because a saturated point reads as
 * a UI dot, not a star.
 */
function starTint(r: Rng, out: THREE.Color): THREE.Color {
  const roll = r.next();
  if (roll < 0.44) return out.copy(C.white).lerp(C.sky, 0.25 + 0.45 * r.next());
  if (roll < 0.7) return out.copy(C.white);
  if (roll < 0.82) return out.copy(C.sky).lerp(C.blueBright, 0.15 + 0.4 * r.next());
  if (roll < 0.92) return out.copy(C.white).lerp(C.amber, 0.3 + 0.35 * r.next());
  return out.copy(C.white).lerp(C.violet, 0.4 + 0.35 * r.next());
}

// ── Layers as flat arrays ─────────────────────────────────────────────────
export interface StarLayer {
  position: Float32Array;
  /** Linear colour × brightness. */
  color: Float32Array;
  /** x: sprite size in CSS px (bigger = room for a halo), y: seed for twinkle. */
  star: Float32Array;
}

export interface DustLayer extends StarLayer {
  /** World units per second of `t`: slow, so the motes are felt more than seen. */
  velocity: Float32Array;
}

function layer(n: number): StarLayer {
  return { position: new Float32Array(n * 3), color: new Float32Array(n * 3), star: new Float32Array(n * 2) };
}

/**
 * Brightness as a sky has it: a great many faint stars and a handful of
 * bright ones. `floor` is the faintest, `span` what the steep tail adds;
 * about one star in 80 is a "hero" with a halo.
 */
function brightness(r: Rng, floor: number, span: number): number {
  if (r.next() < 0.0125) return 0.55 + 0.7 * r.next();
  return floor + span * Math.pow(r.next(), 6.5);
}

/** Sprite size follows brightness: faint stars are a core only, bright ones need room for a halo. */
const spriteSize = (b: number, r: Rng) => 3.2 + 12 * THREE.MathUtils.smoothstep(b, 0.18, 1.1) + 0.4 * r.next();

function writeStar(l: StarLayer, i: number, p: THREE.Vector3, tint: THREE.Color, b: number, size: number, seed: number) {
  l.position.set([p.x, p.y, p.z], i * 3);
  l.color.set([tint.r * b, tint.g * b, tint.b * b], i * 3);
  l.star.set([size, seed], i * 2);
}

/** A unit direction: gathered round FRONT with probability `share`, uniform otherwise. */
function direction(r: Rng, gather: { share: number; spread: number }, basis: [THREE.Vector3, THREE.Vector3], out: THREE.Vector3) {
  if (r.next() < gather.share) {
    // An angle off FRONT on each axis; clamped short of 90° so tan stays finite.
    const off = () => Math.tan(THREE.MathUtils.clamp(r.gauss() * gather.spread, -1.4, 1.4));
    const [u, v] = basis;
    return out.copy(FRONT).addScaledVector(u, off()).addScaledVector(v, off()).normalize();
  }
  const [z, a] = [2 * r.next() - 1, 2 * Math.PI * r.next()];
  const s = Math.sqrt(1 - z * z);
  return out.set(s * Math.cos(a), s * Math.sin(a), z);
}

function frontBasis(): [THREE.Vector3, THREE.Vector3] {
  const u = new THREE.Vector3(0, 1, 0).cross(FRONT).normalize();
  return [u, FRONT.clone().cross(u).normalize()];
}

/**
 * Smooth periodic value noise on a small random lattice, evaluated once per
 * star at build time: it is what makes the sky clump.
 */
function lattice3(seed: number): (x: number, y: number, z: number) => number {
  const n = 12;
  const r = rng(seed);
  const v = Float32Array.from({ length: n ** 3 }, () => r.next());
  const wrap = (i: number) => ((i % n) + n) % n;
  const at = (x: number, y: number, z: number) => v[(wrap(z) * n + wrap(y)) * n + wrap(x)];
  const fade = (t: number) => t * t * (3 - 2 * t);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return (x, y, z) => {
    const [ix, iy, iz] = [Math.floor(x), Math.floor(y), Math.floor(z)];
    const [fx, fy, fz] = [fade(x - ix), fade(y - iy), fade(z - iz)];
    const plane = (k: number) =>
      lerp(lerp(at(ix, iy, k), at(ix + 1, iy, k), fx), lerp(at(ix, iy + 1, k), at(ix + 1, iy + 1, k), fx), fy);
    return lerp(plane(iz), plane(iz + 1), fz);
  };
}

/**
 * Real skies are not evenly salted: stars gather in drifts and thin into
 * voids. This share of each sky is kept only where a two-octave field says
 * so; the rest stays even, so no patch is ever empty.
 */
const CLUMPED = 0.7;
function clumping(seed: number): (d: THREE.Vector3) => number {
  const field = lattice3(seed);
  return (d) => {
    const c = 0.62 * field(d.x * 3 + 20, d.y * 3 + 20, d.z * 3 + 20) + 0.38 * field(d.x * 7.3 + 5, d.y * 7.3 + 5, d.z * 7.3 + 5);
    return 0.08 + 0.92 * THREE.MathUtils.smoothstep(c, 0.36, 0.7);
  };
}

/** A direction from `direction`, rejected until the clumping field accepts it (or not, for the even share). */
function clumpedDirection(r: Rng, gather: { share: number; spread: number }, basis: [THREE.Vector3, THREE.Vector3],
  keep: (d: THREE.Vector3) => number, out: THREE.Vector3): THREE.Vector3 {
  const clumped = r.next() < CLUMPED;
  for (let tries = 0; tries < 24; tries++) {
    direction(r, gather, basis, out);
    if (!clumped || r.next() < keep(out)) break;
  }
  return out;
}

export function buildFarStars(): StarLayer {
  const [r, l, p, tint, basis, keep] = [rng(101), layer(COUNT.far), new THREE.Vector3(), new THREE.Color(), frontBasis(), clumping(111)];
  for (let i = 0; i < COUNT.far; i++) {
    clumpedDirection(r, FAR_GATHER, basis, keep, p);
    const b = brightness(r, 0.012, 0.55);
    writeStar(l, i, p, starTint(r, tint), b, spriteSize(b, r), r.next());
  }
  return l;
}

export function buildWorldStars(): StarLayer {
  const [r, l, p, tint, basis, keep] = [rng(202), layer(COUNT.world), new THREE.Vector3(), new THREE.Color(), frontBasis(), clumping(222)];
  for (let i = 0; i < COUNT.world; i++) {
    clumpedDirection(r, WORLD_GATHER, basis, keep, p);
    // Denser near the clear ball: the near stars are the ones that parallax.
    p.multiplyScalar(CLEAR_RADIUS + (WORLD_REACH - CLEAR_RADIUS) * Math.pow(r.next(), 1.7)).add(SET_CENTRE);
    const b = brightness(r, 0.02, 0.6);
    writeStar(l, i, p, starTint(r, tint), b, spriteSize(b, r), r.next());
  }
  return l;
}

/** Dust: a unit box of positions (the shader scales and wraps it), dim and cool. */
export function buildDust(): DustLayer {
  const r = rng(303);
  const l: DustLayer = { ...layer(COUNT.dust), velocity: new Float32Array(COUNT.dust * 3) };
  const [p, tint] = [new THREE.Vector3(), new THREE.Color()];
  for (let i = 0; i < COUNT.dust; i++) {
    p.set(r.next(), r.next(), r.next());
    tint.copy(C.white).lerp(C.sky, 0.3 + 0.5 * r.next());
    writeStar(l, i, p, tint, 0.022 + 0.035 * Math.pow(r.next(), 2), 4 + r.next(), r.next());
    l.velocity.set([r.gauss() * 0.06, r.gauss() * 0.03 + 0.02, r.gauss() * 0.06], i * 3);
  }
  return l;
}

// ── Nebula noise volume ───────────────────────────────────────────────────
/** Lattice cells per side. The noise repeats every NOISE_CELLS units: far past anything one sky samples twice. */
export const NOISE_CELLS = 32;

/**
 * A lattice of random values, four independent channels. The GPU's trilinear
 * filter interpolates it and the shader bends the fraction through a
 * smoothstep, which turns one fetch into one octave of smooth value noise —
 * no per-pixel hashing and no JS-side noise evaluation, so it bakes in ~1ms.
 */
export function bakeNoiseVolume(): THREE.Data3DTexture {
  const r = rng(404);
  const data = new Uint8Array(NOISE_CELLS ** 3 * 4);
  for (let i = 0; i < data.length; i++) data[i] = Math.floor(r.next() * 256);
  const tex = new THREE.Data3DTexture(data, NOISE_CELLS, NOISE_CELLS, NOISE_CELLS);
  return Object.assign(tex, {
    format: THREE.RGBAFormat, type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, wrapR: THREE.RepeatWrapping,
    generateMipmaps: false, unpackAlignment: 1, needsUpdate: true,
  });
}
