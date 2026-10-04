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
 *   viewport    scene/viewport.ts — scroll, canvas size, and the measured View
 *   quality     scene/quality.ts — fewer pixels for a device that falls behind
 */

import * as THREE from 'three';
import type { Stage } from '../three/stage';
import { buildRobot } from '../three/robot';
import type { Robot } from '../three/robot';
import { duyoVoice } from '../ui/duyoVoice';
import { createRobotLife } from './robotLife';
import { buildPhone } from './phone';
import { createPhoneScreen } from './phoneScreen';
import { buildGalaxy } from './galaxy';
import { buildCosmos } from './cosmos';
import { PALETTE } from './contract';
import type { Cosmos, CosmosInput, Galaxy, Phone, PhoneScreen } from './contract';
import { direct, GALAXY_POS, GALAXY_TILT, PHONE_POS, ROBOT_POS, ROBOT_SCALE } from './director';
import { trackHandling } from './handling';
import type { Tick } from './loop';
import { trackPointer } from './pointer';
import { COMPILE_WAIT_MS, followScroll, nextTask, placeCamera } from './feel';
import { startLoop } from './loop';
import { createQualityGuard } from './quality';
import { startStaged } from './start';
import type { Own, SceneOptions, SceneRuntime } from './start';
import { trackViewport } from './viewport';

export type { SceneOptions, SceneRuntime } from './start';

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
async function assemble(stage: Stage, own: Own, alive: () => boolean): Promise<Parts | null> {
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

/** The home page's film on a canvas (scene/start.ts). */
export function startScene(canvas: HTMLCanvasElement, options: SceneOptions = {}): SceneRuntime | null {
  return startStaged(canvas, options, assemble, run);
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
  // …and the canvas paints that space itself, opaque. The cosmos and the
  // galaxy add light without writing alpha, so over a transparent clear
  // their pixels carry colour at alpha 0 — invalid premultiplied values that
  // a headless compositor happens to add but a real Chrome window on macOS
  // throws away: the stars, the gas and the galaxy simply vanished there
  // while the opaque robot stayed. On an opaque clear there is no such pixel.
  renderer.setClearColor(PALETTE.space, 1);
  const life = createRobotLife(robot, ROBOT_POS);

  // ── Pointer, tilt and the visitor's motion setting (scene/pointer.ts) ──
  let px = 0;
  let py = 0;
  const input = trackPointer();
  // Scroll and size (scene/viewport.ts). After a scroll DUYO may have moved
  // out from under a still pointer: ask again.
  const page = trackViewport(stage, () => {
    input.moved = true;
  });

  // ── Drag turns the subject; a click talks to DUYO (scene/handling.ts) ─
  // In the hero a drag turns DUYO, later the phone: whichever is on screen.
  let robotShown = 1;
  const hands = trackHandling({ camera, robot, input, page, robotShown: () => robotShown });

  let smoothScroll = page.scroll;
  const quality = createQualityGuard(renderer.getPixelRatio(), stage.setPixelRatioCap);

  // ── Frame ──────────────────────────────────────────────────────────────
  const origin = new THREE.Vector3();

  const cosmosInput: CosmosInput = { t: 0, dt: 0, camera };

  // A clock that counts drawn frames only: the idle life. It stands still
  // under reduced motion but never runs back, so a blink, the spin and the
  // bobs hold instead of snapping when the setting changes.
  let anim = 0;

  const frame = ({ now, dt, f60, ease }: Tick) => {
    anim += dt * input.motion;
    const t = anim;

    const follow = input.motion ? ease(0.05) : 1;
    px += (input.tx * input.motion - px) * follow;
    py += (input.ty * input.motion - py) * follow;
    smoothScroll = followScroll(smoothScroll, page.scroll, ease, input.motion);

    const d = direct(smoothScroll, page.view, input.motion === 1);
    robotShown = d.robotShown;
    // Out of shot, DUYO costs nothing: not drawn, not in the shadow pass
    // (the key light's shadow camera sits on its station, so it would be).
    robot.root.visible = robotShown > 0;
    // Its voice belongs to its shot; with DUYO gone its stop button is too.
    if (robotShown === 0 && duyoVoice.status() === 'playing') duyoVoice.stop();

    // Camera: the director's shot, the pointer's parallax, the footer's lift (scene/feel.ts).
    placeCamera(camera, scene, page, d.cameraPos, d.cameraLook, px, py);

    // Phone: the director's pose, plus a hover bob, plus whatever the visitor
    // has dragged it to — which eases back once they let go.
    hands.settle(f60);
    const phoneDrag = hands.onRobot ? 0 : 1;
    phone.root.rotation.set(
      d.phonePitch + hands.pitch * phoneDrag + Math.sin(t * 0.8) * 0.02,
      d.phoneYaw + hands.yaw * phoneDrag + px * 0.12,
      Math.sin(t * 0.6) * 0.012,
    );
    phone.root.position.y = PHONE_POS[1] + Math.sin(t * 1.1) * 0.06;

    screen.draw({ ...d.screen, t });

    // Galaxy — emergence starts wherever the display actually is this frame.
    // World space: the galaxy converts into its own frame, and spins itself.
    phone.screen.getWorldPosition(origin);
    galaxy?.update({ t, emergence: d.emergence, darkness: d.darkness, origin });

    // Space: far layers follow the camera, near ones give the parallax depth.
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
      dragYaw: hands.onRobot ? hands.yaw : 0,
      voice: duyoVoice.level(),
      talking: since ? (now - since) / 1000 : -1,
    });
    hands.hover();

    renderer.render(scene, camera);
  };
  const stopLoop = startLoop(frame, quality, options.onFirstFrame);

  return () => {
    alive = false;
    stopLoop();
    hands.dispose();
    page.dispose();
    input.dispose();
    if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
    else window.clearTimeout(idle);
    if (galaxy) {
      scene.remove(galaxy.root);
      galaxy.dispose();
    }
  };
}
