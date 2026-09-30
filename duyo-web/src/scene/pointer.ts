/**
 * The visitor's hand, as the scene hears it: the pointer, the phone's tilt,
 * and whether they asked for stillness.
 *
 * One live object the runtime reads every frame, so the frame loop allocates
 * nothing. Two readers want different things from it:
 *
 *   parallax  the camera, DUYO's gaze — motion, so it is gated by `motion`
 *             in the runtime, and the tilt is not even listened to while the
 *             visitor asked for reduced motion
 *   stars     the cosmos lens — a hover, not motion, so it stays on under
 *             reduced motion (the cosmos then brightens without moving). A
 *             finger counts only while it is down; a mouse from its first
 *             move until it leaves the window.
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
  /** The stars may answer it now. */
  starsActive: boolean;
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
    if (e.pointerType !== 'touch') input.starsActive = true;
  };
  const onTouchDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    onPointer(e);
    input.starsActive = true;
  };
  const onTouchUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') input.starsActive = false;
  };
  const onLeave = (e: MouseEvent) => {
    if (!e.relatedTarget) input.starsActive = false;
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
    starsActive: false,
    motion: reduced.matches ? 0 : 1,
    dispose: () => {
      reduced.removeEventListener('change', onReduced);
      listenTilt(false);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerdown', onTouchDown);
      window.removeEventListener('pointerup', onTouchUp);
      window.removeEventListener('pointercancel', onTouchUp);
      document.removeEventListener('mouseout', onLeave);
    },
  };

  reduced.addEventListener('change', onReduced);
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('pointerdown', onTouchDown, { passive: true });
  window.addEventListener('pointerup', onTouchUp, { passive: true });
  window.addEventListener('pointercancel', onTouchUp, { passive: true });
  document.addEventListener('mouseout', onLeave);
  listenTilt(input.motion === 1);
  return input;
}
