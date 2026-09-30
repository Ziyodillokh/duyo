/**
 * Cosmos harness — the living space alone, rendered the way the site renders
 * it: an opaque clear to the space colour (runtime.ts), ACES, the stage's
 * pixel-ratio cap, a 500-unit far plane, and the director's own camera.
 *
 *   ?fly=0..1|auto   camera along the film from DUYO's shot (0) to the first phone section (1); auto swings
 *   ?reduced=1       reduced motion: dt 0, t held (at ?t, default 2)
 *   ?frames=N        deterministic: fixed 1/60 s steps, and the state holds after frame N
 *   ?meteor=s        the first shooting star at this `t`
 *   ?props=1         opaque stand-ins for the robot and the phone, to judge occlusion
 *   ?copy=left|right sample copy over the sky, to judge readability
 *   ?hud=1           build time and live frame time
 *   ?bench=1         GPU cost at this size: synchronous render loops with and without each layer
 *
 * The sky no longer answers the pointer itself (the site gives it the camera's parallax instead).
 * The bench also times the halo, by parking it behind the camera.
 */

import * as THREE from 'three';
import { buildCosmos } from '../src/scene/cosmos';
import { PALETTE, PHONE_DIMS, hex } from '../src/scene/contract';
import type { Cosmos } from '../src/scene/contract';
import { PHONE_POS, ROBOT_POS, ROBOT_SCALE, direct } from '../src/scene/director';

const q = new URLSearchParams(location.search);
const num = (k: string): number | null => (q.has(k) && q.get(k) !== '' ? Number(q.get(k)) : null);
const reduced = q.get('reduced') === '1';
const frames = num('frames');
const autoFly = q.get('fly') === 'auto';
const fixedFly = autoFly ? null : num('fly') ?? 0;

// As src/three/stage.ts and runtime.ts: DPR capped at 1.75, ACES, and an opaque clear to the space colour.
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setClearColor(PALETTE.space, 1);
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

// ── Camera: the director's, from the hero (scroll 0) to the first phone section (0.2) ──
/** Scroll position of the first phone section: fly=1. */
const FIRST_PHONE = 0.2;
function placeCamera(fly: number) {
  const aspect = innerWidth / innerHeight;
  const shot = direct(fly * FIRST_PHONE, { aspect, fovDeg: camera.fov, stacked: innerWidth <= 767 }, true);
  camera.position.set(...shot.cameraPos);
  camera.lookAt(...shot.cameraLook);
  camera.updateMatrixWorld();
}

// ── Stand-ins: opaque, so occlusion is what the site will show ─────────────
if (q.get('props') === '1') {
  const robot = new THREE.Mesh(new THREE.CapsuleGeometry(1.2, 1.4, 8, 24), new THREE.MeshBasicMaterial({ color: 0xdfe6f2 }));
  robot.scale.setScalar(ROBOT_SCALE);
  robot.position.set(ROBOT_POS[0], ROBOT_POS[1] + 0.23, ROBOT_POS[2]);
  const phone = new THREE.Mesh(
    new THREE.BoxGeometry(PHONE_DIMS.width, PHONE_DIMS.height, PHONE_DIMS.depth),
    new THREE.MeshBasicMaterial({ color: hex(PALETTE.navy) }),
  );
  phone.position.set(...PHONE_POS);
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

// ── Clock ─────────────────────────────────────────────────────────────────
const STEP = 1 / 60;
let [frame, t, last] = [0, reduced ? num('t') ?? 2 : 0, performance.now()];
const frameTimes: number[] = [];

function tick(now: number) {
  const held = frames !== null && frame >= frames;
  const wall = frames !== null ? STEP : Math.min(0.1, (now - last) / 1000);
  const dt = held || reduced ? 0 : wall;
  frameTimes.push(now - last);
  if (frameTimes.length > 180) frameTimes.shift();
  last = now;
  if (!held) {
    t += dt;
    const fly = fixedFly ?? 0.5 - 0.5 * Math.cos((t / 8) * Math.PI);
    placeCamera(fly);
    cosmos.update({ t, dt, camera });
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
      cosmos.update({ t: t + i * STEP, dt: STEP, camera });
      renderer.render(scene, camera);
    }
    sync();
    return (performance.now() - t0) / n;
  };
  // By material, not object, so a layer's own visibility is left alone.
  const materialOf = (o: THREE.Object3D) => (o as THREE.Mesh<THREE.BufferGeometry, THREE.Material>).material;
  const only = (keep: (name: string) => boolean) => layers.forEach((o) => (materialOf(o).visible = keep(o.name)));
  const ms: Record<string, number> = {};
  for (const [name, keep] of [
    ['empty', () => false], ['all', () => true], ['nebula', (n: string) => n === 'nebula'],
    ['stars', (n: string) => n !== 'nebula'],
    ['empty2', () => false], ['all2', () => true],
  ] as const) {
    only(keep);
    ms[name] = loop(240);
  }
  only(() => true);
  // The halo's share of the nebula: park it behind the camera, where the pass skips it.
  const halo = layers.map(materialOf).find((m): m is THREE.ShaderMaterial => m instanceof THREE.ShaderMaterial && 'uHaloAt' in m.uniforms);
  if (halo) {
    const at = halo.uniforms.uHaloAt.value as THREE.Vector3;
    const kept = at.clone();
    at.copy(camera.position).addScaledVector(camera.getWorldDirection(new THREE.Vector3()), -10);
    ms.noHalo = loop(240);
    at.copy(kept);
    ms.all3 = loop(240);
  }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  return { buildMs, width: size.x, height: size.y, dpr: renderer.getPixelRatio(), ms };
}

declare global {
  interface Window { __cosmos?: { buildMs: number; bench: () => BenchResult; cosmos: Cosmos; renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera } }
}
window.__cosmos = { buildMs, bench, cosmos, renderer, camera };
placeCamera(fixedFly ?? 0);
requestAnimationFrame(tick);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = fov();
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
