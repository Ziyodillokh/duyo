/**
 * Scroll → state. The one clock the page and the 3D scene share.
 *
 * The page layer paints the background colour and chooses text colours; the
 * scene layer lights the galaxy and moves the camera. If they computed
 * "how dark is it" separately, the background would go navy while the galaxy
 * was still faint, or the copy would turn white on a paper ground. So both
 * read darkness from here.
 */

import { SECTIONS } from '../content';

export const SECTION_COUNT = SECTIONS.length;

/** Page scroll as 0..1 over the whole document. */
export function readScroll(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}

/** Smooth 0→1 between a and b. */
export function ramp(x: number, a: number, b: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Scroll position at which section `i` is centred in the viewport. */
export const sectionCentre = (i: number): number =>
  SECTION_COUNT > 1 ? i / (SECTION_COUNT - 1) : 0;

/**
 * Which two sections p sits between, and how far from the first to the
 * second — with a HOLD around each centre, so a section's state is steady
 * while you are actually reading it and the change happens in the gap.
 */
export function between(p: number): { a: number; b: number; k: number } {
  const span = SECTION_COUNT - 1;
  const x = Math.min(span, Math.max(0, p * span));
  const a = Math.min(span - 1, Math.floor(x));
  const local = x - a; // 0 at centre a, 1 at centre b
  // Hold the first and last 22% of each gap on the nearer section.
  const k = ramp(local, 0.22, 0.78);
  return { a, b: a + 1, k };
}

/** 0 on a light section, 1 on a dark one, eased through the gap. */
export function darknessAt(p: number): number {
  const { a, b, k } = between(p);
  const da = SECTIONS[a].theme === 'dark' ? 1 : 0;
  const db = SECTIONS[b].theme === 'dark' ? 1 : 0;
  return da + (db - da) * k;
}

/** Linear blend of two hex colours, for the page ground. */
export function mixHex(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const x = (pa >> shift) & 255;
    const y = (pb >> shift) & 255;
    return Math.round(x + (y - x) * k);
  };
  const out = (ch(16) << 16) | (ch(8) << 8) | ch(0);
  return `#${out.toString(16).padStart(6, '0')}`;
}
