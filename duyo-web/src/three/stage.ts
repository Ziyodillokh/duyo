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
  /** Lowers (or restores) the pixel-ratio cap and applies it at once; scene/quality.ts. */
  setPixelRatioCap: (cap: number) => void;
  /** (Re)bakes the lighting environment; see StageOptions.deferEnvironment. */
  bakeEnvironment: () => void;
  dispose: () => void;
}

export interface StageOptions {
  /**
   * Leave the first environment bake to the caller, so start-up can hand the
   * main thread back before it: rendering and prefiltering the studio is
   * one of the costliest steps, ~100ms on a mid-range phone.
   */
  deferEnvironment?: boolean;
}

/** Above this a fullscreen 3D pass stops buying visible quality. */
const MAX_DPR = 1.75;

export const FLOOR_Y = -1.96;

/**
 * RoomEnvironment through PMREM: a small studio of emissive boxes,
 * prefiltered into the mip chain a rough material samples. The generator
 * and the room are only needed for the one render, so both go at once.
 */
function renderEnvironment(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const target = pmrem.fromScene(room, 0.04);
  room.dispose();
  pmrem.dispose();
  return target;
}

export function createStage(canvas: HTMLCanvasElement, options: StageOptions = {}): Stage | null {
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
  // PCF with a blur radius: three r18x removed PCFSoftShadowMap and falls
  // back to this anyway, with a console warning.
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();

  // ── Environment ────────────────────────────────────────────────────────
  // The single biggest quality lever. Cost is one render at startup and
  // nothing per frame.
  let envRT: THREE.WebGLRenderTarget | null = null;
  const bakeEnvironment = () => {
    envRT?.dispose();
    envRT = renderEnvironment(renderer);
    scene.environment = envRT.texture;
  };
  if (!options.deferEnvironment) bakeEnvironment();
  // 0.55: enough for the gloss to have something to mirror, low enough
  // that the brand blue stays blue instead of washing to grey.
  scene.environmentIntensity = 0.55;
  // Deliberately NOT scene.background — the page's own gradient shows through.

  // A lost-and-restored context (a reclaimed background tab on Android, a
  // GPU reset, a GPU switch on a Mac) gets its buffers and programs back
  // from three, whose own listener runs first — but not what was rendered
  // INTO a render target. The environment would come back black and the
  // white plastic read as dark metal for the rest of the visit, so bake it
  // again. The old target is dropped, not disposed: its memory went with
  // the lost context, and disposing it would delete handles the new one
  // does not own.
  const onRestored = () => {
    envRT = null;
    bakeEnvironment();
  };
  canvas.addEventListener('webglcontextrestored', onRestored);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 500);
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

  let dprCap = MAX_DPR;
  const resize = (w: number, h: number) => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // A portrait phone needs a wider lens or the finished robot loses its
    // feet; widening beats dollying because the dolly is already the story.
    camera.fov = w / h < 0.8 ? 44 : 32;
    camera.updateProjectionMatrix();
  };

  const setPixelRatioCap = (cap: number) => {
    dprCap = Math.min(MAX_DPR, cap);
    const size = renderer.getSize(new THREE.Vector2());
    if (size.x > 0 && size.y > 0) resize(size.x, size.y);
  };

  const dispose = () => {
    canvas.removeEventListener('webglcontextrestored', onRestored);
    ground.geometry.dispose();
    (ground.material as THREE.Material).dispose();
    envRT?.dispose();
    renderer.dispose();
  };

  return { scene, camera, renderer, ground, floorY: FLOOR_Y, resize, setPixelRatioCap, bakeEnvironment, dispose };
}
