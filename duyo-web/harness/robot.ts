/**
 * Robot harness — DUYO alone, on the site's own stage.
 *
 *   /harness/robot.html?ground=paper|space &yaw=<radians> &wave=<0..1>
 *   optional: &wig=<-1..1> (where in the wave's swing) &look=<head yaw>
 *             &pitch=<head pitch> &dist=<units> &cy=<camera y> &ty=<aim y>
 *
 * Rendered through createStage(), so the renderer, environment, lights and
 * shadow catcher are the page's own, onto a transparent canvas over a CSS
 * ground — what is judged here is what the page shows. The arm and antenna
 * are posed with the runtime's own formulas, so `wave` covers exactly the
 * range the page can reach.
 */

import { createStage } from '../src/three/stage';
import { ARM_DRIVE, buildRobot } from '../src/three/robot';
import { PALETTE } from '../src/scene/contract';

const GROUNDS: Record<string, string> = { paper: PALETTE.paper, space: PALETTE.space };

function main(): void {
  const params = new URLSearchParams(location.search);
  const num = (k: string, d: number) => {
    const v = parseFloat(params.get(k) ?? '');
    return Number.isFinite(v) ? v : d;
  };
  document.body.style.background = GROUNDS[params.get('ground') ?? 'paper'] ?? PALETTE.paper;

  const canvas = document.getElementById('c');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('harness canvas missing');
  const stage = createStage(canvas);
  if (!stage) {
    document.body.textContent = 'WebGL unavailable';
    return;
  }

  const t0 = performance.now();
  const robot = buildRobot();
  document.body.dataset.buildMs = (performance.now() - t0).toFixed(1);
  stage.scene.add(robot.root);
  robot.root.rotation.y = num('yaw', 0);
  const armR = robot.arms.children[1];
  if (armR) armR.rotation.z = ARM_DRIVE.rest + num('wave', 0) * (ARM_DRIVE.lift + num('wig', 0) * ARM_DRIVE.wiggle);
  robot.antenna.rotation.z = 0.2;
  const look = num('look', 0);
  robot.head.rotation.set(num('pitch', 0), look, -look * 0.07);

  const { camera } = stage;
  const render = () => {
    stage.resize(innerWidth, innerHeight);
    camera.position.set(0, num('cy', 1.1), num('dist', 9.8));
    camera.lookAt(0, num('ty', 0.28), 0);
    stage.renderer.render(stage.scene, camera);
    document.body.dataset.ready = '1';
  };
  addEventListener('resize', render);
  render();

  addEventListener('pagehide', () => {
    robot.dispose();
    stage.dispose();
  });
}

main();
