/**
 * DUYO's arms: short and chunky — a gold shoulder pad, a white arm, a gold
 * wrist band and a big blue moulded hand (robotHand.ts). Its own left arm
 * (+x, the viewer's right) is raised in a friendly "hi": the hand up beside
 * the shoulder, just under the helmet's cheek, palm to the viewer and
 * fingers spread. Its own right hangs relaxed beside the belly in a soft
 * toy fist, the thumb across its front.
 *
 * Split from robot.ts because the rig is the one part of DUYO that moves by
 * more than a few degrees, and it has to stay clear of a head that turns.
 */

import * as THREE from 'three';
import { handGeometry } from './robotHand';
import { profile, roundRing } from './robotShapes';
import type { V3 } from './robotShapes';
import type { Kit } from './robotSkin';

/**
 * How the page drives an arm, through the arm group's own rotation — to
 * this rig those are numbers, not turns:
 *   rotation.z = rest + lift·hello, hello 0..1: how far the raised hand has
 *     come up into its wave;
 *   rotation.y = the hand's rock about the palm's normal, in radians — the
 *     windscreen-wiper swing of a wave, + toward the face (taken only in
 *     part: ROCK_IN); wiggle is its amplitude when waving;
 *   rotation.x = a real turn, the sway, as before.
 * robotLife.ts writes them and harness/robot.ts poses with them.
 */
export const ARM_DRIVE = { rest: 0, lift: 1, wiggle: 0.32 } as const;

/**
 * Where the shoulders sit on the torso (robot space; mirrored in x): on the
 * barrel's shoulder line, far enough out that a hanging arm clears the
 * belly below without splaying away from it.
 */
export const SHOULDER: V3 = [0.9, -0.44, 0.02];
/**
 * Shoulder → wrist band, per arm: the raised arm reads a little longer in
 * the render, held out and toward the lens.
 */
const REACH = { down: 0.58, up: 0.7 } as const;

/** The hands against the band: the renders' hands are big, a glove on a bracelet. */
const HAND_SCALE = 1.12;

/**
 * An arm's pose, on its own side (+x; mirrored for −x): which way the arm
 * runs from the shoulder, and which way the fingers point and the palm faces.
 */
interface Pose {
  arm: V3;
  fingers: V3;
  palm: V3;
}

/**
 * Hanging: out just enough to clear the barrel of the belly, and forward —
 * DUYO turns toward its copy, which swings this side away, and an arm
 * hanging straight down went behind the belly. The hand hangs plumb below
 * the wrist, so it tucks in rather than carrying on the arm's line, its
 * palm turned in and forward: the visitor sees the fist's curled fingers
 * and the thumb across them — the renders' fist, thumb on the front — and
 * not the blank back of a mitten.
 */
const HANG: Pose = { arm: [0.7, -1, 0.36], fingers: [0, -1, 0.12], palm: [-0.75, 0, 0.65] };
/**
 * Raised: the arm out and forward, and the hand up at the wrist, palm to
 * the viewer — turned a little to the arm's own side, which is where the
 * visitor stands once DUYO has turned toward its copy.
 */
const RAISED: Pose = { arm: [1, -0.5, 0.36], fingers: [0.26, 1, 0.1], palm: [0.25, -0.05, 1] };
/** The hello: the arm comes up nearly level and the hand stands straighter. */
const HELLO: Pose = { arm: [1, -0.36, 0.52], fingers: [0.42, 1, 0.12], palm: [0.24, -0.05, 1] };
/**
 * How much of a rock toward the face the hand takes: a wave swings out
 * from the face, and swung fully in, the fingertips met the helmet's cheek
 * once the head had turned toward them (harness/robot.html?check=1).
 */
const ROCK_IN = 0.35;
/** How much of the wrist's bend the band takes: it sits mostly on the arm. */
const CUFF_SHARE = 0.3;
/**
 * Where the arm runs through each hand's own space (robotHand.ts): the
 * relaxed hand carries straight on, the open one is moulded bent up.
 */
const ENTRY = { open: new THREE.Vector3(1, 0, 0), relaxed: new THREE.Vector3(0, 1, 0) } as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);

const AXIS_DOWN = new THREE.Vector3(0, -1, 0);
const AXIS_PALM = new THREE.Vector3(0, 0, 1);
const NO_TURN = new THREE.Quaternion();

/** A pose as turns, on side s: the arm's (from hanging straight down) and the hand's (from hand space). */
interface Turns {
  arm: THREE.Quaternion;
  hand: THREE.Quaternion;
}

function turnsOf(p: Pose, s: number): Turns {
  const along = new THREE.Vector3(s * p.arm[0], p.arm[1], p.arm[2]).normalize();
  const y = new THREE.Vector3(s * p.fingers[0], p.fingers[1], p.fingers[2]).normalize();
  const z = new THREE.Vector3(s * p.palm[0], p.palm[1], p.palm[2]);
  z.addScaledVector(y, -z.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return {
    arm: new THREE.Quaternion().setFromUnitVectors(AXIS_DOWN, along),
    hand: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)),
  };
}

export class Arm extends THREE.Group {
  /** Undoes the pivot's own z and y turns: to this rig they are numbers. */
  private readonly cancel = new THREE.Group();
  readonly upper = new THREE.Group();
  /** At the wrist band, in the arm's frame: the band and the hand hang in it. */
  readonly wrist = new THREE.Group();
  readonly hand = new THREE.Group();
  readonly cuff = new THREE.Group();
  private readonly rest: Turns;
  private readonly hello: Turns;
  private readonly entry: THREE.Vector3;
  // Scratch for pose(), which runs every frame and must not allocate.
  private readonly qArm = new THREE.Quaternion();
  private readonly qHand = new THREE.Quaternion();
  private readonly qTmp = new THREE.Quaternion();
  private readonly vTmp = new THREE.Vector3();

  constructor(readonly side: number) {
    super();
    this.rotation.z = ARM_DRIVE.rest;
    // The pivot turns by Rx·Ry·Rz; in this order the cancel is exactly
    // Rz⁻¹·Ry⁻¹, and only the sway is left.
    this.cancel.rotation.order = 'ZYX';
    this.add(this.cancel);
    this.cancel.add(this.upper);
    this.upper.add(this.wrist);
    this.wrist.add(this.cuff, this.hand);
    this.hand.scale.setScalar(HAND_SCALE);
    this.wrist.position.y = -(side > 0 ? REACH.up : REACH.down);
    this.rest = turnsOf(side > 0 ? RAISED : HANG, side);
    this.hello = side > 0 ? turnsOf(HELLO, side) : this.rest;
    this.entry = side > 0 ? ENTRY.open : ENTRY.relaxed;
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
    const { rest, hello, qArm, qHand, qTmp, vTmp } = this;
    this.cancel.rotation.set(0, -this.rotation.y, -this.rotation.z);
    const up = smooth(clamp01((this.rotation.z - ARM_DRIVE.rest) / ARM_DRIVE.lift));
    qArm.slerpQuaternions(rest.arm, hello.arm, up);
    // The rock turns the hand in its own plane, about the palm's normal;
    // positive swings the fingers toward the face.
    const rock = this.rotation.y > 0 ? this.rotation.y * ROCK_IN : this.rotation.y;
    qHand.slerpQuaternions(rest.hand, hello.hand, up).multiply(qTmp.setFromAxisAngle(AXIS_PALM, this.side * rock));
    this.upper.quaternion.copy(qArm);
    // The hand in the arm's frame; the band takes a share of the bend.
    this.hand.quaternion.copy(qArm).invert().multiply(qHand);
    vTmp.copy(this.entry).applyQuaternion(this.hand.quaternion);
    qTmp.setFromUnitVectors(AXIS_DOWN, vTmp);
    this.cuff.quaternion.slerpQuaternions(NO_TURN, qTmp, CUFF_SHARE);
  }
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
 * Both arms. children[0] is the raised arm at +x (DUYO's own left, the one
 * that waves hello); children[1] hangs at −x.
 */
export function buildArms(kit: Kit): THREE.Group {
  const arms = new THREE.Group();
  const padGeo = kit.keep(new THREE.SphereGeometry(0.25, 24, 16));
  const cuffGeo = kit.keep(roundRing(0.14, 0.275, 0.19, 40));
  for (const side of [1, -1]) {
    const arm = new Arm(side);
    arm.position.set(side * SHOULDER[0], SHOULDER[1], SHOULDER[2]);

    // The pad caps the shoulder: an upright gold dome on the torso's side.
    const pad = kit.part(padGeo, kit.yellow);
    pad.position.set(side * 0.05, 0.05, 0.04);
    pad.scale.set(0.78, 1.25, 1.15);
    pad.rotation.z = side * 0.28;
    arm.shoulder.add(pad);

    arm.upper.add(kit.part(kit.keep(armGeometry(side > 0 ? REACH.up : REACH.down)), kit.white));
    const cuff = kit.part(cuffGeo, kit.yellow);
    cuff.position.y = -0.01;
    arm.cuff.add(cuff);
    // The raised hand is open in the hello; the hanging one is relaxed, and
    // a right hand, so its shape is the mirror image.
    arm.hand.add(kit.part(kit.keep(handGeometry(side > 0, side < 0)), kit.blue));
    arms.add(arm);
  }
  return arms;
}
