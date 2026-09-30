/**
 * Robot harness — DUYO alone, on the site's own stage.
 *
 *   /harness/robot.html?ground=paper|space|none &yaw=<radians> &wave=<0..1>
 *   optional: &wig=<-1..1> (where in the wave's swing) &look=<head yaw>
 *             &pitch=<head pitch> &speak=<0..1> &blink=<0..1> &shadow=0|1
 *             &dist=<units> &cx=<camera x> &cy=<camera y> &ty=<aim y>
 *             &fov=<degrees>
 *             &blue=|yellow=|white=<hex> — try an albedo in place of
 *             robotSkin.ts's, to tune the palette against the picture
 *
 *   ?check=1 sweeps the head through every yaw (±0.45) and pitch the page
 *   can give it, and the raised arm through its whole hello, and writes the
 *   hands' clearance from the helmet, the ear cups and the torso to
 *   body[data-check] (each > 1 means clear; see clearance()).
 *
 *   ?match=1 is the comparison shot against the app's mascot-default.png:
 *   a transparent canvas (no CSS ground, no shadow catcher) and a camera
 *   and turn that lay DUYO's silhouette over the picture's, so a screenshot
 *   taken with its background omitted can be diffed against it pixel for
 *   pixel. Every parameter above still applies on top.
 *
 * Rendered through createStage(), so the renderer, environment, lights and
 * shadow catcher are the page's own, onto a transparent canvas over a CSS
 * ground — what is judged here is what the page shows. The arms and the
 * antenna are posed with the same drive the page uses, so `wave` covers
 * exactly the range the page can reach.
 */

import * as THREE from 'three';
import { createStage } from '../src/three/stage';
import { ANTENNA_REST, ARM_DRIVE, buildRobot } from '../src/three/robot';
import type { Robot } from '../src/three/robot';
import { Arm } from '../src/three/robotArms';
import { CORE, SHELL } from '../src/three/robotHead';
import type { Blob } from '../src/three/robotShapes';
import { TORSO_DEPTH } from '../src/three/robotBody';
import { PALETTE } from '../src/scene/contract';
import * as SKIN from '../src/three/robotSkin';

const GROUNDS: Record<string, string> = { paper: PALETTE.paper, space: PALETTE.space, none: 'transparent' };

/**
 * The comparison shot. The mascot is a long-lens product render seen a
 * little from above, turned so its own right side (the viewer's left)
 * faces the lens — the body by about 0.17 rad, and the head a further
 * 0.19 (the belly lettering and the boot tabs sit nearly square to the
 * lens; the eyes and the visor's margins say the face is turned twice as
 * far). Fitted by silhouette overlap.
 */
const MATCH = { yaw: 0.17, look: 0.19, pitch: 0, dist: 16, cx: 0, cy: 1.6, ty: 0.22, fov: 24 } as const;
/** Everyday harness shot: straight on, the page's own lens. */
const PLAIN = { yaw: 0, look: 0, pitch: 0, dist: 9.8, cx: 0, cy: 1.1, ty: 0.28, fov: 0 } as const;

/**
 * Swaps any material still wearing one of the palette's albedos for the
 * hex given in the URL, so a colour can be judged in the render without
 * rebuilding. The torso's painted skin is not touched.
 */
function tryPalette(root: THREE.Object3D, params: URLSearchParams): void {
  const swaps: [string, number][] = [['blue', SKIN.BLUE], ['yellow', SKIN.YELLOW], ['white', SKIN.WHITE]];
  const wanted = swaps.flatMap(([k, from]) => {
    const hex = params.get(k);
    return hex && /^[0-9a-f]{6}$/i.test(hex) ? [[from, parseInt(hex, 16)] as const] : [];
  });
  if (!wanted.length) return;
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshPhysicalMaterial)) return;
    const m = o.material;
    for (const [from, to] of wanted) if (m.color.getHex() === from) m.color.setHex(to);
  });
}

/** The superellipsoid's own function: below 1 is inside. */
function blobF(b: Blob, p: THREE.Vector3): number {
  let f = 0;
  for (let i = 0; i < 3; i++) {
    const d = p.getComponent(i) - b.c[i];
    const r = d >= 0 ? b.r[i] : i === 1 ? (b.rBelow ?? b.r[1]) : i === 2 ? (b.rBack ?? b.r[2]) : b.r[i];
    const e = i === 1 && d < 0 ? b.eBelow : b.e[i];
    f += Math.abs(d / r) ** e;
  }
  return f;
}

interface Clearance {
  helmet: number;
  ears: number;
  torso: number;
  worst: string;
}

/**
 * How close the hands (everything from the wrist band out) come to the
 * helmet, the ear cups and the torso, in the current pose: the helmet by
 * its own superellipsoid functions, an ear cup as the cylinder round its
 * lathe, the torso as its lathe's radius at each height. Each is a ratio,
 * 1 on the surface; the minimum over every hand vertex.
 */
function clearance(robot: Robot, torsoR: (y: number) => number): Omit<Clearance, 'worst'> {
  robot.root.updateMatrixWorld(true);
  const toHead = robot.head.matrixWorld.clone().invert();
  const toBody = robot.body.matrixWorld.clone().invert();
  const ears: THREE.Mesh[] = [];
  robot.head.children.forEach((c) => c.name === 'ear' && c.children.forEach((m) => m instanceof THREE.Mesh && ears.push(m)));
  const v = new THREE.Vector3();
  const q = new THREE.Vector3();
  const out = { helmet: Infinity, ears: Infinity, torso: Infinity };
  for (const arm of robot.arms.children) {
    if (!(arm instanceof Arm)) continue;
    arm.wrist.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const pos = o.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i += 2) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        q.copy(v).applyMatrix4(toHead);
        out.helmet = Math.min(out.helmet, blobF(SHELL, q), blobF(CORE, q));
        for (const ear of ears) {
          const box = ear.geometry.boundingBox ?? (ear.geometry.computeBoundingBox(), ear.geometry.boundingBox);
          if (!box) continue;
          q.copy(v).applyMatrix4(ear.matrixWorld.clone().invert());
          const radial = Math.hypot(q.x, q.z) / Math.max(box.max.x, box.max.z);
          const axial = Math.abs(q.y - (box.max.y + box.min.y) / 2) / ((box.max.y - box.min.y) / 2);
          out.ears = Math.min(out.ears, Math.max(radial, axial));
        }
        q.copy(v).applyMatrix4(toBody);
        const r = torsoR(q.y);
        if (r > 0) out.torso = Math.min(out.torso, Math.hypot(q.x, q.z / TORSO_DEPTH) / r);
      }
    });
  }
  return out;
}

/** The torso's radius at each height, read off its lathe. */
function torsoRadius(robot: Robot): (y: number) => number {
  const bins = new Map<number, number>();
  robot.body.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.name !== 'torso') return;
    const pos = o.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const k = Math.round(pos.getY(i) / 0.02);
      bins.set(k, Math.max(bins.get(k) ?? 0, Math.hypot(pos.getX(i), pos.getZ(i) / TORSO_DEPTH)));
    }
  });
  return (y) => Math.max(bins.get(Math.round(y / 0.02)) ?? 0, bins.get(Math.round(y / 0.02) + 1) ?? 0);
}

/**
 * Every head yaw and pitch the page can reach, against every point of the
 * hello. The worst clearance overall, and per pitch for the arm at rest
 * and mid-wave, so a failure says where it is.
 */
function sweepClearance(robot: Robot): Clearance & { table: Record<string, string> } {
  const torsoR = torsoRadius(robot);
  const [armUp, armDown] = robot.arms.children;
  const worst: Clearance = { helmet: Infinity, ears: Infinity, torso: Infinity, worst: '' };
  const table: Record<string, string> = {};
  const waves: [number, number][] = [[0, 0], [0.3, 0], [0.6, 0], [0.85, 0], [1, -1], [1, -0.5], [1, 0], [1, 0.5], [1, 1]];
  for (const pitch of [-0.35, -0.2, 0, 0.1, 0.18]) {
    for (const [wave, wig] of waves) {
      const row = { helmet: Infinity, ears: Infinity, torso: Infinity };
      for (let yaw = -0.45; yaw <= 0.4501; yaw += 0.05) {
        for (const sway of [-0.05, 0.05]) {
          robot.head.rotation.set(pitch, yaw, -yaw * 0.07);
          armUp.rotation.set(sway, 0, ARM_DRIVE.rest + wave * (ARM_DRIVE.lift + wig * ARM_DRIVE.wiggle));
          armDown.rotation.set(-sway, 0, ARM_DRIVE.rest);
          const c = clearance(robot, torsoR);
          if (c.helmet < worst.helmet) worst.worst = `helmet@yaw ${yaw.toFixed(2)} pitch ${pitch} wave ${wave} wig ${wig}`;
          for (const k of ['helmet', 'ears', 'torso'] as const) {
            row[k] = Math.min(row[k], c[k]);
            worst[k] = Math.min(worst[k], c[k]);
          }
        }
      }
      table[`pitch ${pitch} wave ${wave} wig ${wig}`] = `${row.helmet.toFixed(2)} ${row.ears.toFixed(2)} ${row.torso.toFixed(2)}`;
    }
  }
  return { ...worst, table };
}

function main(): void {
  const params = new URLSearchParams(location.search);
  const num = (k: string, d: number) => {
    const v = parseFloat(params.get(k) ?? '');
    return Number.isFinite(v) ? v : d;
  };
  const match = params.get('match') === '1';
  const shot = match ? MATCH : PLAIN;
  const ground = params.get('ground') ?? (match ? 'none' : 'paper');
  const bg = GROUNDS[ground] ?? PALETTE.paper;
  document.documentElement.style.background = bg;
  document.body.style.background = bg;

  const canvas = document.getElementById('c');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('harness canvas missing');
  const stage = createStage(canvas);
  if (!stage) {
    document.body.textContent = 'WebGL unavailable';
    return;
  }
  stage.ground.visible = num('shadow', match ? 0 : 1) > 0;

  const t0 = performance.now();
  const robot = buildRobot();
  document.body.dataset.buildMs = (performance.now() - t0).toFixed(1);
  let tris = 0;
  robot.root.traverse((o) => {
    const g = (o as { geometry?: { index: { count: number } | null; getAttribute: (n: string) => { count: number } } }).geometry;
    if (g) tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  });
  document.body.dataset.tris = String(Math.round(tris));
  stage.scene.add(robot.root);
  tryPalette(robot.root, params);
  if (params.get('check') === '1') document.body.dataset.check = JSON.stringify(sweepClearance(robot));

  robot.root.rotation.y = num('yaw', shot.yaw);
  const [armL, armR] = robot.arms.children;
  if (armL) armL.rotation.z = ARM_DRIVE.rest + num('wave', 0) * (ARM_DRIVE.lift + num('wig', 0) * ARM_DRIVE.wiggle);
  if (armR) armR.rotation.z = ARM_DRIVE.rest;
  robot.antenna.rotation.z = ANTENNA_REST;
  const look = num('look', shot.look);
  robot.head.rotation.set(num('pitch', shot.pitch), look, -look * 0.07);
  robot.speak(num('speak', 0));
  for (const eye of robot.eyes) eye.scale.y = Math.max(0.05, 1 - num('blink', 0));

  const { camera } = stage;
  const render = () => {
    stage.resize(innerWidth, innerHeight);
    const fov = num('fov', shot.fov);
    if (fov > 0) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.position.set(num('cx', shot.cx), num('cy', shot.cy), num('dist', shot.dist));
    camera.lookAt(num('cx', shot.cx), num('ty', shot.ty), 0);
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
