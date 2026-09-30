/**
 * The shapes DUYO is built from — geometry and lettering with no colour or
 * proportion of its own. robot.ts decides what DUYO looks like; this file
 * only knows how to make a soft helmet, a frame that follows it, a plump
 * star, a moulded ring and four letters.
 *
 * Split out so robot.ts reads as the character sheet it is, and so each of
 * these can be looked at alone when one of them is wrong.
 */

import * as THREE from 'three';

export type V3 = readonly [number, number, number];

// ── Superellipsoids ────────────────────────────────────────────────────────

/**
 * |x/rx|^ex + |y/ry|^ey + |z/rz|^ez = 1, centred on `c`, with its own y
 * radius and exponent below the centre: DUYO's helmet is a dome over a
 * broad, flat chin, and one radius and exponent cannot be both. Likewise
 * its own z radius behind the centre: the helmet's white core is deep at
 * the back but must stay shallow in front, behind the blue face.
 */
export interface Blob {
  c: V3;
  r: V3;
  e: V3;
  eBelow: number;
  /** The y radius below the centre; `r[1]` when absent. */
  rBelow?: number;
  /** The z radius behind the centre; `r[2]` when absent. */
  rBack?: number;
}

const signedPow = (v: number, e: number) => Math.sign(v) * Math.abs(v) ** e;
const NEWTON_STEPS = 5;

/** The exponent on axis `i` for a point whose offset on that axis is `v`. */
const expOf = (b: Blob, i: number, v: number) => (i === 1 && v < 0 ? b.eBelow : b.e[i]);

/** The radius on axis `i` for a point whose offset on that axis is `v`. */
const radOf = (b: Blob, i: number, v: number) => {
  if (v >= 0) return b.r[i];
  if (i === 1) return b.rBelow ?? b.r[1];
  if (i === 2) return b.rBack ?? b.r[2];
  return b.r[i];
};

export function blobNormal(b: Blob, p: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  const g = (i: number, v: number) => {
    const e = expOf(b, i, v);
    const r = radOf(b, i, v);
    return (e / r) * signedPow(v / r, e - 1);
  };
  return out.set(g(0, p.x - b.c[0]), g(1, p.y - b.c[1]), g(2, p.z - b.c[2])).normalize();
}

/**
 * A sphere's vertices pushed out to the superellipsoid along their own
 * rays. Normals come from the implicit surface's gradient, not from the
 * triangles, so the sphere's UV seam leaves no crease in the highlight.
 */
export function blobGeometry(b: Blob, ws = 88, hs = 66): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, ws, hs);
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const d = new THREE.Vector3();
  const n = new THREE.Vector3();
  const k = [0, 0, 0];
  const e = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i);
    for (let a = 0; a < 3; a++) {
      k[a] = Math.abs(d.getComponent(a)) / radOf(b, a, d.getComponent(a));
      e[a] = expOf(b, a, d.getComponent(a));
    }
    // Along a ray F(t) is convex and increasing; Newton started where the
    // largest term alone reaches 1 converges from outside, never overshoots —
    // and quadratically: for the helmet's shapes five steps reach machine
    // precision (four leave 5e-8), and this loop is most of a cold build.
    let t = 1 / Math.max(k[0], k[1], k[2]);
    for (let it = 0; it < NEWTON_STEPS; it++) {
      let f = -1;
      let df = 0;
      for (let a = 0; a < 3; a++) {
        const v = (k[a] * t) ** e[a];
        f += v;
        df += (e[a] * v) / t;
      }
      t -= f / df;
    }
    d.multiplyScalar(t).add(n.set(b.c[0], b.c[1], b.c[2]));
    pos.setXYZ(i, d.x, d.y, d.z);
    blobNormal(b, d, n);
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  return geo;
}

/** The z of a blob's front surface above (x, y). */
export function frontZ(b: Blob, x: number, y: number): number {
  const dy = y - b.c[1];
  const rest = 1 - Math.abs((x - b.c[0]) / b.r[0]) ** b.e[0] - Math.abs(dy / radOf(b, 1, dy)) ** expOf(b, 1, dy);
  return b.c[2] + b.r[2] * Math.max(rest, 0) ** (1 / b.e[2]);
}

/** The y of a blob's top surface over (x, z). */
export function topY(b: Blob, x: number, z: number): number {
  const dz = z - b.c[2];
  const rest = 1 - Math.abs((x - b.c[0]) / b.r[0]) ** b.e[0] - Math.abs(dz / radOf(b, 2, dz)) ** b.e[2];
  return b.c[1] + b.r[1] * Math.max(rest, 0) ** (1 / b.e[1]);
}

const tmpN = new THREE.Vector3();
const FORWARD = new THREE.Vector3(0, 0, 1);

/** A point on a blob's front, lifted `lift` along the surface normal. */
export function onFront(b: Blob, x: number, y: number, lift: number, out = new THREE.Vector3()): THREE.Vector3 {
  out.set(x, y, frontZ(b, x, y));
  return out.addScaledVector(blobNormal(b, out, tmpN), lift);
}

/** Sit an object on a blob's front at (x, y), facing out along the surface. */
export function placeOnFront(b: Blob, o: THREE.Object3D, x: number, y: number, lift: number, spin = 0): void {
  onFront(b, x, y, lift, o.position);
  o.quaternion.setFromUnitVectors(FORWARD, blobNormal(b, o.position, tmpN));
  o.rotateZ(spin);
}

// ── Outlines and surfaces ──────────────────────────────────────────────────

/**
 * Rounded-rectangle outline, counter-clockwise. The point count depends only
 * on `arc` and `run`, so outlines of different sizes correspond point for
 * point — which is what lets a frame be stitched between two of them. The
 * straight runs are subdivided so the outline can bend over a curve.
 */
export function roundRect(w: number, h: number, r: number, arc = 10, run = 14): THREE.Vector2[] {
  const cx = w / 2 - r;
  const cy = h / 2 - r;
  const corners: V3[] = [[cx, cy, 0], [-cx, cy, 0.5], [-cx, -cy, 1], [cx, -cy, 1.5]];
  const at = (k: number, j: number) => {
    const [x, y, a0] = corners[k % 4];
    const a = (a0 + j / (arc - 1) / 2) * Math.PI;
    return new THREE.Vector2(x + r * Math.cos(a), y + r * Math.sin(a));
  };
  const pts: THREE.Vector2[] = [];
  for (let k = 0; k < 4; k++) {
    for (let j = 0; j < arc; j++) pts.push(at(k, j));
    const from = at(k, arc - 1);
    const to = at(k + 1, 0);
    for (let j = 1; j <= run; j++) pts.push(from.clone().lerp(to, j / (run + 1)));
  }
  return pts;
}

/** Stitch rows of closed loops, outermost first, into one surface facing +z. */
export function stitch(rows: THREE.Vector3[][]): THREE.BufferGeometry {
  const n = rows[0].length;
  const pos: number[] = [];
  const idx: number[] = [];
  for (const row of rows) for (const p of row) pos.push(p.x, p.y, p.z);
  for (let j = 0; j < rows.length - 1; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * n + i;
      const b = j * n + ((i + 1) % n);
      idx.push(a, b, a + n, b, b + n, a + n);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * A band laid on a blob's front between two matching outlines centred at
 * height cy: each row is [how far from `from` toward `to`, lift off the surface].
 */
export function bandOn(
  b: Blob,
  cy: number,
  from: THREE.Vector2[],
  to: THREE.Vector2[],
  rows: readonly (readonly [number, number])[],
): THREE.BufferGeometry {
  return stitch(rows.map(([q, lift]) => from.map((p, i) => {
    const at = p.clone().lerp(to[i], q);
    return onFront(b, at.x, cy + at.y, lift);
  })));
}

// ── Solids ─────────────────────────────────────────────────────────────────

/** A plump five-point star, back face on z = 0, facing +z. */
export function starGeometry(radius: number): THREE.ExtrudeGeometry {
  const v = Array.from({ length: 10 }, (_, i) => {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? radius * 0.5 : radius;
    return new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
  });
  // Every corner is eased with a curve through it: the renders' stars are
  // soft vinyl, and a sharp star reads as a decal.
  const shape = new THREE.Shape();
  v.forEach((p, i) => {
    const ease = i % 2 ? 0.16 : 0.22;
    const a = p.clone().lerp(v[(i + 9) % 10], ease);
    const b = p.clone().lerp(v[(i + 1) % 10], ease);
    if (i === 0) shape.moveTo(a.x, a.y);
    else shape.lineTo(a.x, a.y);
    shape.quadraticCurveTo(p.x, p.y, b.x, b.y);
  });
  shape.closePath();
  const bevel = radius * 0.24;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: radius * 0.1,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.7,
    bevelSegments: 5,
    curveSegments: 6,
  });
  geo.translate(0, 0, bevel);
  return geo;
}

/** A ring with a rounded-rectangle section, around y; rIn 0 makes a puck. */
export function roundRing(rIn: number, rOut: number, thick: number, seg = 40): THREE.LatheGeometry {
  const round = Math.min(thick / 2, (rOut - rIn) / 2) * 0.9;
  const h = thick / 2;
  const pts: THREE.Vector2[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let j = 0; j <= 5; j++) {
      const a = a0 + (j / 5) * (Math.PI / 2);
      pts.push(new THREE.Vector2(cx + round * Math.cos(a), cy + round * Math.sin(a)));
    }
  };
  // Counter-clockwise in (r, y), which is what makes the lathe face outward.
  pts.push(new THREE.Vector2(Math.max(rIn, 0.001), -h));
  corner(rOut - round, -h + round, -Math.PI / 2);
  corner(rOut - round, h - round, 0);
  pts.push(new THREE.Vector2(Math.max(rIn, 0.001), h));
  if (rIn > 0) pts.push(pts[0].clone());
  return new THREE.LatheGeometry(pts, seg);
}

/** A (radius, y) silhouette, smoothed and resampled evenly along its length. */
export function profile(pts: readonly (readonly [number, number])[], n: number): THREE.Vector2[] {
  return new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y))).getSpacedPoints(n);
}

/** Radius of a bottom-to-top silhouette at height y. */
export function radiusAt(p: THREE.Vector2[], y: number): number {
  for (let i = 0; i < p.length - 1; i++) {
    if (p[i].y <= y && p[i + 1].y >= y) {
      return THREE.MathUtils.lerp(p[i].x, p[i + 1].x, (y - p[i].y) / (p[i + 1].y - p[i].y || 1));
    }
  }
  return 0;
}

/** A closed outline through `pts`, each corner eased by a curve. */
export function roundedShape(pts: readonly (readonly [number, number])[]): THREE.Shape {
  const s = new THREE.Shape();
  const v = pts.map(([x, y]) => new THREE.Vector2(x, y));
  v.forEach((p, i) => {
    const a = p.clone().lerp(v[(i + v.length - 1) % v.length], 0.35);
    const b = p.clone().lerp(v[(i + 1) % v.length], 0.35);
    if (i === 0) s.moveTo(a.x, a.y);
    else s.lineTo(a.x, a.y);
    s.quadraticCurveTo(p.x, p.y, b.x, b.y);
  });
  s.closePath();
  return s;
}

export function ellipseShape(rx: number, ry: number): THREE.Shape {
  return new THREE.Shape().absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0);
}

/** The smile's outline: flat top, round bottom, `w` wide and `h` deep. */
export function smileShape(w: number, h: number): THREE.Shape {
  return new THREE.Shape().moveTo(-w / 2, 0).lineTo(w / 2, 0).absellipse(0, 0, w / 2, h, 0, Math.PI, true);
}

// ── Lettering ──────────────────────────────────────────────────────────────
// Drawn as strokes, not typeset: a canvas font depends on what has loaded by
// the time the robot is built, and the logotype must not. Four geometric
// letters are also closer to the renders' lettering than any system face.

type Letter = 'D' | 'U' | 'Y' | 'O';
const LETTER_W: Record<Letter, number> = { D: 0.8, U: 0.76, Y: 0.84, O: 0.94 };
const WORD: readonly Letter[] = ['D', 'U', 'Y', 'O'];
const TRACK = 0.1;
const STROKE = 0.21;

/**
 * "DUYO", centred on the origin, `h` tall, one colour per letter. `weight`
 * scales the stroke; `rim` is how far the darker edge shows past it, over h.
 */
export function drawWord(
  g: CanvasRenderingContext2D,
  h: number,
  colours: readonly string[],
  edge: string,
  weight = 1,
  rim = 0.05,
): void {
  const sw = h * STROKE * weight;
  const width = WORD.reduce((s, l) => s + LETTER_W[l] * h, 0) + TRACK * h * (WORD.length - 1);
  let x = -width / 2;
  WORD.forEach((l, i) => {
    const w = LETTER_W[l] * h;
    // Two passes: a darker edge, then the face — the moulded letters in the
    // renders have a shaded rim.
    for (const [colour, extra] of [[edge, h * rim], [colours[i], 0]] as const) {
      g.save();
      g.beginPath();
      g.rect(x - sw, -h / 2 - extra / 2, w + 2 * sw, h + extra);
      g.clip();
      g.strokeStyle = colour;
      g.lineWidth = sw + extra;
      g.lineJoin = 'round';
      g.stroke(letterPath(l, x, w, h, sw));
      g.restore();
    }
    x += w + TRACK * h;
  });
}

/** One letter's centre-line path in a box [x, x + w] × [-h/2, h/2]. */
function letterPath(l: Letter, x: number, w: number, h: number, sw: number): Path2D {
  const p = new Path2D();
  const i = sw / 2;
  const top = -h / 2;
  const bot = h / 2;
  if (l === 'D') {
    const r = (h - sw) / 2;
    p.moveTo(x + i, top + i);
    p.lineTo(x + w - i - r, top + i);
    p.arc(x + w - i - r, 0, r, -Math.PI / 2, Math.PI / 2);
    p.lineTo(x + i, bot - i);
    p.closePath();
  } else if (l === 'U') {
    const r = (w - sw) / 2;
    p.moveTo(x + i, top - h);
    p.lineTo(x + i, bot - i - r);
    p.arc(x + w / 2, bot - i - r, r, Math.PI, 0, true);
    p.lineTo(x + w - i, top - h);
  } else if (l === 'Y') {
    // Arms and stem overshoot the box; the caller's clip cuts them square.
    const m = x + w / 2;
    const j = top + h * 0.5;
    p.moveTo(x + i * 0.9 - w * 0.3, top - h * 0.5);
    p.lineTo(m, j);
    p.lineTo(x + w - i * 0.9 + w * 0.3, top - h * 0.5);
    p.moveTo(m, j);
    p.lineTo(m, bot + h);
  } else {
    p.ellipse(x + w / 2, 0, w / 2 - i, h / 2 - i, 0, 0, Math.PI * 2);
  }
  return p;
}

export function canvas2d(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  return [cv, g];
}
