/**
 * The running scene: builds every piece, then applies the director's state to
 * it once per frame.
 *
 * Framework-free on purpose. React mounts it and tears it down; nothing in
 * here re-renders. Everything that varies per frame is a number written onto
 * an existing object — no allocation in the loop.
 *
 * The pieces, and who owns them:
 *   stage       renderer, camera, environment, key light, shadow ground
 *   robot       three/robot.ts  — the guide
 *   phone       scene/phone.ts  — the subject
 *   screen      scene/phoneScreen.ts — the app UI on the phone's display
 *   galaxy      scene/galaxy.ts — the world, and the brain map made real
 *   director    scene/director.ts — scroll → where all of the above should be
 *   measure     scene/measure.ts — where the copy leaves room; device tilt
 */

import * as THREE from 'three';
import { createStage } from '../three/stage';
import type { Stage } from '../three/stage';
import { ARM_DRIVE, buildRobot } from '../three/robot';
import type { Robot } from '../three/robot';
import { buildPhone } from './phone';
import { createPhoneScreen } from './phoneScreen';
import { buildGalaxy } from './galaxy';
import type { Galaxy, Phone, PhoneScreen } from './contract';
import { direct, GALAXY_POS, GALAXY_TILT, PHONE_POS, ROBOT_SCALE, ROBOT_Y } from './director';
import type { View } from './director';
import { createTiltReader, measureBands, measureFrames } from './measure';
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

/**
 * How long the hero's opening exchange takes to play on load, in seconds:
 * long enough to read the empty chat, see the question go and the board
 * start writing — the app's own pace, not a flash.
 */
const INTRO_SECONDS = 4.2;
/**
 * How far DUYO's head may turn from its body, in radians. Beyond about
 * ±0.45 the visor goes edge-on and the forehead reads "UYO"; the face is
 * the character, so it stays towards the visitor.
 */
const HEAD_YAW_MAX = 0.45;
const HEAD_PITCH_MAX = 0.35;
/** Where the hero's intro stops; scroll carries the rest of the chat. */
const INTRO_TARGET = 0.62;

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

  if (!(await onward())) return null;
  const robot = buildRobot();
  own(() => {
    scene.remove(robot.root);
    robot.dispose();
  });
  robot.root.scale.setScalar(ROBOT_SCALE);
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
  return alive() ? { robot, phone, screen } : null;
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
function run(stage: Stage, { robot, phone, screen }: Parts, options: SceneOptions): () => void {
  const { scene, camera, renderer } = stage;
  let alive = true;

  // The galaxy is the costliest piece to build (~130ms on a slow phone:
  // thousands of stars and a baked noise field) and on the paper hero it is
  // a 6% glow. So it is built in the first idle moment after the scene has
  // drawn, splitting start-up into shorter tasks instead of one long one
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

  // The shadow ground sits under the robot's feet; the phone floats above it
  // and drops a soft shadow of its own, which is most of what makes it read
  // as hovering rather than pasted on.
  stage.ground.position.set(0, ROBOT_Y + stage.floorY * ROBOT_SCALE, 0);
  // Draws only shadow, so it must not write depth either: it would hide the
  // part of the galaxy that lies below the floor line, as a hard horizon.
  (stage.ground.material as THREE.ShadowMaterial).depthWrite = false;

  // ── Pointer and tilt ───────────────────────────────────────────────────
  // Two uses: a gentle parallax on the camera everywhere, and a look from the
  // robot. Eased, never snapped — a hard follow reads as jitter. Motion the
  // visitor did not ask for: off under reduced motion, tilt not even read.
  let tx = 0;
  let ty = 0;
  let px = 0;
  let py = 0;
  const onPointer = (e: PointerEvent) => {
    tx = (e.clientX / window.innerWidth) * 2 - 1;
    ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  const tilt = createTiltReader();
  const onTilt = (e: DeviceOrientationEvent) => {
    const target = tilt.read(e);
    if (target) [tx, ty] = target;
  };
  const listenTilt = (on: boolean) => {
    window.removeEventListener('deviceorientation', onTilt);
    if (on) window.addEventListener('deviceorientation', onTilt);
    tilt.recentre();
  };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let motion = reduced.matches ? 0 : 1;
  const onReduced = () => {
    motion = reduced.matches ? 0 : 1;
    listenTilt(motion === 1);
  };
  reduced.addEventListener('change', onReduced);
  window.addEventListener('pointermove', onPointer, { passive: true });
  listenTilt(motion === 1);

  // ── Drag turns the PHONE ───────────────────────────────────────────────
  // The phone is the thing worth inspecting, so it is what a drag moves.
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
    lastX = e.clientX;
    lastY = e.clientY;
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
    if (e.pointerId === dragId) endDrag();
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
  const tmpGaze = new THREE.Vector3();
  const headWorld = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const invRobot = new THREE.Quaternion();
  let headYaw = 0;
  let headPitch = 0;
  let prevHeadYaw = 0;
  let antennaV = 0;
  let antennaA = 0;
  let nextBlink = 2.2;
  let blinkUntil = 0;
  let blinkT = 0;
  let springAcc = 0;

  // Two clocks that count drawn frames only. `anim` is the idle life: it
  // stands still under reduced motion but never runs back, so a blink, the
  // spin and the bobs hold instead of snapping when the setting changes.
  // `introClock` plays the opening, so a tab opened in the background still
  // plays it when first shown.
  let anim = 0;
  let introClock = 0;
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
    anim += dt * motion;
    introClock += dt;
    const t = anim;

    const follow = motion ? ease(0.05) : 1;
    px += (tx * motion - px) * follow;
    py += (ty * motion - py) * follow;
    // Smoothed scroll: a flicked wheel lands over a few frames instead of
    // one, which is the difference between a cut and a move.
    const gap = scroll - smoothScroll;
    const rate = SCROLL_EASE + (FLICK_EASE - SCROLL_EASE) * ramp(Math.abs(gap), FLICK_GAP_FROM, FLICK_GAP_TO);
    smoothScroll += gap * (motion ? ease(rate) : 1);

    const intro = motion ? Math.min(1, introClock / INTRO_SECONDS) : 1;
    // Ease in and out: the empty chat holds a beat before the question goes.
    const introEased = motion ? INTRO_TARGET * intro * intro * (3 - 2 * intro) : 1;
    const d = direct(smoothScroll, view, introEased, motion === 1);

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
    phone.root.rotation.set(
      d.phonePitch + dragPitch + Math.sin(t * 0.8) * 0.02,
      d.phoneYaw + dragYaw + px * 0.12,
      Math.sin(t * 0.6) * 0.012,
    );
    phone.root.position.y = PHONE_POS[1] + Math.sin(t * 1.1) * 0.06;

    screen.draw({ ...d.screen, t });

    // Galaxy — emergence starts wherever the display actually is this frame.
    // World space: the galaxy converts into its own frame, and spins itself.
    phone.screen.getWorldPosition(origin);
    galaxy?.update({ t, emergence: d.emergence, darkness: d.darkness, origin });

    // Shadows belong to the paper page; in deep space there is no floor.
    (stage.ground.material as THREE.ShadowMaterial).opacity = 0.24 * (1 - d.darkness);

    // ── Robot ────────────────────────────────────────────────────────────
    robot.root.rotation.y = d.robotYaw + px * 0.12;
    robot.root.position.set(d.robotPos[0], d.robotPos[1] + Math.sin(t * 1.3 + 1) * 0.03, d.robotPos[2]);
    robot.root.scale.setScalar(ROBOT_SCALE * d.robotScale);
    // The shadow catcher follows the feet, which sit lower on a phone screen.
    stage.ground.position.y = d.robotPos[1] + stage.floorY * ROBOT_SCALE * d.robotScale;

    // Head aims at the director's gaze target, expressed in the robot's own
    // frame, then clamped so it never cranes like an owl.
    robot.head.getWorldPosition(headWorld);
    tmpGaze.set(d.gaze[0], d.gaze[1], d.gaze[2]).sub(headWorld);
    robot.root.getWorldQuaternion(invRobot).invert();
    tmpGaze.applyQuaternion(invRobot);
    const wantYaw = Math.max(-HEAD_YAW_MAX, Math.min(HEAD_YAW_MAX, Math.atan2(tmpGaze.x, tmpGaze.z)));
    const wantPitch = Math.max(
      -HEAD_PITCH_MAX,
      Math.min(HEAD_PITCH_MAX, -Math.atan2(tmpGaze.y, Math.hypot(tmpGaze.x, tmpGaze.z))),
    );
    headYaw += (wantYaw + px * 0.18 - headYaw) * ease(0.08);
    headPitch += (wantPitch + py * 0.1 - headPitch) * ease(0.08);
    robot.head.rotation.set(headPitch, headYaw, -headYaw * 0.07);

    // Antenna: a spring driven by how fast the head turned, so it overshoots
    // and settles after the head stops. Stepped at a fixed 60Hz — a spring
    // integrated per display frame rings differently on every screen.
    springAcc = Math.min(springAcc + dt, MAX_DT);
    const steps = Math.floor(springAcc * 60);
    if (steps > 0) {
      springAcc -= steps / 60;
      const yawV = (headYaw - prevHeadYaw) / steps;
      prevHeadYaw = headYaw;
      for (let i = 0; i < steps; i += 1) {
        antennaV = (antennaV - yawV * 9 - antennaA * 0.14) * 0.72;
        antennaA += antennaV;
      }
    }
    robot.antenna.rotation.z = 0.2 + Math.max(-0.5, Math.min(0.5, antennaA));

    // Wave on the last section — the right arm swings up from the shoulder.
    const armR = robot.arms.children[1];
    const armL = robot.arms.children[0];
    if (armR && armL) {
      // robot.ts turns this one angle into a shoulder-and-elbow pose, and
      // its clearance from the head is solved against these same numbers.
      armR.rotation.z = ARM_DRIVE.rest + d.wave * (ARM_DRIVE.lift + Math.sin(t * 7) * ARM_DRIVE.wiggle);
      armR.rotation.x = Math.sin(t * 0.9) * 0.05 * (1 - d.wave);
      armL.rotation.x = -Math.sin(t * 0.9) * 0.05;
    }

    // Blink as an event: ~90ms shut every four to seven seconds. Never held
    // shut: under reduced motion the clock stands still, possibly mid-blink.
    if (t > nextBlink) {
      blinkUntil = t + 0.09;
      nextBlink = t + 4 + ((Math.sin(t * 97.13) + 1) / 2) * 3;
    }
    blinkT += ((motion && t < blinkUntil ? 1 : 0) - blinkT) * ease(0.45);
    for (const eye of robot.eyes) {
      eye.scale.y = Math.max(0.05, 1 - blinkT);
      eye.position.x = (eye.userData.baseX as number) + px * 0.05;
      eye.position.y = (eye.userData.baseY as number) - py * 0.03;
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
    reduced.removeEventListener('change', onReduced);
    listenTilt(false);
    window.removeEventListener('pointermove', onPointer);
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
