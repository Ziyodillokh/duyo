/**
 * The visitor's hands on the scene: a drag turns the subject, a click or a
 * tap on DUYO plays its voice, and a pointer over DUYO shows a hand. Shared
 * by the home page's film and the robot page's.
 *
 * Listening on the window keeps the canvas pointer-events:none, so links
 * and buttons keep working. A press on a control, the copy, the nav or the
 * footer is the page's: selecting a sentence must not spin the subject.
 * One pointer only: a pinch reports two, and deltas taken between
 * alternating fingers are their separation, not a movement — so a second
 * finger ends the drag and leaves the zoom to the browser. On touch the
 * vertical is the page's scroll (App.tsx, pan-y), and a swipe's first move
 * arrives before the browser takes it: it must not nod the subject.
 */

import * as THREE from 'three';
import type { Robot } from '../three/robot';
import { duyoVoice } from '../ui/duyoVoice';
import type { PointerInput } from './pointer';
import type { Viewport } from './viewport';

/**
 * A press that moves less than this is a click (talk to DUYO), not a drag.
 * A fingertip wobbles more than a mouse, so a tap gets more room.
 */
const CLICK_SLOP_PX = 6;
const TAP_SLOP_PX = 10;
/** How far a drag may turn and tip the subject, in radians. */
const YAW_MAX = 1.1;
const PITCH_MAX = 0.45;
/** Radians per px of drag. */
const YAW_PER_PX = 0.006;
const PITCH_PER_PX = 0.004;
/** Let go, the turn eases back by this share per 60Hz frame. */
const RELEASE = 0.93;

export interface HandlingDeps {
  camera: THREE.Camera;
  robot: Robot;
  input: PointerInput;
  page: Viewport;
  /** 0..1: how much DUYO is the shot right now. Below a half it cannot be clicked. */
  robotShown: () => number;
}

export interface Handling {
  /** The drag's turn and tip, in radians. */
  readonly yaw: number;
  readonly pitch: number;
  /** The drag began while DUYO was the shot (else it turns the other subject). */
  readonly onRobot: boolean;
  /** At the start of a frame: a released drag eases back. */
  settle: (f60: number) => void;
  /** At the end of a frame: a hand over DUYO says it can be clicked. Asked only when the pointer moved. */
  hover: () => void;
  dispose: () => void;
}

export function trackHandling({ camera, robot, input, page, robotShown }: HandlingDeps): Handling {
  let dragId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let downX = 0;
  let downY = 0;
  let yaw = 0;
  let pitch = 0;
  let dragOnRobot = true;
  let hovering = false;
  let talkPending = false;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  // A box around DUYO as it stands now, a little generous: the ray meets it
  // in microseconds, and only a ray that does is tested against the
  // 84k-triangle model.
  const box = new THREE.Box3();

  /** Is the pointer at (clientX, clientY) on DUYO? Only asked while DUYO is the shot. */
  const isOnRobot = (x: number, y: number) => {
    if (robotShown() < 0.5 || page.width === 0) return false;
    ndc.set((x / page.width) * 2 - 1, -(y / page.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (!raycaster.ray.intersectsBox(box.setFromObject(robot.root).expandByScalar(0.15))) return false;
    return raycaster.intersectObject(robot.root, true).length > 0;
  };

  const pagesOwn = (el: EventTarget | null) =>
    el instanceof Element && !!el.closest('a, button, input, textarea, select, [role="button"], .copy, header, nav, footer');
  // Held, the press would also select text wherever the pointer crosses.
  const htmlStyle = document.documentElement.style;
  const selectable = (on: boolean) => {
    for (const prop of ['user-select', '-webkit-user-select']) {
      if (on) htmlStyle.removeProperty(prop);
      else htmlStyle.setProperty(prop, 'none');
    }
  };
  const endDrag = () => {
    if (dragId === null) return;
    dragId = null;
    document.body.style.cursor = '';
    // The cursor was just cleared: the next move must be free to set it again.
    hovering = false;
    input.moved = true;
    selectable(true);
  };
  const onDown = (e: PointerEvent) => {
    talkPending = false;
    if (dragId !== null) return endDrag();
    if (e.button !== 0 || pagesOwn(e.target)) return;
    dragId = e.pointerId;
    lastX = downX = e.clientX;
    lastY = downY = e.clientY;
    dragOnRobot = robotShown() >= 0.5;
    document.body.style.cursor = 'grabbing';
    selectable(false);
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== dragId) return;
    yaw = Math.max(-YAW_MAX, Math.min(YAW_MAX, yaw + (e.clientX - lastX) * YAW_PER_PX));
    const dy = e.pointerType === 'touch' ? 0 : e.clientY - lastY;
    pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, pitch + dy * PITCH_PER_PX));
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== dragId) return;
    endDrag();
    const slop = e.pointerType === 'touch' ? TAP_SLOP_PX : CLICK_SLOP_PX;
    const still = Math.hypot(e.clientX - downX, e.clientY - downY) < slop;
    if (!still || e.type !== 'pointerup') return;
    // The voice starts from the click that follows, not from here: Safari
    // counts a click as the gesture that may start sound; a pointerup, not
    // always.
    if (isOnRobot(e.clientX, e.clientY)) talkPending = true;
  };
  const onClick = () => {
    if (!talkPending) return;
    talkPending = false;
    duyoVoice.toggle();
  };
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('click', onClick);

  return {
    get yaw() {
      return yaw;
    },
    get pitch() {
      return pitch;
    },
    get onRobot() {
      return dragOnRobot;
    },
    settle(f60) {
      if (dragId !== null) return;
      const back = Math.pow(RELEASE, f60);
      yaw *= back;
      pitch *= back;
    },
    hover() {
      if (!input.moved || dragId !== null) return;
      input.moved = false;
      const over = input.seen && isOnRobot(((input.tx + 1) / 2) * window.innerWidth, ((input.ty + 1) / 2) * window.innerHeight);
      if (over !== hovering) {
        hovering = over;
        document.body.style.cursor = over ? 'pointer' : '';
      }
    },
    dispose() {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('click', onClick);
      endDrag();
      document.body.style.cursor = '';
    },
  };
}
