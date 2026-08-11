import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Frames per second the map redraws at while drifting.
 *
 *  Not 60: the drift is a few points of slow movement, so a third of the
 *  frames looks identical while doing a third of the SVG work. On a phone
 *  showing a child's whole notebook that difference is the whole budget.
 */
const FPS = 20;
const FRAME_MS = 1000 / FPS;

/**
 * A seconds-since-mount clock for the brain map's drift, or a frozen 0 when
 * motion should not play.
 *
 * Stops entirely when:
 *  - `enabled` is false (the caller has nothing to animate), or
 *  - the OS "reduce motion" accessibility setting is on. Constant background
 *    movement is exactly what that setting exists to switch off, and a map
 *    that ignores it is unusable for a child who gets motion sick — they get
 *    the static layout, which was the whole design before drift existed and
 *    is still complete on its own.
 *
 * Returns a number that changes every frame, so a component reading it
 * re-renders each tick. Keep expensive work out of that path — see
 * `note-graph.tsx`, where the touch targets are deliberately excluded.
 */
export function useGraphClock(enabled: boolean): number {
  const [t, setT] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (alive) setReduceMotion(on);
      })
      .catch(() => {
        // Unsupported platform: leave motion on rather than silently
        // disabling a feature over a query that never worked.
      });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (on: boolean) => setReduceMotion(on),
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const running = enabled && !reduceMotion;

  useEffect(() => {
    if (!running) {
      setT(0);
      return;
    }
    const start = Date.now();
    let last = 0;

    const tick = () => {
      const elapsed = Date.now() - start;
      if (elapsed - last >= FRAME_MS) {
        last = elapsed;
        setT(elapsed / 1000);
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [running]);

  return running ? t : 0;
}
