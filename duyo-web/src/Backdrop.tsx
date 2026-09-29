/**
 * The background the brief asked a video to fill.
 *
 * The brief pointed at a hosted .mp4 on a CloudFront domain that belongs to
 * another company's product page. DUYO was rejected from Google Play under
 * the Impersonation policy in September for third-party assets in its store
 * listing, so that file cannot ship on a DUYO page in the same month.
 *
 * What replaces it keeps the brief's character rather than arguing with it:
 * pale, quiet, and sitting behind dark type on paper grey. It is DUYO's own
 * mark — nodes joined by links, the same figure inside the logo — built as a
 * real 3D cloud, turned by the pointer, drawn with 2D canvas primitives.
 *
 * No library, and no WebGL: a hundred projected points and their links is
 * arithmetic, and canvas gives finer control over a *light* palette than a
 * shader does. Nothing here leaves the device.
 */

import { useEffect, useRef } from 'react';

interface Node {
  x: number;
  y: number;
  z: number;
  /** Fixed per node so the cloud has a few accents rather than one hue. */
  hue: 'blue' | 'violet' | 'amber';
}

/** Enough to read as a structure, few enough to stay quiet behind the copy. */
const NODE_COUNT = 104;
/** Two nodes closer than this in 3D get a line. Distances never change — the
 *  cloud only rotates, and rotation is rigid — so the pairs are found once.
 *  0.34, not 0.46: the wider radius joined nearly everything to everything
 *  and the figure read as a tangle rather than a structure. */
const LINK_DIST = 0.34;

const COLOURS: Record<Node['hue'], string> = {
  blue: '91, 150, 249', //   #5B96F9 — DUYO blue, the dominant one
  violet: '139, 92, 246', // #8B5CF6
  amber: '245, 158, 11', //  #F59E0B — a handful, for warmth
};

/** Deterministic, so the composition is the same on every load. */
function makeNodes(): Node[] {
  let seed = 20260930;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  return Array.from({ length: NODE_COUNT }, (_, i) => {
    // Points on a shell, pulled inward at random, give a cloud with a
    // readable silhouette instead of a uniform box.
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const r = 0.55 + rand() * 0.45;
    return {
      x: r * Math.sin(phi) * Math.cos(theta),
      // Flattened: a disc reads as an object seen at an angle, a ball reads
      // as noise.
      y: r * Math.cos(phi) * 0.52,
      z: r * Math.sin(phi) * Math.sin(theta),
      hue: i % 17 === 0 ? 'amber' : i % 3 === 0 ? 'violet' : 'blue',
    };
  });
}

function findLinks(nodes: Node[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dz = nodes[i].z - nodes[j].z;
      if (dx * dx + dy * dy + dz * dz < LINK_DIST * LINK_DIST) out.push([i, j]);
    }
  }
  return out;
}

export default function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nodes = makeNodes();
    const links = findLinks(nodes);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let motion = reduced.matches ? 0 : 1;
    const onReduced = () => {
      motion = reduced.matches ? 0 : 1;
    };
    reduced.addEventListener('change', onReduced);

    // Eased toward, never snapped to: a hard follow reads as jitter.
    let targetX = 0.15;
    let targetY = -0.1;
    let curX = targetX;
    let curY = targetY;

    const onPointer = (e: PointerEvent) => {
      targetX = (e.clientX / window.innerWidth) * 2 - 1;
      targetY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    // Phones have no pointer; tilt does the same job.
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      targetX = Math.max(-1, Math.min(1, e.gamma / 45));
      targetY = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('deviceorientation', onTilt);

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    let raf = 0;
    let running = true;
    const start = performance.now();

    const px = new Float32Array(NODE_COUNT);
    const py = new Float32Array(NODE_COUNT);
    const pd = new Float32Array(NODE_COUNT); // depth, 0 far … 1 near

    const frame = () => {
      if (!running) return;
      const t = ((performance.now() - start) / 1000) * motion;

      curX += (targetX - curX) * 0.04;
      curY += (targetY - curY) * 0.04;

      // The cloud sits up and right; the copy lives bottom-left and the brief
      // leaves it on bare paper.
      const cx = w * (w < 640 ? 0.56 : 0.68);
      const cy = h * (w < 640 ? 0.34 : 0.44);
      // Scaled off the short edge so the figure keeps its proportions when the
      // window is wide and short.
      const scale = Math.min(w, h) * (w < 640 ? 0.52 : 0.46);

      const yaw = t * 0.06 + curX * 0.55;
      const pitch = 0.32 + curY * 0.3;
      const cosA = Math.cos(yaw);
      const sinA = Math.sin(yaw);
      const cosB = Math.cos(pitch);
      const sinB = Math.sin(pitch);

      for (let i = 0; i < NODE_COUNT; i++) {
        const n = nodes[i];
        // Yaw about Y, then pitch about X.
        const x1 = n.x * cosA - n.z * sinA;
        const z1 = n.x * sinA + n.z * cosA;
        const y2 = n.y * cosB - z1 * sinB;
        const z2 = n.y * sinB + z1 * cosB;
        // Perspective. 2.6 is a gentle lens — a shorter one swings the near
        // nodes across the frame and the cloud stops feeling solid.
        const p = 2.6 / (2.6 + z2);
        px[i] = cx + x1 * scale * p;
        py[i] = cy + y2 * scale * p;
        pd[i] = Math.max(0, Math.min(1, (z2 + 1.1) / 2.2));
      }

      ctx.clearRect(0, 0, w, h);

      // Links first, so nodes sit on top of their own threads.
      ctx.lineWidth = 1;
      for (let k = 0; k < links.length; k++) {
        const [i, j] = links[k];
        const depth = (pd[i] + pd[j]) * 0.5;
        // Faint by design: this is paper with something behind it, not a
        // diagram. Far links nearly vanish, which is what gives depth.
        ctx.strokeStyle = `rgba(100, 130, 190, ${0.04 + depth * 0.13})`;
        ctx.beginPath();
        ctx.moveTo(px[i], py[i]);
        ctx.lineTo(px[j], py[j]);
        ctx.stroke();
      }

      for (let i = 0; i < NODE_COUNT; i++) {
        const d = pd[i];
        const r = 1.6 + d * 4.2;
        const rgb = COLOURS[nodes[i].hue];
        // A soft halo, then the node — the halo is what keeps a 3px dot from
        // looking like a stray pixel on a light ground.
        const g = ctx.createRadialGradient(px[i], py[i], 0, px[i], py[i], r * 3.4);
        g.addColorStop(0, `rgba(${rgb}, ${0.1 + d * 0.16})`);
        g.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px[i], py[i], r * 3.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(${rgb}, ${0.22 + d * 0.5})`;
        ctx.beginPath();
        ctx.arc(px[i], py[i], r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // A hidden tab should not hold an animation loop open.
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
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div aria-hidden="true" className="fixed inset-0 z-0">
      {/* A breath of colour on the paper, so the cloud is not floating on a
          flat grey field. Pale enough that gray-900 type stays black on it. */}
      <div className="absolute inset-0 bg-[radial-gradient(115%_90%_at_72%_32%,#e8eefc_0%,#f0f0ee_58%,#f0f0ee_100%)]" />
      <canvas ref={ref} className="absolute inset-0 w-full h-full block" />
    </div>
  );
}
