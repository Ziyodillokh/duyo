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
// reference shows. Checked by pixel statistics against mascot-default.png.
// Gold especially: ACES pulls a bright yellow toward cream, so the albedo is
// a deep amber and the lit result lands on the renders' saturated gold.
export const BLUE = 0x4085b5; //       helmet, mittens
export const CHEST = 0x3779a4; //      the chest panel, which faces the key light
export const RIM = 0x1f8fd6; //        the frame around the visor
export const GROOVE = 0x2f6c94; //     the recess just outside that frame
export const WHITE = 0xf4f6fa; //      body, side shells, boots
export const YELLOW = 0xd99200; //     stars, ear faces, shoulders, cuffs, bands
export const GLASS = 0x010205; //      the visor, above the eyes
export const GLASS_LOW = 0x16385a; //  … and its navy fall-off toward the chin
export const PUPIL = 0x04070d; //      the eyes' dark glass, at the top …
export const PUPIL_LOW = 0x2c3e55; //  … and its lit lower half
export const RING = 0xd79a00; //       the lit ring around each eye
export const BEZEL = 0x1a1209; //      the dark ring inside it
export const SMILE = 0x1d95e2; //      the mouth, as on mascot-head.png …
export const SMILE_EDGE = 0x08345e; // … with its darker outline
const INK_BLUE = '#1a67a3'; //   U Y O across the belly
const INK_YELLOW = '#d08c00'; // the D
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
  /** A flat shape that casts nothing: the glints the renders paint on glass. */
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
  // Gold gets almost no clearcoat and a weaker base reflection: mirrored
  // studio white is exactly what washed it to cream.
  const yellow = satin(YELLOW, 0.42, 0.05);
  yellow.specularIntensity = 0.55;
  const flat = (sh: THREE.Shape, m: THREE.Material) => new THREE.Mesh(keep(new THREE.ShapeGeometry(sh, 10)), m);
  return { keep, part, flat, blue: keep(satin(BLUE, 0.42)), white: keep(satin(WHITE, 0.44)), yellow: keep(yellow) };
}

// ── Skins ──────────────────────────────────────────────────────────────────

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

  // Chest panel: a collar all the way round, dropping to a rounded panel on
  // the front. Its top is under the head.
  const half = 1.02 * (W / (2 * Math.PI));
  const corner = { x: 0.17 * pxU(0.8), y: 0.17 * pxV };
  const panel = (c: CanvasRenderingContext2D, k: number) => {
    const rc = { x: corner.x * k, y: corner.y * k };
    c.beginPath();
    c.rect(0, 0, W * k, rowAt(-0.24) * k);
    c.roundRect((W / 2 - half) * k, 0, 2 * half * k, rowAt(-0.47) * k, [0, 0, rc, rc]);
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
  for (const y of [-0.285, -0.355]) {
    g.beginPath();
    g.moveTo(W / 2 - 0.1 * pxU(0.78), rowAt(y));
    g.lineTo(W / 2 + 0.1 * pxU(0.78), rowAt(y));
    g.stroke();
  }

  // Belly: D in gold, UYO in blue, as on every render.
  const beltY = -0.97;
  const r = 0.93;
  g.setTransform(pxU(r), 0, 0, pxV, W / 2, rowAt(beltY));
  drawWord(g, 0.37, [INK_YELLOW, INK_BLUE, INK_BLUE, INK_BLUE], 'rgba(10,40,70,0.28)');
  b.filter = 'blur(2px)';
  b.setTransform(pxU(r) / 2, 0, 0, pxV / 2, W / 4, rowAt(beltY) / 2);
  drawWord(b, 0.37, ['#fff', '#fff', '#fff', '#fff'], '#777');

  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return { map, bump: new THREE.CanvasTexture(bv) };
}

/** White "DUYO" for the forehead, on a transparent ground. */
function browSkin(w: number, h: number): THREE.CanvasTexture {
  const px = 1100;
  const [cv, g] = canvas2d(Math.round(w * px), Math.round(h * px));
  g.setTransform(px, 0, 0, px, (w * px) / 2, (h * px) / 2);
  const white = css(WHITE);
  drawWord(g, h * 0.8, [white, white, white, white], '#b9c9d6');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * The visor's paint, in the glass's own (x, y) across its w × h face. The map
 * is the glass: black above the eyes, falling to navy toward the chin. The
 * glow is what the renders' glass reflects — a soft grey sheen around the
 * upper-right corner and a lit line along the lower edge — painted rather
 * than mirrored, because the stage's studio would mirror its own square
 * light panel across the top of the glass, which no render shows.
 */
function visorSkin(w: number, h: number, r: number): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
  const W = 512;
  const px = W / w;
  const H = Math.round(h * px);
  const R = r * px;

  const [mv, m] = canvas2d(W, H);
  const fall = m.createLinearGradient(0, 0, 0, H);
  fall.addColorStop(0.5, css(GLASS));
  fall.addColorStop(0.86, css(GLASS_LOW));
  fall.addColorStop(1, css(GLASS_LOW));
  m.fillStyle = fall;
  m.fillRect(0, 0, W, H);

  const [gv, g] = canvas2d(W, H);
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  // The sheen: the outline itself, stroked wide and faded out from the
  // corner, so it bends round the corner exactly as the glass does.
  const inset = 0.05 * W;
  const sheen = g.createRadialGradient(W - R, R, 0, W - R, R, 0.6 * W);
  sheen.addColorStop(0, 'rgba(170,176,188,1)');
  sheen.addColorStop(0.5, 'rgba(150,156,168,0.7)');
  sheen.addColorStop(1, 'rgba(150,156,168,0)');
  g.filter = `blur(${Math.round(0.014 * W)}px)`;
  g.strokeStyle = sheen;
  g.lineWidth = 0.075 * W;
  g.beginPath();
  g.roundRect(inset, inset, W - 2 * inset, H - 2 * inset, R - inset);
  g.stroke();
  // The lower third holds a little navy of its own, as the renders' glass does.
  const deep = g.createLinearGradient(0, 0, 0, H);
  deep.addColorStop(0.55, 'rgba(30,78,124,0)');
  deep.addColorStop(1, 'rgba(30,78,124,1)');
  g.fillStyle = deep;
  g.fillRect(0, 0, W, H);
  // The lower edge catches the frame's blue.
  const lit = g.createLinearGradient(0, 0, W, 0);
  lit.addColorStop(0.08, 'rgba(40,150,215,0)');
  lit.addColorStop(0.3, 'rgba(40,150,215,0.85)');
  lit.addColorStop(0.7, 'rgba(40,150,215,0.85)');
  lit.addColorStop(0.92, 'rgba(40,150,215,0)');
  g.filter = `blur(${Math.round(0.004 * W)}px)`;
  g.strokeStyle = lit;
  g.lineWidth = 0.012 * H;
  g.beginPath();
  g.moveTo(R * 0.6, H - 0.03 * H);
  g.lineTo(W - R * 0.6, H - 0.03 * H);
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
export function glassMaterial(kit: Kit, w: number, h: number, r: number): THREE.MeshPhysicalMaterial {
  const skin = visorSkin(w, h, r);
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
