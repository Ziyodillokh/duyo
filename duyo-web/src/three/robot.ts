/**
 * DUYO, built from primitives — the same character the app ships.
 *
 * The reference is the app's own mascot, and one picture above all:
 * duyo-mobile/assets/duyo/v2/mascot-default.png. Its silhouette, pose and
 * colours were matched by overlaying renders on it (harness/robot.html
 * ?match=1); idle.png, happy.png and mascot-head.png fill in only what it
 * hides — the back, and the open smile. Where this code and that picture
 * disagree, the picture is right.
 *
 * Why it is built rather than placed as a picture: a flat image cannot turn,
 * look, blink or wave, and the page needs all four. What makes DUYO DUYO is
 * the chibi build: a wide soft dome of a head as tall as everything under
 * it, a black glass visor with two gold-ringed eyes, headphone ears and a
 * star on a stick, over a short barrel of a body standing straight in two
 * wide moon boots.
 *
 * The parts live in their own files: robotHead.ts (helmet, visor, forehead
 * lettering, ears, antenna), robotFace.ts (eyes and the talking mouth),
 * robotBody.ts (torso and boots), robotLettering.ts (the belly's moulded
 * "DUYO"), robotArms.ts (the arm rig), robotSkin.ts (palette, materials and
 * painted skins) and robotShapes.ts (geometry).
 *
 * Materials are satin, not lacquer (robotSkin.ts): the render is soft
 * moulded vinyl with broad, low highlights, and the glass shows what is
 * painted on it rather than mirroring the stage's studio.
 */

import * as THREE from 'three';
import { buildArms } from './robotArms';
import { buildBody, buildLegs } from './robotBody';
import { buildFace } from './robotFace';
import { buildHelmet, EYE_X, FACE_Y, SHELL } from './robotHead';
import { makeKit } from './robotSkin';

export { ARM_DRIVE } from './robotArms';
export { ANTENNA_REST } from './robotHead';

/**
 * Where the head pivots on the body (robot space; the feet stand on
 * y = −1.96). Forward of the body's axis: in the render the big head
 * overhangs the chest, and the 3/4 view shows it.
 */
const NECK_Y = -0.2;
const NECK_Z = 0.2;

export interface Robot {
  root: THREE.Group;
  /** Origin at the neck pivot; the runtime turns it for gaze. */
  head: THREE.Group;
  body: THREE.Group;
  /**
   * children[0] at +x: DUYO's own left arm, raised with its hand up in the
   * render's little hello — the one that waves when DUYO talks.
   * children[1] at −x: its own right, hanging in a fist. Each reads its
   * rotation.z as a drive (ARM_DRIVE) and poses shoulder and wrist from it.
   */
  arms: THREE.Group;
  legs: THREE.Group;
  /** Pivots at its base on the crown, so it can trail the head's turn. */
  antenna: THREE.Group;
  /** Each eye group; userData.baseX/baseY = rest position. */
  eyes: THREE.Object3D[];
  /**
   * Talking: 0 silent … 1 loudest. At 0 there is no mouth at all, as in the
   * render; as the level rises one appears and opens into happy.png's open
   * smile, and the eye rings brighten, so the voice is seen as well as heard.
   */
  speak: (level: number) => void;
  dispose: () => void;
}

export function buildRobot(): Robot {
  const bin: { dispose: () => void }[] = [];
  const kit = makeKit(bin);

  const head = new THREE.Group();
  head.position.set(0, NECK_Y, NECK_Z);
  const antenna = buildHelmet(kit, head);
  const face = buildFace(kit, head, { shell: SHELL, faceY: FACE_Y, eyeX: EYE_X });

  const body = buildBody(kit);
  const arms = buildArms(kit);
  const legs = buildLegs(kit);

  const root = new THREE.Group();
  root.add(head, body, arms, legs);

  const dispose = () => {
    for (const d of bin) d.dispose();
  };
  return { root, head, body, arms, legs, antenna, eyes: face.eyes, speak: face.speak, dispose };
}
