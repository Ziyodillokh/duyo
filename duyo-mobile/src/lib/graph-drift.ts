/**
 * Restless drift for the brain map's bodies.
 *
 * The layout in `galaxy-layout.ts` is deterministic and static by design — the
 * child returns to a sky they recognise. This adds a small, never-repeating
 * wobble ON TOP of those fixed positions: the map reads as alive rather than
 * as a printed diagram, while the constellation a child memorised stays where
 * they left it.
 *
 * Two sine waves per axis at incommensurate frequencies. One sine is a visible
 * metronome — everything sways in lockstep and the sky looks mechanical; two
 * that never line up read as drift. Frequency and phase come from a hash of
 * the node's title, so every body moves differently AND the same note moves
 * the same way on every device and every launch.
 *
 * Amplitude is deliberately small (`DRIFT_PX`). The touch targets in
 * `note-graph.tsx` sit at the STATIC layout position, so drift is a visual
 * offset the finger never has to chase: at this amplitude the dot never leaves
 * its own hit area (the smallest is 24pt across), which is what lets the map
 * move without becoming harder to tap.
 */

/** Peak offset in points. Kept well inside the smallest touch radius. */
export const DRIFT_PX = 4.5;

/** Radians per second. Slow enough to read as floating, not vibrating. */
const BASE_SPEED = 0.22;
const SPEED_SPREAD = 0.18;

/** Same FNV-1a as galaxy-layout's tag colours — stable across devices. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface DriftSeed {
  phaseX: number;
  phaseY: number;
  speedX: number;
  speedY: number;
  /** Second, faster wave — what stops the motion reading as a metronome. */
  phaseX2: number;
  phaseY2: number;
}

export function driftSeed(title: string): DriftSeed {
  const h = hash(title);
  // Independent slices of the hash, so x and y are not the same wave shifted.
  const a = (h & 0xff) / 255;
  const b = ((h >>> 8) & 0xff) / 255;
  const c = ((h >>> 16) & 0xff) / 255;
  const d = ((h >>> 24) & 0xff) / 255;
  return {
    phaseX: a * Math.PI * 2,
    phaseY: b * Math.PI * 2,
    speedX: BASE_SPEED + c * SPEED_SPREAD,
    speedY: BASE_SPEED + d * SPEED_SPREAD,
    phaseX2: c * Math.PI * 2,
    phaseY2: d * Math.PI * 2,
  };
}

/**
 * Offset for one body at time `t` (seconds).
 *
 * The second wave runs at an irrational-ish multiple (1.618) of the first, so
 * the pair has no short common period and the path never visibly repeats.
 * Weights sum to 1, keeping the peak at exactly `amp`.
 */
export function driftAt(
  seed: DriftSeed,
  t: number,
  amp: number = DRIFT_PX,
): { dx: number; dy: number } {
  const dx =
    amp *
    (0.62 * Math.sin(t * seed.speedX + seed.phaseX) +
      0.38 * Math.sin(t * seed.speedX * 1.618 + seed.phaseX2));
  const dy =
    amp *
    (0.62 * Math.cos(t * seed.speedY + seed.phaseY) +
      0.38 * Math.cos(t * seed.speedY * 1.618 + seed.phaseY2));
  return { dx, dy };
}
