/**
 * What the scene reads from outside itself: where each section's copy
 * leaves room for the subject, and how the visitor is holding the device.
 *
 * The copy is measured on load, when fonts land and on resize — never per
 * frame — and handed to the director as View.frames, one SectionFrame per
 * section in the order of SECTIONS.
 */

import { SECTIONS } from '../content';
import { smallViewportHeight } from '../ui/layout';
import type { SectionFrame } from './director';

/** Clearance between the copy and the subject, and from the screen edges, in px. */
const COPY_GAP_PX = 32;
const EDGE_PX = 40;
/** The section rail on the right edge. */
const RAIL_PX = 56;
/** Clearance under the nav and above the copy on a stacked screen, in px. */
const BAND_GAP_PX = 14;

/**
 * How far the transforms on `from` and its ancestors, up to `stop`, have
 * moved it, in px. The copy rises into place (page.css `.rv`): 14px low
 * until its section arrives, and part way while it does. Measured as it is
 * drawn, every section not yet on screen came out 14px low, and the next
 * resize moved the subject while it was being read. Subtracting this gives
 * where the copy rests, without touching the entrance — clearing it for the
 * measurement would cut short one that is playing. Translations only:
 * nothing in the copy scales or turns.
 */
function shiftOf(from: Element | null, stop: Element): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (let el = from; el; el = el.parentElement) {
    const t = getComputedStyle(el).transform;
    if (t !== 'none') {
      const m = new DOMMatrixReadOnly(t);
      x += m.m41;
      y += m.m42;
    }
    if (el === stop) break;
  }
  return { x, y };
}

/**
 * The extent of what is actually drawn in a copy block, at rest: its text
 * lines and its buttons. The block's own box is a column that can run well
 * past its last word, which would push the subject further than it needs.
 */
function inkExtent(copy: Element): { left: number; right: number; top: number } | null {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  const take = (r: DOMRect, shift: { x: number; y: number }) => {
    if (r.width === 0) return;
    left = Math.min(left, r.left - shift.x);
    right = Math.max(right, r.right - shift.x);
    top = Math.min(top, r.top - shift.y);
  };
  const range = document.createRange();
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim()) continue;
    range.selectNodeContents(n);
    const shift = shiftOf(n.parentElement, copy);
    for (const r of range.getClientRects()) take(r, shift);
  }
  copy.querySelectorAll('a, button').forEach((el) => take(el.getBoundingClientRect(), shiftOf(el, copy)));
  return right > left ? { left, right, top } : null;
}

/**
 * Stacked (phone) layout: the copy sits under the subject, and how tall it
 * is differs per section, so each section's free band — from the nav's
 * bottom to its copy's first line — is measured, in the canvas's own height
 * (screen y is canvas y: both start at the top). A pinned caption is where
 * it shows whenever its section is on screen; the last section's copy is in
 * the flow, and its offset from the section top is where it sits once the
 * section has arrived.
 */
export function measureBands(canvasHeight: number): SectionFrame[] {
  const toNdc = (y: number) => 1 - (y / canvasHeight) * 2;
  const navBottom = document.querySelector('header nav')?.getBoundingClientRect().bottom ?? 60;
  // A pinned caption rides up with the browser's bars sliding in, so the
  // band is measured where it is shortest, bars in: their coming back can
  // then only give the subject more room, never put the words over it.
  const barsOut = Math.max(0, window.innerHeight - smallViewportHeight());
  return SECTIONS.map((section) => {
    const el = document.getElementById(section.id);
    const copy = el?.querySelector('.copy');
    const ink = copy ? inkExtent(copy) : null;
    if (!el || !copy || !ink) return { centre: 0, half: 1 };
    const pinned = getComputedStyle(copy).position === 'fixed';
    const copyTop = pinned ? ink.top - barsOut : ink.top - el.getBoundingClientRect().top;
    const [top, bottom] = [toNdc(navBottom + BAND_GAP_PX), toNdc(copyTop - BAND_GAP_PX)];
    return { centre: 0, half: 1, band: { centre: (top + bottom) / 2, half: Math.max(0, (top - bottom) / 2) } };
  });
}

/**
 * Side-by-side layout: the horizontal span each section's copy leaves free,
 * in the canvas's own width. It does not change with scroll.
 */
export function measureFrames(w: number): SectionFrame[] {
  const toNdc = (x: number) => (x / w) * 2 - 1;
  return SECTIONS.map((section) => {
    const copy = document.querySelector(`#${section.id} .copy`);
    const ink = copy ? inkExtent(copy) : null;
    if (!ink || section.layout === 'center') return { centre: 0, half: 1 };
    const [lo, hi] =
      section.layout === 'left'
        ? [toNdc(ink.right + COPY_GAP_PX), toNdc(w - RAIL_PX)]
        : [toNdc(EDGE_PX), toNdc(ink.left - COPY_GAP_PX)];
    return { centre: (lo + hi) / 2, half: Math.max(0, (hi - lo) / 2) };
  });
}

// ── Device tilt ───────────────────────────────────────────────────────────

/** Tilt, in degrees from where the device is held, that takes the parallax to its edge. */
const TILT_RANGE_DEG = 40;
/** How fast "where it is held" follows a new grip, in seconds: a lean is parallax, a new grip is not. */
const TILT_RECENTRE_S = 3;
const RAD = Math.PI / 180;

/**
 * Device tilt as the screen sees it, in degrees: how far its right edge has
 * dipped (x) and its top edge has come up (y). Taken from the direction of
 * gravity, not the raw angles: beta and gamma swap roles when the screen
 * turns to landscape, and gamma wraps from −90 to +90 as a landscape device
 * passes upright — either would throw the scene to the opposite extreme.
 */
function screenTilt(beta: number, gamma: number, screenAngle: number): [number, number] {
  const [b, g, a] = [beta * RAD, gamma * RAD, screenAngle * RAD];
  // "Up" in the device's own axes: x right, y top, z out of the display.
  const ux = -Math.cos(b) * Math.sin(g);
  const uy = Math.sin(b);
  const uz = Math.cos(b) * Math.cos(g);
  // The same vector in the screen's axes, which turn with the content.
  const sx = ux * Math.cos(a) - uy * Math.sin(a);
  const sy = ux * Math.sin(a) + uy * Math.cos(a);
  return [Math.atan2(-sx, Math.hypot(sy, uz)) / RAD, Math.atan2(sy, uz) / RAD];
}

export interface TiltReader {
  /** A parallax target, −1..1 each way like the pointer's, or null for an empty reading. */
  read: (e: DeviceOrientationEvent) => [number, number] | null;
  /** Take the next reading as the neutral hold. */
  recentre: () => void;
}

/**
 * Tilt measured from where the device is held, not from a fixed angle. The
 * hold follows a new grip over a few seconds, so any comfortable one — flat
 * on a desk, upright, sideways — is the neutral view, and it re-centres at
 * once when the screen rotates.
 */
export function createTiltReader(): TiltReader {
  let baseX = 0;
  let baseY = 0;
  let lastX = 0;
  let lastY = 0;
  let lastAngle: number | null = null;
  let lastAt = 0;
  const toTarget = (deg: number) => Math.max(-1, Math.min(1, deg / TILT_RANGE_DEG));
  return {
    read(e) {
      if (e.gamma == null || e.beta == null) return null;
      const angle = window.screen.orientation?.angle ?? 0;
      const [x, y] = screenTilt(e.beta, e.gamma, angle);
      const now = performance.now();
      // The hold drifts towards the reading held SINCE the last event, not
      // this one: a still device can go quiet, and a tilt after a long pause
      // would otherwise be absorbed into the hold at once.
      // A first reading, or a rotated screen, is the new hold outright.
      const held = angle === lastAngle;
      const k = held ? 1 - Math.exp(-(now - lastAt) / 1000 / TILT_RECENTRE_S) : 1;
      baseX += ((held ? lastX : x) - baseX) * k;
      baseY += ((held ? lastY : y) - baseY) * k;
      lastX = x;
      lastY = y;
      lastAngle = angle;
      lastAt = now;
      return [toTarget(x - baseX), toTarget(y - baseY)];
    },
    recentre() {
      lastAngle = null;
    },
  };
}
