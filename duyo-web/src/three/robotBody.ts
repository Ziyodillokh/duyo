/**
 * DUYO below the neck: a short, wide barrel of a torso sitting straight
 * down into two wide, low moon boots — mascot-default.png has no legs to
 * speak of. Split from robot.ts, which places the head on top of this.
 *
 * Robot space: the feet stand on y = −1.96 (stage.ts FLOOR_Y).
 */

import * as THREE from 'three';
import { bellyWord } from './robotLettering';
import { profile, radiusAt } from './robotShapes';
import { BELT, letterMaterials, satin, torsoSkin } from './robotSkin';
import type { Kit } from './robotSkin';

/** Torso silhouette, bottom to top, as (radius, y): a barrel, widest at the belly. */
const TORSO: readonly (readonly [number, number])[] = [
  [0.001, -1.64], [0.44, -1.62], [0.74, -1.54], [0.9, -1.4], [0.95, -1.18], [0.96, -0.92],
  [0.94, -0.68], [0.9, -0.46], [0.8, -0.28], [0.6, -0.14], [0.001, -0.08],
];
/** Front-to-back squash: the render's torso is a little shallower than wide. */
export const TORSO_DEPTH = 0.9;

/**
 * Boot silhouette as (radius, y), radius normalised and scaled to BOOT_R: a
 * flat sole, a full rounded side, and a low dome the torso sits into.
 */
const BOOT: readonly (readonly [number, number])[] = [
  [0.001, -1.96], [0.78, -1.96], [0.94, -1.93], [1.0, -1.83], [0.99, -1.7],
  [0.94, -1.58], [0.84, -1.48], [0.64, -1.39], [0.34, -1.33], [0.001, -1.31],
];
const BOOT_R = { x: 0.5, z: 0.66 };
/** Boot centres: wide apart, a little forward of the torso's axis. */
const BOOT_X = 0.59;
const BOOT_Z = 0.12;
/** The thin gold band round each boot's rim, as (y, half-height, stand-off). */
const BAND = { y: -1.49, h: 0.03, lift: 0.02 };
/** The gold tab on each toe: bottom width, top width, height, where it sits, how proud and how round. */
const TAB = { bottom: 0.27, top: 0.19, h: 0.15, y: -1.86, thick: 0.035, bevel: 0.03 };

/** Torso: one lathe painted with the chest panel, and the moulded belly lettering. */
export function buildBody(kit: Kit): THREE.Group {
  const body = new THREE.Group();
  const pts = profile(TORSO, 56);
  const skin = torsoSkin(pts);
  const mTorso = kit.keep(satin(0xffffff, 0.44));
  mTorso.map = kit.keep(skin.map);
  mTorso.bumpMap = kit.keep(skin.bump);
  mTorso.bumpScale = 2.6;
  // phiStart −π puts the texture's middle column on the front (+z).
  const geo = new THREE.LatheGeometry(pts, 88, -Math.PI, Math.PI * 2);
  geo.scale(1, 1, TORSO_DEPTH);
  const torso = kit.part(kit.keep(geo), mTorso);
  torso.name = 'torso';
  body.add(torso);
  const [gold, blue] = bellyWord(pts, TORSO_DEPTH, BELT);
  const [mGold, mBlue] = letterMaterials(kit);
  body.add(kit.part(kit.keep(gold), mGold), kit.part(kit.keep(blue), mBlue));
  return body;
}

/** A flat gold stripe standing just proud of the boot, following its curve. */
function bandGeometry(bootPts: THREE.Vector2[]): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const y = BAND.y - BAND.h + (2 * BAND.h * i) / n;
    // Rounded edges: the stripe's stand-off falls away at its top and bottom.
    const k = Math.sin((Math.PI * i) / n) ** 0.35;
    pts.push(new THREE.Vector2(radiusAt(bootPts, y) + BAND.lift * k, y));
  }
  return new THREE.LatheGeometry(pts, 72);
}

/**
 * The toe tab: a moulded gold pillow on the boot's rounded toe. Built as a
 * grid over the trapezoid, each point carried out to the boot's front
 * surface at its own x and height and raised by a rounded edge profile —
 * an extruded tab's cap is two big triangles, and the toe bulged through
 * its middle. Its rim sinks just under the boot, so it reads as one
 * moulded part. Boot-local, centred on the boot.
 */
function toeTab(bootPts: THREE.Vector2[]): THREE.BufferGeometry {
  const nu = 14;
  const nv = 8;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    const half = THREE.MathUtils.lerp(TAB.bottom, TAB.top, v) / 2;
    const y = TAB.y + v * TAB.h;
    const r = radiusAt(bootPts, y);
    for (let i = 0; i <= nu; i++) {
      const u = (2 * i) / nu - 1;
      const x = u * half;
      const edge = Math.min((1 - Math.abs(u)) * half, v * TAB.h, (1 - v) * TAB.h);
      const k = Math.min(1, edge / TAB.bevel);
      const lift = -0.004 + (TAB.thick + 0.004) * Math.sqrt(k * (2 - k));
      const front = BOOT_R.z * Math.sqrt(Math.max(0, r * r - (x / BOOT_R.x) ** 2));
      pos.push(x, y, front + lift);
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      idx.push(a, a + 1, a + nu + 1, a + 1, a + nu + 2, a + nu + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Two moon boots, each a lathe squashed long, with a gold band round the
 * top and a gold trapezoid tab on the toe.
 */
export function buildLegs(kit: Kit): THREE.Group {
  const legs = new THREE.Group();
  const bootPts = profile(BOOT, 32);
  const bootGeo = kit.keep(new THREE.LatheGeometry(bootPts, 64, -Math.PI, Math.PI * 2));
  const bandGeo = kit.keep(bandGeometry(bootPts));
  const tabGeo = kit.keep(toeTab(bootPts));
  for (const sx of [-1, 1]) {
    const x = sx * BOOT_X;
    const boot = kit.part(bootGeo, kit.white);
    const stripe = kit.part(bandGeo, kit.yellow);
    for (const o of [boot, stripe]) {
      o.position.set(x, 0, BOOT_Z);
      o.scale.set(BOOT_R.x, 1, BOOT_R.z);
    }
    const toe = kit.part(tabGeo, kit.yellow);
    toe.position.set(x, 0, BOOT_Z);
    legs.add(boot, stripe, toe);
  }
  return legs;
}
