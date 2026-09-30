/**
 * DUYO's head, as mascot-default.png draws it: a soft, wide dome as tall as
 * everything under it. Split from robot.ts, which puts it on the body.
 *
 * Head space: the head group's origin is the neck pivot. The helmet is two
 * superellipsoids — a blue shell over the crown and the face, and a white
 * core, wider and further back, that shows at the sides, behind, at the
 * top corners under the antenna and at the chin's corners. Their
 * intersection IS the seam of the helmet in the render, so it needs no
 * modelling of its own.
 */

import * as THREE from 'three';
import { bandOn, blobGeometry, onFront, placeOnFront, roundRect, roundRing, starGeometry, stitch } from './robotShapes';
import type { Blob } from './robotShapes';
import * as SKIN from './robotSkin';
import { browMaterial, glassMaterial, satin } from './robotSkin';
import type { Kit } from './robotSkin';

export const SHELL: Blob = { c: [0, 1.12, -0.1], r: [1.54, 1.42, 0.88], e: [3.0, 1.65, 3.0], eBelow: 5, rBelow: 1.16 };
/**
 * Its own radius and exponent below the centre give the render's broad,
 * flat chin; its shallow front keeps it behind the blue face everywhere the
 * visor reaches (0.12 to spare), while its deep back gives the silhouette.
 */
export const CORE: Blob = {
  c: [0, 1.07, -0.2], r: [1.72, 1.36, 0.7], e: [3.0, 1.65, 2.6], eBelow: 4.5, rBelow: 1.2, rBack: 1.2,
};
/** The visor's and the eyes' shared centre line. */
export const FACE_Y = 0.96;
const VISOR = { w: 2.5, h: 1.58, r: 0.44, frame: 0.06, groove: 0.025 };
export const EYE_X = 0.67;
/** Forehead lettering: left of centre, with the star beside it. */
const BROW = { x: -0.64, y: 2.12, w: 0.7, h: 0.19 };
const BROW_STAR = { x: 0.06, y: 2.2, r: 0.2 };
/** robotLife leans the antenna by this at rest, outward from the crown. */
export const ANTENNA_REST = 0.2;
/** Where the antenna leaves the white core: its top-left, behind the blue. */
const ANTENNA_BASE = { x: -1.5, y: 1.78, z: -0.3 };
/** Headphone cups: radius, and where they sit on the core's sides. */
const EAR = { r: 0.5, y: FACE_Y, z: -0.08, toe: 0.12 };

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
  head.add(kit.part(kit.keep(glassGeo), glassMaterial(kit, w, h)));

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

  const star = kit.part(kit.keep(starGeometry(BROW_STAR.r)), kit.yellow);
  placeOnFront(SHELL, star, BROW_STAR.x, BROW_STAR.y, -0.03, -0.1);
  head.add(star);
}

/**
 * Ears: headphone cups on the white core's sides, as mascot-default.png's
 * near ear shows them — a white cylinder standing off the helmet, capped by
 * a thin gold face whose edge is the yellow band seen from the front, a
 * white ring set just inside that edge, and a big pale chevron on the gold.
 */
function buildEars(kit: Kit, head: THREE.Group): void {
  // Each ring's own y is the cup's outward axis: [geometry, material, offset].
  const cups: [THREE.BufferGeometry, THREE.Material, number][] = [
    [kit.keep(roundRing(0, EAR.r * 0.97, 0.3)), kit.white, 0.0],
    [kit.keep(roundRing(0, EAR.r, 0.08)), kit.yellow, 0.15],
    [kit.keep(roundRing(EAR.r * 0.72, EAR.r * 0.8, 0.03, 48)), kit.white, 0.19],
  ];
  const tickGeo = kit.keep(new THREE.CapsuleGeometry(0.04, 0.22, 4, 10));
  for (const sx of [-1, 1]) {
    const ear = new THREE.Group();
    ear.name = 'ear';
    ear.position.set(sx * CORE.r[0] * 0.97, EAR.y, EAR.z);
    ear.rotation.y = -sx * EAR.toe;
    for (const [geo, mat, out] of cups) {
      const cup = kit.part(geo, mat);
      cup.position.x = sx * out;
      cup.rotation.z = -sx * (Math.PI / 2);
      ear.add(cup);
    }
    // The chevron: two raised pale strokes meeting at a point toward the back.
    for (const k of [-1, 1]) {
      const tick = kit.part(tickGeo, kit.white);
      tick.position.set(sx * 0.19, k * 0.085, -0.03);
      tick.rotation.set(k * 0.75, 0, 0);
      ear.add(tick);
    }
    head.add(ear);
  }
}

/**
 * The antenna: a thin white stick from the white core just behind the blue
 * crown, leaning out, so its star rides above and outside the head's top
 * corner. Pivots at its base.
 */
function buildAntenna(kit: Kit, head: THREE.Group): THREE.Group {
  const antenna = new THREE.Group();
  antenna.position.set(ANTENNA_BASE.x, ANTENNA_BASE.y, ANTENNA_BASE.z);
  antenna.rotation.z = ANTENNA_REST;
  // Its own lean on top of robotLife's, so at rest the star clears the
  // crown's corner the way it does in the render.
  const stick = new THREE.Group();
  stick.rotation.set(0.1, 0, 0.02);
  const stalk = kit.part(kit.keep(new THREE.CylinderGeometry(0.034, 0.04, 0.62, 12)), kit.white);
  stalk.position.y = 0.31;
  const star = kit.part(kit.keep(starGeometry(0.23)), kit.yellow);
  star.position.set(0, 0.66, -0.03);
  // Turned to the key light and the lens, so its face reads lemon, not amber.
  star.rotation.set(-0.2, -0.45, 0.14);
  stick.add(stalk, star);
  antenna.add(stick);
  head.add(antenna);
  return antenna;
}

/** The helmet with its visor, lettering, ears and antenna. */
export function buildHelmet(kit: Kit, head: THREE.Group): THREE.Group {
  head.add(kit.part(kit.keep(blobGeometry(SHELL)), kit.blue), kit.part(kit.keep(blobGeometry(CORE)), kit.white));
  buildVisor(kit, head);
  buildBrow(kit, head);
  buildEars(kit, head);
  return buildAntenna(kit, head);
}
