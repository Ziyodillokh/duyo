/**
 * Renderer, camera, environment and lighting.
 *
 * The first version lit the robot with three directional lights and no
 * environment, which is why it read as flat plastic no matter what the
 * geometry did. Direct light alone gives you a diffuse term and a tiny
 * specular dot; what makes a product render look expensive is what the
 * surface REFLECTS. So this builds a real IBL environment and lets
 * MeshPhysicalMaterial's clearcoat pick it up.
 *
 * Three things do the heavy lifting:
 *
 *   1. RoomEnvironment through PMREM — a generated studio, no HDR file to
 *      download. Every glossy surface now has something to mirror.
 *   2. One shadow-casting key with a soft PCF map, landing on an invisible
 *      ShadowMaterial plane. A figure without a real shadow floats.
 *   3. ACES tone mapping, so highlights roll off instead of clipping to flat
 *      white patches on a white body.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** Invisible plane that receives the key light's shadow. */
  ground: THREE.Mesh;
  /** Where the feet stand, so callers can park the ground under them. */
  floorY: number;
  resize: (w: number, h: number) => void;
  dispose: () => void;
}

/** Above this a fullscreen 3D pass stops buying visible quality. */
const MAX_DPR = 1.75;

export const FLOOR_Y = -1.96;

export function createStage(canvas: HTMLCanvasElement): Stage | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      // Transparent, because the paper ground and the field behind it are CSS
      // and 2D canvas — the robot has to sit ON them, not replace them.
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch {
    return null; // no WebGL; the caller leaves the page without a robot
  }

  renderer.setClearAlpha(0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();

  // ── Environment ────────────────────────────────────────────────────────
  // The single biggest quality lever. RoomEnvironment builds a small studio
  // out of emissive boxes; PMREM prefilters it into the mip chain a rough
  // material samples. Cost is one render at startup and nothing per frame.
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  // 0.55: enough for the gloss to have something to mirror, low enough
  // that the brand blue stays blue instead of washing to grey.
  scene.environmentIntensity = 0.55;
  // Deliberately NOT scene.background — the page's own gradient shows through.
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 1.5, 7.2);

  // ── Lights ─────────────────────────────────────────────────────────────
  // The environment already supplies ambient direction, so these only shape
  // it: one key that casts, one cool rim for the silhouette. A third would be
  // a light nobody could point to in the render.
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-4.2, 7.0, 5.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 22;
  const s = 5.5;
  key.shadow.camera.left = -s;
  key.shadow.camera.right = s;
  key.shadow.camera.top = s;
  key.shadow.camera.bottom = -s;
  // Pulls the shadow off the caster so the contact point does not acne.
  key.shadow.bias = -0.0012;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key);
  scene.add(key.target);

  const rim = new THREE.DirectionalLight(0xc3d9ff, 1.1);
  rim.position.set(5.0, 2.4, -4.2);
  scene.add(rim);

  // ── Shadow catcher ─────────────────────────────────────────────────────
  // ShadowMaterial draws nothing but the shadow, so the paper page shows
  // through everywhere the light is unblocked.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26),
    new THREE.ShadowMaterial({ opacity: 0.26, transparent: true }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = FLOOR_Y;
  ground.receiveShadow = true;
  scene.add(ground);

  const resize = (w: number, h: number) => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // A portrait phone needs a wider lens or the finished robot loses its
    // feet; widening beats dollying because the dolly is already the story.
    camera.fov = w / h < 0.8 ? 44 : 32;
    camera.updateProjectionMatrix();
  };

  const dispose = () => {
    ground.geometry.dispose();
    (ground.material as THREE.Material).dispose();
    envRT.dispose();
    renderer.dispose();
  };

  return { scene, camera, renderer, ground, floorY: FLOOR_Y, resize, dispose };
}
