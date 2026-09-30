/**
 * The visitor's hand, as the scene hears it: the pointer, the phone's tilt,
 * and whether they asked for stillness.
 *
 * One live object the runtime reads every frame, so the frame loop allocates
 * nothing. It drives the camera's parallax, the studio's turn in DUYO's
 * gloss and DUYO's gaze — all motion, so all gated by `motion` in the
 * runtime, and the tilt is not even listened to under reduced motion.
 */

import { createTiltReader } from './measure';

export interface PointerInput {
  /** Pointer or tilt target, −1..1, +y DOWN (screen space). */
  tx: number;
  ty: number;
  /** A pointer has been seen at all. */
  seen: boolean;
  /** It moved since the runtime last looked (the runtime clears this). */
  moved: boolean;
  /** 1 when motion is allowed, 0 under prefers-reduced-motion. */
  motion: number;
  dispose: () => void;
}

export function trackPointer(): PointerInput {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const tilt = createTiltReader();

  const onPointer = (e: PointerEvent) => {
    input.tx = (e.clientX / window.innerWidth) * 2 - 1;
    input.ty = (e.clientY / window.innerHeight) * 2 - 1;
    input.seen = true;
    input.moved = true;
  };
  const onTilt = (e: DeviceOrientationEvent) => {
    const target = tilt.read(e);
    if (target) [input.tx, input.ty] = target;
  };
  const listenTilt = (on: boolean) => {
    window.removeEventListener('deviceorientation', onTilt);
    if (on) window.addEventListener('deviceorientation', onTilt);
    tilt.recentre();
  };
  const onReduced = () => {
    input.motion = reduced.matches ? 0 : 1;
    listenTilt(input.motion === 1);
  };

  const input: PointerInput = {
    tx: 0,
    ty: 0,
    seen: false,
    moved: false,
    motion: reduced.matches ? 0 : 1,
    dispose: () => {
      reduced.removeEventListener('change', onReduced);
      listenTilt(false);
      window.removeEventListener('pointermove', onPointer);
    },
  };

  reduced.addEventListener('change', onReduced);
  window.addEventListener('pointermove', onPointer, { passive: true });
  listenTilt(input.motion === 1);
  return input;
}
