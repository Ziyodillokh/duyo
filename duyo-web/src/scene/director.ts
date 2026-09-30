/**
 * The choreography: scroll position → where everything is.
 *
 * A pure function of scroll (and viewport aspect) so the whole film can be
 * reasoned about, and scrubbed in both directions with identical results.
 * Nothing in here touches three.js objects; Scene3D applies what this returns.
 *
 * The five sections, and what the camera does in each:
 *
 *   0 boshlash    light  copy left; phone + robot on the right; the chat types in
 *   1 xavfsizlik  dark   camera swings round, subject on the left; a message is stopped
 *   2 miya        dark   subject on the right; the brain map's nodes leave the
 *                        screen and become the galaxy while the camera pulls out
 *   3 maqsad      dark   subject on the left; goal steps tick off
 *   4 yuklab      light  subject on the right, as at the start; the robot waves
 *
 * The copy zigzags left, right, left, right, left, and no section is centred:
 * copy scrolls with the page while the scene holds still, so centred copy
 * would pass straight across the phone.
 *
 * Between sections the phone turns a full revolution and the screen swaps
 * while its BACK faces the camera — the cut is hidden inside the move rather
 * than happening in plain sight. When the subject changes sides, the robot
 * hops across behind the turning phone, so it always stands on the side away
 * from the copy.
 */

import { PHONE_DIMS } from './contract';
import type { ScreenId } from './contract';
import { SECTION_COUNT, between, darknessAt, ramp } from './timeline';

type V3 = [number, number, number];

/** Where the pieces stand, in world units. */
export const PHONE_POS: V3 = [0, 0.25, 0];
/** The robot's height and depth; its x belongs to each section's key. */
export const ROBOT_Y = -0.3;
export const ROBOT_Z = -0.85;
export const ROBOT_SCALE = 0.62;

/** Galaxy centre and tilt — the rig sits inside the near edge of the disc. */
export const GALAXY_POS: V3 = [0, -1.6, -9];
export const GALAXY_TILT: V3 = [0.42, 0, 0.18];

/** A span of the screen in normalised units: its centre and half its size. */
interface Band {
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
}

/**
 * Half the width phone + robot need side by side, in world units, with margin.
 * DUYO's head and ears reach further from the pair's centre than the phone
 * does on the other side, and the pointer parallax swings them further
 * still; at 2.0 the hero's ear came within 4 px of the section rail.
 */
const SIDE_HALF_SPAN = 2.15;
/** Half their height, from the robot's feet to the phone's top. */
const SUBJECT_HALF_HEIGHT = 1.75;
/** Fill at most this much of the free space, so nothing touches an edge. */
const FIT_W = 0.92;
/** …and of the height, which leaves the floating nav clear. */
const FIT_H = 0.78;
/** Until the copy is measured: subject centred a third of the way right. */
const FALLBACK_HALF = 0.55;

/**
 * On a stacked (phone) screen the phone is what has to be read, so DUYO
 * stands in closer — its shoulder just behind the phone's edge — and the
 * pair needs this much less width. The phone comes out about a third larger.
 */
const STACKED_ROBOT_X = 0.6;
/** …and smaller, standing on the phone's bottom edge like a companion beside it. */
const STACKED_ROBOT_SCALE = 0.72;
/** Half the width phone + robot need on a stacked screen, with margin. */
const PORTRAIT_HALF_SPAN = 1.75;
/**
 * Half the height they need there: the phone's 1.6, which the robot stands
 * beside, plus its 0.06 hover bob, plus what the yaw and pitch add as its
 * near corner comes towards the camera (most as it turns edge-on in a gap),
 * plus its standing about 0.3 nearer the camera than the target the fit is
 * measured at. At 1.72 all of that came out of the band's 14 px gap, and
 * the phone's top met the nav.
 */
const STACKED_HALF_HEIGHT = 1.9;
/** Until measured: the band from just under the nav to a little above the middle. */
const FALLBACK_BAND: Band = { centre: 0.47, half: 0.35 };
/**
 * A band shorter than this cannot hold a phone anyone could read. A phone
 * held sideways leaves a sliver between the nav and the copy, and fitting
 * the subject into it pushed the camera out to about 50 units: a 20 px
 * speck. Below SLIVER the subject takes the whole height under the nav
 * instead, at an ordinary distance — behind the copy's scrim while it is
 * read, and whole as it scrolls away. Up to ROOMY the two blend, so a band
 * that changes size with the URL bar never flips the shot.
 *
 * Measured as the band's height over the screen's short side, which on any
 * phone is 320–430 px, so these are in effect pixel heights (about 50 and
 * 75 px). A fraction of the screen height would not do: 360x640 upright and
 * 740x360 sideways both leave a band 0.12 high, 75 px of room and 42.
 */
const SLIVER = 0.14;
const ROOMY = 0.2;
/** The phone's bottom edge, where the robot's feet go on a stacked screen. */
const PHONE_BOTTOM = PHONE_POS[1] - PHONE_DIMS.height / 2;
/** The robot's feet below its own origin at scale 1 (three/stage.ts FLOOR_Y). */
const FEET = -1.96;

/** The robot's hop when it changes sides: up, and back behind the phone's turn. */
const HOP_UP = 0.9;
const HOP_BACK = 1.4;

interface Key {
  /** World point the shot is built around — usually the middle of phone and robot. */
  centre: V3;
  /** Camera offset from centre. */
  cam: V3;
  /** Look-target offset from centre. */
  look: V3;
  /**
   * Which side the subject takes: +1 right (copy on the left), −1 left.
   * Only used until the copy has been measured; see SectionFrame.
   */
  shift: number;
  phoneYaw: number;
  phonePitch: number;
  /** Which side of the phone the robot stands on — always away from the copy. */
  robotX: number;
  robotYaw: number;
  /** 0 idle, 1 waving. */
  wave: number;
}

const RIGHT: V3 = [1.05, 0.05, -0.3];
const LEFT: V3 = [-1.05, 0.05, -0.3];

const KEYS: Key[] = [
  { centre: RIGHT, cam: [-0.2, 0.55, 9.4], look: [0, 0.05, 0], shift: 1, phoneYaw: -0.32, phonePitch: 0.04, robotX: 2.35, robotYaw: -0.2, wave: 0 },
  { centre: LEFT, cam: [1.9, 0.85, 9.0], look: [0, 0, 0], shift: -1, phoneYaw: 0.36, phonePitch: 0.02, robotX: -2.35, robotYaw: 0.45, wave: 0 },
  { centre: RIGHT, cam: [-0.9, 0.3, 9.6], look: [0, 0.1, 0], shift: 1, phoneYaw: -0.18, phonePitch: 0, robotX: 2.35, robotYaw: -0.5, wave: 0 },
  { centre: LEFT, cam: [1.6, 0.45, 8.6], look: [0, 0.05, 0], shift: -1, phoneYaw: 0.3, phonePitch: 0.03, robotX: -2.35, robotYaw: 0.35, wave: 0 },
  { centre: RIGHT, cam: [-0.7, 0.8, 10.2], look: [0, -0.05, 0], shift: 1, phoneYaw: -0.22, phonePitch: 0.03, robotX: 2.35, robotYaw: -0.15, wave: 1 },
];

/** Which app screen each section shows. */
const SCREENS: ScreenId[] = ['chat', 'safety', 'map', 'goals', 'home'];

export interface DirectorState {
  cameraPos: V3;
  cameraLook: V3;
  phoneYaw: number;
  phonePitch: number;
  robotPos: V3;
  /** Multiplies ROBOT_SCALE; below 1 on stacked (phone) screens. */
  robotScale: number;
  robotYaw: number;
  wave: number;
  /** Where the robot's head should look, in world space. */
  gaze: V3;
  screen: {
    from: ScreenId;
    to: ScreenId;
    mix: number;
    pFrom: number;
    pTo: number;
  };
  emergence: number;
  darkness: number;
  /** Index of the section nearest the viewport centre. */
  section: number;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp3 = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const length = (a: V3) => Math.hypot(a[0], a[1], a[2]);

/**
 * The band a stacked shot is framed in. A sliver becomes the whole height
 * under the nav: the band's top mirrored about the middle of the screen, so
 * the top edge — the nav's clearance — stays where it was measured all the
 * way through the blend.
 */
function usableBand(band: Band, aspect: number): Band {
  const top = band.centre + band.half;
  // half is the band's height over the screen's height (NDC spans 2);
  // divided by the aspect when upright, its height over the screen's width.
  const k = ramp(band.half / Math.min(1, aspect), SLIVER, ROOMY);
  return { centre: lerp(0, band.centre, k), half: lerp(top, band.half, k) };
}

/**
 * How far camera and target must drop together so that `point` lands at
 * screen height `ndcY`. Dropping both keeps the camera's orientation, so the
 * point's height and depth in camera space each change linearly with the
 * drop, and the answer is exact at the point's own depth. The phone stands
 * nearer the camera than the target, and higher, where the camera looks
 * down on it; placed as if it were at the target's depth it sat 10 px high.
 */
function dropOnto(point: V3, target: V3, toCam: V3, tanHalf: number, ndcY: number): number {
  const reach = length(toCam);
  const fwd = scale(toCam, -1 / reach);
  // A lookAt camera's up is world +y with its share along fwd removed.
  const cosPitch = Math.sqrt(1 - fwd[1] * fwd[1]);
  const d = sub(point, target);
  const along = d[0] * fwd[0] + d[1] * fwd[1] + d[2] * fwd[2];
  const depth = reach + along;
  const height = (d[1] - fwd[1] * along) / cosPitch;
  // After a drop s: height + s·cosPitch = ndcY·tanHalf·(depth + s·fwd.y).
  const slope = ndcY * tanHalf;
  return (slope * depth - height) / (cosPitch - slope * fwd[1]);
}

/** How far back the camera must stand, and where on screen the subject goes. */
interface Fit {
  want: number;
  /** Stacked: the phone's centre in screen y. Side by side: the pair's centre in screen x. */
  at: number;
}

/**
 * A phone screen has no side for the copy — it sits under the subject. So
 * phone and robot are fitted into the measured band between the nav and the
 * top of the copy: the camera backs off until they fit its width and height.
 */
function fitStacked(view: View, a: number, b: number, k: number, dist: number, tanHalf: number): Fit {
  const ba = usableBand(view.frames?.[a]?.band ?? FALLBACK_BAND, view.aspect);
  const bb = usableBand(view.frames?.[b]?.band ?? FALLBACK_BAND, view.aspect);
  const bandHalf = Math.max(0.12, lerp(ba.half, bb.half, k));
  const want = Math.max(
    dist,
    PORTRAIT_HALF_SPAN / (tanHalf * view.aspect),
    STACKED_HALF_HEIGHT / (tanHalf * bandHalf),
  );
  return { want, at: lerp(ba.centre, bb.centre, k) };
}

/** Side by side: the camera backs off until the pair fits the space the copy leaves. */
function fitSide(view: View, a: number, b: number, k: number, dist: number, tanHalf: number): Fit {
  const fa = view.frames?.[a] ?? { centre: 0.34 * KEYS[a].shift, half: FALLBACK_HALF };
  const fb = view.frames?.[b] ?? { centre: 0.34 * KEYS[b].shift, half: FALLBACK_HALF };
  const frameHalf = Math.max(0.2, lerp(fa.half, fb.half, k));
  const want = Math.max(
    dist,
    SIDE_HALF_SPAN / (frameHalf * FIT_W * tanHalf * view.aspect),
    SUBJECT_HALF_HEIGHT / (FIT_H * tanHalf),
  );
  return { want, at: lerp(fa.centre, fb.centre, k) };
}

/**
 * How far through section i's own reading window p is: 0 as it arrives,
 * 1 as it leaves. The screen animations are scrubbed by this, so a message
 * types in while its section is actually on screen.
 */
function localProgress(p: number, i: number): number {
  const span = SECTION_COUNT - 1;
  // Section i occupies [i − 0.5, i + 0.5] in section units; clamp at the ends
  // so the first and last sections still get a full 0..1.
  const x = p * span;
  const lo = i === 0 ? 0 : i - 0.5;
  const hi = i === span ? span : i + 0.5;
  return Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
}

/** Scroll-scrubbed progress for a screen's animation within its section. */
const screenProgress = (p: number, i: number) => ramp(localProgress(p, i), 0.08, 0.66);

/**
 * @param intro 0..1, time-driven, for the hero only: the page must not open on
 *   an empty chat, so the first exchange plays on load and scroll takes over
 *   from there. Pass 1 under reduced motion to show the finished state.
 */
export function direct(p: number, view: View, intro = 1, spinEnabled = true): DirectorState {
  const { aspect, fovDeg, stacked } = view;
  const { a, b, k } = between(p);
  const ka = KEYS[a];
  const kb = KEYS[b];

  const pullIn = stacked ? STACKED_ROBOT_X : 1;
  const keyCentre = lerp3(ka.centre, kb.centre, k);
  const centre: V3 = [keyCentre[0] * pullIn, keyCentre[1], keyCentre[2]];
  const camOff = lerp3(ka.cam, kb.cam, k);
  const lookOff = lerp3(ka.look, kb.look, k);

  // The nodes leave the phone while section 2 is on screen. localProgress
  // clamps to 1 past the section, so once they are out they STAY out — no
  // separate "held" state, which is what made them all appear at once.
  // It starts just past the section's centre, so the map screen is clean
  // while the visitor reads it, and the nodes leave as they scroll on.
  const emergence = ramp(localProgress(p, 2), 0.5, 0.88);

  // Section 2's camera pulls out as the nodes leave, so the reveal of the
  // galaxy and the nodes arriving in it are one motion. It hands back to
  // section 3's own framing across the 2→3 gap.
  const pullOut = a === 2 ? emergence * (1 - k) : b === 2 ? emergence : 0;
  const pull: V3 = [0, 0.6 * pullOut, 6 * pullOut];

  // Framing. Moving camera and target together by the same amount slides
  // the subject across the frame without changing the angle on it; moving
  // the camera back along its own line shrinks it without changing the shot.
  // Each key's distance is a minimum: at a width where the free space is
  // narrow, the camera backs off until phone and robot fit inside it.
  const tanHalf = Math.tan((fovDeg * Math.PI) / 360);
  const rel = sub(camOff, lookOff);
  const dist = length(rel);
  const fit = (stacked ? fitStacked : fitSide)(view, a, b, k, dist, tanHalf);
  // The pull-out goes on after the fit, scaled with it. Folded into the
  // key's distance first, it was lost inside the fit wherever the free space
  // is narrow — on a portrait tablet the camera held still while the nodes
  // left. Where the key's own distance wins (desktop) this is the same shot.
  const toCam = scale(add(rel, pull), fit.want / dist);
  const target = add(centre, lookOff);
  // Stacked: drop camera and target together until the phone's centre sits
  // on the band's centre. Side by side: slide them until the pair's centre
  // sits on the free space's centre.
  const shift: V3 = stacked
    ? [0, -dropOnto(PHONE_POS, target, toCam, tanHalf, fit.at), 0]
    : [-fit.at * length(toCam) * tanHalf * aspect, 0, 0];

  const cameraLook = add(target, shift);
  const cameraPos = add(cameraLook, toCam);

  // Changing sides, the robot hops: up, and back far enough to clear the
  // phone's turn, facing the way it is going.
  const dx = kb.robotX - ka.robotX;
  const travel = Math.abs(dx) > 0.01 ? Math.sin(k * Math.PI) : 0;
  const robotScale = stacked ? STACKED_ROBOT_SCALE : 1;
  // Feet on the phone's bottom edge when smaller, rather than floating up.
  const standY = stacked ? PHONE_BOTTOM - FEET * ROBOT_SCALE * robotScale : ROBOT_Y;
  const robotPos: V3 = [lerp(ka.robotX, kb.robotX, k) * pullIn, standY + travel * HOP_UP, ROBOT_Z - travel * HOP_BACK];
  const robotYaw = lerp(ka.robotYaw, kb.robotYaw, k) + Math.sign(dx) * travel * 1.2;

  // A full turn across every gap where the screen changes, so the swap
  // happens with the back to camera. The last gap keeps its screen and
  // simply settles.
  const screenChanges = SCREENS[a] !== SCREENS[b];
  const spin = screenChanges && spinEnabled ? k * Math.PI * 2 : 0;
  const phoneYaw = lerp(ka.phoneYaw, kb.phoneYaw, k) + spin;
  const phonePitch = lerp(ka.phonePitch, kb.phonePitch, k);

  // Swap in the middle of the turn — when the phone is edge-on to back-on.
  const mix = screenChanges ? ramp(k, 0.38, 0.62) : 0;

  // The robot watches the phone while it is working, looks up at the galaxy
  // during the map, and looks at YOU at the end.
  const lookAtPhone: V3 = [PHONE_POS[0], PHONE_POS[1] + 0.3, PHONE_POS[2] + 0.4];
  // Up and out towards the visitor, not up and back: looking behind itself
  // would turn the face away and show the back of the helmet.
  const lookUp: V3 = [robotPos[0] * 0.6, 4.8, 3.5];
  const lookAtCam = cameraPos;
  const gazeKeys: V3[] = [lookAtPhone, lookAtCam, lookUp, lookAtPhone, lookAtCam];
  const gaze = lerp3(gazeKeys[a], gazeKeys[b], k);

  const section = k < 0.5 ? a : b;

  return {
    cameraPos,
    cameraLook,
    phoneYaw,
    phonePitch,
    robotPos,
    robotScale,
    robotYaw,
    wave: lerp(ka.wave, kb.wave, k),
    gaze,
    screen: {
      from: SCREENS[a],
      to: SCREENS[b],
      mix,
      // No override: screenProgress already reaches 1 before the phone turns
      // away. Forcing it to 1 the moment the gap began snapped the chat
      // straight to finished.
      pFrom: a === 0 ? Math.max(screenProgress(p, 0), intro) : screenProgress(p, a),
      pTo: b === 0 ? Math.max(screenProgress(p, 0), intro) : screenProgress(p, b),
    },
    emergence,
    darkness: darknessAt(p),
    section,
  };
}
