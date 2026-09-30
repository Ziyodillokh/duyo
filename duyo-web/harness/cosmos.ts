/**
 * Cosmos harness — the living space alone, rendered the way the site renders
 * it: a transparent canvas over the near-black CSS ground, ACES, the stage's
 * pixel-ratio cap and a 500-unit far plane.
 *
 *   ?fly=0..1|auto   camera between the robot's station (0) and the phone's (1); auto swings between them
 *   ?px=&py=         freeze the pointer at this NDC point (+y up), active
 *   ?sweep=1         the pointer sweeps a fixed path between t 1.5 and 2 (with ?frames=120, mid-wake)
 *   ?pulse=1         fire a pulse at the centre (at 0.6 s, then every 2.5 s; at frame 30 with ?frames)
 *   ?reduced=1       reduced motion: dt 0, t held (at ?t, default 2)
 *   ?frames=N        deterministic: fixed 1/60 s steps, and the state holds after frame N
 *   ?meteor=s        the first shooting star at this `t`
 *   ?props=1         opaque stand-ins for the robot and the phone, to judge occlusion
 *   ?copy=left|right sample copy over the sky, to judge readability
 *   ?hud=1           build time and live frame time
 *   ?bench=1         GPU cost at this size: synchronous render loops with and without each layer
 *
 * Live: move the mouse for the lens; click for a pulse; touch works while a finger is down.
 */

import * as THREE from 'three';
import { buildCosmos } from '../src/scene/cosmos';
import { PALETTE, PHONE_DIMS, hex } from '../src/scene/contract';
import type { Cosmos } from '../src/scene/contract';

const q = new URLSearchParams(location.search);
const num = (k: string): number | null => (q.has(k) && q.get(k) !== '' ? Number(q.get(k)) : null);
const reduced = q.get('reduced') === '1';
const frames = num('frames');
const autoFly = q.get('fly') === 'auto';
const fixedFly = autoFly ? null : num('fly') ?? 0;
const frozenPointer = num('px') !== null && num('py') !== null ? { x: num('px') ?? 0, y: num('py') ?? 0 } : null;
const sweep = q.get('sweep') === '1';
const SWEEP = { from: [-0.6, 0.35], to: [0.45, -0.05], start: 1.5, seconds: 0.5 } as const;

// As src/three/stage.ts: transparent over the CSS ground, DPR capped at 1.75, ACES.
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setClearAlpha(0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setPixelRatio(Math.min(1.75, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const fov = () => (innerWidth / innerHeight < 0.8 ? 44 : 32);
const camera = new THREE.PerspectiveCamera(fov(), innerWidth / innerHeight, 0.1, 500);

const buildStart = performance.now();
const cosmos = buildCosmos(num('meteor') !== null ? { firstMeteorAt: num('meteor') ?? 0 } : {});
const buildMs = performance.now() - buildStart;
scene.add(cosmos.root);

// ── Stations ───────────────────────────────────────────────────────────────
const STATIONS = {
  robot: { eye: new THREE.Vector3(0, 0.5, 9), look: new THREE.Vector3(0, 0.3, 0) },
  phone: { eye: new THREE.Vector3(14, 1.8, -9), look: new THREE.Vector3(14, 1, -18) },
};
const look = new THREE.Vector3();
function placeCamera(fly: number) {
  const s = fly * fly * (3 - 2 * fly);
  camera.position.lerpVectors(STATIONS.robot.eye, STATIONS.phone.eye, s);
  camera.lookAt(look.lerpVectors(STATIONS.robot.look, STATIONS.phone.look, s));
  camera.updateMatrixWorld();
}

// ── Stand-ins: opaque, so occlusion is what the site will show ─────────────
if (q.get('props') === '1') {
  const robot = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 1.3, 8, 24), new THREE.MeshBasicMaterial({ color: 0xdfe6f2 }));
  robot.position.set(0, 0.45, -0.85);
  const phone = new THREE.Mesh(
    new THREE.BoxGeometry(PHONE_DIMS.width, PHONE_DIMS.height, PHONE_DIMS.depth),
    new THREE.MeshBasicMaterial({ color: hex(PALETTE.navy) }),
  );
  phone.position.set(14, 1, -18);
  scene.add(robot, phone);
}

// ── Copy overlay ───────────────────────────────────────────────────────────
const side = q.get('copy');
if (side === 'left' || side === 'right') {
  const copy = document.createElement('div');
  copy.className = `copy ${side}`;
  copy.innerHTML = '<h2>Savollaringga javob beradigan do‘st</h2>' +
    '<p>DUYO — 13–16 yoshlilar uchun o‘zbek tilidagi sun’iy intellekt hamrohi. U tinglaydi, tushuntiradi va o‘rganishga yordam beradi.</p>' +
    '<p>Guruhlarda xavfsiz suhbat, maqsadlar va bilim xaritasi — hammasi bitta ilovada.</p>';
  document.body.appendChild(copy);
}
const hud = q.get('hud') === '1' ? document.body.appendChild(Object.assign(document.createElement('div'), { className: 'hud' })) : null;

// ── Pointer: eased, as the runtime eases it; touch counts only while down ──
const pointer = { x: 0, y: 0, active: frozenPointer !== null };
const target = { x: frozenPointer?.x ?? 0, y: frozenPointer?.y ?? 0 };
if (frozenPointer) Object.assign(pointer, frozenPointer);
const toNdc = (e: PointerEvent) => ({ x: (e.clientX / innerWidth) * 2 - 1, y: 1 - (e.clientY / innerHeight) * 2 });
const canvas = renderer.domElement;
if (!frozenPointer) {
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' && e.buttons === 0) return;
    Object.assign(target, toNdc(e));
    if (!pointer.active) Object.assign(pointer, target); // arrive where the pointer is, not from a stale spot
    pointer.active = true;
  });
  canvas.addEventListener('pointerdown', (e) => {
    Object.assign(target, toNdc(e));
    if (!pointer.active) Object.assign(pointer, target);
    pointer.active = true;
  });
  const leave = (e: PointerEvent) => { if (e.type === 'pointerleave' || e.pointerType === 'touch') pointer.active = false; };
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => canvas.addEventListener(type, leave as EventListener));
}
canvas.addEventListener('click', (e) => { const p = toNdc(e); cosmos.pulse(p.x, p.y); });

// ── Clock ─────────────────────────────────────────────────────────────────
const STEP = 1 / 60;
const PULSE_FRAME = 30;
let [frame, t, last] = [0, reduced ? num('t') ?? 2 : 0, performance.now()];
let nextPulse = 0.6;
const frameTimes: number[] = [];

function tick(now: number) {
  const held = frames !== null && frame >= frames;
  const wall = frames !== null ? STEP : Math.min(0.1, (now - last) / 1000);
  // The runtime eases the pointer on the wall clock whatever the motion setting; only dt goes to 0.
  const dt = held || reduced ? 0 : wall;
  frameTimes.push(now - last);
  if (frameTimes.length > 180) frameTimes.shift();
  last = now;
  if (!held) {
    t += dt;
    const fly = fixedFly ?? 0.5 - 0.5 * Math.cos((t / 8) * Math.PI);
    placeCamera(fly);
    if (sweep) {
      const s = Math.min(1, Math.max(0, (t - SWEEP.start) / SWEEP.seconds));
      target.x = SWEEP.from[0] + (SWEEP.to[0] - SWEEP.from[0]) * s;
      target.y = SWEEP.from[1] + (SWEEP.to[1] - SWEEP.from[1]) * s;
      if (!pointer.active) Object.assign(pointer, target);
      pointer.active = true;
    }
    if (!frozenPointer) {
      const k = 1 - Math.exp(-wall * 12);
      pointer.x += (target.x - pointer.x) * k;
      pointer.y += (target.y - pointer.y) * k;
    }
    if (q.get('pulse') === '1') {
      const due = frames !== null ? frame === PULSE_FRAME : t >= nextPulse;
      if (due) { cosmos.pulse(0, 0); nextPulse = t + 2.5; }
    }
    cosmos.update({ t, dt, camera, pointer });
    frame++;
  }
  renderer.render(scene, camera);
  if (hud && frame % 15 === 0) {
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    hud.textContent = `build ${buildMs.toFixed(1)} ms\nframe ${avg.toFixed(2)} ms (rAF)\nt ${t.toFixed(2)}`;
  }
  requestAnimationFrame(tick);
}

// ── Bench: synchronous render loops, so the number is the GPU's, not vsync's ──
interface BenchResult { buildMs: number; width: number; height: number; dpr: number; ms: Record<string, number> }
function bench(): BenchResult {
  const gl = renderer.getContext();
  const px = new Uint8Array(4);
  const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const layers = cosmos.root.children;
  const loop = (n: number) => {
    for (let i = 0; i < 5; i++) renderer.render(scene, camera);
    sync();
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      cosmos.update({ t: t + i * STEP, dt: STEP, camera, pointer });
      renderer.render(scene, camera);
    }
    sync();
    return (performance.now() - t0) / n;
  };
  const only = (keep: (i: number) => boolean) => layers.forEach((o, i) => (o.visible = keep(i)));
  const ms: Record<string, number> = {};
  for (const [name, keep] of [
    ['empty', () => false], ['all', () => true], ['nebula', (i: number) => i === 0], ['stars', (i: number) => i > 0],
    ['empty2', () => false], ['all2', () => true],
  ] as const) {
    only(keep);
    ms[name] = loop(240);
  }
  only(() => true);
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  return { buildMs, width: size.x, height: size.y, dpr: renderer.getPixelRatio(), ms };
}

declare global {
  interface Window { __cosmos?: { buildMs: number; bench: () => BenchResult; cosmos: Cosmos; renderer: THREE.WebGLRenderer } }
}
window.__cosmos = { buildMs, bench, cosmos, renderer };
placeCamera(fixedFly ?? 0);
requestAnimationFrame(tick);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = fov();
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
