/**
 * Phone harness — the phone alone, under the site's renderer settings.
 *
 *   /harness/phone.html?view=front | three-quarter | back | dark | edge
 *   optional overrides: &ry=<radians> &rx=<radians> &dist=<units> &px=&py=<pan> &hide=<part,part>
 *
 * The test texture is built to expose fit problems: a stroke hugging the
 * canvas edge (must show on all four sides), and a circle (must stay round).
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildPhone } from '../src/scene/phone';
import { PALETTE, SCREEN_PX } from '../src/scene/contract';

interface View {
  ry: number;
  rx: number;
  bg: string;
  dist: number;
}

const VIEWS: Record<string, View> = {
  front: { ry: 0, rx: 0, bg: PALETTE.paper, dist: 8.2 },
  'three-quarter': { ry: -0.62, rx: 0.1, bg: PALETTE.paper, dist: 8.2 },
  back: { ry: Math.PI + 0.55, rx: 0.12, bg: PALETTE.paper, dist: 8.2 },
  dark: { ry: -0.62, rx: 0.1, bg: PALETTE.space, dist: 8.2 },
  edge: { ry: -1.35, rx: 0.05, bg: PALETTE.paper, dist: 6.4 },
};

function testTexture(): THREE.CanvasTexture {
  const { width: w, height: h } = SCREEN_PX;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');

  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, PALETTE.white);
  bg.addColorStop(1, '#dfe8fb');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);

  g.fillStyle = PALETTE.navy;
  g.font = '600 34px -apple-system, system-ui, sans-serif';
  g.fillText('9:41', 64, 70);
  g.fillRect(w - 150, 50, 44, 22);
  g.fillRect(w - 96, 50, 34, 22);

  g.font = '700 88px -apple-system, system-ui, sans-serif';
  g.fillText('DUYO', 56, 250);

  const bubble = (x: number, y: number, bw: number, bh: number, fill: string) => {
    g.fillStyle = fill;
    g.beginPath();
    g.roundRect(x, y, bw, bh, 36);
    g.fill();
  };
  bubble(56, 330, 460, 120, '#ffffff');
  bubble(w - 56 - 420, 490, 420, 110, PALETTE.blue);
  bubble(56, 640, 520, 190, '#ffffff');

  g.strokeStyle = PALETTE.violet;
  g.lineWidth = 8;
  g.beginPath();
  g.arc(w / 2, 1080, 150, 0, Math.PI * 2);
  g.stroke();

  bubble(40, h - 170, w - 80, 100, '#ffffff');
  g.fillStyle = PALETTE.blue;
  g.beginPath();
  g.arc(w - 100, h - 120, 34, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = PALETTE.danger;
  g.lineWidth = 6;
  g.strokeRect(3, 3, w - 6, h - 6);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function main(): void {
  const params = new URLSearchParams(location.search);
  const base = VIEWS[params.get('view') ?? 'three-quarter'] ?? VIEWS['three-quarter'];
  const num = (k: string, d: number) => {
    const v = parseFloat(params.get(k) ?? '');
    return Number.isFinite(v) ? v : d;
  };
  const view: View = { ...base, ry: num('ry', base.ry), rx: num('rx', base.rx), dist: num('dist', base.dist) };

  const canvas = document.getElementById('c') as HTMLCanvasElement;
  document.body.style.background = view.bg;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(view.bg);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-4.2, 7, 5.2);
  key.castShadow = true;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc3d9ff, 1.1);
  rim.position.set(5, 2.4, -4.2);
  scene.add(rim);

  const tex = testTexture();
  // &aniso=1 / &nomip=1 isolate sampler artefacts from the model's own.
  tex.anisotropy = num('aniso', tex.anisotropy);
  if (params.get('nomip') === '1') {
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
  }
  const phone = buildPhone(tex);
  phone.root.rotation.set(view.rx, view.ry, 0, 'YXZ');
  // &hide=phone-cover,phone-panel hides named parts, to isolate artefacts.
  const hidden = new Set((params.get('hide') ?? '').split(',').filter(Boolean));
  phone.root.children.forEach((o, i) => {
    if (hidden.has(o.name) || hidden.has(`#${i}`)) o.visible = false;
  });
  scene.add(phone.root);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const px = num('px', 0);
  const py = num('py', 0);
  camera.position.set(px, py, view.dist);
  camera.lookAt(px, py, 0);

  const render = () => {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  addEventListener('resize', render);
  render();

  addEventListener('pagehide', () => {
    phone.dispose();
    tex.dispose();
    env.dispose();
    renderer.dispose();
  });
}

main();
