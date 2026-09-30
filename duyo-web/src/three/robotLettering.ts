/**
 * The belly's "DUYO", moulded rather than painted. mascot-default.png's
 * letters are chunky, rounded and raised off the white plastic — gold D,
 * blue UYO — and a painted word with a bump map read as a decal beside it.
 *
 * Each letter is a stroke: a half-round section swept along its centre
 * line, laid out flat in (u along the belly, v up) and then wrapped onto
 * the torso's lathe, with normals carried through the same wrap so the
 * letters shade as one moulding with the body. Open strokes end in round
 * caps; the Y's three strokes meet under a knob.
 */

import * as THREE from 'three';
import { radiusAt } from './robotShapes';

type P2 = readonly [number, number];

/** Where the word sits: its centre height, letter height, and stroke half-width over height. */
export interface WordPlace {
  y: number;
  h: number;
  stroke: number;
}

/** Letter widths over height, and the gap between letters. */
const WIDTH = { D: 0.8, U: 0.76, Y: 0.86, O: 0.94 } as const;
const TRACK = 0.1;
/** How far the section stands off the surface, over its half-width: a low, rounded moulding. */
const RELIEF = 0.75;
/** Points round each section's half-circle. */
const SECTION = 8;

/** A polyline with each interior corner replaced by an arc of `radius`. */
function fillet(pts: P2[], closed: boolean, radius: number, steps = 4): P2[] {
  const out: P2[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const isEnd = !closed && (i === 0 || i === n - 1);
    if (isEnd) {
      out.push(p);
      continue;
    }
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const t = Math.min(radius, la / 2, lb / 2);
    const from: P2 = [p[0] + ((a[0] - p[0]) * t) / la, p[1] + ((a[1] - p[1]) * t) / la];
    const to: P2 = [p[0] + ((b[0] - p[0]) * t) / lb, p[1] + ((b[1] - p[1]) * t) / lb];
    // A quadratic through the corner: close enough to an arc at these sizes.
    for (let s = 0; s <= steps; s++) {
      const k = s / steps;
      const x = (1 - k) ** 2 * from[0] + 2 * (1 - k) * k * p[0] + k * k * to[0];
      const y = (1 - k) ** 2 * from[1] + 2 * (1 - k) * k * p[1] + k * k * to[1];
      out.push([x, y]);
    }
  }
  return out;
}

const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number): P2[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as const;
  });

interface Stroke {
  pts: P2[];
  closed: boolean;
}

/** The four letters' centre lines, each in a box [x0, x0 + w] × [−h/2, h/2]. */
function letters(h: number, r: number): { strokes: Stroke[]; knobs: P2[]; ends: P2[]; colour: number[] } {
  const strokes: Stroke[] = [];
  const colour: number[] = [];
  const knobs: P2[] = [];
  const ends: P2[] = [];
  const top = h / 2 - r;
  const bot = -h / 2 + r;
  const width = (WIDTH.D + WIDTH.U + WIDTH.Y + WIDTH.O + 3 * TRACK) * h;
  let x0 = -width / 2;

  // D: a stem and a round bowl, its two corners eased.
  let w = WIDTH.D * h;
  const rb = top;
  const cx = x0 + w - r - rb;
  const bowl = arc(cx, 0, rb, rb, Math.PI / 2, -Math.PI / 2, 16);
  const dOutline: P2[] = [[x0 + r, bot], [x0 + r, top], ...bowl];
  strokes.push({ pts: fillet(dOutline, true, r * 1.1), closed: true });
  colour.push(0);
  x0 += w + TRACK * h;

  // U: two stems into a round bottom.
  w = WIDTH.U * h;
  const ru = w / 2 - r;
  const cyU = bot + ru;
  strokes.push({ pts: [[x0 + r, top], ...arc(x0 + w / 2, cyU, ru, ru, Math.PI, 2 * Math.PI, 16), [x0 + w - r, top]], closed: false });
  ends.push([x0 + r, top], [x0 + w - r, top]);
  colour.push(1);
  x0 += w + TRACK * h;

  // Y: two arms and a stem meeting a little below the middle.
  w = WIDTH.Y * h;
  const joint: P2 = [x0 + w / 2, -0.04 * h];
  strokes.push({ pts: [[x0 + r * 0.9, top], joint], closed: false }, { pts: [[x0 + w - r * 0.9, top], joint], closed: false });
  strokes.push({ pts: [joint, [joint[0], bot]], closed: false });
  knobs.push(joint);
  ends.push([x0 + r * 0.9, top], [x0 + w - r * 0.9, top], [joint[0], bot]);
  colour.push(1, 1, 1);
  x0 += w + TRACK * h;

  // O: an upright ellipse.
  w = WIDTH.O * h;
  strokes.push({ pts: arc(x0 + w / 2, 0, w / 2 - r, top, 0, 2 * Math.PI, 40).slice(0, -1), closed: true });
  colour.push(1);
  return { strokes, knobs, ends, colour };
}

/** Densify a polyline so the wrap can bend it: no segment longer than `step`. */
function densify(pts: P2[], closed: boolean, step: number): P2[] {
  const out: P2[] = [];
  const n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let s = 0; s < k; s++) out.push([a[0] + ((b[0] - a[0]) * s) / k, a[1] + ((b[1] - a[1]) * s) / k]);
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

/**
 * Flat stroke geometry: position (u, v, height off the surface) and the
 * flat-space normal, a half-round section swept along the centre line.
 */
function sweep(stroke: Stroke, r: number): { pos: number[]; nor: number[]; idx: number[] } {
  const pts = densify(stroke.pts, stroke.closed, r * 0.7);
  const n = pts.length;
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[stroke.closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const next = pts[stroke.closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let tx = next[0] - prev[0];
    let ty = next[1] - prev[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    for (let j = 0; j <= SECTION; j++) {
      const a = (Math.PI * j) / SECTION;
      const c = Math.cos(a);
      const s = Math.sin(a);
      pos.push(pts[i][0] - ty * r * c, pts[i][1] + tx * r * c, RELIEF * r * s - 0.004);
      const nz = s / RELIEF;
      const l = Math.hypot(c, nz);
      nor.push((-ty * c) / l, (tx * c) / l, nz / l);
    }
  }
  const rows = stroke.closed ? n : n - 1;
  const ring = SECTION + 1;
  for (let i = 0; i < rows; i++) {
    const a = i * ring;
    const b = ((i + 1) % n) * ring;
    for (let j = 0; j < SECTION; j++) idx.push(a + j, a + j + 1, b + j, b + j, a + j + 1, b + j + 1);
  }
  return { pos, nor, idx };
}

/** A flattened dome cap in flat space, for stroke ends and the Y's knob. */
function dome(at: P2, r: number): { pos: number[]; nor: number[]; idx: number[] } {
  const g = new THREE.SphereGeometry(r, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = g.getAttribute('position');
  const q = g.getAttribute('normal');
  const pos: number[] = [];
  const nor: number[] = [];
  for (let i = 0; i < p.count; i++) {
    // Sphere y is up; here the dome's axis is the flat space's z.
    pos.push(at[0] + p.getX(i), at[1] - p.getZ(i), RELIEF * p.getY(i) - 0.004);
    const nz = q.getY(i) / RELIEF;
    const l = Math.hypot(q.getX(i), q.getZ(i), nz);
    nor.push(q.getX(i) / l, -q.getZ(i) / l, nz / l);
  }
  const idx = Array.from(g.getIndex()?.array ?? []);
  g.dispose();
  return { pos, nor, idx };
}

/**
 * Wrap flat (u, v, w) onto the torso: u is arc length round the belly at
 * height place.y + v, w is height off the surface. Normals go through the
 * surface's own frame at each point.
 */
function wrap(
  part: { pos: number[]; nor: number[]; idx: number[] },
  profile: THREE.Vector2[],
  depth: number,
  y0: number,
): THREE.BufferGeometry {
  const pos = new Float32Array(part.pos.length);
  const nor = new Float32Array(part.nor.length);
  const tu = new THREE.Vector3();
  const tv = new THREE.Vector3();
  const tn = new THREE.Vector3();
  const out = new THREE.Vector3();
  for (let i = 0; i < part.pos.length; i += 3) {
    const [u, v, w] = [part.pos[i], part.pos[i + 1], part.pos[i + 2]];
    const y = y0 + v;
    const R = radiusAt(profile, y);
    const dR = (radiusAt(profile, y + 0.01) - radiusAt(profile, y - 0.01)) / 0.02;
    const phi = u / R;
    const s = Math.sin(phi);
    const c = Math.cos(phi);
    tu.set(c, 0, -depth * s).normalize();
    tv.set(dR * s, 1, depth * dR * c).normalize();
    tn.set(depth * s, -depth * dR, c).normalize();
    out.set(R * s, y, depth * R * c).addScaledVector(tn, w);
    pos.set([out.x, out.y, out.z], i);
    out
      .set(0, 0, 0)
      .addScaledVector(tu, part.nor[i])
      .addScaledVector(tv, part.nor[i + 1])
      .addScaledVector(tn, part.nor[i + 2])
      .normalize();
    nor.set([out.x, out.y, out.z], i);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setIndex(part.idx);
  return geo;
}

/** Merge flat parts into one, offsetting indices. */
function merge(parts: { pos: number[]; nor: number[]; idx: number[] }[]): { pos: number[]; nor: number[]; idx: number[] } {
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  for (const p of parts) {
    const base = pos.length / 3;
    pos.push(...p.pos);
    nor.push(...p.nor);
    for (const k of p.idx) idx.push(k + base);
  }
  return { pos, nor, idx };
}

/**
 * The word as two geometries — [gold D, blue UYO] — wrapped onto a lathe
 * of silhouette `profile` squashed front-to-back by `depth`.
 */
export function bellyWord(profile: THREE.Vector2[], depth: number, place: WordPlace): [THREE.BufferGeometry, THREE.BufferGeometry] {
  const r = place.h * place.stroke;
  const { strokes, knobs, ends, colour } = letters(place.h, r);
  const gold: ReturnType<typeof sweep>[] = [];
  const blue: ReturnType<typeof sweep>[] = [];
  strokes.forEach((s, i) => (colour[i] === 0 ? gold : blue).push(sweep(s, r)));
  for (const k of [...knobs, ...ends]) blue.push(dome(k, r));
  return [wrap(merge(gold), profile, depth, place.y), wrap(merge(blue), profile, depth, place.y)];
}
