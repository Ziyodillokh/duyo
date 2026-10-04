/**
 * Framing: where the camera stands so a subject fits the room the copy
 * leaves it — beside the copy on a wide screen, in the band above it on a
 * phone held upright. Shared by both films (scene/director.ts for the home
 * page, robot/director.ts for the robot page): each says what its shots
 * frame, this says where the camera goes. Pure; nothing here touches
 * three.js.
 */

import { ramp } from './timeline';

export type V3 = [number, number, number];
/** Half the subject's width and height, in world units. */
export interface Half {
  w: number;
  h: number;
}
/** A finished shot: where the camera looks and where it stands. */
export interface Shot {
  look: V3;
  pos: V3;
}

/** A span of the screen in normalised units: its centre and half its size. */
export interface Band {
  centre: number;
  half: number;
}

/**
 * The space the copy leaves free in one section, in normalised screen x
 * (−1 left edge, +1 right edge): its centre and half its width. Measured
 * from the DOM by the runtime, so the subject fits whatever the page's
 * layout actually is at this width, instead of a guess per breakpoint.
 */
export interface SectionFrame extends Band {
  /**
   * Stacked (phone) layouts only: the free band between the nav and the top
   * of the copy, in normalised screen y (+1 top), as centre and half height.
   */
  band?: Band;
}

export interface View {
  aspect: number;
  fovDeg: number;
  /** The page stacks copy under the subject (phone width). */
  stacked: boolean;
  /** One per section; absent until measured. */
  frames?: readonly SectionFrame[];
  /**
   * Side by side: the share of the canvas's height, from its top, that shows
   * with the browser's bars in (100svh over the canvas's 100lvh). The shot
   * is fitted and centred in it, so a phone held sideways never has the
   * subject's feet under its bars. 1, or absent, where there are no bars.
   */
  visible?: number;
}

/** Fill at most this much of the free space, so nothing touches an edge. */
const FIT_W = 0.92;
/** …and of the height, which leaves the floating nav clear. */
const FIT_H = 0.8;
/** Until the copy is measured: subject centred a third of the way to its side. */
const FALLBACK_HALF = 0.55;
/** Until measured: the band from just under the nav to a little above the middle. */
const FALLBACK_BAND: Band = { centre: 0.47, half: 0.35 };
/** Stacked: the subject may use this much of the band's height. */
const STACKED_FIT_H = 0.9;
/**
 * A band shorter than this cannot hold anything anyone could see. A phone
 * held sideways leaves a sliver between the nav and the copy, and fitting
 * into it pushed the camera out to a 20 px speck. Below SLIVER the subject
 * takes the whole height under the nav instead, at an ordinary distance —
 * behind the copy's scrim while it is read, whole as it scrolls away. Up to
 * ROOMY the two blend, so a band that changes with the URL bar never flips
 * the shot. Measured over the screen's short side: in effect ~50 and ~75 px.
 */
const SLIVER = 0.14;
const ROOMY = 0.2;

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const lerp3 = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const length = (a: V3) => Math.hypot(a[0], a[1], a[2]);

/**
 * The band a stacked shot is framed in. A sliver becomes the whole height
 * under the nav: the band's top mirrored about the middle of the screen, so
 * the top edge — the nav's clearance — stays where it was measured all the
 * way through the blend.
 */
function usableBand(band: Band, aspect: number): Band {
  const top = band.centre + band.half;
  const k = ramp(band.half / Math.min(1, aspect), SLIVER, ROOMY);
  return { centre: lerp(0, band.centre, k), half: lerp(top, band.half, k) };
}

/**
 * How far camera and target must drop together so that `point` lands at
 * screen height `ndcY`. Dropping both keeps the camera's orientation, so the
 * point's height and depth in camera space each change linearly with the
 * drop, and the answer is exact at the point's own depth.
 */
export function dropOnto(point: V3, target: V3, toCam: V3, tanHalf: number, ndcY: number): number {
  const reach = length(toCam);
  const fwd = scale(toCam, -1 / reach);
  // A lookAt camera's up is world +y with its share along fwd removed.
  const cosPitch = Math.sqrt(1 - fwd[1] * fwd[1]);
  const d = sub(point, target);
  const along = d[0] * fwd[0] + d[1] * fwd[1] + d[2] * fwd[2];
  const depth = reach + along;
  const height = (d[1] - fwd[1] * along) / cosPitch;
  const slope = ndcY * tanHalf;
  return (slope * depth - height) / (cosPitch - slope * fwd[1]);
}

/** How far back the camera must stand, and where on screen the subject goes. */
interface Fit {
  want: number;
  /** Stacked: the subject's middle in screen y. Side by side: in screen x. */
  at: number;
}

/** A phone screen stacks the copy under the subject: fit it into the band above. */
function fitStacked(view: View, i: number, half: Half, tanHalf: number): Fit {
  const band = usableBand(view.frames?.[i]?.band ?? FALLBACK_BAND, view.aspect);
  const bandHalf = Math.max(0.12, band.half);
  const want = Math.max(
    half.w / (FIT_W * tanHalf * view.aspect),
    half.h / (STACKED_FIT_H * tanHalf * bandHalf),
  );
  return { want, at: band.centre };
}

/**
 * Side by side: the camera backs off until the subject fits the space the
 * copy leaves. `shift` places it until the copy is measured: +1 right.
 */
function fitSide(view: View, i: number, half: Half, tanHalf: number, shift: number): Fit {
  const frame = view.frames?.[i] ?? { centre: 0.34 * shift, half: FALLBACK_HALF };
  const frameHalf = Math.max(0.2, frame.half);
  const want = Math.max(
    half.w / (frameHalf * FIT_W * tanHalf * view.aspect),
    half.h / (FIT_H * tanHalf * (view.visible ?? 1)),
  );
  return { want, at: frame.centre };
}

/**
 * Side by side: across to the subject's side of the screen, and down so its
 * middle sits in the middle of the part the bars leave showing (screen y
 * 1 − visible), which with no bars is the middle of the screen.
 */
function sideSlide(mid: V3, target: V3, toCam: V3, at: number, view: View, tanHalf: number): V3 {
  const visible = view.visible ?? 1;
  const across = -at * length(toCam) * tanHalf * view.aspect;
  if (visible >= 1) return [across, 0, 0];
  const moved = add(target, [across, 0, 0]);
  return [across, -dropOnto(mid, moved, toCam, tanHalf, 1 - visible), 0];
}


/** What a shot frames: its subject's middle and half-extents, and the camera's offset from it. */
export interface Subject {
  mid: V3;
  half: Half;
  /** Camera offset from the subject's middle; its length is the least distance. */
  cam: V3;
  /** Look-target offset from the subject's middle. */
  look: V3;
  /** Which side it takes until the copy is measured: +1 right (copy on the left), −1 left. */
  shift: number;
}

/**
 * Section i's finished shot of a subject: the camera stands back along its
 * offset until the subject fits the room the copy leaves (beside it, or in
 * the band above it on a phone), then camera and target move together to
 * put the subject in that room. `extra` is added to the offset before the
 * fit scales it, so a pull-out survives wherever the fit sets the distance.
 */
export function frameShot(view: View, i: number, subject: Subject, tanHalf: number, extra: V3 = [0, 0, 0]): Shot {
  const { mid, half } = subject;
  const rel = sub(subject.cam, subject.look);
  const dist = length(rel);
  const fit = view.stacked ? fitStacked(view, i, half, tanHalf) : fitSide(view, i, half, tanHalf, subject.shift);
  const want = Math.max(dist, fit.want);
  const toCam = scale(add(rel, extra), want / dist);
  const target = add(mid, subject.look);
  const slide: V3 = view.stacked
    ? [0, -dropOnto(mid, target, toCam, tanHalf, fit.at), 0]
    : sideSlide(mid, target, toCam, fit.at, view, tanHalf);
  const look = add(target, slide);
  return { look, pos: add(look, toCam) };
}
