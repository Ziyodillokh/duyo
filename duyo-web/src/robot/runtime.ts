/**
 * The robot page's running scene: DUYO at its station in the cosmos, the
 * projector in its raised hand, and the hologram it throws — the home
 * page's knowledge galaxy at a tenth of the size (scene/galaxy.ts), whose
 * nodes stream out of DUYO's palm as the visitor reads about it.
 *
 * Built and run as the home page's is (scene/runtime.ts): the same stage,
 * the same DUYO and its life, the same sky, the same answers to the pointer
 * and the scroll (scene/feel.ts, scene/handling.ts, scene/viewport.ts).
 * What differs is what the director asks for (robot/director.ts).
 */

import * as THREE from 'three';
import type { Stage } from '../three/stage';
import { buildRobot } from '../three/robot';
import type { Robot } from '../three/robot';
import type { Arm } from '../three/robotArms';
import { duyoVoice } from '../ui/duyoVoice';
import { buildCosmos } from '../scene/cosmos';
import { PALETTE } from '../scene/contract';
import type { Cosmos, CosmosInput, Galaxy } from '../scene/contract';
import { ROBOT_POS, ROBOT_SCALE } from '../scene/director';
import { COMPILE_WAIT_MS, followScroll, nextTask, placeCamera } from '../scene/feel';
import { buildGalaxy } from '../scene/galaxy';
import { trackHandling } from '../scene/handling';
import { startLoop } from '../scene/loop';
import type { Tick } from '../scene/loop';
import { trackPointer } from '../scene/pointer';
import { createQualityGuard } from '../scene/quality';
import { createRobotLife } from '../scene/robotLife';
import { startStaged } from '../scene/start';
import type { Own, SceneOptions, SceneRuntime } from '../scene/start';
import { trackViewport } from '../scene/viewport';
import { buildBeam } from './beam';
import type { Beam } from './beam';
import { HOLO_CARDS, ROBOT_SAYS } from './content';
import { HOLO_SCALE, HOLO_TILT, directRobot } from './director';
import { buildLabels } from './labels';
import type { Labels } from './labels';

/** The lens sits this far out from the wrist, toward the hologram: in the palm. */
const LENS_OUT = 0.22;
/** The hologram unfolds as the beam comes on: from this share of its size to all of it. */
const UNFOLD_FROM = 0.55;
/**
 * DUYO's talk in the participant section, without a recording: the mouth
 * moving in syllables, phrases and pauses, under the bubble's words.
 */
function speech(t: number): number {
  const phrase = Math.sin(t * 1.9) > -0.55 ? 1 : 0;
  const syllable = Math.abs(Math.sin(t * 7.3)) * (0.6 + 0.4 * Math.sin(t * 2.3));
  return phrase * syllable;
}

interface Parts {
  cosmos: Cosmos;
  robot: Robot;
  beam: Beam;
  labels: Labels;
}

/** Each piece in a task of its own, as on the home page; see scene/runtime.ts assemble(). */
async function assemble(stage: Stage, own: Own, alive: () => boolean): Promise<Parts | null> {
  const { scene, camera, renderer } = stage;
  const onward = () => nextTask().then(alive);

  if (!(await onward())) return null;
  stage.bakeEnvironment();
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
  const beam = buildBeam();
  own(() => beam.dispose());
  scene.add(beam.root);
  const labels = buildLabels(HOLO_CARDS, ROBOT_SAYS);
  own(() => labels.dispose());
  scene.add(labels.root);

  if (!(await onward())) return null;
  await Promise.race([renderer.compileAsync(scene, camera), nextTask(COMPILE_WAIT_MS)]);
  return alive() ? { cosmos, robot, beam, labels } : null;
}

/** The robot page's film on a canvas (scene/start.ts). */
export function startRobotScene(canvas: HTMLCanvasElement, options: SceneOptions = {}): SceneRuntime | null {
  return startStaged(canvas, options, assemble, run);
}

function run(stage: Stage, { cosmos, robot, beam, labels }: Parts, options: SceneOptions): () => void {
  const { scene, camera, renderer } = stage;
  let alive = true;

  // The hologram is not seen until the visitor scrolls: built in the first
  // idle moment, its shaders in a task of their own.
  let galaxy: Galaxy | null = null;
  const buildLater = async () => {
    const built = buildGalaxy({ scale: HOLO_SCALE, halo: false });
    built.root.rotation.set(...HOLO_TILT);
    await nextTask();
    if (alive) await renderer.compileAsync(built.root, camera, scene);
    if (!alive) return built.dispose();
    scene.add(built.root);
    galaxy = built;
  };
  const idle = window.requestIdleCallback
    ? window.requestIdleCallback(buildLater, { timeout: 400 })
    : window.setTimeout(buildLater, 60);

  stage.ground.visible = false;
  renderer.setClearColor(PALETTE.space, 1);
  const life = createRobotLife(robot, ROBOT_POS);

  let px = 0;
  let py = 0;
  const input = trackPointer();
  const page = trackViewport(stage, () => {
    input.moved = true;
  });
  // DUYO is on screen in every section here: a drag turns it, a tap on it talks.
  const hands = trackHandling({ camera, robot, input, page, robotShown: () => 1 });
  let smoothScroll = page.scroll;
  const quality = createQualityGuard(renderer.getPixelRatio(), stage.setPixelRatioCap);

  const cosmosInput: CosmosInput = { t: 0, dt: 0, camera };
  const hand = (robot.arms.children[0] as Arm).hand;
  const lens = new THREE.Vector3();
  const holo = new THREE.Vector3();
  const head = new THREE.Vector3();
  const toward = new THREE.Vector3();
  let anim = 0;
  /** When DUYO began its talk (anim seconds), for the hello wave that opens it; −1 while quiet. */
  let talkSince = -1;

  const frame = ({ now, dt, f60, ease }: Tick) => {
    anim += dt * input.motion;
    const t = anim;
    const follow = input.motion ? ease(0.05) : 1;
    px += (input.tx * input.motion - px) * follow;
    py += (input.ty * input.motion - py) * follow;
    smoothScroll = followScroll(smoothScroll, page.scroll, ease, input.motion);

    const d = directRobot(smoothScroll, page.view);
    placeCamera(camera, scene, page, d.cameraPos, d.cameraLook, px, py);
    hands.settle(f60);

    // DUYO first, so the hand the beam leaves from is where it is drawn.
    // A recording, when there is one and it plays, speaks for DUYO; in the
    // participant section without one, DUYO mouths its bubble's words, and
    // waves hello as it starts.
    const since = duyoVoice.startedAt();
    const recorded = since > 0;
    if (d.talk > 0.6 && talkSince < 0) talkSince = t;
    if (d.talk < 0.4) talkSince = -1;
    life.update({
      t,
      dt,
      ease,
      motion: input.motion,
      gaze: d.gaze,
      face: d.cameraPos,
      px,
      py,
      dragYaw: hands.yaw,
      voice: recorded ? duyoVoice.level() : d.talk * speech(t) * 0.8 * input.motion,
      talking: recorded ? (now - since) / 1000 : talkSince >= 0 ? t - talkSince : -1,
      hold: d.hold,
    });

    // The projector: from the palm, out toward the hologram.
    holo.set(...d.holo);
    hand.getWorldPosition(lens);
    lens.addScaledVector(toward.subVectors(holo, lens).normalize(), LENS_OUT);
    beam.update(lens, holo, d.beam, t);

    // The hologram unfolds and brightens from nothing with the beam, and
    // its nodes leave from the palm.
    if (galaxy) {
      const on = d.beam;
      galaxy.root.visible = on > 0.004;
      galaxy.root.position.copy(holo);
      galaxy.root.scale.setScalar(HOLO_SCALE * (UNFOLD_FROM + (1 - UNFOLD_FROM) * on * (2 - on)));
      galaxy.update({ t, emergence: d.emergence, darkness: on, origin: lens, glow: on * on * (3 - 2 * on) });
    }

    robot.head.getWorldPosition(head);
    labels.update({ holo, head, layout: page.view.stacked ? 'tall' : 'wide', labels: d.labels, talk: d.talk, t });

    cosmosInput.t = t;
    cosmosInput.dt = input.motion ? dt : 0;
    cosmos.update(cosmosInput);

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
