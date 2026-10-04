/**
 * The words inside the robot page's scene: four glass cards around the
 * hologram — what the wall shows, in Uzbek — and the bubble DUYO speaks in.
 *
 * Each is a sprite (it always faces the visitor) whose picture is drawn
 * once on a canvas: a blue tile with the site's own icon (ui/icons.tsx)
 * and the words in Inter. Drawn again once Inter has loaded, so the words
 * never keep a fallback face.
 */

import * as THREE from 'three';
import type { IconName } from '../content';
import { ICONS } from '../ui/icons';
import type { V3 } from '../scene/framing';

/** Canvas px per world unit: sharp at the size the cards are seen. */
const PX = 256;
const FONT = '600 {size}px Inter, system-ui, -apple-system, Segoe UI, sans-serif';

/**
 * Where the cards sit around the hologram, by layout: one over its top on
 * DUYO's side, three down its far side — none where the beam comes in from
 * DUYO's hand, below and toward DUYO.
 */
const CARD_AT: Record<'wide' | 'tall', V3[]> = {
  wide: [[-3.0, 2.35, 0.6], [3.2, 2.15, 0.3], [3.85, 0.05, 0.5], [2.9, -2.05, 0.7]],
  tall: [[-2.3, 2.35, 0.5], [2.6, 1.75, 0.3], [3.0, -0.2, 0.5], [2.4, -2.0, 0.6]],
};
const CARD_W = 3.1;
const CARD_H = 0.84;
/** The bubble, from DUYO's head: over its helmet, where the talking shot leaves room (robot/director.ts). */
const BUBBLE_AT: V3 = [0.35, 2.4, 0.35];
/** On a phone held upright DUYO is seen smaller: the bubble grows so its words still read. */
const BUBBLE_TALL = 1.45;
const BUBBLE_W = 3.0;
const BUBBLE_H = 0.72;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Glass: deep blue, a lit rim, a soft blue glow around it. */
function glass(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.save();
  ctx.shadowColor = 'rgba(59,130,246,0.55)';
  ctx.shadowBlur = 24;
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = 'rgba(9,16,38,0.78)';
  ctx.fill();
  ctx.restore();
  roundRect(ctx, x, y, w, h, r);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(159,208,255,0.55)';
  ctx.stroke();
}

function drawCard(canvas: HTMLCanvasElement, icon: IconName, label: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  const pad = 20;
  glass(ctx, pad, pad, w - pad * 2, h - pad * 2, (h - pad * 2) / 2.6);
  // The tile, as on the page: a blue square with the icon in white.
  const tile = h - pad * 2 - 24;
  const tx = pad + 12;
  const ty = pad + 12;
  const g = ctx.createLinearGradient(tx, ty, tx + tile, ty + tile);
  g.addColorStop(0, '#3b82f6');
  g.addColorStop(1, '#1d4ed8');
  roundRect(ctx, tx, ty, tile, tile, tile * 0.3);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.translate(tx + tile * 0.2, ty + tile * 0.2);
  ctx.scale((tile * 0.6) / 24, (tile * 0.6) / 24);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(ICONS[icon]));
  ctx.restore();
  ctx.fillStyle = '#f4f7fd';
  ctx.font = FONT.replace('{size}', String(Math.round(h * 0.25)));
  ctx.textBaseline = 'middle';
  ctx.fillText(label, tx + tile + 20, h / 2 + 1, w - (tx + tile + 20) - pad - 12);
}

function drawBubble(canvas: HTMLCanvasElement, words: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  const pad = 20;
  const tail = 22;
  glass(ctx, pad, pad, w - pad * 2, h - pad * 2 - tail, 34);
  // The tail, toward DUYO: down and to the left.
  ctx.beginPath();
  ctx.moveTo(pad + 46, h - pad - tail - 2);
  ctx.lineTo(pad + 30, h - pad);
  ctx.lineTo(pad + 82, h - pad - tail - 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(9,16,38,0.9)';
  ctx.fill();
  ctx.fillStyle = '#f4f7fd';
  ctx.font = FONT.replace('{size}', String(Math.round((h - tail) * 0.26)));
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(words, w / 2, pad + (h - pad * 2 - tail) / 2 + 1, w - pad * 2 - 40);
}

function sprite(w: number, h: number, draw: (c: HTMLCanvasElement) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * PX);
  canvas.height = Math.round(h * PX);
  draw(canvas);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, opacity: 0 }));
  s.scale.set(w, h, 1);
  s.renderOrder = 20;
  return { s, canvas, map, redraw: () => (draw(canvas), (map.needsUpdate = true)) };
}

export interface LabelsInput {
  holo: THREE.Vector3;
  head: THREE.Vector3;
  layout: 'wide' | 'tall';
  /** 0..1: the four cards. */
  labels: number;
  /** 0..1: the bubble. */
  talk: number;
  t: number;
}

export interface Labels {
  readonly root: THREE.Group;
  update: (input: LabelsInput) => void;
  dispose: () => void;
}

const ease = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

export function buildLabels(cards: readonly { icon: IconName; label: string }[], says: string): Labels {
  const root = Object.assign(new THREE.Group(), { name: 'labels' });
  const made = cards.map((c) => sprite(CARD_W, CARD_H, (canvas) => drawCard(canvas, c.icon, c.label)));
  const bubble = sprite(BUBBLE_W, BUBBLE_H, (canvas) => drawBubble(canvas, says));
  root.add(...made.map((m) => m.s), bubble.s);
  let alive = true;
  void document.fonts
    ?.load(FONT.replace('{size}', '32'))
    .then(() => {
      if (!alive) return;
      made.forEach((m) => m.redraw());
      bubble.redraw();
    })
    .catch(() => {
      /* Inter did not arrive: the cards keep the system face they were drawn in. */
    });

  return {
    root,
    update({ holo, head, layout, labels, talk, t }) {
      made.forEach((m, i) => {
        // One after another, a beat apart, rising into place.
        const k = ease((labels - i * 0.12) / 0.5);
        const at = CARD_AT[layout][i];
        m.s.visible = k > 0.002;
        m.s.material.opacity = k;
        m.s.position.set(holo.x + at[0], holo.y + at[1] - (1 - k) * 0.25 + Math.sin(t * 0.8 + i * 1.7) * 0.05, holo.z + at[2]);
      });
      const b = ease(talk * 1.4 - 0.2);
      const grow = layout === 'tall' ? BUBBLE_TALL : 1;
      bubble.s.visible = b > 0.002;
      bubble.s.material.opacity = b;
      bubble.s.scale.set(BUBBLE_W * grow, BUBBLE_H * grow, 1);
      bubble.s.position.set(
        head.x + BUBBLE_AT[0] * grow,
        head.y + BUBBLE_AT[1] + (grow - 1) * 0.35 + Math.sin(t * 1.3) * 0.03,
        head.z + BUBBLE_AT[2],
      );
    },
    dispose() {
      alive = false;
      [...made, bubble].forEach((m) => {
        m.map.dispose();
        m.s.material.dispose();
      });
      root.removeFromParent();
    },
  };
}
