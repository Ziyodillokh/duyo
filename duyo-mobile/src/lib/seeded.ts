/**
 * The two deterministic primitives the sky is built on.
 *
 * Nothing in the brain map may ever call Math.random(): a note keeps its
 * planet, its colour and now its rhythm forever, on every device, or the map
 * stops being a place the child recognises. These were copied into three
 * files; they live here now so the three can never disagree.
 */

/** Stable 32-bit hash of a string. */
export function hash32(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic 0..1 from an integer — mulberry32's mixing step. */
export function rand01(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
