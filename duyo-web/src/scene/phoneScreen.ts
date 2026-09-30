/**
 * The phone's display: the real DUYO app.
 *
 * The owner's complaint was that the phone showed "completely different
 * things" from the app. Nothing here draws app UI: every screen is a capture
 * of the current app (duyo-mobile on Expo web against a local mock, under
 * Android's insets, with Android's emoji; what each shows is written up in
 * assets/app-screens/manifest.json), and this module composites them, adding
 * only what Android draws over an app: the status bar and the gesture handle.
 *
 * Layout on the SCREEN_PX canvas, a 360 × 770 dp Android phone at 2×:
 *   y 0..48      the status bar, 24 dp, showing the time the capture was taken
 *   y 48..1540   the capture, 720 × 1492, blitted 1:1 on whole pixels; its
 *                last 32 px are the gesture area, where the handle goes
 *
 * Between two states of a screen only what the app itself changes moves, and
 * it moves the way the app moves it (phoneScreenScripts.ts, per screen):
 *   - a list scrolls: both states ride one scroll position, so what they
 *     share holds still and only what is new slides in
 *   - a field is typed into: its text appears glyph by glyph
 *   - the chalkboard is written: the finished board is covered with slate and
 *     uncovered line by line, left to right behind a chalk tip, at the pace
 *     components/chalkboard.tsx writes it
 *   - content the app swaps outright is cut, never cross-faded
 *   - a navigation fades, as the app's stack does (animation: 'fade'), and so
 *     does the change from one section's screen to the next
 * Every position and distance comes from the capture run (captures.ts is
 * generated with the images), so a recapture cannot leave these stale.
 *
 * Cost: draw() runs every frame. The visible state is quantised — which gap
 * or which step of which change, and how far through a fade between screens
 * — and only a change repaints and asks for an upload, so a phone that is
 * only being looked at uploads nothing.
 */

import * as THREE from 'three';
import { PALETTE } from './contract';
import type { PhoneScreen, ScreenId, ScreenState } from './contract';
import { NAV_BAR_PX, SHOTS, STATUS_BAR_PX } from '../assets/app-screens/captures';
import type { ShotName } from '../assets/app-screens/captures';
import { createLoader } from './phoneScreenLoader';
import { H, SCRIPTS, W, blit, clamp01, lerp, makeCanvas } from './phoneScreenScripts';
import type { Ctx, Get, Win } from './phoneScreenScripts';

const BAR = STATUS_BAR_PX;
/** Inside a change, one repaint per this much of the screen's progress. */
const STEP_P = 1 / 800;
/** A fade between sections, in steps: finer than a display shows. */
const MIX_STEPS = 24;
/** Keys for "this screen is not on display" — any number no quantise() returns. */
const HIDDEN = Number.MIN_SAFE_INTEGER;
/** Android's gesture handle, 108 × 4 dp. */
const HANDLE_W = 216;
const HANDLE_H = 8;
/** The status bar's face: Roboto on an Android visitor's phone; Inter, which the page loads, elsewhere. */
const BAR_FONT = "500 24px Roboto, Inter, 'Segoe UI', sans-serif";

const isLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 > 0.5;
};

const ORDER = Object.keys(SCRIPTS) as ScreenId[];
const SCREEN_OF = new Map<ShotName, ScreenId>(ORDER.flatMap((id) => SCRIPTS[id].shots.map((n): [ShotName, ScreenId] => [n, id])));

/**
 * Where p falls: a gap between spans (key < 0, painted at the gap's start)
 * or a step inside one (painted at that step). Written into `out` — draw()
 * runs every frame and allocates nothing when nothing changed.
 */
function quantise(spans: readonly Win[], p: number, out: { key: number; q: number }): void {
  let gapStart = 0;
  for (let i = 0; i < spans.length; i++) {
    const [a, b] = spans[i];
    if (p < a) {
      out.key = -(i + 1);
      out.q = gapStart;
      return;
    }
    if (p <= b) {
      const n = Math.max(1, Math.ceil((b - a) / STEP_P));
      const j = b > a ? Math.round(((p - a) / (b - a)) * n) : 0;
      out.key = i * 100_000 + j;
      out.q = a + ((b - a) * j) / n;
      return;
    }
    gapStart = b;
  }
  out.key = -(spans.length + 1);
  out.q = gapStart;
}

// ─────────────────────────────────────────────────────────────────────────
// Android's own chrome
// ─────────────────────────────────────────────────────────────────────────

/**
 * Android's status bar as a Pixel draws it: the clock on the left; the Wi-Fi
 * fan, a full signal wedge and an upright battery on the right. Both ends are
 * inset past the display's rounded corners (≈92 px of radius at this scale),
 * and the middle is left clear for the punch-hole camera.
 */
function statusIcons(ink: string, clock: string): HTMLCanvasElement {
  const c = makeCanvas(W, BAR);
  const cy = BAR / 2;
  c.fillStyle = ink;
  c.font = BAR_FONT;
  c.textBaseline = 'middle';
  c.fillText(clock, 62, cy + 1);

  // Wi-Fi, a quarter-circle fan on its point; then a full signal wedge.
  c.beginPath();
  c.moveTo(584, cy + 11);
  c.arc(584, cy + 11, 22, -0.75 * Math.PI, -0.25 * Math.PI);
  c.moveTo(610, cy + 11);
  c.lineTo(632, cy + 11);
  c.lineTo(632, cy - 11);
  c.fill();
  // Battery at 80%: the empty part in the same ink, faint, as Android does it.
  c.globalAlpha = 0.32;
  c.beginPath();
  c.roundRect(644, cy - 10, 13, 22, 3);
  c.rect(648, cy - 12.5, 5, 3);
  c.fill();
  c.globalAlpha = 1;
  c.beginPath();
  c.roundRect(644, cy - 10 + 22 * 0.2, 13, 22 * 0.8, [0, 0, 3, 3]);
  c.fill();
  return c.canvas;
}

export function createPhoneScreen(): PhoneScreen {
  const ctx = makeCanvas(W, H, false);
  const canvas = ctx.canvas;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const icons = new Map<string, HTMLCanvasElement>();
  let scratch: Ctx | null = null; // the incoming screen of a fade, made on first use
  let disposed = false;

  // What is on display, as last painted: `m` is the fade in steps; ka / kb
  // the quantised keys of `from` and `to` (HIDDEN where not shown), qa / qb
  // the progress each was painted at.
  const last = { from: ORDER[0], to: ORDER[0], m: 0, ka: HIDDEN, kb: HIDDEN, qa: 0, qb: 0 };
  const out = { key: 0, q: 0 };
  const shown = (id: ScreenId) => (last.m < MIX_STEPS && last.from === id) || (last.m > 0 && last.to === id);

  const srcs = {} as Record<ShotName, string>;
  for (const n of Object.keys(SHOTS) as ShotName[]) srcs[n] = SHOTS[n].src;
  // A capture that arrives, or is let go, while its screen shows: repaint now.
  const loader = createLoader(srcs, (name) => {
    const id = SCREEN_OF.get(name);
    if (!disposed && id && shown(id)) repaint();
  });
  const get: Get = (n) => loader.get(n);

  /** Decode what is on display first, then the sections either side; let the rest go. */
  const focus = (from: ScreenId, to: ScreenId) => {
    const i = ORDER.indexOf(from);
    const j = ORDER.indexOf(to);
    const ids = [from, to, ORDER[Math.max(i, j) + 1], ORDER[Math.min(i, j) - 1]];
    const names = ids.flatMap((id) => (id ? SCRIPTS[id].shots : []));
    loader.want([...new Set(names)]);
  };

  /** A screen at q; until its captures decode, the nearest decoded one of it, or its ground. */
  const paintScreen = (c: Ctx, id: ScreenId, q: number) => {
    const script = SCRIPTS[id];
    if (script.paint(c, get, q)) return;
    const list = script.shots;
    const at = list.indexOf(script.primary(q));
    for (let d = 0; d < list.length; d++) {
      for (const i of [at - d, at + d]) {
        const s = i >= 0 && i < list.length ? get(list[i]) : null;
        if (s) return blit(c, s);
      }
    }
    c.fillStyle = SHOTS[script.primary(q)].top;
    c.fillRect(0, 0, W, H);
  };

  /** What Android draws over the app: the status bar's icons and the gesture handle. */
  const chrome = (name: ShotName) => {
    const { top, bottom, clock } = SHOTS[name];
    const ink = isLight(top) ? PALETTE.navy : PALETTE.white;
    const key = `${ink} ${clock}`;
    let cv = icons.get(key);
    if (!cv) icons.set(key, (cv = statusIcons(ink, clock)));
    ctx.drawImage(cv, 0, 0);
    const light = isLight(bottom);
    ctx.fillStyle = light ? PALETTE.navy : PALETTE.white;
    ctx.globalAlpha = light ? 0.55 : 0.7;
    ctx.beginPath();
    ctx.roundRect((W - HANDLE_W) / 2, H - (NAV_BAR_PX + HANDLE_H) / 2, HANDLE_W, HANDLE_H, HANDLE_H / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  function repaint() {
    const { from, to, m, qa, qb } = last;
    if (m < MIX_STEPS) paintScreen(ctx, from, qa);
    if (m > 0 && m < MIX_STEPS) {
      scratch ??= makeCanvas(W, H, false);
      paintScreen(scratch, to, qb);
      ctx.globalAlpha = m / MIX_STEPS;
      ctx.drawImage(scratch.canvas, 0, 0);
      ctx.globalAlpha = 1;
    } else if (m === MIX_STEPS) {
      paintScreen(ctx, to, qb);
    }
    // System UI is not part of either app screen: it switches once, halfway.
    chrome(2 * m < MIX_STEPS ? SCRIPTS[from].primary(qa) : SCRIPTS[to].primary(qb));
    texture.needsUpdate = true; // the only upload request: after a real repaint
  }

  // Paint the first screen's ground now: the runtime may upload this canvas
  // before its first draw(), and an untouched opaque canvas is black.
  focus(last.from, last.to);
  repaint();
  // The clock is drawn in a web font; once it is in, draw it again.
  void document.fonts?.ready
    .then(() => document.fonts.load(BAR_FONT))
    .then(() => {
      if (disposed) return;
      icons.clear();
      repaint();
    }, () => undefined);

  return {
    canvas,
    texture,
    // `t` is not read: a capture has no idle life to run, and a clock-driven
    // repaint would upload the texture on every frame.
    draw(s: ScreenState) {
      if (disposed) return;
      const same = s.from === s.to; // one screen on both sides of a gap: just scrub it
      const mix = clamp01(s.mix);
      const m = same ? 0 : Math.round(mix * MIX_STEPS);
      const from = m < MIX_STEPS ? s.from : s.to;
      const to = m > 0 ? s.to : from;
      let ka = HIDDEN;
      let kb = HIDDEN;
      let qa = 0;
      let qb = 0;
      if (m < MIX_STEPS) {
        quantise(SCRIPTS[from].spans, same ? lerp(s.pFrom, s.pTo, mix) : s.pFrom, out);
        ka = out.key;
        qa = out.q;
      }
      if (m > 0) {
        quantise(SCRIPTS[to].spans, s.pTo, out);
        kb = out.key;
        qb = out.q;
      }
      if (m === last.m && ka === last.ka && kb === last.kb && from === last.from && to === last.to) return;
      const moved = from !== last.from || to !== last.to;
      Object.assign(last, { from, to, m, ka, kb, qa, qb }); // only on a change
      if (moved) focus(from, to);
      repaint();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      loader.dispose();
      texture.dispose();
      // iOS counts canvas backing stores against a hard cap: hand them back now.
      for (const cv of [canvas, scratch?.canvas, ...icons.values()]) if (cv) cv.width = cv.height = 0;
      icons.clear();
      scratch = null;
    },
  };
}
