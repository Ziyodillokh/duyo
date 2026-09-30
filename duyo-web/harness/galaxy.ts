/**
 * Galaxy harness — the galaxy alone, rendered the way the site renders it:
 * a transparent canvas over a CSS ground, the stage's near/far and pixel-ratio
 * cap, the root placed and tilted by the director's constants.
 *
 *   ?e=0..1            fix emergence (default: animate 0→1 over 6 s, then hold)
 *   ?inside=1          put the camera inside the disc
 *   ?view=phone        a close three-quarter view of the phone, to judge emergence
 *   ?stage=1           the real composition: galaxy at GALAXY_POS/GALAXY_TILT, an
 *                      opaque phone at PHONE_POS, camera from the director at ?p=
 *   ?p=0..1            page scroll for ?stage=1 (default 0.534: section 2, mid-emergence)
 *   ?ground=space|paper  the CSS ground behind the canvas (default space)
 *   ?dark=0..1         darkness (default 1 on space, 0 on paper; the director's in stage mode)
 *   ?t=seconds         freeze the clock at t (for repeatable screenshots)
 *   ?hide=0,1          hide layers by index (disc, core, stars, links, nodes)
 */

import * as THREE from 'three';
import { buildGalaxy } from '../src/scene/galaxy';
import { PALETTE, PHONE_DIMS, hex } from '../src/scene/contract';
import { direct, GALAXY_POS, GALAXY_TILT, PHONE_POS } from '../src/scene/director';

const q = new URLSearchParams(location.search);
const num = (k: string): number | null => (q.has(k) ? Number(q.get(k)) : null);
const fixedE = num('e');
const fixedT = num('t');
const paper = q.get('ground') === 'paper';
const stage = q.get('stage') === '1';
const scroll = num('p') ?? 0.534;
const inside = q.get('inside') === '1';
const phoneView = q.get('view') === 'phone';

document.body.style.background = paper ? PALETTE.paper : PALETTE.space;

// As src/three/stage.ts: transparent over the CSS ground, DPR capped at 1.75.
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearAlpha(0);
renderer.setPixelRatio(Math.min(1.75, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const fov = () => (innerWidth / innerHeight < 0.8 ? 44 : stage ? 32 : 50);
const camera = new THREE.PerspectiveCamera(fov(), innerWidth / innerHeight, 0.1, 100);

const galaxy = buildGalaxy();
// Orientation is the director's, never the module's.
galaxy.root.rotation.set(...GALAXY_TILT);
if (stage) galaxy.root.position.set(...GALAXY_POS);
scene.add(galaxy.root);
const layers = galaxy.root.children[0]?.children ?? [];
(q.get('hide') ?? '').split(',').filter(Boolean).forEach((i) => layers[Number(i)] && (layers[Number(i)].visible = false));

// Stage mode: an opaque phone slab, so occlusion is what the site will show.
const phone = new THREE.Group();
const slab = new THREE.Mesh(
  new THREE.BoxGeometry(PHONE_DIMS.width, PHONE_DIMS.height, PHONE_DIMS.depth),
  new THREE.MeshBasicMaterial({ color: hex(PALETTE.navy) }),
);
const glass = new THREE.Mesh(
  new THREE.PlaneGeometry(PHONE_DIMS.width - 0.11, PHONE_DIMS.height - 0.11),
  new THREE.MeshBasicMaterial({ color: 0x0b1428 }),
);
glass.position.z = PHONE_DIMS.depth / 2 + 0.002;
phone.add(slab, glass);
phone.position.set(...PHONE_POS);
if (stage) scene.add(phone);

// Otherwise a stand-in outline, where emergence begins.
const origin = new THREE.Vector3(0, 0, 6);
const outline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.PlaneGeometry(PHONE_DIMS.width, PHONE_DIMS.height)),
  new THREE.LineBasicMaterial({ color: hex(PALETTE.sky), transparent: true, opacity: 0.35 }),
);
outline.position.copy(origin);
if (!stage) scene.add(outline);

const insideEye = new THREE.Vector3();
const insideLook = new THREE.Vector3();

/** Place the camera; returns [emergence, darkness] where the mode decides them. */
function placeCamera(t: number): [number, number] {
  const e = fixedE ?? Math.min(1, t / 6);
  const dark = num('dark') ?? (paper ? 0 : 1);
  if (stage) {
    const d = direct(scroll, { aspect: camera.aspect, fovDeg: camera.fov, stacked: innerWidth <= 767 });
    camera.position.set(...d.cameraPos);
    camera.lookAt(...d.cameraLook);
    phone.rotation.set(d.phonePitch, d.phoneYaw, 0);
    glass.getWorldPosition(origin); // the display's world position, passed unchanged
    return [fixedE ?? d.emergence, num('dark') ?? d.darkness];
  }
  if (inside) {
    galaxy.root.updateWorldMatrix(true, false);
    const a = 0.9 + t * 0.01;
    galaxy.root.localToWorld(insideEye.set(Math.cos(a) * 15, 0.35, Math.sin(a) * 15));
    galaxy.root.localToWorld(insideLook.set(-2, -0.4, 3));
    camera.position.copy(insideEye);
    camera.lookAt(insideLook);
    return [e, dark];
  }
  if (phoneView) {
    camera.position.set(5.5 + Math.sin(t * 0.1), 3, 17);
    camera.lookAt(-1, -0.5, 2);
    return [e, dark];
  }
  const a = 0.35 + t * 0.025;
  const r = 44 + Math.sin(t * 0.07) * 2;
  camera.position.set(Math.sin(a) * r, 14 + Math.sin(t * 0.05) * 2, Math.cos(a) * r);
  camera.lookAt(0, -1, 0);
  return [e, dark];
}

const start = performance.now();
function frame() {
  const t = fixedT ?? (performance.now() - start) / 1000;
  const [emergence, darkness] = placeCamera(t);
  galaxy.update({ t, emergence, darkness, origin });
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = fov();
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
