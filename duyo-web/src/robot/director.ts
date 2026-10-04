/**
 * The robot page's film: scroll position → where everything is. Pure, like
 * the home page's (scene/director.ts), and framed by the same rules
 * (scene/framing.ts).
 *
 * One station. DUYO stands where it stands, as in the home page's hero, and
 * the hologram it throws — the knowledge galaxy, the app's Neo Miya made
 * light — floats beside its raised hand. Only the camera moves, and what
 * DUYO does with that hand:
 *
 *   0 robot         DUYO alone, big, waving: the hero
 *   1 proyeksiya    the camera draws back, the beam lights, and the map's
 *                   nodes stream out of DUYO's hand into a galaxy
 *   2 imkoniyatlar  the galaxy close, turning; the copy takes the right
 *   3 qanday        wide again, and around the galaxy the four things the
 *                   wall shows
 *   4 ishtirokchi   DUYO close, the beam off: it talks to the visitor
 *   5 yakun         all of it — DUYO, its galaxy, the four — for the close
 */

import { sectionCount } from '../film';
import { ROBOT_HALF, ROBOT_MID } from '../scene/director';
import { frameShot, lerp, lerp3 } from '../scene/framing';
import type { Half, V3, View } from '../scene/framing';
import { between, ramp } from '../scene/timeline';

/**
 * Where the hologram floats: up beside DUYO's raised hand, which points the
 * beam. On a phone held upright it rises higher and closer, so DUYO and its
 * galaxy stack into the tall band above the caption.
 */
const HOLO_WIDE: V3 = [4.1, 1.85, -1.4];
const HOLO_TALL: V3 = [1.9, 4.45, -1.2];
export const holoPos = (view: View): V3 => (view.stacked ? HOLO_TALL : HOLO_WIDE);
/** The home page's galaxy (radius 30) at hologram size. */
export const HOLO_SCALE = 0.085;
/** Tipped back toward the visitor, and a little toward DUYO. */
export const HOLO_TILT: V3 = [1.0, -0.3, 0.1];
/** The hologram's half-extents as it shows, tipped; and how far its labels reach past it. */
const HOLO_HALF: Half = { w: 2.6, h: 2.1 };
const LABELS_REACH: Half = { w: 2.6, h: 0.85 };
/** DUYO with room above its helmet for the bubble it speaks in (robot/labels.ts). */
const TALK_ROOM = 0.85;

type Subject = 'robot' | 'talk' | 'holo' | 'both';

interface Key {
  subject: Subject;
  /** Camera offset from the subject's middle; the fit may stand it further back. */
  cam: V3;
  /** Which side the subject takes until the copy is measured: +1 right. */
  shift: number;
  /** The projector: 0 off, 1 the beam and the hologram lit. */
  beam: number;
  /** The four labels around the hologram. */
  labels: number;
  /** DUYO looks at its projection (1) rather than at the visitor (0). */
  gazeHolo: number;
  /** The raised hand holds still to project. */
  hold: number;
  /** DUYO talks to the visitor. */
  talk: number;
}

const KEYS: Key[] = [
  { subject: 'robot', cam: [-1.2, 0.5, 10.5], shift: 1, beam: 0, labels: 0, gazeHolo: 0, hold: 0, talk: 0 },
  { subject: 'both', cam: [-2.4, 1.3, 13.5], shift: 1, beam: 1, labels: 0, gazeHolo: 0.85, hold: 1, talk: 0 },
  { subject: 'holo', cam: [-2.8, 0.2, 8.5], shift: -1, beam: 1, labels: 0, gazeHolo: 0.85, hold: 1, talk: 0 },
  { subject: 'both', cam: [1.2, 1.6, 13.5], shift: 1, beam: 1, labels: 1, gazeHolo: 0.7, hold: 1, talk: 0 },
  { subject: 'talk', cam: [1.6, 0.4, 9.2], shift: -1, beam: 0, labels: 0, gazeHolo: 0, hold: 0, talk: 1 },
  { subject: 'both', cam: [-0.8, 1.0, 14], shift: 1, beam: 1, labels: 1, gazeHolo: 0.35, hold: 0.5, talk: 0 },
];

/** The scroll (in sections) over which the nodes stream out of the hand: through the projection's reading window. */
const EMERGE_FROM = 0.7;
const EMERGE_TO = 1.3;

/** What a key frames, laid out for this view: DUYO, the hologram, or the box around both. */
function subjectOf(kind: Subject, holo: V3, labelled: boolean, tall: boolean): { mid: V3; half: Half } {
  if (kind === 'robot') return { mid: ROBOT_MID, half: ROBOT_HALF };
  if (kind === 'talk') {
    const room = TALK_ROOM * (tall ? 1.4 : 1);
    return { mid: [ROBOT_MID[0], ROBOT_MID[1] + room, ROBOT_MID[2]], half: { w: ROBOT_HALF.w, h: ROBOT_HALF.h + room } };
  }
  const reach = labelled ? LABELS_REACH : { w: 0, h: 0 };
  const half: Half = { w: HOLO_HALF.w + reach.w, h: HOLO_HALF.h + reach.h };
  if (kind === 'holo') return { mid: holo, half };
  const lo = [Math.min(ROBOT_MID[0] - ROBOT_HALF.w, holo[0] - half.w), Math.min(ROBOT_MID[1] - ROBOT_HALF.h, holo[1] - half.h)];
  const hi = [Math.max(ROBOT_MID[0] + ROBOT_HALF.w, holo[0] + half.w), Math.max(ROBOT_MID[1] + ROBOT_HALF.h, holo[1] + half.h)];
  return {
    mid: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, holo[2] / 2],
    half: { w: (hi[0] - lo[0]) / 2, h: (hi[1] - lo[1]) / 2 },
  };
}

export interface RobotShot {
  cameraPos: V3;
  cameraLook: V3;
  /** Where DUYO's head should look, in world space. */
  gaze: V3;
  holo: V3;
  beam: number;
  /** 0..1: the nodes' journey from DUYO's hand into the galaxy. */
  emergence: number;
  labels: number;
  hold: number;
  talk: number;
  /** Index of the section nearest the viewport centre. */
  section: number;
}

export function directRobot(p: number, view: View): RobotShot {
  const { a, b, k } = between(p);
  const [ka, kb] = [KEYS[a], KEYS[b]];
  const tanHalf = Math.tan((view.fovDeg * Math.PI) / 360);
  const holo = holoPos(view);

  // Each key frames its own subject; between two keys the camera blends the
  // two finished shots, so at either end it is exactly that section's.
  // On a phone held upright the four labels would be too small to read: the
  // caption under the scene names them instead, and the shot frames without them.
  const labelled = (key: Key) => key.labels > 0 && !view.stacked;
  const shot = (key: Key, i: number) => {
    const { mid, half } = subjectOf(key.subject, holo, labelled(key), view.stacked);
    return frameShot(view, i, { mid, half, cam: key.cam, look: [0, 0, 0], shift: key.shift }, tanHalf);
  };
  const [sa, sb] = [shot(ka, a), shot(kb, b)];
  const cameraPos = lerp3(sa.pos, sb.pos, k);
  const cameraLook = lerp3(sa.look, sb.look, k);
  const mix = (f: (key: Key) => number) => lerp(f(ka), f(kb), k);

  const x = p * (sectionCount() - 1);
  return {
    cameraPos,
    cameraLook,
    gaze: lerp3(cameraPos, holo, mix((key) => key.gazeHolo)),
    holo,
    beam: mix((key) => key.beam),
    emergence: ramp(x, EMERGE_FROM, EMERGE_TO),
    labels: view.stacked ? 0 : mix((key) => key.labels),
    hold: mix((key) => key.hold),
    talk: mix((key) => key.talk),
    section: k < 0.5 ? a : b,
  };
}
