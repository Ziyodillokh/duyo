/**
 * Live force simulation for the brain map — the physics behind Obsidian's
 * graph view, sized for a child's notebook on a phone.
 *
 * This is d3-force's velocity-Verlet scheme reimplemented small: every tick,
 * bodies repel each other, links pull their endpoints together like springs,
 * a gentle gravity draws everything toward the canvas centre, and the whole
 * system cools down (`alpha` decays) until it falls asleep. Grabbing a body
 * pins it to the finger and re-heats the system, so its neighbourhood
 * reorganises around the drag and settles again on release — which is
 * exactly the motion Obsidian users know.
 *
 * Deliberately deterministic: no randomness anywhere, so the same notebook
 * settles into the same sky on every device. The only "noise" is an
 * index-based nudge for bodies that land exactly on top of each other.
 *
 * Ticks are fixed-step like d3's, not wall-clock scaled: a dropped frame
 * slows the animation instead of teleporting bodies, which is the failure
 * mode you want on a low-end phone.
 */

export interface SimBody {
  x: number;
  y: number;
  /** Drawn radius — feeds charge (big bodies push harder) and collision. */
  r: number;
}

export interface SimLink {
  /** Body indices. */
  a: number;
  b: number;
}

/** How cool the system must get before it stops ticking. */
const ALPHA_MIN = 0.001;
/** Cooling rate per tick. ~90 ticks from 1 to asleep — a few seconds of
 *  settling at TICK_FPS, which is the Obsidian feel: a burst, then stillness. */
const ALPHA_DECAY = 0.08;
/** While a finger holds a body the system idles warm at this alpha instead
 *  of cooling, so neighbours keep responding for the whole drag. (d3's
 *  `alphaTarget(0.3)` drag convention.) */
const DRAG_ALPHA = 0.3;

/** Velocity kept per tick — the rest is friction. d3's default. */
const FRICTION = 0.6;

/** Repulsion. Charge grows with radius so the hub clears more room. */
const CHARGE = 44;
/** Beyond this, bodies ignore each other — keeps far clusters from slowly
 *  shoving each other off the canvas. */
const REPEL_MAX_D2 = 420 * 420;

/** Springs. Rest length leaves room for two bodies plus a label. */
const LINK_BASE = 66;
const LINK_STRENGTH = 0.9;

/** Gravity toward the canvas centre. The most-linked body is pulled harder,
 *  which is what keeps the "sun" of the child's system near the middle
 *  without pinning it. */
const GRAVITY = 0.045;
const CENTRAL_GRAVITY = 0.11;

/** Overlap separation — not a d3 default, but labels under 11pt bodies stop
 *  being readable the moment two discs merge, so overlaps get pushed apart. */
const COLLIDE_PAD = 3;
const COLLIDE_STRENGTH = 0.7;

export class GraphPhysics {
  readonly xs: Float64Array;
  readonly ys: Float64Array;
  private readonly vxs: Float64Array;
  private readonly vys: Float64Array;
  private readonly charge: Float64Array;
  private readonly radii: Float64Array;
  private readonly degree: Int32Array;
  private readonly links: { a: number; b: number; dist: number; strength: number; bias: number }[];

  private readonly cx: number;
  private readonly cy: number;
  private readonly centralIndex: number;

  private alpha = 1;
  private alphaTarget = 0;
  /** Index of the finger-held body, or -1. */
  private pinned = -1;
  private pinX = 0;
  private pinY = 0;

  constructor(bodies: SimBody[], links: SimLink[], cx: number, cy: number, centralIndex: number) {
    const n = bodies.length;
    this.xs = new Float64Array(n);
    this.ys = new Float64Array(n);
    this.vxs = new Float64Array(n);
    this.vys = new Float64Array(n);
    this.charge = new Float64Array(n);
    this.radii = new Float64Array(n);
    this.degree = new Int32Array(n);
    this.cx = cx;
    this.cy = cy;
    this.centralIndex = centralIndex;

    bodies.forEach((b, i) => {
      this.xs[i] = b.x;
      this.ys[i] = b.y;
      this.radii[i] = b.r;
      this.charge[i] = CHARGE * (1 + b.r / 8);
    });

    for (const l of links) {
      this.degree[l.a]++;
      this.degree[l.b]++;
    }
    this.links = links.map((l) => {
      const da = Math.max(1, this.degree[l.a]);
      const db = Math.max(1, this.degree[l.b]);
      return {
        a: l.a,
        b: l.b,
        dist: LINK_BASE + 0.7 * (bodies[l.a].r + bodies[l.b].r),
        // d3's defaults: a spring weakens on high-degree nodes so a hub is
        // not torn apart, and the lighter-connected end does most of the
        // moving.
        strength: Math.min(1, LINK_STRENGTH / Math.min(da, db)),
        bias: da / (da + db),
      };
    });
  }

  /** Warm the system back up (new data arrived, or a drag began). */
  kick(alpha: number): void {
    this.alpha = Math.max(this.alpha, alpha);
  }

  /** Hold a body at (x, y). Keeps the system warm until `release`. */
  pin(i: number, x: number, y: number): void {
    this.pinned = i;
    this.pinX = x;
    this.pinY = y;
    this.alphaTarget = DRAG_ALPHA;
    this.kick(DRAG_ALPHA);
  }

  movePin(x: number, y: number): void {
    this.pinX = x;
    this.pinY = y;
  }

  release(): void {
    this.pinned = -1;
    this.alphaTarget = 0;
  }

  /** One physics step. Returns false once the system is asleep. */
  tick(): boolean {
    this.alpha += (this.alphaTarget - this.alpha) * ALPHA_DECAY;
    if (this.alpha < ALPHA_MIN && this.pinned < 0) return false;

    const { xs, ys, vxs, vys, charge, links } = this;
    const n = xs.length;
    const a = this.alpha;

    // Gravity toward the centre.
    for (let i = 0; i < n; i++) {
      const g = (i === this.centralIndex ? CENTRAL_GRAVITY : GRAVITY) * a;
      vxs[i] += (this.cx - xs[i]) * g;
      vys[i] += (this.cy - ys[i]) * g;
    }

    // Pairwise repulsion. O(n²) on purpose — a child's notebook is tens of
    // notes, and a Barnes-Hut tree would be complexity with no one to serve.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = xs[j] - xs[i];
        let dy = ys[j] - ys[i];
        let d2 = dx * dx + dy * dy;
        if (d2 > REPEL_MAX_D2) continue;
        if (d2 < 1) {
          dx = ((i - j) % 7) * 0.13;
          dy = 0.17;
          d2 = dx * dx + dy * dy;
        }
        const w = a / d2;
        // d3's asymmetry: how hard I am pushed depends on YOUR charge.
        vxs[i] -= dx * charge[j] * w;
        vys[i] -= dy * charge[j] * w;
        vxs[j] += dx * charge[i] * w;
        vys[j] += dy * charge[i] * w;
      }
    }

    // Springs. Measured against where the bodies are HEADED (position +
    // velocity), which is what keeps d3's links from oscillating.
    for (const l of links) {
      const dx = xs[l.b] + vxs[l.b] - xs[l.a] - vxs[l.a];
      const dy = ys[l.b] + vys[l.b] - ys[l.a] - vys[l.a];
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = ((d - l.dist) / d) * l.strength * a;
      vxs[l.b] -= dx * f * l.bias;
      vys[l.b] -= dy * f * l.bias;
      vxs[l.a] += dx * f * (1 - l.bias);
      vys[l.a] += dy * f * (1 - l.bias);
    }

    // Integrate.
    for (let i = 0; i < n; i++) {
      if (i === this.pinned) {
        xs[i] = this.pinX;
        ys[i] = this.pinY;
        vxs[i] = 0;
        vys[i] = 0;
        continue;
      }
      vxs[i] *= FRICTION;
      vys[i] *= FRICTION;
      xs[i] += vxs[i];
      ys[i] += vys[i];
    }

    // Separate overlaps so labels stay readable.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = xs[j] - xs[i];
        let dy = ys[j] - ys[i];
        const rr = this.radii[i] + this.radii[j] + COLLIDE_PAD;
        let d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        if (d2 < 1) {
          dx = ((i - j) % 7) * 0.13;
          dy = 0.17;
          d2 = dx * dx + dy * dy;
        }
        const d = Math.sqrt(d2);
        const push = ((rr - d) / d) * 0.5 * COLLIDE_STRENGTH;
        // The smaller body yields more ground, like d3's forceCollide.
        const wi = this.radii[j] / (this.radii[i] + this.radii[j]);
        if (i !== this.pinned) {
          xs[i] -= dx * push * wi;
          ys[i] -= dy * push * wi;
        }
        if (j !== this.pinned) {
          xs[j] += dx * push * (1 - wi);
          ys[j] += dy * push * (1 - wi);
        }
      }
    }

    return true;
  }

  /** Run to rest right now — the "reduce motion" path renders only the
   *  settled sky, with no animation in between. */
  settleSync(maxTicks = 300): void {
    for (let t = 0; t < maxTicks && this.tick(); t++) {
      /* tick */
    }
  }
}
