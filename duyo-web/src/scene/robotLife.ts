/**
 * DUYO's life at its station: where it looks, how it breathes, blinks and
 * talks. The runtime calls update() once a frame with what it knows; this
 * turns that into joint angles. Nothing here allocates per frame.
 *
 * DUYO never walks. It stands at ROBOT_POS, turned a little towards the
 * copy it is introducing, and everything alive about it happens in place:
 * the head follows the visitor, the antenna trails the head, the eyes blink,
 * the body breathes — and when its recording plays, it waves hello once,
 * nods along and its mouth opens with the loudness of its own voice.
 */

import * as THREE from 'three';
import { ARM_DRIVE } from '../three/robot';
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

/** How DUYO stands: turned a little towards the copy on its left. */
const BODY_YAW = -0.28;
/**
 * How far the head may turn from the body. Beyond about ±0.45 the visor
 * goes edge-on and the forehead reads "UYO"; the face is the character.
 */
const HEAD_YAW_MAX = 0.45;
const HEAD_PITCH_MAX = 0.35;
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

    // Head aims at the gaze target in the robot's own frame, clamped, with
    // the pointer leading it; while talking it nods along with the voice.
    robot.head.getWorldPosition(headWorld);
    tmpGaze.set(f.gaze[0], f.gaze[1], f.gaze[2]).sub(headWorld);
    robot.root.getWorldQuaternion(invRobot).invert();
    tmpGaze.applyQuaternion(invRobot);
    const clampYaw = (v: number) => Math.max(-HEAD_YAW_MAX, Math.min(HEAD_YAW_MAX, v));
    const clampPitch = (v: number) => Math.max(-HEAD_PITCH_MAX, Math.min(HEAD_PITCH_MAX, v));
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
    robot.antenna.rotation.z = 0.2 + Math.max(-0.5, Math.min(0.5, antennaA));

    // Arms: a slow sway at rest; one hello wave as the sound begins — motion,
    // so not under reduced motion. Eased, so stopping the voice mid-wave
    // lowers the arm instead of teleporting it.
    const since = f.talking;
    const waveTo =
      f.motion && since >= 0 ? smooth(since / WAVE_UP) * (1 - smooth((since - WAVE_HOLD) / (WAVE_DOWN - WAVE_HOLD))) : 0;
    wave += (waveTo - wave) * ease(0.2);
    const armR = robot.arms.children[1];
    const armL = robot.arms.children[0];
    if (armR && armL) {
      armR.rotation.z = ARM_DRIVE.rest + wave * (ARM_DRIVE.lift + Math.sin(t * 7) * ARM_DRIVE.wiggle);
      armR.rotation.x = Math.sin(t * 0.9) * 0.05 * (1 - wave);
      armL.rotation.x = -Math.sin(t * 0.9) * 0.05;
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
