/**
 * The phone — an Android handset built from primitives, display facing +Z.
 * The site's download is an Android APK and its users carry Galaxies and
 * Redmis, so the body is one: both keys on the right edge, a punch-hole
 * front camera, and three separate lens rings in a column on the back.
 *
 * Why not RoundedBoxGeometry for the body: it clamps its radius to half the
 * shortest side, and the phone is only 0.17 deep, so the plan corners would
 * come out at 0.085 instead of PHONE_DIMS.radius and the display's corners
 * could no longer run concentric with the body's. A real phone has two
 * different radii — a big one in plan, a small one on the edge profile — so
 * the body is a rounded rectangle EXTRUDED with a bevel: the shape carries
 * the plan radius, the bevel carries the edge roll.
 *
 * Front stack, back to front, all concentric with the body's corners:
 *   black glass ring (the bezel) → lit display → punch-hole camera → cover
 *   glass. The cover is additive, so it only ever ADDS reflections: it cannot
 *   dim or grey the UI underneath, which a normal alpha blend would.
 *
 * Every colour is derived from PALETTE. The texture belongs to the caller
 * and is not disposed here; everything else built in this file is.
 */

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE, PHONE_DIMS, SCREEN_PX, type Phone } from './contract';
import { STATUS_BAR_PX } from '../assets/app-screens/captures';

const { width: W, height: H, depth: D, radius: R, screenInset: INSET } = PHONE_DIMS;

/** Edge roll of the frame: how far the rounded edge eats into the face… */
const EDGE_SIZE = 0.034;
/** …and how deep it runs along Z. The flat band between is the metal side. */
const EDGE_DEPTH = 0.042;

/** Stacking offsets in front of the body's front face. Far apart enough for a
 *  24-bit depth buffer at the camera distances the page uses. */
const Z_PANEL = 0.0008;
const Z_DISPLAY = 0.0016;
const Z_CAMERA = 0.0024;
const Z_COVER = 0.0034;

const CURVE_SEGMENTS = 20;
/* The screen draws Android's status bar across the top STATUS_BAR_PX of
   SCREEN_PX (scene/phoneScreen.ts); the front camera sits in it. */
/** The punch hole's radius as a share of that bar's height: ~4% of the
 *  display's width across, as on a current Android flagship. */
const HOLE_RADIUS = 0.3;
/** How far the bezel ring runs in under the display's edge. */
const BEZEL_OVERLAP = 0.006;

/** Share of the environment the cover glass adds over the UI. Real glass is
 *  ~4%, which already holds a whole softbox; above ~0.35 the UI greys out
 *  whenever the phone faces a light head-on. */
const COVER_REFLECTANCE = 0.15;
/** Ceiling on what the cover may ADD to any pixel, in output (sRGB) units.
 *  RoomEnvironment's light boxes are HDR: uncapped, a head-on phone clips a
 *  white UI to pure white. A soft knee keeps the sheen's shape under the cap. */
const COVER_MAX_ADD = 0.03;

// ── Rear cameras (in the BACK's own view: +X of the model is its left) ──
// Three lens rings standing straight off the back in a column along the
// left edge, the flash beside the top one — no island around them.
const LENS_R = 0.13;
const LENS_H = 0.042;
const LENS_EDGE = 0.25; //  lens centre in from the side edge…
const LENS_TOP = 0.28; //   …and the top lens's centre down from the top
const LENS_PITCH = 0.33; // centre to centre down the column
const FLASH_R = 0.045;

const c = (s: string) => new THREE.Color(s);

/** mergeGeometries returns null on mismatched attributes; fail loudly. */
function mergeOrThrow(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts);
  if (!g) throw new Error('phone: merge failed — mismatched attributes');
  return g;
}

/** Compress the cover's output so its additive contribution never exceeds
 *  COVER_MAX_ADD: add = rgb × opacity, so rgb is soft-capped at max/opacity. */
function capCoverOutput(shader: { fragmentShader: string }): void {
  const cap = (COVER_MAX_ADD / COVER_REFLECTANCE).toFixed(4);
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <dithering_fragment>',
    `gl_FragColor.rgb = ${cap} * (1.0 - exp(-gl_FragColor.rgb / ${cap}));\n#include <dithering_fragment>`,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Geometry helpers
// ─────────────────────────────────────────────────────────────────────────

/** A centred rounded rectangle with true circular corners. */
function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const x = w / 2;
  const y = h / 2;
  const rr = Math.max(0.0005, Math.min(r, x, y));
  const s = new THREE.Shape();
  s.moveTo(-x + rr, -y);
  s.lineTo(x - rr, -y);
  s.absarc(x - rr, -y + rr, rr, -Math.PI / 2, 0, false);
  s.lineTo(x, y - rr);
  s.absarc(x - rr, y - rr, rr, 0, Math.PI / 2, false);
  s.lineTo(-x + rr, y);
  s.absarc(-x + rr, y - rr, rr, Math.PI / 2, Math.PI, false);
  s.lineTo(-x, -y + rr);
  s.absarc(-x + rr, -y + rr, rr, Math.PI, Math.PI * 1.5, false);
  return s;
}

/**
 * A flat rounded rectangle whose UVs run 0..1 across its own bounds.
 * ShapeGeometry writes shape coordinates into `uv` (−w/2..w/2), which would
 * tile a texture instead of fitting it; this remaps them so a texture fills
 * the shape edge to edge with no stretch beyond the shape's own aspect.
 */
function fittedPlate(w: number, h: number, r: number): THREE.ShapeGeometry {
  const geo = new THREE.ShapeGeometry(roundedRect(w, h, r), CURVE_SEGMENTS);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * A rounded slab spanning w × h × depth, centred on the origin, with a
 * rolled edge. ExtrudeGeometry is non-indexed, so its own normals are
 * per-face and a bevel comes out faceted; welding the vertices first makes
 * the roll one smooth surface that reflections slide across.
 */
function slab(
  w: number,
  h: number,
  r: number,
  depth: number,
  edgeSize: number,
  edgeDepth: number,
): THREE.BufferGeometry {
  const core = depth - 2 * edgeDepth;
  const raw = new THREE.ExtrudeGeometry(roundedRect(w - 2 * edgeSize, h - 2 * edgeSize, r - edgeSize), {
    depth: core,
    bevelEnabled: true,
    bevelThickness: edgeDepth,
    bevelSize: edgeSize,
    bevelSegments: 7,
    curveSegments: CURVE_SEGMENTS,
  });
  raw.translate(0, 0, -core / 2);
  raw.deleteAttribute('normal');
  raw.deleteAttribute('uv');
  const welded = mergeVertices(raw, 1e-5);
  raw.dispose();
  welded.computeVertexNormals();
  return welded;
}

/**
 * A lens barrel as a lathe: an outer wall, a rounded lip, and an inner wall
 * that steps down to where the lens glass sits recessed. Axis along −Z, base
 * at z = 0, so it stands off the back.
 *
 * Both walls carry a slight draft, as a machined barrel does. A perfectly
 * vertical wall is edge-on when the phone faces the camera, and software
 * rasterisers (SwiftShader, the WebGL fallback on GPU-blocklisted devices)
 * let that ring of zero-area triangles win stray depth samples straight
 * through the body: single dark pixels on the UI. Drafted, it never is.
 */
function lensBarrel(): THREE.BufferGeometry {
  const lip = 0.022;
  const draft = 0.004;
  const pts = [
    new THREE.Vector2(LENS_R, 0),
    new THREE.Vector2(LENS_R - draft, LENS_H - 0.008),
    new THREE.Vector2(LENS_R - draft - 0.003, LENS_H - 0.002),
    new THREE.Vector2(LENS_R - draft - 0.008, LENS_H),
    new THREE.Vector2(LENS_R - lip + 0.004, LENS_H),
    new THREE.Vector2(LENS_R - lip, LENS_H - 0.004),
    new THREE.Vector2(LENS_R - lip - draft * 0.6, LENS_H - 0.014),
  ];
  const geo = new THREE.LatheGeometry(pts, 56);
  geo.rotateX(-Math.PI / 2); // lathe axis +Y → −Z
  return geo;
}

/** A disc facing −Z at depth z, for anything that lies on the back. */
function backDisc(radius: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(radius, 48);
  g.rotateY(Math.PI);
  g.translate(x, y, z);
  return g;
}

// ─────────────────────────────────────────────────────────────────────────
// Materials
// ─────────────────────────────────────────────────────────────────────────

function createMaterials(texture: THREE.Texture) {
  // Aluminium with a cold blue cast: the brand navy lifted toward white, as
  // metal. A metal's colour IS its reflection tint, so this stays neutral
  // enough to read as metal and not as painted blue.
  const metal = c(PALETTE.navy).lerp(c(PALETTE.white), 0.3);
  const backGlass = c(PALETTE.navy).lerp(c(PALETTE.blue), 0.035);
  const lensCoat = c(PALETTE.space).lerp(c(PALETTE.violet), 0.03);
  // Frosted warm diffuser, dimmed: an unlit flash is pearl, not white.
  const flash = c(PALETTE.white).lerp(c(PALETTE.amber), 0.22).multiplyScalar(0.62);

  // Additive: contributes only its reflection, never darkens the UI.
  const cover = new THREE.MeshStandardMaterial({
    color: 0x000000,
    roughness: 0.18,
    metalness: 0,
    transparent: true,
    opacity: COVER_REFLECTANCE,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  cover.onBeforeCompile = capCoverOutput;

  return {
    frame: new THREE.MeshPhysicalMaterial({
      color: metal,
      metalness: 0.85,
      roughness: 0.22,
      clearcoat: 0.25,
      clearcoatRoughness: 0.2,
    }),
    ring: new THREE.MeshStandardMaterial({
      color: metal,
      metalness: 0.8,
      roughness: 0.16,
    }),
    // Black glass behind the display — the bezel. Unlit on purpose: the
    // cover glass in front carries all of the gloss. (A lit material would
    // mirror scene.environment at full strength — three ignores a material's
    // envMapIntensity when the map comes from the scene — and read grey.)
    panel: new THREE.MeshBasicMaterial({ color: c(PALETTE.space).multiplyScalar(0.4) }),
    display: new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
    hole: new THREE.MeshBasicMaterial({ color: c(PALETTE.space).multiplyScalar(0.25) }),
    // The front camera: a basic material, so it stays a dark lens at every
    // angle instead of mirroring the ceiling light as a white dot.
    holeLens: new THREE.MeshBasicMaterial({
      color: c(PALETTE.space).lerp(c(PALETTE.violet), 0.12).multiplyScalar(0.7),
    }),
    cover,
    // Frosted back: satin under a lacquer, so the key light sweeps a soft
    // diagonal sheen across it, against the glossy metal of the lens rings.
    back: new THREE.MeshPhysicalMaterial({
      color: backGlass,
      roughness: 0.36,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.22,
    }),
    lensGlass: new THREE.MeshPhysicalMaterial({
      color: c(PALETTE.space).multiplyScalar(0.35),
      roughness: 0.03,
      metalness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
    }),
    lensCoat: new THREE.MeshPhysicalMaterial({
      color: lensCoat,
      roughness: 0.08,
      metalness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
    }),
    flash: new THREE.MeshPhysicalMaterial({
      color: flash,
      roughness: 0.35,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
    }),
  };
}

type Materials = ReturnType<typeof createMaterials>;

// ─────────────────────────────────────────────────────────────────────────
// Parts
// ─────────────────────────────────────────────────────────────────────────

type Keep = <T extends { dispose: () => void }>(x: T) => T;

function solid(geo: THREE.BufferGeometry, mat: THREE.Material, cast = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

/** A flat part laid on the front face; draws nothing into the shadow map. */
function film(geo: THREE.BufferGeometry, mat: THREE.Material, z: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.z = D / 2 + z;
  return m;
}

function buildFront(root: THREE.Group, mat: Materials, keep: Keep): THREE.Mesh {
  // The body's flat front face ends where the edge roll begins.
  const faceW = W - 2 * EDGE_SIZE;
  const faceH = H - 2 * EDGE_SIZE;
  const faceGeo = keep(fittedPlate(faceW, faceH, R - EDGE_SIZE));
  const dw = W - 2 * INSET;
  const dh = H - 2 * INSET;

  // The bezel is a ring, not a full plate: nothing black sits right behind
  // the lit display to bleed through it at grazing angles, and the display's
  // pixels are not shaded twice. Its hole is a hair smaller than the display
  // so no sliver of body shows between the two when the phone is turned.
  const ring = roundedRect(faceW, faceH, R - EDGE_SIZE);
  ring.holes.push(roundedRect(dw - 2 * BEZEL_OVERLAP, dh - 2 * BEZEL_OVERLAP, R - INSET - BEZEL_OVERLAP));
  const panel = film(keep(new THREE.ShapeGeometry(ring, CURVE_SEGMENTS)), mat.panel, Z_PANEL);
  panel.name = 'phone-panel';
  root.add(panel);

  const screen = film(keep(fittedPlate(dw, dh, R - INSET)), mat.display, Z_DISPLAY);
  screen.name = 'phone-display';
  root.add(screen);

  // Front camera: an Android punch hole, centred in the status bar the screen
  // draws — the site's download is an Android APK, so the phone is one. A
  // black aperture with the lens glass set inside it.
  const bar = (dh * STATUS_BAR_PX) / SCREEN_PX.height;
  const holeR = bar * HOLE_RADIUS;
  const hole = film(keep(new THREE.CircleGeometry(holeR, 32)), mat.hole, Z_CAMERA);
  hole.position.y = dh / 2 - bar / 2;
  root.add(hole);

  const lens = film(keep(new THREE.CircleGeometry(holeR * 0.55, 24)), mat.holeLens, Z_CAMERA + 0.0004);
  lens.position.y = hole.position.y;
  root.add(lens);

  const cover = film(faceGeo, mat.cover, Z_COVER);
  cover.name = 'phone-cover';
  cover.renderOrder = 2; // after everything it reflects over
  root.add(cover);

  return screen;
}

/** The volume rocker above the power key, both on the right edge (+X seen from the front). */
function buildButtons(root: THREE.Group, mat: Materials, keep: Keep): void {
  const proud = 0.014;
  const thick = 0.05;
  const keys: { y: number; len: number }[] = [
    { y: 0.78, len: 0.46 }, // volume rocker
    { y: 0.36, len: 0.22 }, // power
  ];
  const parts = keys.map(({ y, len }) => {
    // Half its width buried in the frame, so no seam shows against the side.
    const g = new THREE.CapsuleGeometry(proud, len - 2 * proud, 6, 16);
    g.scale(1, 1, thick / (2 * proud));
    g.translate(W / 2 - 0.001, y, 0);
    return g;
  });
  const merged = keep(mergeOrThrow(parts));
  parts.forEach((g) => g.dispose());
  root.add(solid(merged, mat.frame));
}

function buildBack(root: THREE.Group, mat: Materials, keep: Keep): void {
  const back = D / 2;
  const plate = new THREE.Mesh(keep(fittedPlate(W - 2 * EDGE_SIZE, H - 2 * EDGE_SIZE, R - EDGE_SIZE)), mat.back);
  plate.rotation.y = Math.PI;
  plate.position.z = -back - Z_PANEL;
  plate.receiveShadow = true;
  root.add(plate);

  // Seen from behind, the column runs down the left edge — which is +X in
  // model space. The rings stand straight off the back glass.
  const face = -back - Z_PANEL;
  const cx = W / 2 - LENS_EDGE;
  const cy = H / 2 - LENS_TOP;
  const lenses: [number, number][] = [0, 1, 2].map((i) => [cx, cy - i * LENS_PITCH]);

  const barrel = lensBarrel();
  const barrels = lenses.map(([x, y]) => barrel.clone().translate(x, y, face + 0.004));
  const glassZ = face - (LENS_H - 0.014) - 0.0005;
  const glass = lenses.map(([x, y]) => backDisc(LENS_R - 0.021, x, y, glassZ));
  const coat = lenses.map(([x, y]) => backDisc(LENS_R * 0.31, x, y, glassZ - 0.0006));
  // The inner element's retaining ring — a glossy dark torus whose one rim
  // highlight is what gives a lens its depth.
  const inner = lenses.map(([x, y]) => {
    const g = new THREE.TorusGeometry(LENS_R * 0.5, 0.007, 8, 48);
    g.translate(x, y, glassZ - 0.002);
    return g;
  });

  // The flash sits inboard of the top lens, flush with the glass.
  const flashGeo = backDisc(FLASH_R, cx - LENS_R - 0.1, cy, face - 0.0006);

  // One mesh per material — the lens parts cost three draw calls.
  const merge = (parts: THREE.BufferGeometry[]) => {
    const g = keep(mergeOrThrow(parts));
    parts.forEach((p) => p.dispose());
    return g;
  };
  root.add(solid(merge(barrels), mat.ring));
  root.add(solid(merge([...glass, ...inner]), mat.lensGlass, false));
  root.add(solid(merge(coat), mat.lensCoat, false));
  root.add(solid(keep(flashGeo), mat.flash, false));
  barrel.dispose();
}

// ─────────────────────────────────────────────────────────────────────────

export function buildPhone(texture: THREE.Texture): Phone {
  const bin: { dispose: () => void }[] = [];
  const keep: Keep = (x) => (bin.push(x), x);

  const mat = createMaterials(texture);
  Object.values(mat).forEach((m) => keep(m));

  const root = new THREE.Group();
  root.name = 'phone';

  root.add(solid(keep(slab(W, H, R, D, EDGE_SIZE, EDGE_DEPTH)), mat.frame));
  const screen = buildFront(root, mat, keep);
  buildButtons(root, mat, keep);
  buildBack(root, mat, keep);

  const dispose = () => {
    root.removeFromParent();
    bin.forEach((x) => x.dispose());
    bin.length = 0;
  };

  return { root, screen, dispose };
}
