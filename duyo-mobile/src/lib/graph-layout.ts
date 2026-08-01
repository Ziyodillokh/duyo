import type { GraphEdge, GraphNode } from '@/api/endpoints/notes';

export interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  /** Dot radius, grown by how many notes link here. */
  r: number;
}

export interface LayoutEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Endpoint titles, so the view can dim edges outside the focused set. */
  sourceTitle: string;
  targetTitle: string;
}

export interface Layout {
  nodes: PositionedNode[];
  edges: LayoutEdge[];
}

const ITERATIONS = 220;
const REPULSION = 5200;
const SPRING = 0.045;
const SPRING_LENGTH = 62;
const CENTRING = 0.012;
const DAMPING = 0.85;

const MIN_R = 7;
const MAX_R = 18;

/**
 * Force-directed layout: nodes push apart, links pull together.
 *
 * Deterministic — nodes start on a circle in the order the server sent them
 * (most-linked first), so the same graph draws the same way every open. A
 * random seed would make the child's brain rearrange itself on every visit,
 * which destroys the sense that it is a place they know.
 *
 * Runs to completion in one pass rather than animating: at the scale a child
 * reaches (tens of notes) it costs under a millisecond, and a settling
 * animation would just delay reading.
 */
export function layoutGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
): Layout {
  if (nodes.length === 0) return { nodes: [], edges: [] };

  const index = new Map(nodes.map((n, i) => [n.title.toLowerCase(), i]));
  const xs = new Float64Array(nodes.length);
  const ys = new Float64Array(nodes.length);
  const vx = new Float64Array(nodes.length);
  const vy = new Float64Array(nodes.length);

  // Seed on a circle; the most-linked node sits at the centre.
  const radius = Math.min(width, height) * 0.32;
  nodes.forEach((_, i) => {
    if (i === 0) {
      xs[i] = 0;
      ys[i] = 0;
      return;
    }
    const angle = (2 * Math.PI * (i - 1)) / Math.max(1, nodes.length - 1);
    xs[i] = Math.cos(angle) * radius;
    ys[i] = Math.sin(angle) * radius;
  });

  const links = edges
    .map((e) => [
      index.get(e.source.toLowerCase()),
      index.get(e.target.toLowerCase()),
    ])
    .filter((pair): pair is [number, number] =>
      pair[0] !== undefined && pair[1] !== undefined && pair[0] !== pair[1],
    );

  for (let step = 0; step < ITERATIONS; step++) {
    // Repulsion — every pair pushes apart.
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = xs[i] - xs[j];
        let dy = ys[i] - ys[j];
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          // Exactly overlapping: nudge deterministically by index so the pair
          // separates instead of dividing by zero.
          dx = (i - j) * 0.1;
          dy = 0.1;
          d2 = dx * dx + dy * dy;
        }
        const force = REPULSION / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        vx[i] += fx;
        vy[i] += fy;
        vx[j] -= fx;
        vy[j] -= fy;
      }
    }

    // Springs along links.
    for (const [a, b] of links) {
      const dx = xs[b] - xs[a];
      const dy = ys[b] - ys[a];
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (d - SPRING_LENGTH) * SPRING;
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;
      vx[a] += fx;
      vy[a] += fy;
      vx[b] -= fx;
      vy[b] -= fy;
    }

    // Gentle pull to the middle so disconnected notes don't drift off-canvas.
    for (let i = 0; i < nodes.length; i++) {
      vx[i] -= xs[i] * CENTRING;
      vy[i] -= ys[i] * CENTRING;
      vx[i] *= DAMPING;
      vy[i] *= DAMPING;
      xs[i] += vx[i];
      ys[i] += vy[i];
    }
  }

  // Fit to the viewport with room for the largest dot and its label.
  const maxLinks = Math.max(1, ...nodes.map((n) => n.links));
  const radii = nodes.map(
    (n) => MIN_R + (MAX_R - MIN_R) * Math.min(1, n.links / maxLinks),
  );

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < nodes.length; i++) {
    minX = Math.min(minX, xs[i] - radii[i]);
    maxX = Math.max(maxX, xs[i] + radii[i]);
    minY = Math.min(minY, ys[i] - radii[i]);
    maxY = Math.max(maxY, ys[i] + radii[i]);
  }
  const pad = 26;
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  // Shrink to fit, never stretch to fill. Blowing a two-note graph up to the
  // full canvas pushed the pair into opposite corners with nothing between
  // them; keeping scale ≤ 1 lets the simulation's own spacing stand and a
  // small graph sits as a small cluster in the middle, the way Obsidian's does.
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY, 1);
  const offsetX = pad + (width - pad * 2 - spanX * scale) / 2;
  const offsetY = pad + (height - pad * 2 - spanY * scale) / 2;

  const toX = (v: number) => (v - minX) * scale + offsetX;
  const toY = (v: number) => (v - minY) * scale + offsetY;

  const positioned: PositionedNode[] = nodes.map((n, i) => ({
    ...n,
    x: toX(xs[i]),
    y: toY(ys[i]),
    r: radii[i],
  }));

  return {
    nodes: positioned,
    edges: links.map(([a, b]) => ({
      x1: toX(xs[a]),
      y1: toY(ys[a]),
      x2: toX(xs[b]),
      y2: toY(ys[b]),
      sourceTitle: nodes[a].title,
      targetTitle: nodes[b].title,
    })),
  };
}
