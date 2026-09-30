/**
 * DUYO's hands, sculpted: a soft mitten palm, four tapered fingers and a
 * thumb, blended into one moulded surface (robotSdf.ts) — the chunky,
 * friendly glove of a vinyl toy, not a bunch of balls.
 *
 * Two hands. The raised one is open in a "hi": fingers gently spread, palm
 * out. The hanging one rests in a soft toy fist, the thumb across its
 * front, as the renders' lowered hand is.
 *
 * Hand space: the origin is the centre of the wrist band; the fingers point
 * +y, the palm faces +z, and the thumb is on −x (a left hand, held up
 * palm-out). `mirror` makes the right hand. The arm comes in from −y for
 * the resting hand, and from −x — bent up at the wrist — for the open one.
 */

import * as THREE from 'three';
import { meshField, pillow, roundCone, smin } from './robotSdf';
import type { Field, Pillow } from './robotSdf';
import type { V3 } from './robotShapes';

/**
 * One digit: where it leaves the palm, then two segments, each a turn and a
 * length. `splay` turns it in the palm's plane (+ toward the little finger's
 * side), `curl` tips it toward the palm (+z). Radii at the base, the joint
 * and the tip: each finger tapers to a soft round tip.
 */
interface Digit {
  base: V3;
  segs: readonly (readonly [splay: number, curl: number, len: number])[];
  r: readonly [number, number, number];
}

interface HandShape {
  palm: Pillow;
  /** The heel of the hand, out of the wrist band. */
  heel: { from: V3; to: V3; r0: number; r1: number };
  fingers: readonly Digit[];
  thumb: Digit;
  /**
   * Fillet widths: fingers into the palm, the thumb's mound, the heel into
   * the palm, the grooves between the fingers, and each finger's knuckle.
   */
  blend: { finger: number; thumb: number; heel: number; between: number; joint: number };
}

/** Finger radii at the base, the joint and the tip: fat, short, soft — a toy's. */
const FAT = [0.07, 0.066, 0.061] as const;
const SMALL = [0.063, 0.059, 0.055] as const;
const THUMB = [0.078, 0.071, 0.064] as const;

/**
 * The open hand, bent up at the wrist as the renders hold it: the arm comes
 * in from −x (the thumb's side) and the heel carries on out of the
 * band before the palm stands up, so the hand rises from the band's end
 * rather than sweeping through it. The fingers leave the palm under its top
 * edge, so the fillet reads as knuckles; the middle is longest; the spread
 * widens the gaps toward the tips, and a slight curl keeps the hand from
 * looking stiff. The thumb stands up and in from low on the palm, clear of
 * the index, so it reads as a thumb and not a lump.
 */
const OPEN: HandShape = {
  palm: { c: [0.2, 0.27, 0], w0: 0.11, w1: 0.125, h: 0.08, d: 0.055, r: 0.09, puff: 0.02 },
  heel: { from: [0.01, 0.01, 0], to: [0.15, 0.13, 0], r0: 0.175, r1: 0.16 },
  fingers: [
    { base: [0.07, 0.37, 0.01], segs: [[-0.27, 0.08, 0.13], [-0.3, 0.26, 0.095]], r: FAT },
    { base: [0.157, 0.38, 0.01], segs: [[-0.09, 0.08, 0.145], [-0.1, 0.26, 0.105]], r: FAT },
    { base: [0.245, 0.375, 0.01], segs: [[0.1, 0.08, 0.13], [0.11, 0.26, 0.095]], r: FAT },
    { base: [0.328, 0.355, 0.01], segs: [[0.3, 0.08, 0.105], [0.33, 0.26, 0.08]], r: SMALL },
  ],
  thumb: { base: [0.01, 0.2, 0.045], segs: [[-0.85, 0.3, 0.125], [-0.62, 0.4, 0.1]], r: THUMB },
  blend: { finger: 0.06, thumb: 0.07, heel: 0.08, between: 0.018, joint: 0.025 },
};

/**
 * The resting hand, straight on the arm (+y out of the band): a soft,
 * closed toy fist — the arms are too short for an open hand to hang past
 * the boots. Each finger rolls forward off the knuckle and back down, so
 * the fist's face is four rounded segments side by side with soft grooves
 * between them, and the thumb wraps across the front of the first two.
 * Its heel is slimmer than the palm, so the two never run nearly parallel —
 * there the blend wobbled and the highlight mottled.
 */
const RELAXED: HandShape = {
  palm: { c: [0, 0.23, 0], w0: 0.1, w1: 0.118, h: 0.07, d: 0.065, r: 0.09, puff: 0.012 },
  heel: { from: [0, -0.02, 0], to: [0, 0.1, 0], r0: 0.15, r1: 0.15 },
  fingers: [
    { base: [-0.118, 0.32, 0.03], segs: [[-0.02, 1.35, 0.1], [-0.02, 2.85, 0.1]], r: FAT },
    { base: [-0.04, 0.33, 0.03], segs: [[0, 1.3, 0.11], [0, 2.85, 0.105]], r: FAT },
    { base: [0.04, 0.325, 0.03], segs: [[0.01, 1.35, 0.1], [0.01, 2.85, 0.1]], r: FAT },
    { base: [0.113, 0.305, 0.03], segs: [[0.03, 1.4, 0.09], [0.03, 2.85, 0.085]], r: SMALL },
  ],
  thumb: { base: [-0.125, 0.16, 0.1], segs: [[-0.25, 1.0, 0.09], [1.45, 1.15, 0.1]], r: THUMB },
  blend: { finger: 0.06, thumb: 0.05, heel: 0.07, between: 0.03, joint: 0.04 },
};

/** A direction from a splay and a curl, as Digit describes them. */
function heading(splay: number, curl: number, sx: number): V3 {
  return [sx * Math.sin(splay) * Math.cos(curl), Math.cos(splay) * Math.cos(curl), Math.sin(curl)];
}

/**
 * A digit as one field — its two segments joined with a small fillet at the
 * knuckle — with a bounding sphere, so the hand's field can skip it at
 * points it cannot reach.
 */
interface Bone {
  f: Field;
  c: THREE.Vector3;
  r: number;
}

function digitBone(d: Digit, sx: number, joint: number, box: THREE.Box3): Bone {
  const pts = [new THREE.Vector3(sx * d.base[0], d.base[1], d.base[2])];
  for (const [splay, curl, len] of d.segs) {
    const [hx, hy, hz] = heading(splay, curl, sx);
    pts.push(pts[pts.length - 1].clone().add(new THREE.Vector3(hx, hy, hz).multiplyScalar(len)));
  }
  const segs = d.segs.map((_, i) => roundCone(pts[i].toArray(), pts[i + 1].toArray(), d.r[i], d.r[i + 1]));
  const c = new THREE.Box3().setFromPoints(pts).getCenter(new THREE.Vector3());
  const r = Math.max(...pts.map((q) => q.distanceTo(c))) + d.r[0];
  pts.forEach((q, i) => box.expandByPoint(q.clone().addScalar(d.r[i])).expandByPoint(q.clone().addScalar(-d.r[i])));
  const f: Field = (x, y, z) => {
    let v = Infinity;
    for (const g of segs) v = smin(v, g(x, y, z), joint);
    return v;
  };
  return { f, c, r };
}

/** A lower bound on a bone's field at a point: the distance to its bounding sphere. */
function reach(b: Bone, x: number, y: number, z: number): number {
  const dx = x - b.c.x;
  const dy = y - b.c.y;
  const dz = z - b.c.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - b.r;
}

/** The whole hand as one field, and the box it fits in. */
function handField(s: HandShape, sx: number): { f: Field; box: THREE.Box3 } {
  const { palm, heel: h, blend } = s;
  const mx = (v: V3): V3 => [sx * v[0], v[1], v[2]];
  const p = pillow({ ...palm, c: mx(palm.c) });
  const heel = roundCone(mx(h.from), mx(h.to), h.r0, h.r1);
  const half = new THREE.Vector3(palm.w1 + palm.r, palm.h + palm.r, palm.d + palm.puff + palm.r);
  const box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...mx(palm.c)), half.multiplyScalar(2));
  box.expandByPoint(new THREE.Vector3(...mx(h.from)).addScalar(-h.r0));
  box.expandByPoint(new THREE.Vector3(...mx(h.from)).addScalar(h.r0));
  const fingers = s.fingers.map((d) => digitBone(d, sx, blend.joint, box));
  const thumb = digitBone(s.thumb, sx, blend.joint, box);
  // A finger further than a fillet's width from what is already there
  // cannot change the surface: most samples skip most fingers.
  const skip = Math.max(blend.finger, blend.between);
  const f: Field = (x, y, z) => {
    const body = smin(p(x, y, z), heel(x, y, z), blend.heel);
    let fist = Infinity;
    for (const b of fingers) {
      if (reach(b, x, y, z) > Math.min(body, fist) + skip) continue;
      fist = smin(fist, b.f(x, y, z), blend.between);
    }
    const hand = smin(body, fist, blend.finger);
    return reach(thumb, x, y, z) > hand + blend.thumb ? hand : smin(hand, thumb.f(x, y, z), blend.thumb);
  };
  return { f, box };
}

/**
 * Grid cells for the meshes: the open hand, in the hero's foreground, a
 * little finer than the relaxed one. Normals come from the field, so these
 * only set how finely the silhouette is cut — about 3 px at the hero on a
 * 2x screen — and they hold both hands to ~17k triangles.
 */
const CELL = { open: 0.0175, relaxed: 0.019 } as const;

/** A hand's mesh. `open` for the raised hello; `mirror` for the right hand. */
export function handGeometry(open: boolean, mirror: boolean): THREE.BufferGeometry {
  const { f, box } = handField(open ? OPEN : RELAXED, mirror ? -1 : 1);
  const cell = open ? CELL.open : CELL.relaxed;
  box.expandByScalar(2 * cell);
  return meshField(f, box.min.toArray(), box.max.toArray(), cell);
}
