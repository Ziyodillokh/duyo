/**
 * DUYO's colours and painted surfaces: the palette sampled from the app's
 * mascot renders, and the canvas skins for the torso (chest panel, belly
 * lettering) and the forehead. robot.ts shapes the character; this file is
 * what it is painted with, kept apart so the two can be checked against the
 * renders separately — and so neither file outgrows a read.
 */

import * as THREE from 'three';
import { canvas2d, drawWord } from './robotShapes';

// ── Colour ─────────────────────────────────────────────────────────────────
// Albedo, so a shade deeper than the lit pixels in the render: the key light,
// the studio environment and ACES lift and desaturate them back to what the
// reference shows. Checked by per-part median colour against
// mascot-default.png under the page's own stage (harness/robot.html?match=1),
// on the parts both light the same way — the crown, the belly, the boots.
// The picture's key is at its upper right and the stage's at the upper
// left, so DUYO's near side is lit here where the picture shades it; no
// albedo can fix that, and none is tuned to.
export const BLUE = 0x3592d6; //       helmet, hands: the picture's sky blue
export const CHEST = 0x216aa6; //      the chest panel, which faces the key light
export const RIM = 0x48aee6; //        the frame around the visor, a light moulded lip
export const GROOVE = 0x3584b8; //     the shallow step just outside that frame
export const WHITE = 0xd8dde6; //      body, side shells, boots: soft and a little cool
export const YELLOW = 0xd8a000; //     stars, ear faces, shoulders, cuffs, bands
export const GLASS = 0x010205; //      the visor, above the eyes
export const GLASS_LOW = 0x08121e; //  … and its navy fall-off toward the chin
export const PUPIL = 0x04070d; //      the eyes' dark glass, at the top …
export const PUPIL_LOW = 0x2c3e55; //  … and its lit lower half
export const RING = 0xd79a00; //       the lit ring around each eye
export const BEZEL = 0x1a1209; //      the dark ring inside it
export const MOUTH_RIM = 0xd98a12; //  the talking mouth's gold rim, as on happy.png …
export const MOUTH_DEEP = 0x3c1606; // … its dark top, under the teeth …
export const MOUTH_LOW = 0xb8642c; //  … and its warm, lit bottom
export const LETTER_BLUE = 0x1d5f9c; // U Y O moulded across the belly
export const LETTER_GOLD = 0xb88600; // the D, a deeper gold than the bands
const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Colour a geometry's vertices from `top` at y0 down to `bottom` at y1. */
export function gradeY(geo: THREE.BufferGeometry, top: number, bottom: number, y0: number, y1: number): void {
  const pos = geo.getAttribute('position');
  const a = new THREE.Color(top);
  const b = new THREE.Color(bottom);
  const c = new THREE.Color();
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = Math.min(1, Math.max(0, (y0 - pos.getY(i)) / (y0 - y1)));
    c.copy(a).lerp(b, k * k * (3 - 2 * k)).toArray(out, i * 3);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(out, 3));
}

// ── Materials ──────────────────────────────────────────────────────────────

/** Soft moulded vinyl: a low, broad clearcoat over a satin base. */
export function satin(color: number, roughness = 0.42, clearcoat = 0.35): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0, clearcoat, clearcoatRoughness: 0.32 });
}

/** Satin lit a little from within — for what must read on black glass. */
export function glow(color: number, strength: number, roughness = 0.3): THREE.MeshPhysicalMaterial {
  const m = satin(color, roughness, 0);
  m.emissive.setHex(color);
  m.emissiveIntensity = strength;
  return m;
}

/** What every part builder shares: the dispose bin, the materials, a mesh maker. */
export interface Kit {
  keep: <T extends { dispose: () => void }>(x: T) => T;
  /** A mesh that casts and receives — self-shadowing is most of the depth. */
  part: (g: THREE.BufferGeometry, m: THREE.Material) => THREE.Mesh;
  /** A flat shape that receives nothing: the glints the renders paint on glass. */
  flat: (s: THREE.Shape, m: THREE.Material) => THREE.Mesh;
  blue: THREE.Material;
  white: THREE.Material;
  yellow: THREE.Material;
}

export function makeKit(bin: { dispose: () => void }[]): Kit {
  const keep = <T extends { dispose: () => void }>(x: T): T => (bin.push(x), x);
  const part = (g: THREE.BufferGeometry, m: THREE.Material) => {
    const o = new THREE.Mesh(g, m);
    o.castShadow = true;
    o.receiveShadow = true;
    return o;
  };
  // Gold gets almost no clearcoat and a weak base reflection: mirrored
  // studio white is what washed it to cream. And it skips tone mapping: ACES
  // desaturates a bright yellow whatever its albedo — the picture's lemon
  // gold came out cream when lit and amber when the albedo was deepened to
  // compensate (boot band dE 13 against 8 without). The stage's lighting
  // tops out near 1, so the gold still shades and never blows out.
  const yellow = satin(YELLOW, 0.42, 0.05);
  yellow.specularIntensity = 0.25;
  yellow.toneMapped = false;
  const flat = (sh: THREE.Shape, m: THREE.Material) => {
    const o = new THREE.Mesh(keep(new THREE.ShapeGeometry(sh, 10)), m);
    o.castShadow = true;
    return o;
  };
  return { keep, part, flat, blue: keep(satin(BLUE, 0.42)), white: keep(satin(WHITE, 0.44)), yellow: keep(yellow) };
}

// ── Skins ──────────────────────────────────────────────────────────────────

/**
 * Chest panel, in robot-space heights: the collar all round down to
 * `collar`, the front panel down to `bottom` across ±`half` radians, and its
 * two short white lines. mascot-default.png's panel spans nearly the whole
 * front of the chest.
 */
const PANEL = { collar: -0.3, bottom: -0.66, half: 1.2, lines: [-0.35, -0.42] } as const;
/** Belly lettering: its centre height, the radius it is painted at, letter height, stroke half-width over height. */
export const BELT = { y: -0.96, r: 0.96, h: 0.37, stroke: 0.118 } as const;

/**
 * The torso's skin: the blue chest panel with its two lines, and the belly
 * lettering, plus a blurred height map that raises both. Painted in the
 * lathe's own (u around, v along the silhouette) space; `pts` are spaced
 * evenly along the silhouette, so v is arc length and a unit is the same
 * number of pixels all the way down the front.
 */
export function torsoSkin(pts: THREE.Vector2[]): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const W = 2048;
  const H = 1024;
  const seg = pts.slice(1).map((p, i) => p.distanceTo(pts[i]));
  const len = seg.reduce((a, b) => a + b, 0);
  const rowAt = (y: number) => {
    let s = 0;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].y >= y) return (1 - (s + seg[i - 1] * ((y - pts[i - 1].y) / (pts[i].y - pts[i - 1].y))) / len) * H;
      s += seg[i - 1];
    }
    return 0;
  };
  const pxV = H / len;
  const pxU = (r: number) => W / (2 * Math.PI * r);

  const [cv, g] = canvas2d(W, H);
  const [bv, b] = canvas2d(W / 2, H / 2);
  g.fillStyle = css(WHITE);
  g.fillRect(0, 0, W, H);
  b.fillStyle = '#000';
  b.fillRect(0, 0, W / 2, H / 2);

  // Chest panel: a collar all the way round, dropping to a wide rounded
  // panel across the front. Its top is under the head.
  const half = PANEL.half * (W / (2 * Math.PI));
  const corner = { x: 0.2 * pxU(0.86), y: 0.2 * pxV };
  const panel = (c: CanvasRenderingContext2D, k: number) => {
    const rc = { x: corner.x * k, y: corner.y * k };
    c.beginPath();
    c.rect(0, 0, W * k, rowAt(PANEL.collar) * k);
    c.roundRect((W / 2 - half) * k, 0, 2 * half * k, rowAt(PANEL.bottom) * k, [0, 0, rc, rc]);
    c.fill();
  };
  g.fillStyle = css(CHEST);
  panel(g, 1);
  b.filter = 'blur(3px)';
  b.fillStyle = '#3a3a3a';
  panel(b, 0.5);

  g.strokeStyle = css(WHITE);
  g.lineCap = 'round';
  g.lineWidth = 0.03 * pxV;
  for (const y of PANEL.lines) {
    g.beginPath();
    g.moveTo(W / 2 - 0.1 * pxU(0.84), rowAt(y));
    g.lineTo(W / 2 + 0.1 * pxU(0.84), rowAt(y));
    g.stroke();
  }

  // Belly: the lettering itself is moulded (robotLettering.ts); painted
  // here is only the soft shade it casts into the plastic round its feet.
  const { y: beltY, r, h } = BELT;
  const shade = 'rgba(40,60,90,0.16)';
  g.filter = 'blur(7px)';
  g.setTransform(pxU(r), 0, 0, pxV, W / 2, rowAt(beltY));
  drawWord(g, h, [shade, shade, shade, shade], shade);
  g.filter = 'none';

  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return { map, bump: new THREE.CanvasTexture(bv) };
}

/**
 * The belly letters' plastics: the D skips tone mapping for the same reason
 * as the gold trim (makeKit), the blue is a deep satin.
 */
export function letterMaterials(kit: Kit): [THREE.Material, THREE.Material] {
  const gold = satin(LETTER_GOLD, 0.38, 0.1);
  gold.specularIntensity = 0.3;
  gold.toneMapped = false;
  return [kit.keep(gold), kit.keep(satin(LETTER_BLUE, 0.36, 0.3))];
}

/** White "DUYO" for the forehead, on a transparent ground. */
function browSkin(w: number, h: number): THREE.CanvasTexture {
  const px = 1100;
  const [cv, g] = canvas2d(Math.round(w * px), Math.round(h * px));
  g.setTransform(px, 0, 0, px, (w * px) / 2, (h * px) / 2);
  const white = css(WHITE);
  // The render's forehead letters are raised white plastic with a crisp,
  // darker moulded edge; the edge pass gives them that outline.
  drawWord(g, h * 0.78, [white, white, white, white], '#3f7aa6', 1.3, 0.1);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * The visor's paint, in the glass's own (x, y) across its w × h face. The map
 * is the glass: black down to below the eyes, falling to a deep navy along
 * the chin. The glow is what mascot-default.png's glass reflects — one broad
 * grey sheen, a window's reflection bounded by a clean curve, filling the
 * upper-right corner and fading down the right side — painted rather than
 * mirrored, because the stage's studio would mirror its own square light
 * panel across the top of the glass, which the render does not show.
 */
function visorSkin(w: number, h: number): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
  const W = 512;
  const H = Math.round((h * W) / w);

  const [mv, m] = canvas2d(W, H);
  const fall = m.createLinearGradient(0, 0, 0, H);
  fall.addColorStop(0.62, css(GLASS));
  fall.addColorStop(0.8, css(GLASS_LOW));
  fall.addColorStop(1, css(GLASS_LOW));
  m.fillStyle = fall;
  m.fillRect(0, 0, W, H);

  const [gv, g] = canvas2d(W, H);
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  // The sheen: everything right of one curve from the top edge a little past
  // the middle to the right edge low down, brightest at the top corner.
  const sheen = g.createLinearGradient(0.55 * W, 0, W, 0.85 * H);
  sheen.addColorStop(0, 'rgba(92,97,106,1)');
  sheen.addColorStop(0.55, 'rgba(118,123,132,1)');
  sheen.addColorStop(1, 'rgba(60,64,72,0)');
  g.filter = `blur(${Math.round(0.006 * W)}px)`;
  g.fillStyle = sheen;
  g.beginPath();
  g.moveTo(0.58 * W, -0.05 * H);
  g.bezierCurveTo(0.7 * W, 0.2 * H, 0.84 * W, 0.5 * H, 1.02 * W, 0.8 * H);
  g.lineTo(1.02 * W, -0.05 * H);
  g.closePath();
  g.fill();
  // The glass's own navy, deepest along the chin, and a faint lit edge
  // where the lower rim of the frame reflects in it.
  g.filter = 'none';
  const deep = g.createLinearGradient(0, 0, 0, H);
  deep.addColorStop(0.66, 'rgba(14,34,56,0)');
  deep.addColorStop(0.86, 'rgba(14,34,56,1)');
  deep.addColorStop(1, 'rgba(18,42,66,1)');
  g.fillStyle = deep;
  g.fillRect(0, 0, W, H);
  const lit = g.createLinearGradient(0, 0, W, 0);
  lit.addColorStop(0.1, 'rgba(50,120,170,0)');
  lit.addColorStop(0.35, 'rgba(50,120,170,0.5)');
  lit.addColorStop(0.65, 'rgba(50,120,170,0.5)');
  lit.addColorStop(0.9, 'rgba(50,120,170,0)');
  g.filter = `blur(${Math.round(0.006 * W)}px)`;
  g.strokeStyle = lit;
  g.lineWidth = 0.012 * H;
  g.beginPath();
  g.moveTo(0.1 * W, 0.965 * H);
  g.lineTo(0.9 * W, 0.965 * H);
  g.stroke();

  const map = new THREE.CanvasTexture(mv);
  const glow = new THREE.CanvasTexture(gv);
  map.colorSpace = THREE.SRGBColorSpace;
  glow.colorSpace = THREE.SRGBColorSpace;
  return { map, glow };
}

/**
 * The visor's glass: the painted skin above, and next to no reflectance of
 * its own — mirrored, the studio's panels read as a white box across it.
 */
export function glassMaterial(kit: Kit, w: number, h: number): THREE.MeshPhysicalMaterial {
  const skin = visorSkin(w, h);
  return kit.keep(
    new THREE.MeshPhysicalMaterial({
      map: kit.keep(skin.map),
      emissiveMap: kit.keep(skin.glow),
      emissive: 0xffffff,
      roughness: 0.3,
      specularIntensity: 0.12,
    }),
  );
}

/** The forehead's white "DUYO", as a cut-out on a w × h patch. */
export function browMaterial(kit: Kit, w: number, h: number): THREE.MeshPhysicalMaterial {
  return kit.keep(
    new THREE.MeshPhysicalMaterial({
      map: kit.keep(browSkin(w, h)),
      roughness: 0.4,
      clearcoat: 0.35,
      clearcoatRoughness: 0.32,
      // A cut-out rather than a blend, so it sorts like any opaque part and
      // casts a letter-shaped shadow; coverage smooths the cut edge.
      alphaTest: 0.5,
      alphaToCoverage: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
}
