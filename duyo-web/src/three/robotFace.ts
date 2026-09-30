/**
 * DUYO's face: two big gold-ringed eyes under the visor glass, and the
 * mouth that exists only while it talks. Split from robot.ts, which places
 * it.
 */

import * as THREE from 'three';
import { ellipseShape, placeOnFront, roundedShape, roundRing, smileShape } from './robotShapes';
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

/** The eye, outside in, as radii: silver hairline, thick gold ring, dark bezel, glass pupil. */
const EYE = { hair: 0.293, ringOut: 0.281, ringIn: 0.216, pupil: 0.184 };
/** The eyes sit a little above the visor's middle. */
const EYE_RISE = 0.08;
/** The open smile at full voice: width, depth, and how far below the eye line its top sits. */
const MOUTH = { w: 0.48, h: 0.22, drop: 0.1 };

export interface Face {
  eyes: THREE.Object3D[];
  speak: (level: number) => void;
}

/**
 * Each eye, from outside in: a hairline of reflected light, a thick warm
 * gold ring lit from within, a dark bezel, then a glossy black pupil that
 * lightens toward the bottom, with a big curved highlight at the upper
 * right and a small dash at the lower left — mascot-default.png. It sits
 * nearly flush with the visor, as if under the same glass, and is one group
 * so the runtime can squash it to blink and nudge it to lead the head.
 */
function buildEyes(kit: Kit, head: THREE.Group, at: FacePlace, mRing: THREE.Material): THREE.Object3D[] {
  const hairGeo = kit.keep(new THREE.TorusGeometry(EYE.hair, 0.007, 6, 64));
  const ringGeo = kit.keep(roundRing(EYE.ringIn, EYE.ringOut, 0.05, 64));
  const bezelGeo = kit.keep(new THREE.CircleGeometry(EYE.ringIn + 0.005, 56));
  const pupilGeo = kit.keep(new THREE.SphereGeometry(EYE.pupil, 36, 20));
  gradeY(pupilGeo, SKIN.PUPIL, SKIN.PUPIL_LOW, 0.02, -EYE.pupil);
  const mHair = kit.keep(satin(0xc4ccd6, 0.4, 0));
  const mBezel = kit.keep(satin(SKIN.BEZEL, 0.6, 0));
  const mPupil = kit.keep(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.2, specularIntensity: 0.3 }));
  const mShine = kit.keep(new THREE.MeshBasicMaterial({ color: 0xeef1f6 }));
  const shine = roundedShape([[-0.075, 0.05], [0.03, 0.086], [0.092, 0.034], [0.078, -0.06], [-0.012, -0.034]]);

  const eyes: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group();
    placeOnFront(at.shell, eye, sx * at.eyeX, at.faceY + EYE_RISE, 0.012);
    const ring = kit.part(ringGeo, mRing);
    ring.rotation.x = Math.PI / 2;
    ring.position.z = 0.012;
    const bezel = kit.part(bezelGeo, mBezel);
    bezel.position.z = 0.004;
    const pupil = kit.part(pupilGeo, mPupil);
    pupil.scale.z = 0.34;
    const big = kit.flat(shine, mShine);
    big.position.set(0.062, 0.062, 0.068);
    const dash = kit.flat(ellipseShape(0.036, 0.012), mShine);
    dash.position.set(-0.088, -0.028, 0.06);
    dash.rotation.z = 0.15;
    eye.add(kit.part(hairGeo, mHair), ring, bezel, pupil, big, dash);
    eye.userData.baseX = eye.position.x;
    eye.userData.baseY = eye.position.y;
    head.add(eye);
    eyes.push(eye);
  }
  return eyes;
}

/**
 * The talking mouth, happy.png's open smile: a gold rim round a warm,
 * lit-from-within mouth, with a white band of teeth along its flat top.
 * Hinged at that top edge, so scaling y opens it downward. It is not there
 * at all while DUYO is silent: mascot-default.png has no mouth.
 */
function buildMouth(kit: Kit, head: THREE.Group, at: FacePlace): { mouth: THREE.Group; mRim: THREE.MeshPhysicalMaterial } {
  const { w, h } = MOUTH;
  const mRim = kit.keep(glow(SKIN.MOUTH_RIM, 0.5));
  const mTeeth = kit.keep(glow(0xf4f1ea, 0.35));
  const mInside = kit.keep(new THREE.MeshBasicMaterial({ vertexColors: true }));
  const inside = new THREE.ShapeGeometry(smileShape(w * 0.86, h * 0.84), 16);
  gradeY(inside, SKIN.MOUTH_DEEP, SKIN.MOUTH_LOW, -0.04, -h * 0.84);
  const mouth = new THREE.Group();
  placeOnFront(at.shell, mouth, 0, at.faceY - MOUTH.drop, 0.02);
  const rim = kit.part(kit.keep(new THREE.ShapeGeometry(smileShape(w, h), 16)), mRim);
  const fill = kit.part(kit.keep(inside), mInside);
  fill.position.set(0, -h * 0.07, 0.003);
  const teeth = kit.part(kit.keep(new THREE.ShapeGeometry(smileShape(w * 0.8, h * 0.2), 12)), mTeeth);
  teeth.position.set(0, -h * 0.07, 0.006);
  teeth.scale.y = 0.9;
  mouth.add(rim, fill, teeth);
  mouth.visible = false;
  head.add(mouth);
  return { mouth, mRim };
}

export function buildFace(kit: Kit, head: THREE.Group, at: FacePlace): Face {
  const mRing = kit.keep(glow(SKIN.RING, 0.28, 0.45));
  const ringRest = mRing.emissiveIntensity;
  const eyes = buildEyes(kit, head, at, mRing);
  const { mouth, mRim } = buildMouth(kit, head, at);
  const rimRest = mRim.emissiveIntensity;

  const speak = (level: number) => {
    const v = Math.min(1, Math.max(0, level));
    // A mouth that is barely open still reads as a slit: it appears at once
    // at a sliver of its depth and opens from there.
    const open = v * v * (3 - 2 * v);
    mouth.visible = v > 0.01;
    mouth.scale.set(0.72 + 0.28 * open, 0.14 + 0.86 * open, 1);
    mRing.emissiveIntensity = ringRest * (1 + 1.4 * v);
    mRim.emissiveIntensity = rimRest * (1 + 0.8 * v);
  };
  return { eyes, speak };
}
