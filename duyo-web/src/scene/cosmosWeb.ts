/**
 * The knowledge web: the stars near the visitor's hand light up and join
 * into a small constellation, the way DUYO's "D" holds a knowledge graph and
 * the app turns what you learn into a star map.
 *
 * NODES are a few hundred faint stars of their own, at infinity like the far
 * sky, on a jittered grid in the plane tangent to FRONT. That plane is what
 * a camera looking along FRONT sees, so the nodes fall evenly on screen at
 * every station: the web never finds a hole or a crowd under the hand.
 *
 * EACH FRAME the stars within reach of the pointer are ranked by distance
 * (the ones already lit are favoured, so the web does not flicker between
 * near-equals), the nearest few are joined by their shortest tree plus a
 * couple of short uncrossed chords, and the nearest three reach a thread to
 * the hand. Those links are wanted; every other link fades. So the web
 * follows the hand and leaves a fading wake of constellation behind it.
 *
 * A PULSE widens the reach for a moment, so the click lights a bigger web,
 * and the shaders send a spark down every link, away from where it landed.
 *
 * COST. Links live in a fixed table of slots and a fixed instanced buffer:
 * nothing is allocated per frame. The per-frame work is one dot product per
 * node, a projection for the few near the pointer, and an O(k²) tree on a
 * dozen of them; with no pointer and nothing fading it is a single branch.
 *
 * REDUCED MOTION. Links appear and vanish with the hover, at full length,
 * with no easing, no growth and no sparks (pulse() is never called then).
 */

import * as THREE from 'three';
import { C, FRONT, rng } from './cosmosSky';
import { PULSE_SECONDS } from './cosmosShaders';
import { HUES, HUE_PACK, LINK_FRAG, LINK_VERT, NODE_FRAG, NODE_VERT } from './cosmosWebShaders';

// ── Nodes ─────────────────────────────────────────────────────────────────
/**
 * Grid pitch and half-extents on the tangent plane (tan units: 1 = 45° off
 * FRONT). Every station's camera looks within ~17° of FRONT, so ±45° across
 * and ±37° up and down covers every frame of the film, portrait included.
 * At this pitch a 16:10 desktop view holds ~110 nodes and a pointer's reach
 * ~10 of them.
 */
const PITCH = 0.07;
const HALF_U = 1.0;
const HALF_V = 0.75;
/** Share of the node hues: sky, blue, violet — and the rare amber. */
const HUE_SHARE = [0.5, 0.26, 0.2, 0.04] as const;
/** Code of the pointer's own hue in the link shader's palette. */
const POINTER_HUE = HUES - 1;

// ── The graph ─────────────────────────────────────────────────────────────
/** How far from the pointer a star can join (viewport heights). */
const REACH = 0.19;
/** Stars in the web at rest, and how many more a pulse brings in at its height. */
const WEB_NODES = 8;
const PULSE_NODES = 5;
const MAX_NODES = WEB_NODES + PULSE_NODES;
/** A pulse widens the reach by this share at its start, easing back as it runs out. */
const PULSE_REACH = 0.8;
/** Threads from the hand to its nearest stars. */
const HAND_LINKS = 3;
/** Chords added to the tree, and how long one may be against the tree's mean link. */
const CHORDS = 3;
const CHORD_RATIO = 1.3;
/** No link longer than this (viewport heights): a long thread reads as a scratch, not a constellation. */
const LONGEST = 0.18;
/** A lit star's distance counts at this share when ranking: it takes a clearly nearer one to displace it. */
const STAY = 0.82;
/** Link slots: the wanted links (at most 12 + 3 + 3 = 18 during a pulse) and the ones still fading. */
const SLOTS = 28;

// ── Easing, per second of dt ──────────────────────────────────────────────
/** A link lights in about a tenth of a second; behind the hand it fades to a quarter in 0.8 s and is gone in about two. */
const LIGHT_UP = 10;
const LIGHT_DOWN = 1.7;
/** How quickly a new thread grows from its first star to its second. */
const GROW = 7;
/** Below this a fading link's slot is free again. */
const DEAD = 0.004;

/** The golden ratio's fraction: consecutive keys land far apart in 0..1. */
const GOLDEN = 0.6180339887;
/** Light a lit node adds, over its faint resting self. */
const LIT = 0.7;

export interface WebInput {
  t: number;
  dt: number;
  camera: THREE.PerspectiveCamera;
  pointer: { x: number; y: number; active: boolean };
}

/** The web's two layers, which the cosmos adds, measures and disposes with its others. */
export interface Web {
  readonly nodes: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly links: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  update(input: WebInput): void;
  pulse(x: number, y: number, t: number): void;
}

export interface WebLook {
  /** The resting star core, as 1 / (2σ²) with σ in CSS px: the nodes are stars like the others. */
  coreK: number;
  /** How the layers blend: as light, like every layer of the sky. */
  blend: THREE.ShaderMaterialParameters;
}

interface NodeSet {
  dirs: Float32Array;
  hues: Uint8Array;
  geometry: THREE.BufferGeometry;
  glow: THREE.BufferAttribute;
}

/** The nodes, generated once from a fixed seed: the same web on every load. */
function buildNodes(): NodeSet {
  const r = rng(606);
  const [cols, rows] = [Math.round((2 * HALF_U) / PITCH), Math.round((2 * HALF_V) / PITCH)];
  const n = cols * rows;
  const u = new THREE.Vector3(0, 1, 0).cross(FRONT).normalize();
  const v = FRONT.clone().cross(u).normalize();
  const hueColors = [C.sky, C.blueBright, C.violet, C.amber];
  const [dirs, color, hue, star, hues] = [new Float32Array(n * 3), new Float32Array(n * 3), new Float32Array(n * 3), new Float32Array(n * 2), new Uint8Array(n)];
  const [d, tint] = [new THREE.Vector3(), new THREE.Color()];
  for (let i = 0; i < n; i++) {
    // Anywhere in its cell: stratified, so evenly spread without ever reading as a grid.
    const x = -HALF_U + PITCH * ((i % cols) + r.next());
    const y = -HALF_V + PITCH * (Math.floor(i / cols) + r.next());
    d.copy(FRONT).addScaledVector(u, x).addScaledVector(v, y).normalize();
    dirs.set([d.x, d.y, d.z], i * 3);
    const roll = r.next();
    let code = 0;
    for (let acc = HUE_SHARE[0]; code < HUE_SHARE.length - 1 && roll >= acc; acc += HUE_SHARE[++code]);
    hues[i] = code;
    const h = hueColors[code];
    hue.set([h.r, h.g, h.b], i * 3);
    // At rest a faint star, pale, as the sky's own are: it only shows its hue when lit.
    tint.copy(C.white).lerp(h, 0.35).multiplyScalar(0.022 + 0.05 * r.next() ** 2);
    color.set([tint.r, tint.g, tint.b], i * 3);
    star.set([3.4, r.next()], i * 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(dirs, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  geometry.setAttribute('aHue', new THREE.BufferAttribute(hue, 3));
  geometry.setAttribute('aStar', new THREE.BufferAttribute(star, 2));
  const glow = new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aGlow', glow);
  return { dirs, hues, geometry, glow };
}

/** Which side of the line a→b point c is on (the sign), times twice the triangle's area. */
const side = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

/** Do segments p→q and r→s cross (strictly: sharing an end is not crossing)? */
function crosses(px: number, py: number, qx: number, qy: number, rx: number, ry: number, sx: number, sy: number): boolean {
  return side(rx, ry, sx, sy, px, py) * side(rx, ry, sx, sy, qx, qy) < 0 && side(px, py, qx, qy, rx, ry) * side(px, py, qx, qy, sx, sy) < 0;
}

export function buildWeb(shared: Record<string, THREE.IUniform>, { coreK, blend }: WebLook): Web {
  const { dirs, hues, geometry: nodeGeometry, glow } = buildNodes();
  const count = hues.length;
  const glowArray = glow.array as Float32Array;
  const nodes = new THREE.Points(nodeGeometry, new THREE.ShaderMaterial({
    uniforms: { ...shared, uReveal: { value: 0.1 }, uLit: { value: LIT }, uCoreK: { value: coreK } },
    vertexShader: NODE_VERT, fragmentShader: NODE_FRAG, ...blend,
  }));

  // ── Links: one quad, instanced per slot ──────────────────────────────────
  const quad = new THREE.InstancedBufferGeometry();
  quad.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3));
  quad.setIndex([0, 1, 2, 0, 2, 3]);
  const instanced = (size: number) => new THREE.InstancedBufferAttribute(new Float32Array(SLOTS * size), size).setUsage(THREE.DynamicDrawUsage);
  const [aFrom, aTo, aLink] = [instanced(3), instanced(3), instanced(4)];
  quad.setAttribute('aFrom', aFrom);
  quad.setAttribute('aTo', aTo);
  quad.setAttribute('aLink', aLink);
  quad.instanceCount = 0;
  const pointerHue = C.white.clone().lerp(C.sky, 0.5);
  const links = new THREE.Mesh(quad, new THREE.ShaderMaterial({
    uniforms: { ...shared, uHue: { value: [C.sky, C.blueBright, C.violet, C.amber, pointerHue] } },
    vertexShader: LINK_VERT, fragmentShader: LINK_FRAG, ...blend,
    side: THREE.DoubleSide, // wound by the thread's direction on screen, either way round
  }));
  links.visible = false;

  // ── Slots: a link's identity and state, preallocated ─────────────────────
  const key = new Int32Array(SLOTS).fill(-1);
  const [light, reach] = [new Float32Array(SLOTS), new Float32Array(SLOTS)];
  const want = new Uint8Array(SLOTS);
  const [from, to] = [new Int32Array(SLOTS), new Int32Array(SLOTS)]; // to −1: the hand
  const handDir = new Float32Array(SLOTS * 3); // where the hand was, for a thread to it

  // ── Per-frame scratch ───────────────────────────────────────────────────
  const sel = new Int32Array(MAX_NODES);
  const [selD, selX, selY] = [new Float32Array(MAX_NODES), new Float32Array(MAX_NODES), new Float32Array(MAX_NODES)];
  const lit = new Uint8Array(count); // in last frame's web: ranked as nearer
  const [best, parent, joined] = [new Float32Array(MAX_NODES), new Int32Array(MAX_NODES), new Uint8Array(MAX_NODES * MAX_NODES)];
  const [edgeA, edgeB] = [new Int32Array(MAX_NODES * 2), new Int32Array(MAX_NODES * 2)];
  const [inverse, rotation, hand] = [new THREE.Quaternion(), new THREE.Matrix4(), new THREE.Vector3()];
  let [selCount, edgeCount, live, glowDirty] = [0, 0, 0, false];
  let [pulseAt, pulseX, pulseY] = [-1e4, 0, 0];

  /** Rank the stars near (cx, cy) (NDC); fills sel, nearest first. */
  const select = (cx: number, cy: number, camera: THREE.PerspectiveCamera, reachH: number, most: number) => {
    const P = camera.projectionMatrix.elements;
    const aspect = P[5] / P[0];
    // The pointer as a world direction, to skip every star far from it with one dot product.
    hand.set((cx + P[8]) / P[0], (cy + P[9]) / P[5], -1).applyQuaternion(camera.quaternion).normalize();
    const cosReach = Math.cos(Math.atan(reachH * (2 / P[5]) * 1.4));
    const R = rotation.makeRotationFromQuaternion(inverse.copy(camera.quaternion).invert()).elements;
    const hx = cx * aspect * 0.5;
    const hy = cy * 0.5;
    for (let i = 0; i < selCount; i++) lit[sel[i]] = 0;
    selCount = 0;
    for (let i = 0; i < count; i++) {
      const x = dirs[i * 3];
      const y = dirs[i * 3 + 1];
      const z = dirs[i * 3 + 2];
      if (x * hand.x + y * hand.y + z * hand.z < cosReach) continue;
      const vz = R[2] * x + R[6] * y + R[10] * z;
      if (vz >= -1e-4) continue;
      const nx = ((P[0] * (R[0] * x + R[4] * y + R[8] * z) + P[8] * vz) / -vz) * aspect * 0.5;
      const ny = ((P[5] * (R[1] * x + R[5] * y + R[9] * z) + P[9] * vz) / -vz) * 0.5;
      const dist = Math.hypot(nx - hx, ny - hy);
      if (dist > reachH) continue;
      const rank = lit[i] ? dist * STAY : dist;
      if (selCount === most && rank >= selD[selCount - 1]) continue;
      // Insertion into the short sorted list.
      let j = Math.min(selCount, most - 1);
      for (; j > 0 && selD[j - 1] > rank; j--) {
        sel[j] = sel[j - 1];
        selD[j] = selD[j - 1];
        selX[j] = selX[j - 1];
        selY[j] = selY[j - 1];
      }
      sel[j] = i;
      selD[j] = rank;
      selX[j] = nx;
      selY[j] = ny;
      if (selCount < most) selCount++;
    }
    for (let i = 0; i < selCount; i++) lit[sel[i]] = 1;
  };

  const gap = (i: number, j: number) => Math.hypot(selX[i] - selX[j], selY[i] - selY[j]);
  const addEdge = (i: number, j: number) => {
    edgeA[edgeCount] = i;
    edgeB[edgeCount++] = j;
    joined[i * MAX_NODES + j] = joined[j * MAX_NODES + i] = 1;
  };

  /** The selection's shortest tree (Prim's), then a few short chords that cross nothing. */
  const connect = () => {
    edgeCount = 0;
    joined.fill(0);
    if (selCount < 2) return;
    best.fill(Infinity, 0, selCount);
    parent.fill(-1, 0, selCount);
    best[0] = 0;
    const done = joined; // the diagonal of `joined` is never an edge: it marks tree membership
    let total = 0;
    for (let n = 0; n < selCount; n++) {
      let pick = -1;
      for (let i = 0; i < selCount; i++) if (!done[i * MAX_NODES + i] && (pick < 0 || best[i] < best[pick])) pick = i;
      done[pick * MAX_NODES + pick] = 1;
      if (parent[pick] >= 0 && best[pick] <= LONGEST) {
        addEdge(parent[pick], pick);
        total += best[pick];
      }
      for (let i = 0; i < selCount; i++) {
        const g = gap(pick, i);
        if (!done[i * MAX_NODES + i] && g < best[i]) {
          best[i] = g;
          parent[i] = pick;
        }
      }
    }
    const longestChord = edgeCount ? (total / edgeCount) * CHORD_RATIO : 0;
    for (let c = 0; c < CHORDS; c++) {
      let bi = -1;
      let bj = -1;
      let bg = longestChord;
      for (let i = 0; i < selCount; i++) {
        for (let j = i + 1; j < selCount; j++) {
          const g = gap(i, j);
          if (g >= bg || joined[i * MAX_NODES + j]) continue;
          let clear = true;
          for (let e = 0; e < edgeCount && clear; e++) {
            const a = edgeA[e];
            const b = edgeB[e];
            clear = !crosses(selX[i], selY[i], selX[j], selY[j], selX[a], selY[a], selX[b], selY[b]);
          }
          if (!clear) continue;
          bi = i;
          bj = j;
          bg = g;
        }
      }
      if (bi < 0) break;
      addEdge(bi, bj);
    }
  };

  /** Mark link (a → b; b −1 for the hand) as wanted, taking a slot for it if it is new. */
  const wantLink = (a: number, b: number, moving: boolean) => {
    const k = b < 0 ? count * count + a : Math.min(a, b) * count + Math.max(a, b);
    let slot = -1;
    let free = -1;
    let faintest = -1;
    for (let s = 0; s < SLOTS && slot < 0; s++) {
      if (key[s] === k) slot = s;
      else if (key[s] < 0) free = free < 0 ? s : free;
      else if (!want[s] && (faintest < 0 || light[s] < light[faintest])) faintest = s;
    }
    if (slot < 0) {
      // A free slot, else the faintest of the fading ones: a full table drops the oldest wake first.
      slot = free >= 0 ? free : faintest;
      if (slot < 0) return;
      key[slot] = k;
      from[slot] = a;
      to[slot] = b;
      light[slot] = reach[slot] = moving ? 0 : 1;
    }
    want[slot] = 1;
    if (b < 0) {
      handDir[slot * 3] = hand.x;
      handDir[slot * 3 + 1] = hand.y;
      handDir[slot * 3 + 2] = hand.z;
    }
  };

  const fromArr = aFrom.array as Float32Array;
  const toArr = aTo.array as Float32Array;
  const linkArr = aLink.array as Float32Array;
  /** Copy direction `n` of `src` into instance `at` of `dst`: three floats, no views made. */
  const put = (dst: Float32Array, at: number, src: Float32Array, n: number) => {
    dst[at * 3] = src[n * 3];
    dst[at * 3 + 1] = src[n * 3 + 1];
    dst[at * 3 + 2] = src[n * 3 + 2];
  };

  /** Ease every slot, free the dead, light the nodes and write the instance buffer. */
  const settle = (dt: number, moving: boolean) => {
    if (glowDirty) glowArray.fill(0);
    live = 0;
    const up = 1 - Math.exp(-dt * LIGHT_UP);
    const down = 1 - Math.exp(-dt * LIGHT_DOWN);
    const grow = 1 - Math.exp(-dt * GROW);
    for (let s = 0; s < SLOTS; s++) {
      if (key[s] < 0) continue;
      const toHand = to[s] < 0;
      if (!moving) {
        light[s] = want[s];
        reach[s] = 1;
      } else if (want[s]) {
        light[s] += (1 - light[s]) * up;
        reach[s] += (1 - reach[s]) * grow;
      } else {
        light[s] -= light[s] * down;
        // A thread to the hand draws back into its star as it fades; one between stars fades in place.
        if (toHand) reach[s] = Math.min(reach[s], Math.sqrt(light[s]));
      }
      if (light[s] < DEAD && !want[s]) {
        key[s] = -1;
        continue;
      }
      const a = from[s];
      const b = to[s];
      glowArray[a] = Math.max(glowArray[a], light[s]);
      if (!toHand) glowArray[b] = Math.max(glowArray[b], light[s] * THREE.MathUtils.smoothstep(reach[s], 0.75, 1));
      put(fromArr, live, dirs, a);
      if (toHand) put(toArr, live, handDir, s);
      else put(toArr, live, dirs, b);
      linkArr[live * 4] = light[s];
      linkArr[live * 4 + 1] = reach[s];
      linkArr[live * 4 + 2] = hues[a] + HUE_PACK * (toHand ? POINTER_HUE : hues[b]);
      // A seed from the link's identity, so its glint keeps its phase for as long as it lives.
      linkArr[live * 4 + 3] = (key[s] * GOLDEN) % 1;
      live++;
    }
    // Uploaded while anything is lit, and once more as the last node goes dark.
    glow.needsUpdate = glowDirty || live > 0;
    glowDirty = live > 0;
    if (live > 0) aFrom.needsUpdate = aTo.needsUpdate = aLink.needsUpdate = true;
    quad.instanceCount = live;
    links.visible = live > 0;
  };

  return {
    nodes,
    links,
    update({ t, dt, camera, pointer }: WebInput) {
      const moving = dt > 0;
      const age = (t - pulseAt) / PULSE_SECONDS;
      const boost = moving && age >= 0 && age < 1 ? 1 - age : 0;
      // A tap lifts the finger before its pulse lands: the web then gathers round the pulse instead.
      const centred = pointer.active || boost > 0;
      if (!centred && live === 0 && !glowDirty) return;
      want.fill(0);
      if (centred) {
        const cx = pointer.active ? pointer.x : pulseX;
        const cy = pointer.active ? pointer.y : pulseY;
        select(cx, cy, camera, REACH * (1 + PULSE_REACH * boost), WEB_NODES + Math.round(PULSE_NODES * boost));
        connect();
        // The tree grows outward from the hand: each link starts at its end nearer the pointer.
        for (let e = 0; e < edgeCount; e++) {
          const i = edgeA[e];
          const j = edgeB[e];
          if (selD[i] <= selD[j]) wantLink(sel[i], sel[j], moving);
          else wantLink(sel[j], sel[i], moving);
        }
        if (pointer.active) for (let i = 0; i < Math.min(HAND_LINKS, selCount); i++) wantLink(sel[i], -1, moving);
      } else {
        for (let i = 0; i < selCount; i++) lit[sel[i]] = 0;
        selCount = 0;
      }
      settle(dt, moving);
    },
    pulse(x: number, y: number, t: number) {
      pulseAt = t;
      pulseX = x;
      pulseY = y;
    },
  };
}
