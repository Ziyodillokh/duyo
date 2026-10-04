/**
 * A scene's frame loop: one requestAnimationFrame chain that stops while
 * the tab is hidden and starts again on return, with the frame time each
 * frame's eases integrate over.
 *
 * Every ease is tuned as "this fraction per 60Hz frame" and rescaled by the
 * real frame time, so a 120Hz screen is not twice as twitchy and a phone
 * managing 30fps is not twice as sluggish. Clamped, so a stall (a slow
 * first frame, a returning tab) never lurches; and the time away while
 * hidden is not a frame at all.
 */

import { MAX_DT } from './feel';
import type { QualityGuard } from './quality';

export interface Tick {
  now: number;
  /** Seconds since the last frame, clamped. */
  dt: number;
  /** dt in 60Hz frames. */
  f60: number;
  /** Converts a per-60Hz-frame ease into this frame's. */
  ease: (perFrame: number) => number;
}

/** Runs `draw` every frame from the next one; returns the loop's teardown. `onFirst` once, after the first draw. */
export function startLoop(draw: (tick: Tick) => void, quality: QualityGuard, onFirst?: () => void): () => void {
  let raf = 0;
  let running = true;
  let first = true;
  let last = performance.now();

  const frame = () => {
    if (!running) return;
    const now = performance.now();
    const dt = Math.min(MAX_DT, (now - last) / 1000);
    quality.frame(now - last);
    last = now;
    const f60 = dt * 60;
    draw({ now, dt, f60, ease: (perFrame) => 1 - Math.pow(1 - perFrame, f60) });
    if (first) {
      first = false;
      onFirst?.();
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  const onVisibility = () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else if (!running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
