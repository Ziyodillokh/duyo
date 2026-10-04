/**
 * Where the page is and how big the picture is: the scroll the film reads,
 * the canvas size, and the room the copy leaves for the subject (View).
 *
 * Read on the event, applied in the frame: layout reads inside rAF are what
 * make scroll-driven scenes stutter.
 *
 * The canvas is sized from its own box, which App.tsx makes the LARGE
 * viewport: a phone's URL bar sliding in and out on the first scroll changes
 * the window, not the canvas. Such a resize re-reads the scroll and nothing
 * else — the drawing buffer is not reallocated and the copy is not measured
 * again, so the shot does not jump mid-scroll. The copy was measured with
 * the bars in, where it leaves the least room (measure.ts), so it holds.
 */

import type { Stage } from '../three/stage';
import { duyoVoice } from '../ui/duyoVoice';
import { arrangeCaptions, isStacked, smallViewportHeight } from '../ui/layout';
import type { View } from './director';
import { measureBands, measureFrames } from './measure';
import { readScroll, readTail } from './timeline';

/** Above this share of the canvas showing, there are no bars to allow for. */
const VISIBLE_SNAP = 0.99;

export interface Viewport {
  /** Handed to the director; re-measured in place. */
  readonly view: View;
  /** The canvas in CSS px as last applied, 0 until measured. Client px map onto it from its top-left. */
  readonly width: number;
  readonly height: number;
  /** The film's scroll, 0..1 (timeline.ts). */
  readonly scroll: number;
  /** Px scrolled past the film's end: at phone width, the footer coming in. */
  readonly tail: number;
  dispose: () => void;
}

/** Tracks scroll and size for the scene; `onScroll` hears every scroll after it has been read. */
export function trackViewport(stage: Stage, onScroll: () => void): Viewport {
  const canvas = stage.renderer.domElement;
  const view: View = { aspect: 1, fovDeg: stage.camera.fov, stacked: false };
  let width = 0;
  let height = 0;
  let ratio = 0;
  let windowWidth = 0;
  let scroll = readScroll();
  let tail = readTail();
  let alive = true;

  const readPage = () => {
    scroll = readScroll();
    tail = readTail();
  };
  const handleScroll = () => {
    readPage();
    onScroll();
  };

  const measure = () => {
    if (!alive) return;
    // Pinned or not decides where the copy is: settle it before reading it.
    arrangeCaptions();
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    // A window dragged to a screen of another density keeps its CSS size.
    const dpr = window.devicePixelRatio || 1;
    if (w !== width || h !== height || dpr !== ratio) {
      [width, height, ratio] = [w, h, dpr];
      stage.resize(w, h);
    }
    windowWidth = window.innerWidth;
    view.aspect = w / h;
    view.fovDeg = stage.camera.fov;
    view.stacked = isStacked();
    view.frames = view.stacked ? measureBands(h) : measureFrames(w);
    // Snapped: svh is fractional on a scaled display while the canvas is
    // whole px, and a real bar takes 5% of the height or more.
    const shows = smallViewportHeight() / h;
    view.visible = view.stacked || shows > VISIBLE_SNAP ? 1 : shows;
    readPage();
  };
  const onResize = () => {
    const barsOnly =
      window.innerWidth === windowWidth &&
      canvas.clientWidth === width &&
      canvas.clientHeight === height &&
      (window.devicePixelRatio || 1) === ratio;
    if (barsOnly) readPage();
    else measure();
  };

  measure();
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  // Anything else that moves the copy — a caption sent back into the page
  // (ui/layout.ts), the footer's fonts — changes the page's height.
  const pageSize = new ResizeObserver(measure);
  pageSize.observe(document.body);
  // Inter is wider than the fallback face; measure again once it has landed.
  void document.fonts.ready.then(measure);
  // The listen button appears only once the recording is known to exist,
  // and it can change the hero's copy: measure again after React has put it
  // in (two frames: its render, then its layout).
  const unsubVoice = duyoVoice.subscribe(() => requestAnimationFrame(() => requestAnimationFrame(measure)));

  return {
    view,
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    get scroll() {
      return scroll;
    },
    get tail() {
      return tail;
    },
    dispose() {
      alive = false;
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', onResize);
      pageSize.disconnect();
      unsubVoice();
    },
  };
}
