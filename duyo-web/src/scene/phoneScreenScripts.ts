/**
 * The phone screen's five scripts: how each section's app screen moves from
 * one captured state to the next, and the few drawing primitives they share.
 * phoneScreen.ts drives them; what each state shows is in
 * assets/app-screens/manifest.json, and every position and distance used here
 * is measured by the capture run into assets/app-screens/captures.ts.
 *
 * All drawing is in capture px: a capture is 720 wide like the canvas, and
 * its y is STATUS_BAR_PX lower on the canvas, under the status bar.
 */

import { SCREEN_PX } from './contract';
import type { ScreenId } from './contract';
import { GEOMETRY, STATUS_BAR_PX } from '../assets/app-screens/captures';
import type { ShotName } from '../assets/app-screens/captures';
import type { Shot } from './phoneScreenLoader';

type Box = readonly [x: number, y: number, w: number, h: number];
export type Win = readonly [from: number, to: number];
export type Get = (name: ShotName) => Shot | null;
export type Ctx = CanvasRenderingContext2D;

export const W = SCREEN_PX.width;
export const H = SCREEN_PX.height;
const BAR = STATUS_BAR_PX;
const SHOT_H = H - BAR;
/** The status bar's ground is the capture's top BAR_ROWS rows, averaged in BAR_BANDS columns. */
const BAR_ROWS = 2;
const BAR_BANDS = 8;

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => clamp01(x) ** 2 * (3 - 2 * clamp01(x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** How far p is through a window: 0 before, 1 after; a zero-width window is a cut. */
const within = (p: number, [a, b]: Win) => (b > a ? clamp01((p - a) / (b - a)) : p >= a ? 1 : 0);

export function makeCanvas(w: number, h: number, alpha = true): Ctx {
  const cv = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const c = cv.getContext('2d', { alpha });
  if (!c) throw new Error('phoneScreen: 2D canvas unavailable');
  return c;
}

// ─────────────────────────────────────────────────────────────────────────
// Drawing a capture, in capture px (a capture's y is BAR lower on the canvas)
// ─────────────────────────────────────────────────────────────────────────

/**
 * The status bar's ground for one capture. The app is edge-to-edge, so its
 * own ground runs on under the bar: the capture's top rows averaged in bands.
 * Averaged, not stretched: a stretched row turns every star on the map into a
 * vertical streak.
 */
const grounds = new WeakMap<Shot, string[]>();
function groundOf(img: Shot): string[] {
  let stops = grounds.get(img);
  if (stops) return stops;
  const c = makeCanvas(W, BAR_ROWS);
  c.drawImage(img, 0, 0, W, BAR_ROWS, 0, 0, W, BAR_ROWS);
  const px = c.getImageData(0, 0, W, BAR_ROWS).data;
  c.canvas.width = c.canvas.height = 0;
  const band = W / BAR_BANDS;
  stops = [];
  for (let b = 0; b < BAR_BANDS; b++) {
    const sum = [0, 0, 0];
    for (let y = 0; y < BAR_ROWS; y++) {
      for (let x = b * band; x < (b + 1) * band; x++) for (let k = 0; k < 3; k++) sum[k] += px[(y * W + x) * 4 + k];
    }
    stops.push(`rgb(${sum.map((v) => Math.round(v / (band * BAR_ROWS))).join(',')})`);
  }
  grounds.set(img, stops);
  return stops;
}

/** A whole capture, with the status bar's ground under it. */
export function blit(c: Ctx, img: Shot, alpha = 1): void {
  const g = c.createLinearGradient(0, 0, W, 0);
  groundOf(img).forEach((s, b) => g.addColorStop((b + 0.5) / BAR_BANDS, s));
  c.globalAlpha = alpha;
  c.fillStyle = g;
  c.fillRect(0, 0, W, BAR);
  c.drawImage(img, 0, BAR, W, SHOT_H);
  c.globalAlpha = 1;
}

/** Rows [from, to) of a capture, drawn dy lower than they were taken. */
function rows(c: Ctx, img: Shot, from: number, to: number, dy: number): void {
  if (to > from) c.drawImage(img, 0, from, W, to - from, 0, BAR + from + dy, W, to - from);
}

/** One box of a capture, in place. */
function region(c: Ctx, img: Shot, [x, y, w, h]: Box): void {
  if (w > 0 && h > 0) c.drawImage(img, x, y, w, h, x, BAR + y, w, h);
}

/**
 * Cover a box, within rows [top, bottom), with one column of what is already
 * painted beside it, stretched: the ground exactly as it is at each height —
 * a shadow falling across it included — where a flat fill would show as a
 * patch.
 */
function smear(c: Ctx, col: number, [x, y, w, h]: Box, [top, bottom]: readonly [number, number], alpha = 1): void {
  const y0 = Math.max(y, top);
  const y1 = Math.min(y + h, bottom);
  if (w <= 0 || y1 <= y0 || alpha <= 0) return;
  c.globalAlpha = alpha;
  c.drawImage(c.canvas, col, BAR + y0, 1, y1 - y0, x, BAR + y0, w, y1 - y0);
  c.globalAlpha = 1;
}

function clipRows(c: Ctx, [top, bottom]: readonly [number, number]): void {
  c.save();
  c.beginPath();
  c.rect(0, BAR + top, W, bottom - top);
  c.clip();
}

/**
 * A message list scrolling as a new message lands, k of the way: both states
 * ride one scroll position — the old one lifted by k·by, the new one still
 * k·by short of home — so what they share lines up and holds still, the new
 * message slides up from under the list's bottom edge, and only what really
 * differs (typing dots becoming a reply) changes in place. At k = 1 the band
 * is exactly the new capture, so the change hands over without a jump.
 */
function scrollList(c: Ctx, old: Shot, next: Shot, k: number, band: readonly [number, number], by: number): void {
  const [top, bottom] = band;
  const lift = Math.round(k * by);
  clipRows(c, band);
  rows(c, old, top + lift, bottom, -lift);
  c.globalAlpha = k;
  rows(c, next, top, bottom - by, by - lift);
  c.globalAlpha = 1;
  rows(c, next, bottom - by, bottom - by + lift, by - lift);
  c.restore();
}

/**
 * One finished list at any scroll position between two captures of it: each
 * capture's band drawn shifted to where its rows belong, the one taken
 * nearest this position last, so the ends are exactly the captures.
 */
function listAt(c: Ctx, band: readonly [number, number], at: number, a: [Shot, number], b: [Shot, number]): void {
  const [near, far] = Math.abs(at - a[1]) <= Math.abs(at - b[1]) ? [a, b] : [b, a];
  clipRows(c, band);
  rows(c, far[0], band[0], band[1], at - far[1]);
  rows(c, near[0], band[0], band[1], at - near[1]);
  c.restore();
}

interface Field {
  readonly box: Box;
  /** The first blank column after each glyph. */
  readonly stops: readonly number[];
  /** A column of empty field, stretched over what is not typed yet. */
  readonly blank: number;
}

/** A field typed into, f of the way: the capture's text up to a glyph, empty field after it. */
function typed(c: Ctx, img: Shot, { box: [x, y, w, h], stops, blank }: Field, f: number): void {
  const n = Math.ceil(f * stops.length);
  const end = n > 0 ? stops[n - 1] : x;
  if (end < x + w) c.drawImage(img, blank, y, 1, h, end, BAR + y, x + w - end, h);
}

// ─────────────────────────────────────────────────────────────────────────
// The screens
// ─────────────────────────────────────────────────────────────────────────

export interface Script {
  /** Its captures, most urgent to load first. */
  readonly shots: readonly ShotName[];
  /** Where in the screen's progress the picture moves; between, it holds still. */
  readonly spans: readonly Win[];
  /** The capture the picture is mostly made of at p: the status bar's, and a stand-in's reference. */
  primary(p: number): ShotName;
  /** Paint at p; false, having drawn nothing, when a capture it needs is not decoded. */
  paint(c: Ctx, get: Get, p: number): boolean;
}

/** Overlapping and touching windows as one: the spans quantise() walks. */
function spansOf(wins: readonly Win[]): Win[] {
  const sorted = [...wins].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const lastSpan = out[out.length - 1];
    if (lastSpan && a <= lastSpan[1]) lastSpan[1] = Math.max(lastSpan[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** A capture on its own; false if it has not decoded. */
function one(c: Ctx, img: Shot | null): boolean {
  if (!img) return false;
  blit(c, img);
  return true;
}

/**
 * Section 0, the AI chat. The hero's intro plays p from 0 to 0.62 on load,
 * decelerating (runtime.ts); scroll carries the rest. So: the empty chat, the
 * question sent with DUYO's typing dots, the reply landing with the board,
 * and the problem and first step written as the page opens — the hero rests
 * there, question in view, between two lines. Scrolling writes the rest,
 * then scrolls the list down to the answer and writes that, underlined.
 */
function chatScript(): Script {
  const { band, anchor, blank, chalk, lines, answerBox } = GEOMETRY.chat;
  const [L2, L3, L4] = [anchor['chat-2'], anchor['chat-3'], anchor['chat-4']];
  const SENT: Win = [0.44, 0.44];
  const REPLY: Win = [0.525, 0.56];
  /** The board's first lines, written in the intro's last half second… */
  const BOARD_INTRO: Win = [0.562, 0.611];
  const INTRO_MARKS = 3;
  /** …and the rest as the page scrolls. */
  const BOARD_SCROLL: Win = [0.64, 0.97];

  // components/chalkboard.tsx's pace, in ms: per-character writing, a gap
  // between lines, each note fading in after its line, the answer's box
  // fading in and its line written just after.
  const MS_PER_CHAR = 42;
  const MIN_WRITE_MS = 380;
  const LINE_GAP_MS = 260;
  const START_DELAY_MS = 420;
  const NOTE_FADE_MS = 300;
  const ANSWER_FADE_MS = 360;
  const ANSWER_LAG_MS = 120;
  /** Before the answer the child scrolls it into view — not the app's pace, so given a line's. */
  const SCROLL_MS = 600;

  type Kind = 'line' | 'note' | 'answer' | 'box';
  const plan: { kind: Kind; box: Box; size: number; ms: Win }[] = [];
  let scrollMs: Win = [0, 0];
  let cursor = START_DELAY_MS;
  let lineEnd = cursor;
  for (const { kind, box, size, chars } of lines) {
    const write = Math.max(MIN_WRITE_MS, chars * MS_PER_CHAR);
    if (kind === 'note') {
      plan.push({ kind, box, size, ms: [lineEnd, lineEnd + NOTE_FADE_MS] });
    } else if (kind === 'answer') {
      scrollMs = [cursor, cursor + SCROLL_MS];
      cursor += SCROLL_MS;
      plan.push({ kind: 'box', box: answerBox, size, ms: [cursor, cursor + ANSWER_FADE_MS] });
      plan.push({ kind, box, size, ms: [cursor + ANSWER_LAG_MS, cursor + ANSWER_LAG_MS + write] });
    } else {
      plan.push({ kind, box, size, ms: [cursor, cursor + write] });
      lineEnd = cursor + write;
      cursor = lineEnd + LINE_GAP_MS;
    }
  }
  // Each part of the board keeps the app's proportions inside its window of p.
  const intro = plan.slice(0, INTRO_MARKS);
  const rest = plan.slice(INTRO_MARKS);
  const mapper = (part: typeof plan, [p0, p1]: Win) => {
    const m0 = part[0].ms[0];
    const m1 = Math.max(...part.map((m) => m.ms[1]));
    return ([a, b]: Win): Win => [lerp(p0, p1, (a - m0) / (m1 - m0)), lerp(p0, p1, (b - m0) / (m1 - m0))];
  };
  const toIntro = mapper(intro, BOARD_INTRO);
  const toRest = mapper(rest, BOARD_SCROLL);
  const marks = [...intro.map((m) => ({ ...m, win: toIntro(m.ms) })), ...rest.map((m) => ({ ...m, win: toRest(m.ms) }))];
  const SCROLL = toRest(scrollMs);

  /** The board as written by p, over the list drawn with its anchor at L: bare slate where it is not. */
  const board = (c: Ctx, p: number, L: number) => {
    clipRows(c, band);
    for (const { kind, box: [x, y0, w, h], size, win } of marks) {
      const f = within(p, win);
      if (f >= 1) continue;
      const y = y0 + L - L4; // the geometry was measured on chat-4
      if (kind === 'note' || kind === 'box') {
        smear(c, blank, [x, y, w, h], band, 1 - f);
        continue;
      }
      const shown = Math.round(f * w);
      smear(c, blank, [x + shown, y, w - shown, h], band);
      if (f > 0) {
        // ChalkTip: 3 dp wide, 3 dp right of the write head, 0.9 of the line's size tall.
        const th = Math.round(size * 0.9 * 2);
        c.fillStyle = chalk;
        c.globalAlpha = 0.9;
        c.beginPath();
        c.roundRect(x + shown + 6, BAR + y + (h - th) / 2, 6, th, 4);
        c.fill();
        c.globalAlpha = 1;
      }
    }
    c.restore();
  };

  return {
    shots: ['chat-1', 'chat-3', 'chat-2', 'chat-4'],
    spans: spansOf([SENT, REPLY, SCROLL, ...marks.map((m) => m.win)]),
    primary: (p) => (p < SENT[0] ? 'chat-1' : p < REPLY[1] ? 'chat-2' : within(p, SCROLL) >= 1 ? 'chat-4' : 'chat-3'),
    paint(c, get, p) {
      if (p < SENT[0]) return one(c, get('chat-1'));
      if (p < REPLY[0]) return one(c, get('chat-2'));
      const [s2, s3, s4] = [get('chat-2'), get('chat-3'), get('chat-4')];
      if (p < REPLY[1]) {
        if (!s2 || !s3) return false;
        const k = within(p, REPLY);
        blit(c, k < 0.5 ? s2 : s3); // header and composer: the grey send button turns back into the mic
        scrollList(c, s2, s3, k, band, L2 - L3);
        board(c, p, L2 - Math.round(k * (L2 - L3)));
        return true;
      }
      const L = Math.round(lerp(L3, L4, smooth(within(p, SCROLL))));
      if (L === L3 || L === L4) {
        if (!one(c, L === L3 ? s3 : s4)) return false;
      } else {
        if (!s3 || !s4) return false;
        blit(c, s4);
        listAt(c, band, L, [s3, L3], [s4, L4]);
      }
      board(c, p, L);
      return true;
    },
  };
}

/**
 * Section 1, the goal room. The child types a phone number into the
 * composer; the send button replaces the mic at the first character. Sent,
 * the server's refusal opens above the composer and lifts the room with it,
 * and the draft stays where it was — nothing reached the room.
 */
function safetyScript(): Script {
  const { band, anchor, draft } = GEOMETRY.safety;
  const TYPE: Win = [0.34, 0.5];
  const SEND: Win = [0.54, 0.6];
  return {
    shots: ['safety-1', 'safety-2'],
    spans: [TYPE, SEND],
    primary: (p) => (p < SEND[1] ? 'safety-1' : 'safety-2'),
    paint(c, get, p) {
      const [s1, s2] = [get('safety-1'), get('safety-2')];
      if (p < TYPE[0]) return one(c, s1);
      if (p >= SEND[1]) return one(c, s2);
      if (!s1 || !s2) return false;
      if (p < SEND[0]) {
        blit(c, s1);
        rows(c, s2, band[1], SHOT_H, 0); // the composer, typing: placeholder gone, send button up
        typed(c, s2, draft, within(p, TYPE));
        return true;
      }
      blit(c, s2);
      scrollList(c, s1, s2, within(p, SEND), band, anchor['safety-1'] - anchor['safety-2']);
      return true;
    },
  };
}

/** Section 2, the brain map: five notes, then sixteen — the app draws a new layout, so it is a cut. */
function mapScript(): Script {
  const GROWN: Win = [0.45, 0.45];
  return {
    shots: ['map-1', 'map-2'],
    spans: [GROWN],
    primary: (p) => (p < GROWN[0] ? 'map-1' : 'map-2'),
    paint: (c, get, p) => one(c, get(p < GROWN[0] ? 'map-1' : 'map-2')),
  };
}

/**
 * Section 3, goals. The steps DUYO split the goal into, as the notes it wrote
 * in the map; then Maqsadlarim (a navigation: the app fades), where the child
 * types the chapter they reached and saves it — the count and percentage
 * change at once, as the app re-renders them, and the bar grows to its new
 * length.
 */
function goalsScript(): Script {
  const { entry, save, track, fill: fills } = GEOMETRY.goals;
  // The phone only faces the visitor from p ≈ 0.3 (the director turns it in
  // until then), so every state falls after that.
  const NAV: Win = [0.46, 0.52];
  const TYPE: Win = [0.6, 0.68];
  const SAVE: Win = [0.74, 0.82];
  return {
    shots: ['goals-1', 'goals-2', 'goals-3', 'goals-4'],
    spans: [NAV, TYPE, SAVE],
    primary: (p) => (p < NAV[1] ? 'goals-1' : p < TYPE[1] ? 'goals-2' : p < SAVE[0] ? 'goals-3' : 'goals-4'),
    paint(c, get, p) {
      if (p < NAV[0]) return one(c, get('goals-1'));
      if (p < NAV[1]) {
        const [g1, g2] = [get('goals-1'), get('goals-2')];
        if (!g1 || !g2) return false;
        blit(c, g1);
        blit(c, g2, smooth(within(p, NAV)));
        return true;
      }
      if (p < TYPE[0]) return one(c, get('goals-2'));
      if (p < SAVE[0]) {
        const [g2, g3] = [get('goals-2'), get('goals-3')];
        if (!g2 || !g3) return false;
        blit(c, g2);
        region(c, g3, save); // lit at the first digit
        region(c, g3, entry.box);
        typed(c, g3, entry, within(p, TYPE));
        return true;
      }
      if (p < SAVE[1]) {
        const [g3, g4] = [get('goals-3'), get('goals-4')];
        if (!g3 || !g4) return false;
        blit(c, g4);
        region(c, g3, track);
        const grown = Math.round(lerp(fills['goals-3'], fills['goals-4'], smooth(within(p, SAVE))));
        region(c, g4, [track[0], track[1], grown, track[3]]);
        return true;
      }
      return one(c, get('goals-4'));
    },
  };
}

/** Section 4: home, DUYO in its halo. */
const homeScript = (): Script => ({
  shots: ['home-1'],
  spans: [],
  primary: () => 'home-1',
  paint: (c, get) => one(c, get('home-1')),
});

export const SCRIPTS: Record<ScreenId, Script> = {
  chat: chatScript(),
  safety: safetyScript(),
  map: mapScript(),
  goals: goalsScript(),
  home: homeScript(),
};
