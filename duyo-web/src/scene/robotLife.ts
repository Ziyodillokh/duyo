/**
 * DUYO's life at its station: where it looks, how it breathes, blinks and
 * talks. The runtime calls update() once a frame with what it knows; this
 * turns that into joint angles. Nothing here allocates per frame.
 *
 * DUYO never walks. It stands at ROBOT_POS in the pose of the app's
 * mascot-default.png — a 3/4 view, its own right side toward the visitor,
 * the left hand up in a little hello — and everything alive about it
 * happens in place: the head follows the pointer, the antenna trails the
 * head, the eyes blink, the body breathes — and when its recording plays,
 * the raised hand waves hello, the head nods along and a mouth appears,
 * opening with the loudness of its own voice.
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
 * How DUYO stands. In mascot-default.png the body is turned about 0.17 rad
 * to its left, so its right side faces the lens, and the face a further
 * 0.19 (harness/robot.html?match=1 fits both). The desktop hero's camera
 * sees DUYO from 0.30 to its right (the copy is on the left, so DUYO is
 * framed right of centre and the camera stands off to the left): −0.30 +
 * 0.17 ≈ −0.12. Portrait phones frame it centred, from 0.11, and see the
 * body nearly square with the face still turned.
 */
const BODY_YAW = -0.12;
/**
 * The head's own turn at rest, beyond the body's, and how much of the
 * camera's bearing it follows on top — enough to watch the camera leave,
 * little enough that at the hero the face keeps the mascot's 3/4 turn.
 */
const HEAD_TURN = 0.24;
const GAZE_SHARE = 0.25;
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
const MAX_SPRING_STEPS = 6;

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

  const update = (f: RobotFrame) => {
    const { t, ease } = f;

    // Body: in place, breathing, turned towards the copy; a drag turns it.
    robot.root.position.set(home[0], home[1] + Math.sin(t * 1.3 + 1) * 0.03, home[2]);
    robot.root.rotation.y = BODY_YAW + f.dragYaw + f.px * 0.1;

    // Head keeps the mascot's turn, follows a share of the gaze target (in
    // the robot's own frame) and is led by the pointer, clamped; while
    // talking it nods along with the voice.
    robot.head.getWorldPosition(headWorld);
    tmpGaze.set(f.gaze[0], f.gaze[1], f.gaze[2]).sub(headWorld);
    robot.root.getWorldQuaternion(invRobot).invert();
    tmpGaze.applyQuaternion(invRobot);
    const clampYaw = (v: number) => Math.max(-HEAD_YAW_MAX, Math.min(HEAD_YAW_MAX, v));
    const clampPitch = (v: number) => Math.max(-HEAD_PITCH_UP, Math.min(HEAD_PITCH_DOWN, v));
    const wantYaw = clampYaw(HEAD_TURN + GAZE_SHARE * Math.atan2(tmpGaze.x, tmpGaze.z) + f.px * 0.35);
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

    // Arms: a slow sway at rest; as the sound begins, the raised hand says
    // hello — motion, so not under reduced motion. Eased, so stopping the
    // voice mid-wave settles the hand instead of teleporting it.
    const since = f.talking;
    const waveTo =
      f.motion && since >= 0 ? smooth(since / WAVE_UP) * (1 - smooth((since - WAVE_HOLD) / (WAVE_DOWN - WAVE_HOLD))) : 0;
    wave += (waveTo - wave) * ease(0.2);
    const armUp = robot.arms.children[0];
    const armDown = robot.arms.children[1];
    if (armUp && armDown) {
      armUp.rotation.z = ARM_DRIVE.rest + wave * (ARM_DRIVE.lift + Math.sin(t * 7) * ARM_DRIVE.wiggle);
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
