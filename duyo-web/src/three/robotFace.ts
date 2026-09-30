/**
 * DUYO's face: two gold-ringed eyes under the visor glass, and the smile
 * that opens when it talks. Split from robot.ts, which places it.
 */

import * as THREE from 'three';
import { ellipseShape, placeOnFront, roundedShape, smileShape } from './robotShapes';
import type { Blob } from './robotShapes';
import * as SKIN from './robotSkin';
import { glow, gradeY, satin } from './robotSkin';
import type { Kit } from './robotSkin';

/** Where on the head the face goes: the shell it sits on, the eyes' line and spread. */
export interface FacePlace {
  shell: Blob;
  faceY: number;
  eyeX: number;
}

/**
 * Eyes and smile. Each eye, from outside in: a hairline of reflected light,
 * a thin bright gold ring, a dark bezel, then dark glass that lightens toward
 * the bottom, with a big curved highlight at the upper right and a small dash
 * at the left — mascot-head.png and mascot-default.png. It sits nearly flush
 * with the visor, as if under the same glass, and is one group so the
 * runtime can squash it to blink and nudge it to lead the head.
 */
export interface Face {
  eyes: THREE.Object3D[];
  /** The smile's group, hinged at its flat top edge: scaling y opens it downward. */
  mouth: THREE.Group;
  /** Eye rings and smile, with their resting glow, for speech to brighten. */
  lit: Array<[THREE.MeshPhysicalMaterial, number]>;
}

export function buildFace(kit: Kit, head: THREE.Group, at: FacePlace): Face {
  const hairGeo = kit.keep(new THREE.TorusGeometry(0.238, 0.006, 6, 48));
  const ringGeo = kit.keep(new THREE.TorusGeometry(0.21, 0.026, 12, 56));
  const bezelGeo = kit.keep(new THREE.CircleGeometry(0.205, 48));
  const pupilGeo = kit.keep(new THREE.SphereGeometry(0.152, 32, 18));
  gradeY(pupilGeo, SKIN.PUPIL, SKIN.PUPIL_LOW, 0, -0.15);
  const mHair = kit.keep(satin(0xb9c3cf, 0.4, 0));
  const mRing = kit.keep(glow(SKIN.RING, 0.2, 0.5));
  const mBezel = kit.keep(satin(SKIN.BEZEL, 0.6, 0));
  const mPupil = kit.keep(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, specularIntensity: 0.3 }));
  const mShine = kit.keep(new THREE.MeshBasicMaterial({ color: 0xf2f4f8 }));
  const shine = roundedShape([[-0.06, 0.04], [0.025, 0.066], [0.07, 0.026], [0.058, -0.045], [-0.012, -0.026]]);

  const eyes: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group();
    placeOnFront(at.shell, eye, sx * at.eyeX, at.faceY, 0.014);
    const ring = kit.part(ringGeo, mRing);
    ring.scale.z = 0.6;
    const bezel = kit.part(bezelGeo, mBezel);
    bezel.position.z = 0.004;
    const pupil = kit.part(pupilGeo, mPupil);
    pupil.scale.z = 0.36;
    const big = kit.flat(shine, mShine);
    big.position.set(0.052, 0.052, 0.056);
    const dash = kit.flat(ellipseShape(0.03, 0.011), mShine);
    dash.position.set(-0.072, -0.012, 0.048);
    eye.add(kit.part(hairGeo, mHair), ring, bezel, pupil, big, dash);
    eye.userData.baseX = eye.position.x;
    eye.userData.baseY = eye.position.y;
    head.add(eye);
    eyes.push(eye);
  }

  // A small smile, as mascot-head.png draws it: flat top, round bottom, a
  // saturated blue inside a darker outline, lit a little from within so it
  // reads on black glass.
  const mEdge = kit.keep(glow(SKIN.SMILE_EDGE, 0.4));
  const mFill = kit.keep(glow(SKIN.SMILE, 0.45));
  const mouth = new THREE.Group();
  placeOnFront(at.shell, mouth, 0, at.faceY - 0.4, 0.016);
  const fill = kit.part(kit.keep(new THREE.ShapeGeometry(smileShape(0.235, 0.086), 16)), mFill);
  fill.position.set(0, -0.012, 0.003);
  mouth.add(kit.part(kit.keep(new THREE.ShapeGeometry(smileShape(0.3, 0.112), 16)), mEdge), fill);
  head.add(mouth);
  return { eyes, mouth, lit: [[mRing, mRing.emissiveIntensity], [mEdge, 0.4], [mFill, 0.45]] };
}
