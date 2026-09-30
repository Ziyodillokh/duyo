/**
 * The choreography: scroll position → where everything is.
 *
 * A pure function of scroll (and viewport aspect) so the whole film can be
 * reasoned about, and scrubbed in both directions with identical results.
 * Nothing in here touches three.js objects; the runtime applies what this
 * returns.
 *
 * Two stations in open space, and the camera travels between them:
 *
 *   0 boshlash    DUYO stands alone, big, at the robot's station. It turns
 *                 its head to the visitor, and talks when asked to.
 *   1 savol       the camera flies ~25 units, rising in an arc, to the
 *                 phone's station at the near edge of the galaxy; the chat
 *                 types in as the visitor arrives
 *   2 xavfsizlik  a message is stopped
 *   3 miya        the brain map's nodes leave the screen and become the
 *                 galaxy while the camera pulls out
 *   4 maqsad      goal steps tick off
 *   5 yuklab      the home screen
 *
 * Nothing walks or hops: DUYO stays where it stands and the phone stays
 * where it floats. Only the camera moves. From the phone's sections on, the
 * copy zigzags right, left, right, left, right; copy scrolls with the page
 * while the scene holds still, so centred copy would pass across the phone.
 *
 * Between phone sections the phone turns a full revolution and the screen
 * swaps while its BACK faces the camera — the cut is hidden inside the move.
 */

import { PHONE_DIMS } from './contract';
import type { ScreenId } from './contract';
import { SECTION_COUNT, between, darknessAt, ramp } from './timeline';

type V3 = [number, number, number];

// ── Stations ──────────────────────────────────────────────────────────────

/** DUYO's station: the robot's origin (its neck line; feet 1.96·scale below). */
export const ROBOT_POS: V3 = [0, 0, 0];
/** Big: alone in the hero, DUYO is the page. */
export const ROBOT_SCALE = 0.8;
/** The robot's visual middle and half-extents at ROBOT_SCALE, star to boots and ear to ear. */
const ROBOT_MID: V3 = [0, 0.3 * ROBOT_SCALE, 0];
const ROBOT_HALF_W = 1.55 * ROBOT_SCALE;
const ROBOT_HALF_H = 2.35 * ROBOT_SCALE;

/** The phone's station: off to the right and deep, at the galaxy's near edge. */
export const PHONE_POS: V3 = [16, 1.2, -16];
/** Half-extents with room for its yaw, its hover bob and its turn between sections. */
const PHONE_HALF_W = 1.0;
const PHONE_HALF_H = PHONE_DIMS.height / 2 + 0.15;

/** Galaxy centre and tilt, placed from the phone: it floats inside the disc's near edge. */
export const GALAXY_POS: V3 = [PHONE_POS[0], PHONE_POS[1] - 1.85, PHONE_POS[2] - 9];
export const GALAXY_TILT: V3 = [0.42, 0, 0.18];

// ── Framing ───────────────────────────────────────────────────────────────

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

/**
 * The flight between stations is a curve, not a line: the camera first
 * backs away from DUYO along its own line of sight (and up), so DUYO
 * shrinks into the distance instead of sweeping past the lens, then arcs
 * round to the phone. BACK is how far behind the first shot the curve's
 * control point sits, as a multiple of that shot's distance; RISE lifts it.
 */
const FLIGHT_BACK = 2.2;
const FLIGHT_RISE = 5;
/** Across the flight, the part of k over which the camera turns from DUYO to the phone. */
const LOOK_TURN_FROM = 0.42;
const LOOK_TURN_TO = 0.6;

type Subject = 'robot' | 'phone';

interface Key {
  subject: Subject;
  /** Camera offset from the subject's middle. */
  cam: V3;
  /** Look-target offset from the subject's middle. */
  look: V3;
  /**
   * Which side the subject takes: +1 right (copy on the left), −1 left.
   * Only used until the copy has been measured; see SectionFrame.
   */
  shift: number;
  phoneYaw: number;
  phonePitch: number;
}

const KEYS: Key[] = [
  { subject: 'robot', cam: [-1.2, 0.5, 10.5], look: [0, 0, 0], shift: 1, phoneYaw: 0, phonePitch: 0 },
  { subject: 'phone', cam: [1.6, 0.6, 8.6], look: [0, 0, 0], shift: -1, phoneYaw: 0.3, phonePitch: 0.03 },
  { subject: 'phone', cam: [-1.3, 0.45, 8.8], look: [0, 0, 0], shift: 1, phoneYaw: -0.26, phonePitch: 0.02 },
  { subject: 'phone', cam: [1.0, 0.3, 9.4], look: [0, 0, 0], shift: -1, phoneYaw: 0.18, phonePitch: 0 },
  { subject: 'phone', cam: [-1.5, 0.5, 8.6], look: [0, 0, 0], shift: 1, phoneYaw: -0.3, phonePitch: 0.03 },
  { subject: 'phone', cam: [0.9, 0.7, 9.8], look: [0, 0, 0], shift: -1, phoneYaw: 0.2, phonePitch: 0.03 },
];

/** Which app screen each section shows. The hero's waits at the phone's station, far off. */
const SCREENS: ScreenId[] = ['chat', 'chat', 'safety', 'map', 'goals', 'home'];
/** The section whose brain map becomes the galaxy. */
const MAP_SECTION = SCREENS.indexOf('map');

const MIDS: Record<Subject, V3> = { robot: ROBOT_MID, phone: PHONE_POS };
const HALF: Record<Subject, { w: number; h: number }> = {
  robot: { w: ROBOT_HALF_W, h: ROBOT_HALF_H },
  phone: { w: PHONE_HALF_W, h: PHONE_HALF_H },
};

export interface DirectorState {
  cameraPos: V3;
  cameraLook: V3;
  phoneYaw: number;
  phonePitch: number;
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
  /** 1 while DUYO is the subject on screen, 0 once the camera has left it. */
  robotShown: number;
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
  const k = ramp(band.half / Math.min(1, aspect), SLIVER, ROOMY);
  return { centre: lerp(0, band.centre, k), half: lerp(top, band.half, k) };
}

/**
 * How far camera and target must drop together so that `point` lands at
 * screen height `ndcY`. Dropping both keeps the camera's orientation, so the
 * point's height and depth in camera space each change linearly with the
 * drop, and the answer is exact at the point's own depth.
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
function fitStacked(view: View, a: number, b: number, k: number, half: { w: number; h: number }, tanHalf: number): Fit {
  const ba = usableBand(view.frames?.[a]?.band ?? FALLBACK_BAND, view.aspect);
  const bb = usableBand(view.frames?.[b]?.band ?? FALLBACK_BAND, view.aspect);
  const bandHalf = Math.max(0.12, lerp(ba.half, bb.half, k));
  const want = Math.max(
    half.w / (FIT_W * tanHalf * view.aspect),
    half.h / (STACKED_FIT_H * tanHalf * bandHalf),
  );
  return { want, at: lerp(ba.centre, bb.centre, k) };
}

/** Side by side: the camera backs off until the subject fits the space the copy leaves. */
function fitSide(view: View, a: number, b: number, k: number, half: { w: number; h: number }, tanHalf: number): Fit {
  const fa = view.frames?.[a] ?? { centre: 0.34 * KEYS[a].shift, half: FALLBACK_HALF };
  const fb = view.frames?.[b] ?? { centre: 0.34 * KEYS[b].shift, half: FALLBACK_HALF };
  const frameHalf = Math.max(0.2, lerp(fa.half, fb.half, k));
  const want = Math.max(
    half.w / (frameHalf * FIT_W * tanHalf * view.aspect),
    half.h / (FIT_H * tanHalf),
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
  const x = p * span;
  const lo = i === 0 ? 0 : i - 0.5;
  const hi = i === span ? span : i + 0.5;
  return Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
}

/** Scroll-scrubbed progress for a screen's animation within its section. */
const screenProgress = (p: number, i: number) => ramp(localProgress(p, i), 0.08, 0.66);
/** The hero's screen is the chat, waiting off-camera: it plays in section 1. */
const playsIn = (i: number) => (i === 0 ? 1 : i);

export function direct(p: number, view: View, spinEnabled = true): DirectorState {
  const { aspect, fovDeg, stacked } = view;
  const { a, b, k } = between(p);
  const ka = KEYS[a];
  const kb = KEYS[b];
  const tanHalf = Math.tan((fovDeg * Math.PI) / 360);

  // The nodes leave the phone just past the map section's centre, so the
  // screen is clean while the visitor reads it. localProgress clamps to 1
  // past the section, so once they are out they STAY out.
  const emergence = ramp(localProgress(p, MAP_SECTION), 0.5, 0.88);
  // The map section's camera pulls out as the nodes leave, so the reveal of
  // the galaxy and the nodes arriving in it are one motion.
  const pullOut = a === MAP_SECTION ? emergence * (1 - k) : b === MAP_SECTION ? emergence : 0;
  const pull: V3 = [0, 0.6 * pullOut, 6 * pullOut];

  // Each key frames its own subject; the shot between two keys is the blend
  // of the two finished shots. Blending positions of finished shots (rather
  // than their parameters) is what makes the station-to-station flight a
  // clean move: at k=0 and k=1 it is exactly each section's own framing.
  const shot = (key: Key, i: number): { look: V3; pos: V3 } => {
    const mid = MIDS[key.subject];
    const half = HALF[key.subject];
    const rel = sub(key.cam, key.look);
    const dist = length(rel);
    const fit = (stacked ? fitStacked : fitSide)(view, i, i, 0, half, tanHalf);
    const want = Math.max(dist, fit.want);
    // The pull-out goes on after the fit, scaled with it, so it survives
    // wherever the fit, not the key, sets the distance.
    const toCam = scale(add(rel, i === MAP_SECTION ? pull : [0, 0, 0]), want / dist);
    const target = add(mid, key.look);
    const slide: V3 = stacked
      ? [0, -dropOnto(mid, target, toCam, tanHalf, fit.at), 0]
      : [-fit.at * length(toCam) * tanHalf * aspect, 0, 0];
    const look = add(target, slide);
    return { look, pos: add(look, toCam) };
  };
  const sa = shot(ka, a);
  const sb = shot(kb, b);
  // Between stations the camera first backs away still watching DUYO, then
  // turns to find the phone: the look lags the move, so no frame of the
  // flight is empty space.
  const flying = ka.subject !== kb.subject;
  const kLook = flying ? ramp(k, LOOK_TURN_FROM, LOOK_TURN_TO) : k;
  const cameraLook = lerp3(sa.look, sb.look, kLook);
  let cameraPos = lerp3(sa.pos, sb.pos, k);
  if (flying) {
    // Quadratic Bézier through a point behind whichever shot is DUYO's.
    const near = ka.subject === 'robot' ? sa : sb;
    const back = add(add(near.pos, scale(sub(near.pos, near.look), FLIGHT_BACK)), [0, FLIGHT_RISE, 0]);
    const [p0, p2] = [sa.pos, sb.pos];
    const u = 1 - k;
    cameraPos = add(add(scale(p0, u * u), scale(back, 2 * u * k)), scale(p2, k * k));
  }

  // A full turn across every gap where the screen changes, so the swap
  // happens with the back to camera.
  const screenChanges = SCREENS[a] !== SCREENS[b];
  const spin = screenChanges && spinEnabled ? k * Math.PI * 2 : 0;
  const phoneYaw = lerp(ka.phoneYaw, kb.phoneYaw, k) + spin;
  const phonePitch = lerp(ka.phonePitch, kb.phonePitch, k);
  // Swap in the middle of the turn — when the phone is edge-on to back-on.
  const mix = screenChanges ? ramp(k, 0.38, 0.62) : 0;

  const robotShown = ka.subject === 'robot' ? 1 - k : kb.subject === 'robot' ? k : 0;

  return {
    cameraPos,
    cameraLook,
    phoneYaw,
    phonePitch,
    // DUYO looks at the visitor; the runtime adds the pointer on top.
    gaze: cameraPos,
    screen: {
      from: SCREENS[a],
      to: SCREENS[b],
      mix,
      pFrom: screenProgress(p, playsIn(a)),
      pTo: screenProgress(p, playsIn(b)),
    },
    emergence,
    darkness: darknessAt(p),
    section: k < 0.5 ? a : b,
    robotShown,
  };
}
