/**
 * Renderer, camera and lighting for the robot stage.
 *
 * Kept apart from React and from the robot itself: this file knows how to put
 * a lit 3D scene on a canvas and nothing about what stands in it, so the
 * character can be rebuilt without touching any of the plumbing.
 *
 * The page is paper grey, so the renderer is transparent and the robot is lit
 * as a product photograph would be — a broad sky light, one key, one cool rim.
 * No shadow maps: a contact shadow is faked with a single soft disc under the
 * feet, which costs one draw call instead of a depth pass per light and is the
 * difference between 60fps and 30 on a mid-range Android.
 */

import * as THREE from 'three';

export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** Soft ellipse under the robot; the only thing standing in for shadows. */
  contact: THREE.Mesh;
  resize: (w: number, h: number) => void;
  dispose: () => void;
}

/** Above this a fullscreen 3D pass stops buying visible quality. 1.5, not
 *  2: the difference is invisible on a phone and costs 1.8x the fragments. */
const MAX_DPR = 1.5;

export function createStage(canvas: HTMLCanvasElement): Stage | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      // Transparent: the paper ground and the node backdrop live in CSS and
      // canvas 2D behind this, and the robot has to sit ON them.
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch {
    // No WebGL. The caller leaves the page as it is without a robot.
    return null;
  }

  renderer.setClearAlpha(0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Filmic, so the white plastic rolls off instead of clipping to a flat patch
  // where the key light lands.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.35, 8.2);
  camera.lookAt(0, 0.2, 0);

  // Sky-to-ground fill. On its own this reads flat, but it keeps the shadow
  // side from going black on a light page, which is what makes a code-built
  // model look cheap.
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd6dde9, 1.5);
  scene.add(hemi);

  // Key: high, front, camera-left — the angle a product shot uses because it
  // separates a rounded form from its background without drama.
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-3.2, 5.0, 4.4);
  scene.add(key);

  // Cool rim from behind-right. This is the light that gives a white body an
  // edge against pale paper; without it the silhouette dissolves.
  const rim = new THREE.DirectionalLight(0xbcd4ff, 1.5);
  rim.position.set(4.0, 2.2, -3.6);
  scene.add(rim);

  const contact = makeContactShadow();
  scene.add(contact);

  const resize = (w: number, h: number) => {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // The frame loop drives position — it dollies per section — so resize
    // only widens the lens on a portrait phone, where a fixed 32 degrees
    // would crop the finished robot's feet.
    camera.fov = w / h < 0.8 ? 42 : 32;
    camera.updateProjectionMatrix();
  };

  const dispose = () => {
    contact.geometry.dispose();
    (contact.material as THREE.Material).dispose();
    renderer.dispose();
  };

  return { scene, camera, renderer, contact, resize, dispose };
}

/**
 * The fake shadow: a plane with a radial alpha gradient painted once into a
 * canvas texture. Real shadow maps would cost a depth pass per light for one
 * dark smudge that nobody looks at directly.
 */
function makeContactShadow(): THREE.Mesh {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(31, 48, 82, 0.34)');
  g.addColorStop(0.55, 'rgba(31, 48, 82, 0.12)');
  g.addColorStop(1, 'rgba(31, 48, 82, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 4.6),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  return mesh;
}
