/**
 * DUYO's life at its station: where it looks, how it breathes, blinks and
 * talks. The runtime calls update() once a frame with what it knows; this
 * turns that into joint angles. Nothing here allocates per frame.
 *
 * DUYO never walks. It stands at ROBOT_POS, planted and square to the
 * visitor, turned a touch toward its own copy, looking the visitor in the
 * eye with its left hand up in a "hi" — and everything alive about it
 * happens in place: the head follows the pointer, the antenna trails the
 * head, the eyes blink, the body breathes, and now and then the raised
 * hand gives a small friendly wiggle. When its recording plays, the hand
 * waves hello, the head nods along and a mouth appears, opening with the
 * loudness of its own voice.
 */

import * as THREE from 'three';
import { ANTENNA_REST, ARM_DRIVE } from '../three/robot';
import type { Robot } from '../three/robot';

type V3 = readonly [number, number, number];

export interface RobotFrame {
  /** Idle-life seconds (stands still under reduced motion). */
  t: number;
  /** Frame time, clamped; for the fixed-step antenna spring. */
  dt: number;
  /** Converts a per-60Hz-frame ease into this frame's. */
  ease: (perFrame: number) => number;
  /** 1 when motion is allowed. */
  motion: number;
  /** World point to look at (the camera), before the pointer's lead. */
  gaze: V3;
  /** Pointer, eased, −1..1 with +y DOWN (screen space). 0 under reduced motion. */
  px: number;
  py: number;
  /** Extra body turn from a drag, radians. */
  dragYaw: number;
  /** Voice loudness 0..1 this frame. */
  voice: number;
  /** Seconds since the recording started, or −1 when silent. */
  talking: number;
}

/**
 * How DUYO stands: facing the visitor, turned this much further toward its
 * copy (to the screen's left, where the copy sits beside it on a desktop) —
 * enough to read as presenting the words, not so much that the hello hand
 * turns away. Measured from the camera's own bearing, because that differs
 * by framing: the desktop hero sees DUYO from 0.30 to its right (it is
 * framed right of centre with the camera off to the left), a portrait
 * phone from 0.11. A fixed yaw faced it away on one or the other.
 */
const TURN_TO_COPY = 0.2;
/**
 * The body turns after the camera only this fast, and only this far — it
 * shifts its footing, it does not spin, when the camera flies off.
 */
const BODY_FOLLOW = 0.04;
const BODY_YAW_MAX = 0.8;
/**
 * How far the head may turn from the body. Beyond about ±0.45 the visor
 * goes edge-on and the forehead reads "UYO"; the face is the character.
 */
const HEAD_YAW_MAX = 0.45;
/**
 * Up to the sky freely; down only so far — the raised hand sits just under
 * the helmet's cheek, and pitched further the chin would meet it
 * (harness/robot.html?check=1 sweeps it: clear at 0.18 and every yaw).
 */
const HEAD_PITCH_UP = 0.35;
const HEAD_PITCH_DOWN = 0.18;
/** The hello wave when it starts talking: up by 0.35 s, down by 2.4 s. */
const WAVE_UP = 0.35;
const WAVE_HOLD = 1.8;
const WAVE_DOWN = 2.4;
/** The wave's swing, radians per second: a brisk, friendly ~1.3 Hz. */
const WAVE_RATE = 8;
/**
 * The idle wiggle: every 6 to 9 seconds, 1.1 s of two small swings of the
 * raised hand with a little lift — a hand that is still saying hi.
 */
const WIGGLE = { every: 6, spread: 3, len: 1.1, swings: 2, rock: 0.18, lift: 0.22 } as const;
const MAX_SPRING_STEPS = 6;

const clampYaw = (v: number) => Math.max(-HEAD_YAW_MAX, Math.min(HEAD_YAW_MAX, v));
const clampPitch = (v: number) => Math.max(-HEAD_PITCH_UP, Math.min(HEAD_PITCH_DOWN, v));
const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

export interface RobotLife {
  update: (f: RobotFrame) => void;
}

export function createRobotLife(robot: Robot, home: V3): RobotLife {
  const tmpGaze = new THREE.Vector3();
  const headWorld = new THREE.Vector3();
  const invRobot = new THREE.Quaternion();
  let headYaw = 0;
  let headPitch = 0;
  let prevHeadYaw = 0;
  let antennaV = 0;
  let antennaA = 0;
  let springAcc = 0;
  let nextBlink = 2.2;
  let blinkUntil = 0;
  let blinkT = 0;
  let mouth = 0;
  let wave = 0;
  let bodyYaw = NaN;
  let nextWiggle = 3.5;
  let wiggleAt = -Infinity;

  const update = (f: RobotFrame) => {
    const { t, ease } = f;

    // Body: in place, breathing, square to the camera and turned a touch
    // toward the copy; it settles into that at once, then eases after the
    // camera. A drag turns it.
    const bearing = Math.atan2(f.gaze[0] - home[0], f.gaze[2] - home[2]);
    const bodyTo = Math.max(-BODY_YAW_MAX, Math.min(BODY_YAW_MAX, bearing - TURN_TO_COPY));
    bodyYaw = Number.isNaN(bodyYaw) || !f.motion ? bodyTo : bodyYaw + (bodyTo - bodyYaw) * ease(BODY_FOLLOW);
    robot.root.position.set(home[0], home[1] + Math.sin(t * 1.3 + 1) * 0.03, home[2]);
    robot.root.rotation.y = bodyYaw + f.dragYaw + f.px * 0.1;

    // Head looks at the visitor — the gaze target, in the robot's own frame
    // — and is led by the pointer, clamped; while talking it nods along
    // with the voice.
    robot.head.getWorldPosition(headWorld);
    tmpGaze.set(f.gaze[0], f.gaze[1], f.gaze[2]).sub(headWorld);
    robot.root.getWorldQuaternion(invRobot).invert();
    tmpGaze.applyQuaternion(invRobot);
    const wantYaw = clampYaw(Math.atan2(tmpGaze.x, tmpGaze.z) + f.px * 0.35);
    const nod = f.voice * 0.07 * Math.sin(t * 9) * f.motion;
    const wantPitch = clampPitch(-Math.atan2(tmpGaze.y, Math.hypot(tmpGaze.x, tmpGaze.z)) + f.py * 0.18 + nod);
    headYaw += (wantYaw - headYaw) * ease(0.08);
    headPitch += (wantPitch - headPitch) * ease(0.1);
    robot.head.rotation.set(headPitch, headYaw, -headYaw * 0.07);

    // Antenna: a spring driven by how fast the head turned, stepped at a
    // fixed 60Hz — a spring integrated per display frame rings differently
    // on every screen.
    springAcc = Math.min(springAcc + f.dt, MAX_SPRING_STEPS / 60);
    const steps = Math.floor(springAcc * 60);
    if (steps > 0) {
      springAcc -= steps / 60;
      const yawV = (headYaw - prevHeadYaw) / steps;
      prevHeadYaw = headYaw;
      for (let i = 0; i < steps; i += 1) {
        antennaV = (antennaV - yawV * 9 - antennaA * 0.14) * 0.72;
        antennaA += antennaV;
      }
    }
    robot.antenna.rotation.z = ANTENNA_REST + Math.max(-0.5, Math.min(0.5, antennaA));

    // Arms: a slow sway at rest, and now and then the idle wiggle; as the
    // sound begins, the raised hand waves hello. All of it is motion, so
    // none of it under reduced motion. Eased, so stopping the voice
    // mid-wave settles the hand instead of teleporting it.
    const since = f.talking;
    const waveTo =
      f.motion && since >= 0 ? smooth(since / WAVE_UP) * (1 - smooth((since - WAVE_HOLD) / (WAVE_DOWN - WAVE_HOLD))) : 0;
    wave += (waveTo - wave) * ease(0.2);
    if (t > nextWiggle) {
      // Not over a wave: the hello already says it.
      if (wave < 0.05) wiggleAt = t;
      nextWiggle = t + WIGGLE.every + ((Math.sin(t * 53.7) + 1) / 2) * WIGGLE.spread;
    }
    // Outside its window the wiggle is exactly nothing: before the first one
    // u is infinite, and sin(∞) is NaN, which zero does not cancel.
    const u = (t - wiggleAt) / WIGGLE.len;
    const wiggling = u > 0 && u < 1 && f.motion > 0;
    const bump = wiggling ? Math.sin(Math.PI * u) ** 2 : 0;
    const armUp = robot.arms.children[0];
    const armDown = robot.arms.children[1];
    if (armUp && armDown) {
      const swing = wave * Math.sin(t * WAVE_RATE) * ARM_DRIVE.wiggle;
      const wiggle = wiggling ? bump * Math.sin(2 * Math.PI * WIGGLE.swings * u) * WIGGLE.rock : 0;
      armUp.rotation.z = ARM_DRIVE.rest + ARM_DRIVE.lift * Math.min(1, wave + bump * WIGGLE.lift);
      armUp.rotation.y = swing + wiggle;
      armUp.rotation.x = -Math.sin(t * 0.9) * 0.04 * (1 - wave);
      armDown.rotation.x = Math.sin(t * 0.9) * 0.05;
    }

    // Blink as an event: ~90 ms shut every four to seven seconds. Never held
    // shut: under reduced motion the clock stands still, possibly mid-blink.
    if (t > nextBlink) {
      blinkUntil = t + 0.09;
      nextBlink = t + 4 + ((Math.sin(t * 97.13) + 1) / 2) * 3;
    }
    blinkT += ((f.motion && t < blinkUntil ? 1 : 0) - blinkT) * ease(0.45);
    for (const eye of robot.eyes) {
      eye.scale.y = Math.max(0.05, 1 - blinkT);
      eye.position.x = (eye.userData.baseX as number) + f.px * 0.05;
      eye.position.y = (eye.userData.baseY as number) - f.py * 0.03;
    }

    // Mouth: opens fast on a syllable, closes a little slower, like speech.
    const target = f.voice * (f.motion ? 1 : 0.35);
    mouth += (target - mouth) * ease(target > mouth ? 0.55 : 0.25);
    robot.speak(mouth);
  };

  return { update };
}
