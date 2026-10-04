/**
 * How a scene answers the visitor, the same on every page: the scroll it
 * follows, the parallax the pointer gives the camera, the light that turns
 * with the hand, and the footer's lift at the film's end.
 */

import type * as THREE from 'three';
import { ramp } from './timeline';
import type { Viewport } from './viewport';

type V3 = readonly [number, number, number];

/** Longest frame time the eases will integrate over, in seconds. */
export const MAX_DT = 0.1;

/**
 * What the pointer does, and all it does: the camera drifts a little after
 * the hand, so near stars slide past far ones (depth, with inertia), and
 * the studio reflected in DUYO's gloss turns with it. Nothing follows the
 * cursor and nothing flashes — the owner found cursor effects childish.
 */
const PARALLAX_X = 0.42;
const PARALLAX_Y = 0.26;
const ENV_TURN_X = 0.12;
const ENV_TURN_Y = 0.38;

/**
 * Scroll smoothing per 60Hz frame. A jump (End, a nav link, a hard flick)
 * would leave the scene mid-transition under copy that has already arrived,
 * so the rate rises with the gap (whole-page scroll, 0..1) — smoothly, as a
 * step would show as a brake. A wheel notch keeps the gentle rate.
 */
const SCROLL_EASE = 0.14;
const FLICK_EASE = 0.35;
const FLICK_GAP_FROM = 0.03;
const FLICK_GAP_TO = 0.12;

/** The smoothed scroll's next value: a flicked wheel lands over a few frames, which is the difference between a cut and a move. */
export function followScroll(current: number, target: number, ease: (perFrame: number) => number, motion: number): number {
  const gap = target - current;
  const rate = SCROLL_EASE + (FLICK_EASE - SCROLL_EASE) * ramp(Math.abs(gap), FLICK_GAP_FROM, FLICK_GAP_TO);
  return current + gap * (motion ? ease(rate) : 1);
}

/**
 * The camera at the director's shot, with the pointer's parallax on top.
 * Past the film's end the footer scrolls in (phone width): the last shot
 * rides up with the page, as if printed on it, instead of the caption
 * sliding over a subject that stays put — camera and target drop together
 * by the scrolled px, converted at the subject's depth. The studio the
 * glossy parts reflect turns a little with the hand, so light glides
 * across DUYO's visor and helmet: a product shot's move, not an effect.
 */
export function placeCamera(
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  page: Viewport,
  pos: V3,
  look: V3,
  px: number,
  py: number,
): void {
  const depth = Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]);
  const lift = page.tail > 0 ? ((2 * page.tail) / page.height) * Math.tan((camera.fov * Math.PI) / 360) * depth : 0;
  camera.position.set(pos[0] + px * PARALLAX_X, pos[1] - py * PARALLAX_Y - lift, pos[2]);
  scene.environmentRotation.set(-py * ENV_TURN_X, px * ENV_TURN_Y, 0);
  camera.lookAt(look[0], look[1] - lift, look[2]);
}

/** Longest wait for shaders before drawing anyway: a context lost mid-compile never reports ready. */
export const COMPILE_WAIT_MS = 4000;

/** Hand the main thread back: a tap that lands during start-up is served now. */
export const nextTask = (ms = 0): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));
