/**
 * The running scene: builds every piece, then applies the director's state to
 * it once per frame.
 *
 * Framework-free on purpose. React mounts it and tears it down; nothing in
 * here re-renders. Everything that varies per frame is a number written onto
 * an existing object — no allocation in the loop.
 *
 * The pieces, and who owns them:
 *   stage       renderer, camera, environment, key light
 *   robot       three/robot.ts  — DUYO, alone at its station in the hero
 *   life        scene/robotLife.ts — its gaze, blink, breath, wave and voice
 *   phone       scene/phone.ts  — the subject of every later section
 *   screen      scene/phoneScreen.ts — the app UI on the phone's display
 *   galaxy      scene/galaxy.ts — the world, and the brain map made real
 *   cosmos      scene/cosmos.ts — the deep, living space everything is in
 *   director    scene/director.ts — scroll → where all of the above should be
 *   measure     scene/measure.ts — where the copy leaves room; device tilt
 */

import * as THREE from 'three';
import { createStage } from '../three/stage';
import type { Stage } from '../three/stage';
import { buildRobot } from '../three/robot';
import type { Robot } from '../three/robot';
import { duyoVoice } from '../ui/duyoVoice';
import { createRobotLife } from './robotLife';
import { buildPhone } from './phone';
import { createPhoneScreen } from './phoneScreen';
import { buildGalaxy } from './galaxy';
import { buildCosmos } from './cosmos';
import type { Cosmos, CosmosInput, Galaxy, Phone, PhoneScreen } from './contract';
import { direct, GALAXY_POS, GALAXY_TILT, PHONE_POS, ROBOT_POS, ROBOT_SCALE } from './director';
import type { View } from './director';
import { measureBands, measureFrames } from './measure';
import { trackPointer } from './pointer';
import { ramp, readScroll } from './timeline';

export interface SceneRuntime {
  dispose: () => void;
}

export interface SceneOptions {
  /** Once, when the first frame has been drawn: the canvas can be shown. */
  onFirstFrame?: () => void;
  /** Building failed after startScene returned; the scene has already torn itself down. */
  onFail?: (error: unknown) => void;
}

/** The page stacks copy under the subject at and below this width (Tailwind md − 1). */
const STACKED_MAX_WIDTH = 767;

/** Longest frame time the eases will integrate over, in seconds. */
const MAX_DT = 0.1;

/** A press that moves less than this is a click (talk to DUYO), not a drag. */
const CLICK_SLOP_PX = 6;

/**
 * Scroll smoothing per 60Hz frame. A jump (End, a nav link, a hard flick)
 * would leave the scene mid-transition under copy that has already arrived,
 * so the rate rises with the gap (whole-page scroll, 0..1) — smoothly, as a
 * step would show as a brake. A wheel notch keeps the gentle rate.
 */
const SCROLL_EASE = 0.14;
const FLICK_EASE = 0.35;
const FLICK_GAP_FROM = 0.03;
const FLICK_GAP_TO = 0.12;

/** Longest wait for shaders before drawing anyway: a context lost mid-compile never reports ready. */
const COMPILE_WAIT_MS = 4000;

/** Hand the main thread back: a tap that lands during start-up is served now. */
const nextTask = (ms = 0) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

interface Parts {
  cosmos: Cosmos;
  robot: Robot;
  phone: Phone;
  screen: PhoneScreen;
}

/**
 * The environment, robot, phone and screen, then every shader, each in a
 * task of its own: as one task they held a mid-range phone's first taps for
 * half a second. compileAsync links in parallel instead of stalling the
 * first frames. Each piece registers its teardown with `own` once it
 * exists, and each step checks `alive`: dispose can land between any two.
 */
async function assemble(stage: Stage, own: (fn: () => void) => void, alive: () => boolean): Promise<Parts | null> {
  const { scene, camera, renderer } = stage;
  const onward = () => nextTask().then(alive);

  if (!(await onward())) return null;
  stage.bakeEnvironment();
  // Space first: cheap to build (~15ms), and its programs compile with the rest.
  const cosmos = buildCosmos();
  own(() => {
    scene.remove(cosmos.root);
    cosmos.dispose();
  });
  scene.add(cosmos.root);

  if (!(await onward())) return null;
  const robot = buildRobot();
  own(() => {
    scene.remove(robot.root);
    robot.dispose();
  });
  robot.root.scale.setScalar(ROBOT_SCALE);
  robot.root.position.set(...ROBOT_POS);
  scene.add(robot.root);

  if (!(await onward())) return null;
  const screen = createPhoneScreen();
  own(() => screen.dispose());
  screen.texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const phone = buildPhone(screen.texture);
  own(() => {
    scene.remove(phone.root);
    phone.dispose();
  });
  phone.root.position.set(...PHONE_POS);
  scene.add(phone.root);

  if (!(await onward())) return null;
  await Promise.race([renderer.compileAsync(scene, camera), nextTask(COMPILE_WAIT_MS)]);
  return alive() ? { cosmos, robot, phone, screen } : null;
}

/**
 * Null when there is no WebGL. The stage is built now, the rest over the
 * next few tasks; options.onFirstFrame says when there is something to show.
 */
export function startScene(canvas: HTMLCanvasElement, options: SceneOptions = {}): SceneRuntime | null {
  const stage = createStage(canvas, { deferEnvironment: true });
  if (!stage) return null;

  // Torn down newest first: the loop and its listeners, then the pieces,
  // then the renderer they were drawn with.
  const owned: Array<() => void> = [stage.dispose];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    [...owned].reverse().forEach((teardown) => teardown());
  };
  const alive = () => !disposed;

  assemble(stage, (teardown) => owned.push(teardown), alive)
    .then((parts) => {
      if (parts && alive()) owned.push(run(stage, parts, options));
    })
    .catch((error: unknown) => {
      if (!alive()) return;
      dispose();
      options.onFail?.(error);
    });

  return { dispose };
}

/** Wires input, scroll and size to the built scene and runs the frame loop. Returns its teardown. */
function run(stage: Stage, { cosmos, robot, phone, screen }: Parts, options: SceneOptions): () => void {
  const { scene, camera, renderer } = stage;
  let alive = true;

  // The galaxy is the costliest piece to build (~130ms on a slow phone:
  // thousands of stars and a baked noise field) and from the hero it is a
  // distant glow. So it is built in the first idle moment after the scene
  // has drawn, splitting start-up into shorter tasks instead of one long one
  // that would hold the page's first taps.
  let galaxy: Galaxy | null = null;
  const buildLater = async () => {
    const built = buildGalaxy();
    built.root.position.set(...GALAXY_POS);
    built.root.rotation.set(...GALAXY_TILT);
    // Its shaders start in a task of their own; it joins once they are ready.
    await nextTask();
    if (alive) await renderer.compileAsync(built.root, camera, scene);
    if (!alive) return built.dispose();
    scene.add(built.root);
    galaxy = built;
  };
  const idle = window.requestIdleCallback
    ? window.requestIdleCallback(buildLater, { timeout: 400 })
    : window.setTimeout(buildLater, 60);

  // Every section is deep space now: there is no floor to cast a shadow on.
  stage.ground.visible = false;
  const life = createRobotLife(robot, ROBOT_POS);

  // ── Pointer, tilt and the visitor's motion setting (scene/pointer.ts) ──
  let px = 0;
  let py = 0;
  const input = trackPointer();

  // ── Drag turns the subject; a click talks to DUYO ─────────────────────
  // In the hero a drag turns DUYO, later the phone: whichever is on screen.
  // A press that barely moves is a click: on DUYO it plays its voice.
  // Listening on the window keeps the canvas pointer-events:none, so links
  // and buttons keep working. A press on a control, the copy, the nav or the
  // footer is the page's: selecting a sentence must not spin the phone.
  // One pointer only: a pinch reports two, and deltas taken between
  // alternating fingers are their separation, not a movement — so a second
  // finger ends the drag and leaves the zoom to the browser. On touch the
  // vertical is the page's scroll (App.tsx, pan-y), and a swipe's first move
  // arrives before the browser takes it: it must not nod the phone.
  let dragId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let downX = 0;
  let downY = 0;
  let robotShown = 1;
  let dragOnRobot = true;
  let hovering = false;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  /** Is the pointer at (clientX, clientY) on DUYO? Only asked while DUYO is the shot. */
  const onRobot = (x: number, y: number) => {
    if (robotShown < 0.5) return false;
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObject(robot.root, true).length > 0;
  };
  let dragYaw = 0;
  let dragPitch = 0;
  const pagesOwn = (el: EventTarget | null) =>
    el instanceof Element &&
    !!el.closest('a, button, input, textarea, select, [role="button"], .copy, header, nav, footer');
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
    selectable(true);
  };
  const onDown = (e: PointerEvent) => {
    if (dragId !== null) return endDrag();
    if (e.button !== 0 || pagesOwn(e.target)) return;
    dragId = e.pointerId;
    lastX = downX = e.clientX;
    lastY = downY = e.clientY;
    dragOnRobot = robotShown >= 0.5;
    document.body.style.cursor = 'grabbing';
    selectable(false);
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== dragId) return;
    dragYaw = Math.max(-1.1, Math.min(1.1, dragYaw + (e.clientX - lastX) * 0.006));
    const dy = e.pointerType === 'touch' ? 0 : e.clientY - lastY;
    dragPitch = Math.max(-0.45, Math.min(0.45, dragPitch + dy * 0.004));
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== dragId) return;
    endDrag();
    input.dispose();
    const still = Math.hypot(e.clientX - downX, e.clientY - downY) < CLICK_SLOP_PX;
    if (!still || e.type !== 'pointerup') return;
    if (onRobot(e.clientX, e.clientY)) duyoVoice.toggle();
    else cosmos.pulse((e.clientX / window.innerWidth) * 2 - 1, 1 - (e.clientY / window.innerHeight) * 2);
  };
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  // ── Scroll & size ──────────────────────────────────────────────────────
  // Read on the event, applied in the frame: layout reads inside rAF are
  // what make scroll-driven scenes stutter.
  let scroll = readScroll();
  let smoothScroll = scroll;
  const onScroll = () => {
    scroll = readScroll();
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  const view: View = { aspect: 1, fovDeg: camera.fov, stacked: false };
  const onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    stage.resize(w, h);
    view.aspect = w / h;
    view.fovDeg = camera.fov;
    view.stacked = w <= STACKED_MAX_WIDTH;
    view.frames = view.stacked ? measureBands() : measureFrames();
    scroll = readScroll();
  };
  onResize();
  window.addEventListener('resize', onResize, { passive: true });
  // Inter is wider than the fallback face; re-measure once it has landed.
  void document.fonts.ready.then(() => alive && onResize());

  // ── Frame ──────────────────────────────────────────────────────────────
  const origin = new THREE.Vector3();

  const starPointer: CosmosInput['pointer'] = { x: 0, y: 0, active: false };
  const cosmosInput: CosmosInput = { t: 0, dt: 0, camera, pointer: starPointer };

  // A clock that counts drawn frames only: the idle life. It stands still
  // under reduced motion but never runs back, so a blink, the spin and the
  // bobs hold instead of snapping when the setting changes.
  let anim = 0;
  let firstFrame = true;
  let raf = 0;
  let running = true;
  let last = performance.now();

  const frame = () => {
    if (!running) return;
    const now = performance.now();
    // Every ease below is tuned as "this fraction per 60Hz frame" and
    // rescaled by the real frame time, so a 120Hz screen is not twice as
    // twitchy and a phone managing 30fps is not twice as sluggish. Clamped,
    // so a stall (a slow first frame, a returning tab) never lurches.
    const dt = Math.min(MAX_DT, (now - last) / 1000);
    last = now;
    const f60 = dt * 60;
    const ease = (perFrame: number) => 1 - Math.pow(1 - perFrame, f60);
    anim += dt * input.motion;
    const t = anim;

    const follow = input.motion ? ease(0.05) : 1;
    px += (input.tx * input.motion - px) * follow;
    py += (input.ty * input.motion - py) * follow;
    // Smoothed scroll: a flicked wheel lands over a few frames instead of
    // one, which is the difference between a cut and a move.
    const gap = scroll - smoothScroll;
    const rate = SCROLL_EASE + (FLICK_EASE - SCROLL_EASE) * ramp(Math.abs(gap), FLICK_GAP_FROM, FLICK_GAP_TO);
    smoothScroll += gap * (input.motion ? ease(rate) : 1);

    const d = direct(smoothScroll, view, input.motion === 1);
    robotShown = d.robotShown;

    // Camera, with a small pointer parallax on top of the director's shot.
    camera.position.set(d.cameraPos[0] + px * 0.28, d.cameraPos[1] - py * 0.18, d.cameraPos[2]);
    camera.lookAt(d.cameraLook[0], d.cameraLook[1], d.cameraLook[2]);

    // Phone: the director's pose, plus a hover bob, plus whatever the visitor
    // has dragged it to — which eases back once they let go.
    if (dragId === null) {
      const back = Math.pow(0.93, f60);
      dragYaw *= back;
      dragPitch *= back;
    }
    const phoneDrag = dragOnRobot ? 0 : 1;
    phone.root.rotation.set(
      d.phonePitch + dragPitch * phoneDrag + Math.sin(t * 0.8) * 0.02,
      d.phoneYaw + dragYaw * phoneDrag + px * 0.12,
      Math.sin(t * 0.6) * 0.012,
    );
    phone.root.position.y = PHONE_POS[1] + Math.sin(t * 1.1) * 0.06;

    screen.draw({ ...d.screen, t });

    // Galaxy — emergence starts wherever the display actually is this frame.
    // World space: the galaxy converts into its own frame, and spins itself.
    phone.screen.getWorldPosition(origin);
    galaxy?.update({ t, emergence: d.emergence, darkness: d.darkness, origin });

    // Space: far layers follow the camera; the stars answer the pointer.
    const lens = ease(0.25);
    starPointer.x += (input.tx - starPointer.x) * lens;
    starPointer.y += (-input.ty - starPointer.y) * lens;
    starPointer.active = input.starsActive;
    cosmosInput.t = t;
    cosmosInput.dt = input.motion ? dt : 0;
    cosmos.update(cosmosInput);

    // DUYO: alive at its station; turned by a drag started on its shot.
    const since = duyoVoice.startedAt();
    life.update({
      t,
      dt,
      ease,
      motion: input.motion,
      gaze: d.gaze,
      px,
      py,
      dragYaw: dragOnRobot ? dragYaw : 0,
      voice: duyoVoice.level(),
      talking: since ? (now - since) / 1000 : -1,
    });
    // A hand over DUYO says it can be clicked; asked only when the pointer moved.
    if (input.moved && dragId === null) {
      input.moved = false;
      const over = input.seen && onRobot(((input.tx + 1) / 2) * window.innerWidth, ((input.ty + 1) / 2) * window.innerHeight);
      if (over !== hovering) {
        hovering = over;
        document.body.style.cursor = over ? 'pointer' : '';
      }
    }

    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      options.onFirstFrame?.();
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
      raf = requestAnimationFrame(frame);
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    alive = false;
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    endDrag();
    if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
    else window.clearTimeout(idle);
    if (galaxy) {
      scene.remove(galaxy.root);
      galaxy.dispose();
    }
  };
}
