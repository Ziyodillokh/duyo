/**
 * Soft shapes from distance fields: a few round cones and a pillow, blended
 * into one surface and meshed once, at build time.
 *
 * Why a field and not primitives: DUYO's hands are moulded vinyl, and on a
 * moulded hand the fingers grow out of the palm — there is a fillet where
 * they meet, not a seam. Capsules pushed into a sphere leave a hard crease
 * at every join and read as a bunch of blobs (the old hand did). A smooth
 * union of distance fields gives the fillet for free, and the mesh is cut
 * straight from it.
 *
 * The mesher is naive surface nets: one vertex per cell the surface passes
 * through, pulled onto the true surface with the field's gradient, and one
 * quad per grid edge the surface crosses. Normals are the field's gradient,
 * not the triangles', so the shading is as smooth as the field whatever the
 * grid's size — the grid only sets how finely the silhouette is cut.
 */

import * as THREE from 'three';
import type { V3 } from './robotShapes';

/** A distance field: negative inside, roughly the distance to the surface outside. */
export type Field = (x: number, y: number, z: number) => number;

/**
 * Cubic smooth minimum: a union whose seam is a fillet about `k` wide. Cubic
 * rather than quadratic because the quadratic's curvature jumps at the
 * fillet's edge, and a clearcoat shows that as a kink in every highlight.
 */
export function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * h * k * (1 / 6);
}

/**
 * A round cone: a capsule whose radius runs from r0 at `a` to r1 at `b` —
 * a finger that tapers to a soft round tip. The exact distance (after
 * Inigo Quilez); everything that depends only on the shape is worked out
 * once here, so the returned field is cheap to sample.
 */
export function roundCone(a: V3, b: V3, r0: number, r1: number): Field {
  const [bx, by, bz] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l2 = bx * bx + by * by + bz * bz;
  const rr = r0 - r1;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  return (x, y, z) => {
    const px = x - a[0];
    const py = y - a[1];
    const pz = z - a[2];
    const t = px * bx + py * by + pz * bz;
    const u = t - l2;
    const qx = px * l2 - bx * t;
    const qy = py * l2 - by * t;
    const qz = pz * l2 - bz * t;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = t * t * l2;
    const z2 = u * u * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(u) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r1;
    if (Math.sign(t) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r0;
    return (Math.sqrt(x2 * a2 * il2) + t * rr) * il2 - r0;
  };
}

/** A pillow: a rounded box, narrower at its −y end, its broad ±z faces gently domed. */
export interface Pillow {
  c: V3;
  /** Half-width at the −y end and at the +y end, before the rounding. */
  w0: number;
  w1: number;
  /** Half-height and half-depth, before the rounding. */
  h: number;
  d: number;
  /** Rounding radius, and how far the broad faces dome out at their middle. */
  r: number;
  puff: number;
}

export function pillow(s: Pillow): Field {
  return (x, y, z) => {
    const px = x - s.c[0];
    const py = y - s.c[1];
    const pz = z - s.c[2];
    const v = Math.min(1, Math.max(0, (py + s.h) / (2 * s.h)));
    const w = s.w0 + (s.w1 - s.w0) * v;
    // The dome: the half-depth grows toward the middle of the face. Not an
    // exact distance, but a smooth one, which is all the mesher needs.
    const fx = Math.min(1, Math.abs(px) / (w + s.r));
    const fy = Math.min(1, Math.abs(py) / (s.h + s.r));
    const ux = 1 - fx * fx;
    const uy = 1 - fy * fy;
    // Squared, so the dome meets the rim with no kink for a highlight to catch.
    const d = s.d + s.puff * ux * ux * uy * uy;
    const qx = Math.abs(px) - w;
    const qy = Math.abs(py) - s.h;
    const qz = Math.abs(pz) - d;
    const ox = Math.max(qx, 0);
    const oy = Math.max(qy, 0);
    const oz = Math.max(qz, 0);
    const out = Math.sqrt(ox * ox + oy * oy + oz * oz);
    return out + Math.min(Math.max(qx, qy, qz), 0) - s.r;
  };
}

/** The twelve edges of a cell, as corner-index pairs, flat (corner = i + 2j + 4k). */
const EDGES = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7]);
/** The finite-difference step for the gradient: far below a cell, far above float noise. */
const EPS = 1e-4;
/**
 * How far a sample must be from the surface, in cells, for everything it
 * stands for to be on one side: from a block's centre to its farthest
 * point, plus one cell so no neighbour of a filled point crosses the
 * surface, with half again to spare because the pillow's dome and the
 * smooth unions bend the field a little from a true distance.
 */
const SAFE_BLOCK = (Math.sqrt(3) * 1.5 + 1) * 1.5; // a 4³ block, from its centre
const SAFE_PAIR = (Math.sqrt(3) * 0.5 + 1) * 1.5; //  a 2³ sub-block, from its centre

/**
 * Sample the field on the grid, coarse to fine: a 4³ block far from the
 * surface takes its centre's value throughout, then a 2³ sub-block likewise,
 * and only what is left — a thin shell round the surface — is evaluated
 * point by point. Only the sign of a filled point is ever read.
 */
function sampleGrid(f: Field, lo: V3, cell: number, nx: number, ny: number, nz: number): Float32Array {
  const field = new Float32Array(nx * ny * nz);
  const fill = (i0: number, j0: number, k0: number, n: number, v: number | null) => {
    for (let k = k0; k < Math.min(k0 + n, nz); k++) {
      for (let j = j0; j < Math.min(j0 + n, ny); j++) {
        for (let i = i0; i < Math.min(i0 + n, nx); i++) {
          field[i + nx * (j + ny * k)] = v ?? f(lo[0] + i * cell, lo[1] + j * cell, lo[2] + k * cell);
        }
      }
    }
  };
  const centre = (i: number, j: number, k: number, half: number) =>
    f(lo[0] + (i + half) * cell, lo[1] + (j + half) * cell, lo[2] + (k + half) * cell);
  for (let bk = 0; bk < nz; bk += 4) {
    for (let bj = 0; bj < ny; bj += 4) {
      for (let bi = 0; bi < nx; bi += 4) {
        const mid = centre(bi, bj, bk, 1.5);
        if (Math.abs(mid) > SAFE_BLOCK * cell) {
          fill(bi, bj, bk, 4, mid);
          continue;
        }
        for (let sk = bk; sk < bk + 4; sk += 2) {
          for (let sj = bj; sj < bj + 4; sj += 2) {
            for (let si = bi; si < bi + 4; si += 2) {
              const sub = centre(si, sj, sk, 0.5);
              fill(si, sj, sk, 2, Math.abs(sub) > SAFE_PAIR * cell ? sub : null);
            }
          }
        }
      }
    }
  }
  return field;
}

/**
 * Mesh the surface f = 0 inside the box [lo, hi] on a grid of `cell`-sized
 * cubes. The box must hold the whole shape with a cell to spare on every
 * side, or the surface is left open where it is cut.
 */
export function meshField(f: Field, lo: V3, hi: V3, cell: number): THREE.BufferGeometry {
  const [nx, ny, nz] = [0, 1, 2].map((a) => Math.ceil((hi[a] - lo[a]) / cell) + 1);
  const at = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  const field = sampleGrid(f, lo, cell, nx, ny, nz);

  // One vertex per cell the surface passes through: the mean of where it
  // crosses the cell's edges, then one Newton step onto the surface along
  // the gradient — never further than a cell, so a vertex in a narrow gap
  // between two fingers cannot jump to the wrong one. The same gradient is
  // its normal: the step is a small fraction of a cell, too short for the
  // normal to turn. Four samples a vertex, the most a vertex can afford.
  const cellOf = (i: number, j: number, k: number) => i + (nx - 1) * (j + (ny - 1) * k);
  const vert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const pos: number[] = [];
  const nor: number[] = [];
  const corner = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        let inside = 0;
        for (let c = 0; c < 8; c++) {
          corner[c] = field[at(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))];
          if (corner[c] < 0) inside++;
        }
        if (inside === 0 || inside === 8) continue;
        let px = 0;
        let py = 0;
        let pz = 0;
        let crossings = 0;
        for (let e = 0; e < 24; e += 2) {
          const a = EDGES[e];
          const b = EDGES[e + 1];
          const va = corner[a];
          const vb = corner[b];
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          px += (a & 1) + ((b & 1) - (a & 1)) * t;
          py += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
          pz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t;
          crossings++;
        }
        px = lo[0] + (i + px / crossings) * cell;
        py = lo[1] + (j + py / crossings) * cell;
        pz = lo[2] + (k + pz / crossings) * cell;
        const v = f(px, py, pz);
        const gx = (f(px + EPS, py, pz) - v) / EPS;
        const gy = (f(px, py + EPS, pz) - v) / EPS;
        const gz = (f(px, py, pz + EPS) - v) / EPS;
        const g2 = Math.max(gx * gx + gy * gy + gz * gz, 1e-12);
        const step = Math.abs(v) * Math.sqrt(1 / g2) > cell ? 0 : -v / g2;
        const gl = Math.sqrt(g2);
        vert[cellOf(i, j, k)] = pos.length / 3;
        pos.push(px + gx * step, py + gy * step, pz + gz * step);
        nor.push(gx / gl, gy / gl, gz / gl);
      }
    }
  }

  // One quad per grid edge the surface crosses, joining the four cells
  // round that edge, wound so it faces from inside to outside. Split along
  // the shorter diagonal, which keeps thin triangles off curved rims.
  const idx: number[] = [];
  const dist2 = (u: number, v: number) => {
    const dx = pos[3 * u] - pos[3 * v];
    const dy = pos[3 * u + 1] - pos[3 * v + 1];
    const dz = pos[3 * u + 2] - pos[3 * v + 2];
    return dx * dx + dy * dy + dz * dz;
  };
  const quad = (a: number, b: number, c: number, d: number, outward: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    // Reversed, a d c b: the same quad facing the other way.
    const q1 = outward ? b : d;
    const q3 = outward ? d : b;
    if (dist2(a, c) <= dist2(q1, q3)) idx.push(a, q1, c, a, c, q3);
    else idx.push(a, q1, q3, q1, c, q3);
  };
  for (let k = 1; k < nz - 1; k++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const v0 = field[at(i, j, k)] < 0;
        if (v0 !== field[at(i + 1, j, k)] < 0) {
          quad(vert[cellOf(i, j - 1, k - 1)], vert[cellOf(i, j, k - 1)], vert[cellOf(i, j, k)], vert[cellOf(i, j - 1, k)], v0);
        }
        if (v0 !== field[at(i, j + 1, k)] < 0) {
          quad(vert[cellOf(i - 1, j, k - 1)], vert[cellOf(i - 1, j, k)], vert[cellOf(i, j, k)], vert[cellOf(i, j, k - 1)], v0);
        }
        if (v0 !== field[at(i, j, k + 1)] < 0) {
          quad(vert[cellOf(i - 1, j - 1, k)], vert[cellOf(i, j - 1, k)], vert[cellOf(i, j, k)], vert[cellOf(i - 1, j, k)], v0);
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}
