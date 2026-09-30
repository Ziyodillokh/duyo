/**
 * The page ground's colour for a given darkness.
 *
 * A straight sRGB blend of paper and space passes through a flat, dead grey
 * (#7b7c82) halfway — the one frame of the page that looked cheap. Here the
 * blend runs through PALETTE.navy in OKLab instead (paper → navy → space), so
 * the light-to-dark change reads as a blue dusk: slate, then navy, then deep
 * space. Every stop is a PALETTE colour; only the path between them changed.
 *
 * Darkness itself still comes from scene/timeline.ts, so the ground and the
 * 3D scene agree on how dark it is; this only chooses the colour at that
 * darkness. The ramp is precomputed once into STEPS strings, so the scroll
 * handler indexes a table and never builds a string per frame.
 */

import { PALETTE } from '../scene/contract';

/** Distinct ground colours along the ramp — finer than 8-bit colour steps. */
export const GROUND_STEPS = 256;

type Lab = readonly [number, number, number];

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToOklab(hex: string): Lab {
  const n = parseInt(hex.slice(1), 16);
  const r = toLinear(((n >> 16) & 255) / 255);
  const g = toLinear(((n >> 8) & 255) / 255);
  const b = toLinear((n & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToHex([L, A, B]: Lab): string {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const byte = (v: number) => Math.round(Math.min(1, Math.max(0, toGamma(v))) * 255);
  return `#${rgb.map((v) => byte(v).toString(16).padStart(2, '0')).join('')}`;
}

const lerpLab = (a: Lab, b: Lab, t: number): Lab => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Where on the ramp the ground is exactly PALETTE.navy. */
const NAVY_AT = 0.5;

function buildRamp(): readonly string[] {
  const paper = hexToOklab(PALETTE.paper);
  const navy = hexToOklab(PALETTE.navy);
  const space = hexToOklab(PALETTE.space);
  return Array.from({ length: GROUND_STEPS }, (_, i) => {
    const d = i / (GROUND_STEPS - 1);
    const lab = d <= NAVY_AT
      ? lerpLab(paper, navy, d / NAVY_AT)
      : lerpLab(navy, space, (d - NAVY_AT) / (1 - NAVY_AT));
    return oklabToHex(lab);
  });
}

const RAMP = buildRamp();

/** Index into the ramp for a darkness in 0..1 — compare these, not floats. */
export const groundStep = (darkness: number): number =>
  Math.round(Math.min(1, Math.max(0, darkness)) * (GROUND_STEPS - 1));

/** The ground colour at a ramp index from groundStep. */
export const groundAt = (step: number): string => RAMP[step];
