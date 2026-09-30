/**
 * DUYO's arms, as mascot-default.png holds them: short and chunky — a gold
 * shoulder pad, a white arm, a gold wrist band and a big blue hand. Its own
 * right arm (−x, the viewer's left) hangs down and out in a fist with the
 * thumb showing; its own left (+x) is raised, bent at the wrist, the hand
 * beside its cheek with the fingers up in a little hello.
 *
 * Split from robot.ts because the rig is the one part of DUYO that moves by
 * more than a few degrees, and it has to stay clear of a head that turns.
 */

import * as THREE from 'three';
import { profile, roundRing } from './robotShapes';
import type { V3 } from './robotShapes';
import type { Kit } from './robotSkin';

/**
 * How the page drives an arm: rotation.z = rest + wave·(lift + sin·wiggle).
 * robotLife.ts writes it to the raised arm when DUYO talks, and
 * harness/robot.ts poses with it. The rig decodes that one number into a
 * hello (the raised hand lifts a little and turns its palm to the viewer)
 * and, once the hello is up, the wiggle becomes the hand rocking about the
 * wrist.
 */
export const ARM_DRIVE = { rest: 0, lift: 1, wiggle: 0.3 } as const;

/** Where the shoulders sit on the torso (robot space; mirrored in x). */
export const SHOULDER: V3 = [0.86, -0.44, 0.02];
const L_ARM = 0.58; //           shoulder → wrist band, along the white arm
const HAND = 0.32; //           wrist → the hand's centre

/** One arm's joint angles: the shoulder's and the wrist's Euler turns. */
interface Pose {
  upper: V3;
  wrist: V3;
}

/**
 * Shoulder → wrist band, per arm: the raised arm reads a little longer in
 * the render, held out and toward the lens.
 */
const REACH = { down: L_ARM, up: 0.7 } as const;

/**
 * Hanging (own right): out from the body by about 30°, carried a little
 * forward so the fist hangs beside the belly rather than behind it.
 * Raised (own left): the arm out, almost level, and the hand bent up hard
 * at the wrist, fingers to the sky. For both, x is the arm's own side.
 */
const REST_DOWN: Pose = { upper: [-0.2, 0, 0.66], wrist: [0, 0.4, 0.12] };
const REST_UP: Pose = { upper: [-0.1, -0.72, 1.29], wrist: [0.1, 0.2, 0.5] };
/** The hello: the raised arm lifts a little higher and the palm turns out. */
const HELLO: Pose = { upper: [-0.1, -0.5, 1.28], wrist: [0.1, 0.05, 0.1] };
/** Wiggle → the hand's rock about the wrist, per unit of drive. */
const FLICK = 1.3;
/** The hello is complete before the wiggle's lowest point, so at a full wave only the hand moves. */
const HELLO_DONE = ((ARM_DRIVE.lift - ARM_DRIVE.wiggle) / ARM_DRIVE.lift) * 0.97;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
const lerp = THREE.MathUtils.lerp;

export class Arm extends THREE.Group {
  /** Undoes the pivot's own z turn: to this rig the drive is a number. */
  private readonly cancel = new THREE.Group();
  readonly upper = new THREE.Group();
  readonly wrist = new THREE.Group();
  private readonly rest: Pose;
  private readonly hello: Pose;

  constructor(readonly side: number) {
    super();
    this.rotation.z = ARM_DRIVE.rest;
    this.add(this.cancel);
    this.cancel.add(this.upper);
    this.upper.add(this.wrist);
    this.wrist.position.y = -(side > 0 ? REACH.up : REACH.down);
    this.rest = side > 0 ? REST_UP : REST_DOWN;
    this.hello = side > 0 ? HELLO : REST_DOWN;
  }

  /** The group the shoulder pad hangs in: it follows the sway, not the arm. */
  get shoulder(): THREE.Group {
    return this.cancel;
  }

  /**
   * Every route to a world matrix — the render's updateMatrixWorld, and the
   * updateWorldMatrix that Box3 and getWorldPosition use — calls this first,
   * so the pose is never a frame behind the drive.
   */
  override updateMatrix(): void {
    this.pose();
    super.updateMatrix();
  }

  private pose(): void {
    const s = this.side;
    const drive = (this.rotation.z - ARM_DRIVE.rest) / ARM_DRIVE.lift;
    const up = smooth(clamp01(drive / HELLO_DONE));
    const flick = (drive - 1) * FLICK * smooth(clamp01((drive - 0.6) / (HELLO_DONE - 0.6)));
    const { rest, hello } = this;
    this.cancel.rotation.z = -this.rotation.z;
    this.upper.rotation.set(
      lerp(rest.upper[0], hello.upper[0], up),
      s * lerp(rest.upper[1], hello.upper[1], up),
      s * lerp(rest.upper[2], hello.upper[2], up),
    );
    this.wrist.rotation.set(
      lerp(rest.wrist[0], hello.wrist[0], up),
      s * lerp(rest.wrist[1], hello.wrist[1], up),
      s * (lerp(rest.wrist[2], hello.wrist[2], up) + flick),
    );
  }
}

/**
 * A fist: one long rounded mitten carrying on the arm's line, with the
 * thumb a stubby knob on its front, toward the body — mascot-default.png.
 */
function buildFist(kit: Kit, arm: Arm, geo: HandGeo): void {
  const s = arm.side;
  const palm = kit.part(geo.palm, kit.blue);
  palm.position.y = -HAND - 0.02;
  palm.scale.set(1.1, 1.2, 0.98);
  const thumb = kit.part(geo.knob, kit.blue);
  thumb.position.set(-s * 0.22, -HAND - 0.12, 0.16);
  thumb.rotation.set(Math.PI / 2, 0, s * 0.7);
  arm.wrist.add(palm, thumb);
}

/**
 * The white arm: thicker toward the wrist than at the shoulder, as the
 * render's arms are, domed at the shoulder end. Its wrist end hides in the
 * band. Bottom to top, so the lathe faces out.
 */
function armGeometry(reach: number): THREE.LatheGeometry {
  const pts: [number, number][] = [
    [0.001, -reach - 0.02], [0.18, -reach], [0.24, -reach + 0.07], [0.222, -reach * 0.5],
    [0.185, -0.06], [0.15, 0.06], [0.08, 0.13], [0.001, 0.15],
  ];
  return new THREE.LatheGeometry(profile(pts, 20), 24);
}

/**
 * The raised hand: a plump palm held out past the wrist band, and three
 * stubby fingers at its end curled up toward the sky, stacked front to
 * back, with a thumb underneath — the friendly half-wave of the render.
 * In the wrist's frame −y runs out along the hand and +x (on this arm's
 * side) points up.
 */
function buildOpenHand(kit: Kit, arm: Arm, geo: HandGeo): void {
  const s = arm.side;
  const palm = kit.part(geo.palm, kit.blue);
  palm.position.y = -HAND + 0.02;
  palm.scale.set(1.1, 1.08, 1.0);
  arm.wrist.add(palm);
  const fingers: [number, number][] = [[-0.17, 1.05], [0.0, 1.25], [0.17, 1.45]];
  for (const [z, curl] of fingers) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.14, -HAND - 0.16, z);
    pivot.rotation.set(0, 0, s * curl);
    const finger = kit.part(geo.finger, kit.blue);
    finger.position.y = -0.08;
    const tip = kit.part(geo.tip, kit.blue);
    tip.position.y = -0.18;
    pivot.add(finger, tip);
    arm.wrist.add(pivot);
  }
  // The thumb tucks under the palm, out of the way of the hello.
  const thumb = kit.part(geo.finger, kit.blue);
  thumb.position.set(-s * 0.2, -HAND - 0.12, -0.08);
  thumb.rotation.set(0.5, 0, -s * 0.7);
  arm.wrist.add(thumb);
}

interface HandGeo {
  palm: THREE.BufferGeometry;
  knob: THREE.BufferGeometry;
  finger: THREE.BufferGeometry;
  tip: THREE.BufferGeometry;
}

/**
 * Both arms. children[0] is the raised arm at +x (DUYO's own left, the one
 * that waves hello); children[1] hangs at −x.
 */
export function buildArms(kit: Kit): THREE.Group {
  const arms = new THREE.Group();
  const padGeo = kit.keep(new THREE.SphereGeometry(0.25, 24, 16));
  const cuffGeo = kit.keep(roundRing(0.14, 0.275, 0.19, 40));
  const hand: HandGeo = {
    palm: kit.keep(new THREE.SphereGeometry(0.3, 28, 20)),
    knob: kit.keep(new THREE.CapsuleGeometry(0.075, 0.05, 4, 12)),
    finger: kit.keep(new THREE.CapsuleGeometry(0.088, 0.1, 6, 12)),
    tip: kit.keep(new THREE.SphereGeometry(0.1, 16, 12)),
  };
  for (const side of [1, -1]) {
    const arm = new Arm(side);
    arm.position.set(side * SHOULDER[0], SHOULDER[1], SHOULDER[2]);

    // The pad caps the shoulder: an upright gold dome on the torso's side.
    const pad = kit.part(padGeo, kit.yellow);
    pad.position.set(side * 0.05, 0.05, 0.04);
    pad.scale.set(0.78, 1.25, 1.15);
    pad.rotation.z = side * 0.28;
    arm.shoulder.add(pad);

    const white = kit.part(kit.keep(armGeometry(side > 0 ? REACH.up : REACH.down)), kit.white);
    const cuff = kit.part(cuffGeo, kit.yellow);
    cuff.position.y = -0.01;
    arm.upper.add(white);
    arm.wrist.add(cuff);
    if (side > 0) buildOpenHand(kit, arm, hand);
    else buildFist(kit, arm, hand);
    arms.add(arm);
  }
  return arms;
}
