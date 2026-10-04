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
import { add, frameShot, lerp, lerp3, scale, sub } from './framing';
import type { Half, SectionFrame, V3, View } from './framing';
import type { ScreenId } from './contract';
import { between, darknessAt, ramp } from './timeline';
import { sectionCount } from '../film';

export type { SectionFrame, View };

// ── Stations ──────────────────────────────────────────────────────────────

/** DUYO's station: the robot's origin (its neck line; feet 1.96·scale below). */
export const ROBOT_POS: V3 = [0, 0, 0];
/** Big: alone in the hero, DUYO is the page. */
export const ROBOT_SCALE = 0.8;
/**
 * The robot's visual middle and half-extents at ROBOT_SCALE, star to boots
 * and ear to raised hand, measured off the model (the chibi build of
 * mascot-default.png is as wide as it is tall), with room for the head's
 * turn, the breath and a drag. The width is the waving hand's: it reaches
 * 2.2 at rest and 2.39 at the far end of the hello.
 */
export const ROBOT_MID: V3 = [0, 0.29 * ROBOT_SCALE, 0];
const ROBOT_HALF_W = 2.4 * ROBOT_SCALE;
const ROBOT_HALF_H = 2.28 * ROBOT_SCALE;
/** DUYO's half-extents as a subject to frame (scene/framing.ts). */
export const ROBOT_HALF: Half = { w: ROBOT_HALF_W, h: ROBOT_HALF_H };

/** The phone's station: off to the right and deep, at the galaxy's near edge. */
export const PHONE_POS: V3 = [16, 1.2, -16];
/** Half-extents with room for its yaw, its hover bob and its turn between sections. */
const PHONE_HALF_W = 1.0;
const PHONE_HALF_H = PHONE_DIMS.height / 2 + 0.15;

/** Galaxy centre and tilt, placed from the phone: it floats inside the disc's near edge. */
export const GALAXY_POS: V3 = [PHONE_POS[0], PHONE_POS[1] - 1.85, PHONE_POS[2] - 9];
export const GALAXY_TILT: V3 = [0.42, 0, 0.18];

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
const HALF: Record<Subject, Half> = {
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

/**
 * How far through section i's own reading window p is: 0 as it arrives,
 * 1 as it leaves. The screen animations are scrubbed by this, so a message
 * types in while its section is actually on screen.
 */
function localProgress(p: number, i: number): number {
  const span = sectionCount() - 1;
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
  const { fovDeg } = view;
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
  const shot = (key: Key, i: number) =>
    frameShot(view, i, { mid: MIDS[key.subject], half: HALF[key.subject], cam: key.cam, look: key.look, shift: key.shift }, tanHalf, i === MAP_SECTION ? pull : [0, 0, 0]);
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
