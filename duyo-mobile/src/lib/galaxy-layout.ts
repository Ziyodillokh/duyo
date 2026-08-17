import type { GraphEdge, GraphEdgeKind, GraphNode } from '@/api/endpoints/notes';

export interface OrbitedNode extends GraphNode {
  x: number;
  y: number;
  /** Body radius, grown by how many notes link here. */
  r: number;
  /** 0 is the star at the centre; 1 and up are orbits, inner first. */
  ring: number;
  /** Resolved from the note's #tag, so colour means something. */
  colour: string;
}

export interface GalaxyEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Endpoint titles, so the view can dim edges outside the focused set. */
  sourceTitle: string;
  targetTitle: string;
  /** A mention is drawn fainter than a link the child typed on purpose. */
  kind: GraphEdgeKind;
}

export interface Orbit {
  rx: number;
  ry: number;
}

export interface Galaxy {
  /** Centre of the system, in canvas coordinates. */
  cx: number;
  cy: number;
  nodes: OrbitedNode[];
  edges: GalaxyEdge[];
  /** Ellipses to draw as orbit rings, inner first. */
  orbits: Orbit[];
  /** Tag → colour, for the legend. Only tags actually in the graph. */
  legend: { tag: string; colour: string }[];
}

// One colour per #tag, assigned by name so a tag keeps its colour for good.
// Drawn from the app's neon palette (tailwind.config.js) so the map belongs to
// the same product as everything around it.
// Exported so the note editor's colour picker offers exactly the colours the
// map can draw — a swatch that looked different on the map than in the picker
// would make the child's choice feel arbitrary.
export const PALETTE = [
  '#60A5FA', // blue
  '#05DF72', // green
  '#FB64B6', // pink
  '#FF8904', // orange
  '#C27AFF', // purple
  '#FDC700', // yellow
  '#51A2FF', // cyan
  '#E60076', // magenta
];

/** A note with no tag. Neutral on purpose — an untagged note is not a category. */
export const UNTAGGED = '#8FB6E8';
/** A [[link]] with nothing written behind it yet. */
export const UNFORMED = '#5C7599';

const ITERATIONS = 220;
const REPULSION = 5200;
const SPRING = 0.045;
const SPRING_LENGTH = 62;
const CENTRING = 0.012;
const DAMPING = 0.85;

const MIN_R = 7;
const MAX_R = 17;
/** The centre body is drawn larger than any planet — it is the anchor. */
const SUN_R = 26;

/** Stable small hash, so the same tag picks the same colour on every device. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Tags whose colour is fixed, not hashed. `#maqsad` marks the step notes DUYO
 * writes when it decomposes a goal (backend services/goal_paths.py) — that
 * cluster should always read as the same DUYO gold on every device and never
 * collide with a hash-coloured tag the child happened to make. The value
 * matches the colour the backend stamps on those notes.
 */
const RESERVED_TAG_COLOURS: Record<string, string> = {
  maqsad: '#FDC700', // goal path — DUYO gold
};

export function colourForTag(tag: string): string {
  const bare = tag.toLowerCase().replace(/^#/, '');
  return RESERVED_TAG_COLOURS[bare] ?? PALETTE[hash(bare) % PALETTE.length];
}

/**
 * The child's notes as a solar system: notes orbit the one they link to most,
 * #tags colour the bodies they belong to, and [[links]] draw the constellations.
 *
 * Two ideas are layered. A force simulation decides the ANGLE of every node —
 * so notes that link to each other end up as neighbours, which is the part that
 * actually carries meaning. Orbits then decide the DISTANCE: the more a note is
 * linked, the closer it sits to the centre. A pure force layout drifts into a
 * shapeless clump on a phone screen; pure rings would look tidy but scatter
 * related notes to opposite sides. Doing angle and radius separately keeps both.
 *
 * Deterministic — same notes draw the same sky every time. A child returns to a
 * place they recognise, which is the whole point of drawing it rather than
 * listing it.
 */
export function layoutGalaxy(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
): Galaxy {
  const cx = width / 2;
  const cy = height / 2;
  const empty: Galaxy = { cx, cy, nodes: [], edges: [], orbits: [], legend: [] };
  if (nodes.length === 0 || width <= 0 || height <= 0) return empty;

  const index = new Map(nodes.map((n, i) => [n.title.toLowerCase(), i]));

  const links = edges
    .map((e) => [
      index.get(e.source.toLowerCase()),
      index.get(e.target.toLowerCase()),
      e.kind,
    ])
    .filter(
      (t): t is [number, number, GraphEdgeKind] =>
        t[0] !== undefined && t[1] !== undefined && t[0] !== t[1],
    );

  // ── 1. Colour: a note takes the colour of the #tag it is joined to ───────
  const tagColour = new Map<string, string>();
  for (const n of nodes) {
    if (n.kind === 'tag') {
      const bare = n.title.replace(/^#/, '');
      tagColour.set(n.title.toLowerCase(), colourForTag(bare));
    }
  }
  // Tag edges carry the colour outward to the notes filed under that tag.
  // First tag wins, by title order, so a note under two tags does not flicker
  // between them from one render to the next.
  const noteColour = new Map<string, string>();
  const tagEdges = links
    .filter(([, , kind]) => kind === 'tag')
    .sort((a, b) => nodes[a[0]].title.localeCompare(nodes[b[0]].title));
  for (const [a, b] of tagEdges) {
    const [tagIdx, noteIdx] = nodes[a].kind === 'tag' ? [a, b] : [b, a];
    if (nodes[tagIdx].kind !== 'tag') continue;
    const key = nodes[noteIdx].title.toLowerCase();
    if (!noteColour.has(key)) {
      noteColour.set(key, tagColour.get(nodes[tagIdx].title.toLowerCase()) ?? UNTAGGED);
    }
  }

  // Priority: #tag first, then the child's own pick, then neutral grey.
  //
  // The tag has to outrank the manual colour. A tag is a CATEGORY shared by
  // many notes and the filter chips double as the map's legend (see
  // brain-screen.tsx) — if one note under #fizika could paint itself a
  // different colour, the legend would be telling the child something untrue.
  // The manual colour is therefore what an UNTAGGED note gets instead of the
  // flat grey every unfiled note used to share, which is exactly the case
  // where it carries information and nothing else claims the slot.
  const colourOf = (n: GraphNode): string => {
    if (n.kind === 'unwritten') return UNFORMED;
    if (n.kind === 'tag') return tagColour.get(n.title.toLowerCase()) ?? UNTAGGED;
    return noteColour.get(n.title.toLowerCase()) ?? n.colour ?? UNTAGGED;
  };

  // ── 2. Force pass — position is thrown away, only the angle is kept ──────
  const xs = new Float64Array(nodes.length);
  const ys = new Float64Array(nodes.length);
  const vx = new Float64Array(nodes.length);
  const vy = new Float64Array(nodes.length);

  nodes.forEach((_, i) => {
    if (i === 0) {
      xs[i] = 0;
      ys[i] = 0;
      return;
    }
    const angle = (2 * Math.PI * (i - 1)) / Math.max(1, nodes.length - 1);
    xs[i] = Math.cos(angle) * 100;
    ys[i] = Math.sin(angle) * 100;
  });

  for (let step = 0; step < ITERATIONS; step++) {
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

    for (let i = 0; i < nodes.length; i++) {
      vx[i] -= xs[i] * CENTRING;
      vy[i] -= ys[i] * CENTRING;
      vx[i] *= DAMPING;
      vy[i] *= DAMPING;
      xs[i] += vx[i];
      ys[i] += vy[i];
    }
  }

  // ── 3. Rings — most-linked note takes the centre, the rest orbit it ──────
  const order = nodes
    .map((n, i) => ({ i, links: n.links }))
    .sort((a, b) => b.links - a.links || a.i - b.i);

  const sunIdx = order[0].i;
  const orbiting = order.slice(1).map((o) => o.i);

  // Bodies shrink as the sky fills up. A phone is ~390pt wide: sixty notes at
  // the size eight notes get would not fit however they are arranged, and the
  // honest fix is smaller bodies rather than a layout that overlaps them.
  const density = Math.max(0.42, Math.min(1, 24 / nodes.length));
  const minBody = MIN_R * density;
  const maxBody = MAX_R * density;
  const sunBody = SUN_R * Math.max(0.55, density);

  // Leave room for the largest body and the label under it.
  const pad = maxBody + 22;
  const rx = Math.max(30, width / 2 - pad);
  const ry = Math.max(30, height / 2 - pad);

  // How many bodies fit on a ring, from its real geometry. On an ellipse the
  // tightest spacing is at the ends of the MINOR axis, where a step in angle
  // buys the least distance — so the short radius is what capacity must be
  // measured against. Spacing bodies evenly in angle and hoping is what put
  // two planets on top of each other at sixty notes.
  const gap = 2 * maxBody + 6;
  const capacities = (count: number): number[] =>
    Array.from({ length: count }, (_, k) =>
      Math.max(1, Math.floor((2 * Math.PI * Math.min(rx, ry) * ((k + 1) / count)) / gap)),
    );

  // Prefer a few rings for the look of a system, then add more if the bodies
  // genuinely do not fit.
  let ringCount = Math.max(1, Math.min(6, Math.ceil(Math.sqrt(orbiting.length / 3.5))));
  let caps = capacities(ringCount);
  while (
    caps.reduce((a, b) => a + b, 0) < orbiting.length &&
    ringCount < 40
  ) {
    ringCount++;
    caps = capacities(ringCount);
  }

  // Share the bodies out in proportion to what each ring can hold, so the
  // outer rings are not left empty while the inner ones run to their limit.
  const totalCap = caps.reduce((a, b) => a + b, 0) || 1;
  const share = caps.map((c) => Math.floor((orbiting.length * c) / totalCap));
  let left = orbiting.length - share.reduce((a, b) => a + b, 0);
  for (let k = share.length - 1; k >= 0 && left > 0; k--) {
    const room = caps[k] - share[k];
    const take = Math.min(room, left);
    share[k] += take;
    left -= take;
  }

  const ringOf: number[] = new Array(nodes.length).fill(0);
  const members: number[][] = [];
  let placed = 0;
  for (let k = 0; k < ringCount && placed < orbiting.length; k++) {
    const slice = orbiting.slice(placed, placed + share[k]);
    if (slice.length === 0) continue;
    members.push(slice);
    for (const i of slice) ringOf[i] = members.length;
    placed += slice.length;
  }
  // Anything left over (rounding, or a ring that filled up) joins the last ring.
  if (placed < orbiting.length) {
    const rest = orbiting.slice(placed);
    if (members.length === 0) members.push(rest);
    else members[members.length - 1].push(...rest);
    for (const i of rest) ringOf[i] = members.length;
  }

  const usedRings = members.length;
  const orbits: Orbit[] = members.map((_, k) => {
    const frac = (k + 1) / usedRings;
    return { rx: rx * frac, ry: ry * frac };
  });

  const angles = new Float64Array(nodes.length);
  for (const i of orbiting) angles[i] = Math.atan2(ys[i], xs[i]);

  // Within a ring, keep the order the force pass produced but space the bodies
  // evenly. Order is what carries the clustering; even spacing is what stops
  // two notes landing on top of each other.
  members.forEach((slice, k) => {
    const sorted = [...slice].sort((a, b) => angles[a] - angles[b]);
    const step = (2 * Math.PI) / sorted.length;
    const start = angles[sorted[0]];
    sorted.forEach((i, pos) => {
      angles[i] = start + pos * step;
    });
    void k;
  });

  const maxLinks = Math.max(1, ...nodes.map((n) => n.links));

  const positioned: OrbitedNode[] = nodes.map((n, i) => {
    const colour = colourOf(n);
    if (i === sunIdx) {
      return { ...n, x: cx, y: cy, r: sunBody, ring: 0, colour };
    }
    const k = ringOf[i] - 1;
    const orbit = orbits[k] ?? orbits[orbits.length - 1] ?? { rx, ry };
    // A #tag is a landmark, not a body — drawn small however much it is used.
    const r =
      n.kind === 'tag'
        ? minBody * 0.85
        : minBody + (maxBody - minBody) * Math.min(1, n.links / maxLinks);
    return {
      ...n,
      x: cx + Math.cos(angles[i]) * orbit.rx,
      y: cy + Math.sin(angles[i]) * orbit.ry,
      r,
      ring: ringOf[i],
      colour,
    };
  });

  const legend = nodes
    .filter((n) => n.kind === 'tag')
    .map((n) => ({
      tag: n.title.replace(/^#/, ''),
      colour: tagColour.get(n.title.toLowerCase()) ?? UNTAGGED,
    }));

  return {
    cx,
    cy,
    nodes: positioned,
    edges: links.map(([a, b, kind]) => ({
      x1: positioned[a].x,
      y1: positioned[a].y,
      x2: positioned[b].x,
      y2: positioned[b].y,
      sourceTitle: nodes[a].title,
      targetTitle: nodes[b].title,
      kind,
    })),
    orbits,
    legend,
  };
}

/**
 * Background stars. Seeded rather than random so the sky does not reshuffle on
 * every re-render — the map has to feel like the same place each time.
 */
export function starField(
  width: number,
  height: number,
  count = 70,
): { x: number; y: number; r: number; o: number }[] {
  let seed = 0x9e3779b9;
  const next = () => {
    // mulberry32
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, () => ({
    x: next() * width,
    y: next() * height,
    r: 0.5 + next() * 1.3,
    o: 0.25 + next() * 0.5,
  }));
}
