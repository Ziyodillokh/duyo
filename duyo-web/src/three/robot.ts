/**
 * DUYO, built from primitives — the same character the app ships.
 *
 * The reference is the app's own mascot (duyo-mobile/assets/duyo/v2/
 * mascot-default.png is the canonical look; idle, happy, thinking and
 * mascot-head fill in the angles it hides). Proportions were measured off
 * idle.png row by row, as fractions of crown-to-feet height (about 94px to
 * the unit at 400px), and the colours were sampled from the renders. Where
 * this file and those images disagree, the images are right.
 * harness/robot.html renders it for that comparison.
 *
 * Why it is built rather than placed as a picture: a flat image cannot turn,
 * look, blink or wave, and the page needs all four. What makes DUYO DUYO is
 * the head: taller than everything under it, a white helmet with a blue face
 * plate, a black glass visor with two gold-ringed eyes, headphone ears, a
 * star on a stick.
 *
 * Materials are satin, not lacquer (robotSkin.ts): the renders are soft
 * moulded vinyl with broad, low highlights, and the glass shows what is
 * painted on it rather than mirroring the stage's studio.
 */

import * as THREE from 'three';
import {
  bandOn, blobGeometry, onFront, placeOnFront, profile, radiusAt,
  roundRect, roundRing, starGeometry, stitch, topY,
} from './robotShapes';
import type { Blob, V3 } from './robotShapes';
import * as SKIN from './robotSkin';
import { browMaterial, glassMaterial, makeKit, satin, torsoSkin } from './robotSkin';
import type { Kit } from './robotSkin';
import { buildFace } from './robotFace';

// ── Head ───────────────────────────────────────────────────────────────────
// Head space: the head group's origin is the neck pivot, NECK_Y in robot
// space. The helmet is two superellipsoids — a blue face plate over the face
// and the crown, and a white core, wider and further back, that shows at the
// sides, behind and at the chin's corners. Their intersection IS the seam of
// the helmet in the renders, so it needs no modelling of its own; with these
// numbers it runs down in front of the ear, as in thinking.png.
const NECK_Y = -0.1;
const SHELL: Blob = { c: [0, 1.2, 0.2], r: [1.34, 1.2, 0.84], e: [3.6, 2.6, 3], eBelow: 3.4, rBelow: 1.24 };
/** Its own radius and exponent below the centre give idle.png's broad, flat chin. */
const CORE: Blob = { c: [0, 0.95, -0.12], r: [1.52, 1.3, 0.92], e: [3.2, 2.6, 2.6], eBelow: 4.2, rBelow: 1.0 };
/** The visor's and the eyes' shared centre line. */
const FACE_Y = 0.9;
const VISOR = { w: 2.0, h: 1.42, r: 0.44, frame: 0.065, groove: 0.035 };
const EYE_X = 0.56;
/** Forehead lettering: left of centre, with the star beside it. */
const BROW = { x: -0.5, y: 1.93, w: 0.58, h: 0.16 };
/** runtime.ts leans the antenna by this at rest, outward from the crown. */
const ANTENNA_LEAN = 0.2;

// ── Body (robot space; the feet stand on y = -1.96, stage.ts FLOOR_Y) ────────
/** Torso silhouette, bottom to top, as (radius, y): a barrel with a broad chest. */
const TORSO: readonly (readonly [number, number])[] = [
  [0.001, -1.6], [0.42, -1.58], [0.7, -1.5], [0.85, -1.34], [0.9, -1.1], [0.89, -0.82],
  [0.86, -0.5], [0.83, -0.22], [0.79, -0.04], [0.6, 0.1], [0.001, 0.16],
];
/** Front-to-back squash: the renders' torso is a little shallower than wide. */
const TORSO_DEPTH = 0.86;
/** Boot silhouette as (radius, y), radius normalised; scaled to BOOT_R. */
const BOOT: readonly (readonly [number, number])[] = [
  [0.001, -1.96], [0.72, -1.96], [0.9, -1.94], [0.99, -1.87], [1.0, -1.74],
  [0.97, -1.62], [0.88, -1.53], [0.66, -1.46], [0.34, -1.43], [0.001, -1.42],
];
const BOOT_R = { x: 0.46, z: 0.56 };
const SHOULDER: V3 = [0.9, -0.34, 0.02];

// ── Arms ───────────────────────────────────────────────────────────────────
/**
 * How the page drives an arm: rotation.z = rest + wave·(lift + sin·wiggle).
 * runtime.ts writes it (as literals — keep them equal) and harness/robot.ts
 * imports it.
 */
export const ARM_DRIVE = { rest: 0.2, lift: 2.45, wiggle: 0.28 } as const;
// The rig turns that one number into a pose. A straight arm swung that far
// would pass through a head this big, so the upper arm lifts out, shrugs and
// swings toward the viewer, the forearm folds up, and the hand opens beside
// the cheek with its palm to the viewer — happy.png. The wiggle becomes the
// hand waving about its own palm, which also keeps the swing off the cheek.
//
// The shoulder and elbow numbers are solved, not tuned: they put the palm's
// centre beside the ear and in front of it, clear of the cheek and the cup,
// with the elbow bent about 27°. The arms are too short for the forearm to
// stand upright there, so the hand is posed in robot space instead (HAND_UP)
// and the wrist takes up the difference.
const L_UPPER = 0.46; //          shoulder → elbow
const L_FORE = 0.48; //           elbow → wrist; the palm's centre is 0.2 further
const HANG = 0.55; //             rest: the arm hangs this far out from the body
const BEND = 0.7; //              rest: the forearm carried a little forward, as in idle.png
const LIFT = 1.722; //            wave: the upper arm, a little over horizontal
const SWING = 0.771; //           wave: … swung this far toward the viewer
const FOLD = 0.479; //            wave: the elbow folds the forearm up by this
const SHRUG: V3 = [0.1, 0.12, 0.1]; // wave: the shoulder rises into the lift
/** Wave: where the fingers point and the palm faces, x toward the arm's own side. */
const HAND_UP = { fingers: [0.5, 1, 0.1], palm: [-0.15, 0, 1] } as const;
const FLICK = 2.4; //             wiggle → the hand's swing about its palm, per unit of drive
const CURL = 1.7; //              rest: fingers curled into a mitten
const FINGER_X = [-0.16, -0.055, 0.055, 0.16];
/** Lift completes before the wiggle's lowest point, so at a full wave only the hand moves. */
const LIFT_DONE = ((ARM_DRIVE.lift - ARM_DRIVE.wiggle) / ARM_DRIVE.lift) * 0.97;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const swingQ = new THREE.Quaternion();

/**
 * The wrist's own turn that puts the hand at HAND_UP when the arm is fully
 * raised: the target orientation in robot space, less the shoulder's and the
 * elbow's turns at that pose.
 */
function handAtTop(s: number): THREE.Quaternion {
  const f = HAND_UP.fingers;
  const p = HAND_UP.palm;
  const y = new THREE.Vector3(s * f[0], f[1], f[2]).normalize().negate();
  const palm = new THREE.Vector3(s * p[0], p[1], p[2]);
  const z = palm.addScaledVector(y, -palm.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  const target = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  const arm = new THREE.Quaternion()
    .setFromEuler(new THREE.Euler(0, -s * SWING, s * LIFT))
    .multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Z, s * FOLD));
  return arm.invert().multiply(target);
}

class Arm extends THREE.Group {
  /** Undoes the pivot's own z turn: to this rig the drive is a number. */
  private readonly cancel = new THREE.Group();
  readonly upper = new THREE.Group();
  readonly elbow = new THREE.Group();
  readonly wrist = new THREE.Group();
  readonly thumb = new THREE.Group();
  readonly fingers: THREE.Group[] = [];
  /** At rest the palm faces the body and the thumb points forward (idle.png). */
  private readonly handRest: THREE.Quaternion;
  private readonly handUp: THREE.Quaternion;

  constructor(readonly side: number) {
    super();
    this.rotation.z = ARM_DRIVE.rest;
    this.add(this.cancel);
    this.cancel.add(this.upper);
    this.upper.add(this.elbow);
    this.elbow.position.y = -L_UPPER;
    this.elbow.add(this.wrist);
    this.wrist.position.y = -L_FORE;
    this.wrist.add(this.thumb);
    this.handRest = new THREE.Quaternion().setFromAxisAngle(AXIS_Y, (-side * Math.PI) / 2);
    this.handUp = handAtTop(side);
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
    const up = smooth(clamp01(drive / LIFT_DONE));
    const flick = (drive - 1) * FLICK * smooth(clamp01((drive - 0.6) / (LIFT_DONE - 0.6)));
    this.cancel.rotation.z = -this.rotation.z;
    this.upper.position.set(s * SHRUG[0] * up, SHRUG[1] * up, SHRUG[2] * up);
    this.upper.rotation.set(0, -s * SWING * up, s * (HANG + (LIFT - HANG) * up));
    this.elbow.rotation.set(-BEND * (1 - up), 0, s * (FOLD * up + 0.25 * flick));
    this.wrist.quaternion
      .slerpQuaternions(this.handRest, this.handUp, up)
      .multiply(swingQ.setFromAxisAngle(AXIS_Z, s * flick));
    // Curled and shortened at rest, the fingers sink into the palm and the
    // mitten reads as one soft shape; they grow and spread as the arm lifts.
    for (let i = 0; i < this.fingers.length; i++) {
      this.fingers[i].rotation.set(-CURL * (1 - up), 0, (FINGER_X[i] / 0.16) * 0.22 * up);
      this.fingers[i].scale.y = 0.45 + 0.55 * up;
    }
    // Out from the mitten at rest; raised, it stands up beside the fingers.
    this.thumb.rotation.z = s * (0.5 - 0.2 * up);
  }
}

export interface Robot {
  root: THREE.Group;
  /** Origin at the neck pivot; the runtime turns it for gaze. */
  head: THREE.Group;
  body: THREE.Group;
  /**
   * children[0] at +x; children[1] at −x — DUYO's own right hand, the one
   * the runtime waves and happy.png waves with. Each reads its rotation.z as
   * a drive (ARM_DRIVE) and poses shoulder, elbow, wrist and fingers from it.
   */
  arms: THREE.Group;
  legs: THREE.Group;
  /** Pivots at its base on the crown, so it can trail the head's turn. */
  antenna: THREE.Group;
  /** Each eye group; userData.baseX/baseY = rest position. */
  eyes: THREE.Object3D[];
  /**
   * Talking: 0 silent … 1 loudest. Opens the smile downward and brightens
   * the eye rings and mouth, so the voice is seen as well as heard.
   */
  speak: (level: number) => void;
  dispose: () => void;
}

// ── Head ───────────────────────────────────────────────────────────────────

/** Visor glass, its frame and the recess round it, laid on the helmet's curve. */
function buildVisor(kit: Kit, head: THREE.Group): void {
  const { w, h, r, frame, groove } = VISOR;
  const inner = roundRect(w, h, r);
  const outer = roundRect(w + 2 * frame, h + 2 * frame, r + frame);
  const rim = roundRect(w + 2 * (frame + groove), h + 2 * (frame + groove), r + frame + groove);

  const rings = [1, 0.985, 0.96, 0.92, 0.86, 0.76, 0.62, 0.46, 0.3, 0.14, 0.001];
  const glassGeo = stitch(rings.map((s) => inner.map((p) => onFront(SHELL, p.x * s, FACE_Y + p.y * s, 0.014))));
  // UVs across the flat face, so the painted sheen lands where it is drawn.
  const uv = rings.flatMap((s) => inner.flatMap((p) => [(p.x * s) / w + 0.5, (p.y * s) / h + 0.5]));
  glassGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  head.add(kit.part(kit.keep(glassGeo), glassMaterial(kit, w, h, r)));

  // The frame: a rounded bead stitched between the glass's outline and a
  // slightly wider one, standing just proud of the glass. Rows run outermost
  // first, as stitch() needs them to face out …
  const bead = [1, 0.85, 0.68, 0.5, 0.32, 0.15, 0].map((q) => [q, 0.01 + 0.03 * Math.sin(Math.PI * q) ** 0.6] as const);
  head.add(kit.part(kit.keep(bandOn(SHELL, FACE_Y, inner, outer, bead)), kit.keep(satin(SKIN.RIM, 0.45, 0))));
  // … and the dark recess outside it that makes the frame read as a part.
  const recess = [[1, 0.004], [0, 0.004]] as const;
  head.add(kit.part(kit.keep(bandOn(SHELL, FACE_Y, outer, rim, recess)), kit.keep(satin(SKIN.GROOVE, 0.5, 0))));
}

/** Forehead "DUYO" and star — a patch that follows the crown's curve. */
function buildBrow(kit: Kit, head: THREE.Group): void {
  const geo = new THREE.PlaneGeometry(BROW.w, BROW.h, 24, 6);
  const pos = geo.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    onFront(SHELL, pos.getX(i) + BROW.x, pos.getY(i) + BROW.y, 0.006, v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  head.add(kit.part(kit.keep(geo), browMaterial(kit, BROW.w, BROW.h)));

  const star = kit.part(kit.keep(starGeometry(0.17)), kit.yellow);
  placeOnFront(SHELL, star, 0.1, 2.03, -0.02, -0.12);
  head.add(star);
}

/**
 * Ears and antenna. The ears are headphone cups on the white side shells: a
 * deep white cup capped by a thick gold face — its rim is the yellow band
 * seen from the front — with a white ring set just inside that rim and a
 * raised tick on it (mascot-default.png). The antenna is a white stick from
 * the white shell just behind the blue crown, leaning out, so its star rides
 * above and outside the head's top corner.
 */
function buildHeadgear(kit: Kit, head: THREE.Group): THREE.Group {
  // Each ring's own y is the cup's outward axis: [geometry, material, offset].
  const cups: [THREE.BufferGeometry, THREE.Material, number][] = [
    [kit.keep(roundRing(0, 0.43, 0.3)), kit.white, 0.05],
    [kit.keep(roundRing(0, 0.41, 0.14)), kit.yellow, 0.24],
    [kit.keep(roundRing(0.31, 0.355, 0.03, 48)), kit.white, 0.31],
  ];
  const tickGeo = kit.keep(new THREE.CapsuleGeometry(0.03, 0.12, 4, 10));
  for (const sx of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(sx * CORE.r[0] * 0.95, FACE_Y, -0.1);
    ear.rotation.y = -sx * 0.25;
    for (const [geo, mat, out] of cups) {
      const cup = kit.part(geo, mat);
      cup.position.x = sx * out;
      cup.rotation.z = -sx * (Math.PI / 2);
      ear.add(cup);
    }
    // The tick: a small raised chevron on the gold face.
    for (const k of [-1, 1]) {
      const tick = kit.part(tickGeo, kit.yellow);
      tick.position.set(sx * 0.32, k * 0.05, 0.02);
      tick.rotation.set(k * 0.7, 0, 0);
      ear.add(tick);
    }
    head.add(ear);
  }

  const antenna = new THREE.Group();
  const ax = -1.1;
  const az = -0.36;
  antenna.position.set(ax, topY(CORE, ax, az) - 0.05, az);
  antenna.rotation.z = ANTENNA_LEAN;
  // A lean of its own on top of the runtime's, so at rest the star clears
  // the crown's corner the way it does in every render.
  const stick = new THREE.Group();
  stick.rotation.z = 0.22;
  const stalk = kit.part(kit.keep(new THREE.CylinderGeometry(0.026, 0.034, 0.64, 12)), kit.white);
  stalk.position.y = 0.32;
  const star = kit.part(kit.keep(starGeometry(0.22)), kit.yellow);
  star.position.set(0, 0.66, -0.02);
  star.rotation.z = 0.2;
  stick.add(stalk, star);
  antenna.add(stick);
  head.add(antenna);
  return antenna;
}

// ── Body and limbs ─────────────────────────────────────────────────────────

function buildBody(kit: Kit): THREE.Group {
  const body = new THREE.Group();
  const pts = profile(TORSO, 64);
  const skin = torsoSkin(pts);
  const mTorso = kit.keep(satin(0xffffff, 0.44));
  mTorso.map = kit.keep(skin.map);
  mTorso.bumpMap = kit.keep(skin.bump);
  mTorso.bumpScale = 2.2;
  // phiStart −π puts the texture's middle column on the front (+z).
  const geo = new THREE.LatheGeometry(pts, 88, -Math.PI, Math.PI * 2);
  geo.scale(1, 1, TORSO_DEPTH);
  body.add(kit.part(kit.keep(geo), mTorso));
  return body;
}

/**
 * Gold shoulder pad, white arm, gold cuff, and a big smooth blue mitten: a
 * rounded palm, four fingers and a thumb. At rest the fingers curl into the
 * palm and the mitten reads as one soft shape; raised, they open and spread.
 */
function buildArms(kit: Kit): THREE.Group {
  const arms = new THREE.Group();
  const padGeo = kit.keep(new THREE.SphereGeometry(0.265, 24, 16));
  const upperGeo = kit.keep(new THREE.CapsuleGeometry(0.22, 0.16, 8, 20));
  const elbowGeo = kit.keep(new THREE.SphereGeometry(0.212, 20, 14));
  const foreGeo = kit.keep(new THREE.CapsuleGeometry(0.21, 0.12, 8, 20));
  const cuffGeo = kit.keep(roundRing(0.14, 0.245, 0.12, 32));
  const palmGeo = kit.keep(new THREE.SphereGeometry(0.34, 28, 20));
  const fingerGeo = kit.keep(new THREE.CapsuleGeometry(0.08, 0.16, 6, 14));
  const thumbGeo = kit.keep(new THREE.CapsuleGeometry(0.088, 0.1, 6, 14));
  // [0] at +x, [1] at −x: the runtime waves children[1].
  for (const side of [1, -1]) {
    const arm = new Arm(side);
    arm.position.set(side * SHOULDER[0], SHOULDER[1], SHOULDER[2]);

    const pad = kit.part(padGeo, kit.yellow);
    pad.position.set(side * 0.03, 0.03, 0);
    pad.scale.set(1.05, 0.7, 1);
    pad.rotation.z = side * 0.35;
    const upper = kit.part(upperGeo, kit.white);
    upper.position.y = -0.17;
    arm.upper.add(pad, upper);

    const fore = kit.part(foreGeo, kit.white);
    fore.position.y = -0.19;
    const cuff = kit.part(cuffGeo, kit.yellow);
    cuff.position.y = -0.4;
    arm.elbow.add(kit.part(elbowGeo, kit.white), fore, cuff);

    const palm = kit.part(palmGeo, kit.blue);
    palm.position.y = -0.2;
    palm.scale.set(1.04, 1.02, 0.92);
    const thumb = kit.part(thumbGeo, kit.blue);
    thumb.position.y = -0.1;
    arm.thumb.position.set(side * 0.26, -0.14, 0.05);
    arm.thumb.add(thumb);
    arm.wrist.add(palm);
    for (const x of FINGER_X) {
      const pivot = new THREE.Group();
      pivot.position.set(x, -0.38, 0);
      const finger = kit.part(fingerGeo, kit.blue);
      finger.position.y = -0.14;
      pivot.add(finger);
      arm.wrist.add(pivot);
      arm.fingers.push(pivot);
    }
    arms.add(arm);
  }
  return arms;
}

/**
 * Short stubs into round moon boots, each with a flat gold band where the
 * dome starts and a gold tab on the toe.
 */
function buildLegs(kit: Kit): THREE.Group {
  const legs = new THREE.Group();
  const bootPts = profile(BOOT, 40);
  const bootGeo = kit.keep(new THREE.LatheGeometry(bootPts, 64, -Math.PI, Math.PI * 2));
  const bandY = -1.54;
  const bandR = radiusAt(bootPts, bandY) - 0.006;
  // A flat stripe standing just proud of the boot, not a bead.
  const bandPts = Array.from({ length: 25 }, (_, i) => {
    const a = -Math.PI / 2 + (i / 24) * Math.PI * 2;
    return new THREE.Vector2(bandR + Math.cos(a) * 0.03, bandY + Math.sin(a) * 0.055);
  });
  const bandGeo = kit.keep(new THREE.LatheGeometry(bandPts, 64));
  const tab = new THREE.Shape([
    new THREE.Vector2(-0.12, 0),
    new THREE.Vector2(0.12, 0),
    new THREE.Vector2(0.075, 0.12),
    new THREE.Vector2(-0.075, 0.12),
  ]);
  const tabGeo = kit.keep(
    new THREE.ExtrudeGeometry(tab, { depth: 0.02, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 3 }),
  );
  const stubGeo = kit.keep(new THREE.CylinderGeometry(0.2, 0.22, 0.3, 20));
  const bootZ = 0.06;
  const tabY = -1.86;
  for (const sx of [-1, 1]) {
    const x = sx * 0.56;
    const stub = kit.part(stubGeo, kit.white);
    stub.position.set(sx * 0.44, -1.36, 0);
    const boot = kit.part(bootGeo, kit.white);
    const stripe = kit.part(bandGeo, kit.yellow);
    for (const o of [boot, stripe]) {
      o.position.set(x, 0, bootZ);
      o.scale.set(BOOT_R.x, 1, BOOT_R.z);
    }
    const toe = kit.part(tabGeo, kit.yellow);
    toe.position.set(x, tabY, bootZ + BOOT_R.z * radiusAt(bootPts, tabY + 0.06) - 0.012);
    legs.add(stub, boot, stripe, toe);
  }
  return legs;
}

export function buildRobot(): Robot {
  const bin: { dispose: () => void }[] = [];
  const kit = makeKit(bin);

  const head = new THREE.Group();
  head.position.y = NECK_Y;
  head.add(kit.part(kit.keep(blobGeometry(SHELL)), kit.blue), kit.part(kit.keep(blobGeometry(CORE)), kit.white));
  buildVisor(kit, head);
  const { eyes, mouth, lit } = buildFace(kit, head, { shell: SHELL, faceY: FACE_Y, eyeX: EYE_X });
  buildBrow(kit, head);
  const antenna = buildHeadgear(kit, head);

  const body = buildBody(kit);
  const arms = buildArms(kit);
  const legs = buildLegs(kit);

  const root = new THREE.Group();
  root.add(head, body, arms, legs);

  const dispose = () => {
    for (const d of bin) d.dispose();
  };
  const speak = (level: number) => {
    const v = Math.min(1, Math.max(0, level));
    mouth.scale.set(1 - 0.12 * v, 1 + 2.4 * v, 1);
    for (const [m, rest] of lit) m.emissiveIntensity = rest * (1 + 1.6 * v);
  };
  return { root, head, body, arms, legs, antenna, eyes, speak, dispose };
}
