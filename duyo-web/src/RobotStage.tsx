/**
 * The robot, wired to the page: scroll assembles it, the pointer turns it.
 *
 * One canvas fixed behind every section, so the character persists while the
 * copy scrolls past it — the alternative, a model per section, would rebuild
 * the scene three times and lose the continuity the whole idea rests on.
 *
 * Scroll drives assembly through three thresholds; the pointer drives a look,
 * never a spin. A backdrop a visitor can wrench around stops being a backdrop.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createStage } from './three/stage';
import { buildRobot, ROBOT_FLOOR_Y } from './three/robot';

/** Smooth 0→1 ramp between two scroll positions. */
function ramp(x: number, a: number, b: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Where each part joins, as a fraction of total page scroll. */
const BODY_IN: [number, number] = [0.16, 0.44];
const LIMBS_IN: [number, number] = [0.58, 0.86];

export default function RobotStage() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const stage = createStage(canvas);
    if (!stage) return; // no WebGL — the page keeps its backdrop and copy

    const robot = buildRobot();
    stage.scene.add(robot.root);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let motion = reduced.matches ? 0 : 1;
    const onReduced = () => {
      motion = reduced.matches ? 0 : 1;
    };
    reduced.addEventListener('change', onReduced);

    // Eased, never snapped: a head that tracks the cursor exactly reads as a
    // security camera rather than something alive.
    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;

    const onPointer = (e: PointerEvent) => {
      targetX = (e.clientX / window.innerWidth) * 2 - 1;
      targetY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      targetX = Math.max(-1, Math.min(1, e.gamma / 40));
      targetY = Math.max(-1, Math.min(1, (e.beta - 45) / 40));
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('deviceorientation', onTilt);

    // Read on scroll, applied in the frame — layout reads inside rAF are what
    // make a scroll-driven scene stutter.
    let scrollP = 0;
    const readScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollP = max > 0 ? Math.max(0, Math.min(1, window.scrollY / max)) : 0;
    };
    readScroll();
    window.addEventListener('scroll', readScroll, { passive: true });

    let narrow = false;
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      narrow = w / h < 0.8;
      stage.resize(w, h);
      readScroll();
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // Smoothed assembly, so a flicked scroll wheel does not snap parts on.
    let bodyT = 0;
    let limbsT = 0;

    let raf = 0;
    let running = true;
    const start = performance.now();

    const frame = () => {
      if (!running) return;
      const t = ((performance.now() - start) / 1000) * motion;

      curX += (targetX - curX) * 0.06;
      curY += (targetY - curY) * 0.06;

      bodyT += (ramp(scrollP, BODY_IN[0], BODY_IN[1]) - bodyT) * 0.1;
      limbsT += (ramp(scrollP, LIMBS_IN[0], LIMBS_IN[1]) - limbsT) * 0.1;

      // ── Assembly ─────────────────────────────────────────────────────
      // Parts arrive by growing into place and settling, rather than fading:
      // an opacity fade would need per-part materials and would read as a
      // ghost rather than a machine being finished.
      robot.body.visible = bodyT > 0.004;
      robot.body.scale.setScalar(bodyT);
      robot.body.position.y = lerp(-0.9, -0.18, bodyT);

      robot.arms.visible = limbsT > 0.004;
      robot.arms.scale.setScalar(limbsT);
      robot.legs.visible = limbsT > 0.004;
      robot.legs.scale.setScalar(limbsT);
      robot.legs.position.y = lerp(0.5, 0, limbsT);

      // Alone, the head is the subject and sits centre frame. As the body
      // arrives it drops onto the neck, and the whole figure shrinks to keep
      // the finished robot inside the viewport.
      const solo = 1 - bodyT;
      robot.head.position.y = lerp(1.32, 0.34, solo);

      const scale = 1.02 - 0.2 * bodyT - 0.18 * limbsT;
      robot.root.scale.setScalar(scale);
      // Keep the visible mass centred as the silhouette grows downward.
      robot.root.position.y = lerp(-0.45, 0.02, (bodyT + limbsT) / 2) + Math.sin(t * 1.1) * 0.045;

      stage.contact.position.y = ROBOT_FLOOR_Y * scale + robot.root.position.y;
      stage.contact.scale.setScalar(lerp(0.5, 1, limbsT) * scale);
      (stage.contact.material as THREE.MeshBasicMaterial).opacity = limbsT * 0.9 + 0.1;

      // ── Attention ────────────────────────────────────────────────────
      // The head leads, the body follows a fraction — the lag is what makes
      // the turn read as a living thing and not one rigid object.
      robot.head.rotation.y = curX * 0.52;
      robot.head.rotation.x = curY * 0.3 + Math.sin(t * 0.7) * 0.02;
      robot.head.rotation.z = -curX * 0.07;
      robot.root.rotation.y = curX * 0.22 + Math.sin(t * 0.35) * 0.05;

      // Arms drift with the sway so limbs do not look welded on.
      const swing = Math.sin(t * 0.9) * 0.05;
      robot.arms.children.forEach((arm, i) => {
        const dir = i === 0 ? -1 : 1;
        arm.rotation.x = swing * dir;
      });

      // A blink: mostly open, shut briefly on a slow cycle.
      const blink = Math.max(0, Math.sin(t * 0.42) - 0.9975) * 400;
      for (const eye of robot.eyes) eye.scale.y = Math.max(0.06, 1 - blink);

      // On a portrait phone the copy sits under the robot rather than beside
      // it, so the figure centres instead of sitting to the right.
      robot.root.position.x = narrow ? 0 : 1.32;

      stage.renderer.render(stage.scene, stage.camera);
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
      running = false;
      cancelAnimationFrame(raf);
      reduced.removeEventListener('change', onReduced);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('deviceorientation', onTilt);
      window.removeEventListener('scroll', readScroll);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      stage.scene.remove(robot.root);
      robot.dispose();
      stage.dispose();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full block pointer-events-none z-[5]"
    />
  );
}
