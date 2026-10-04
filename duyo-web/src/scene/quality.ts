/**
 * A phone that cannot draw the scene at full resolution gets fewer pixels,
 * not a stutter.
 *
 * Watches the time between drawn frames once start-up has settled. When
 * most frames in a window come late — under about 28 fps — the pixel ratio
 * steps down a notch. A screen held at 30 Hz to save power draws every
 * 33 ms and is left alone: fewer pixels would not make it draw faster.
 * Only ever down: going back up could make it flap between two settings,
 * and a device that needed fewer pixels once will need them again.
 */

/** Pixel ratios to step down through, below whatever the stage starts at. */
const LADDER = [1.5, 1.25, 1];
/** Frames not judged after the start or a step: shaders, the galaxy and a new buffer settle. */
const SETTLE_FRAMES = 90;
/** Frames judged together. */
const WINDOW = 90;
/** A frame further than this from the one before (ms) is late. */
const LATE_MS = 36;
/** The share of late frames in a window that takes a step down. */
const LATE_SHARE = 0.5;

export interface QualityGuard {
  /** One drawn frame, `ms` after the one before. */
  frame: (ms: number) => void;
}

/**
 * `start` is the pixel ratio the stage draws at now: the ladder begins
 * there, so every step is a real reduction — a phone at 1.5 goes straight
 * to 1.25, and one already at 1 has nowhere to go and is not watched.
 */
export function createQualityGuard(start: number, setPixelRatioCap: (cap: number) => void): QualityGuard {
  const steps = [start, ...LADDER.filter((r) => r < start - 0.01)];
  let step = 0;
  let settle = SETTLE_FRAMES;
  let judged = 0;
  let late = 0;
  return {
    frame(ms) {
      if (step === steps.length - 1) return;
      if (settle > 0) {
        settle -= 1;
        return;
      }
      judged += 1;
      if (ms > LATE_MS) late += 1;
      if (judged < WINDOW) return;
      if (late / judged >= LATE_SHARE) {
        step += 1;
        setPixelRatioCap(steps[step]);
        settle = SETTLE_FRAMES;
      }
      judged = 0;
      late = 0;
    },
  };
}
