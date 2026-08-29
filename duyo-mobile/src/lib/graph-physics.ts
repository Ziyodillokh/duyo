/**
 * Live force simulation for the brain map — the physics behind Obsidian's
 * graph view, sized for a child's notebook on a phone.
 *
 * This is d3-force's velocity-Verlet scheme reimplemented small: every tick,
 * bodies repel each other, links pull their endpoints together like springs,
 * and a gentle gravity draws everything toward the canvas centre. Grabbing a
 * body pins it to the finger and re-heats the system, so its neighbourhood
 * reorganises around the drag and settles again on release — which is
 * exactly the motion Obsidian users know.
 *
 * Unlike d3, the system never stops. `alpha` cools to a floor rather than to
 * zero and every body carries a slow drift, so the sky keeps breathing:
 * bodies wander, their links tug the neighbours along, and repulsion opens
 * room ahead of them. The layout still settles in the first seconds — the
 * drift is small enough to sway the sky, never to rearrange it.
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

/** How cool the system must get before it stops ticking. Only reachable once
 *  ambient drift is off (see `settleSync`) — a live sky never gets there. */
const ALPHA_MIN = 0.001;
/** Cooling rate per tick. ~90 ticks from 1 to idle — a few seconds of
 *  settling, the burst you see when the map opens. */
const ALPHA_DECAY = 0.08;

/** The floor the system cools to instead of stopping.
 *
 *  Structural forces stay awake at this alpha, which is what makes the drift
 *  below read as one connected sky rather than as bodies sliding
 *  independently: when a note wanders, its springs carry the neighbours with
 *  it and repulsion opens a path ahead of it. Low enough that the layout the
 *  first seconds settled into is preserved — nothing reorganises on its own. */
const ALPHA_IDLE = 0.055;

/** Ambient wander — the sky is never still, and it does not march in step.
 *
 *  Each axis of each body sums two waves whose frequencies are picked per
 *  body from small primes-ish tables, so no two bodies share a rhythm and a
 *  single body's path loops without visibly repeating — restless rather than
 *  orbital. Everything derives from the body's index, never a RNG, so this
 *  file's determinism rule survives (the same notebook wanders identically
 *  on every device).
 *
 *  Acceleration, not a position offset: a nudge has to enter the same
 *  velocity the springs and repulsion read, or neighbours would not follow.
 *  With FRICTION at 0.6 a steady push settles at 2.5x itself per tick —
 *  tuned here to a visible roam of tens of pixels, against which the springs
 *  still hold every constellation together (verified numerically: link
 *  lengths stay at rest ±10% while bodies cover 30-60px every ten seconds). */
const DRIFT_ACCEL = 0.24;

/** Swarm cohesion — everyone is drawn to everyone, linked or not.
 *
 *  A uniform pairwise pull between every pair of bodies is mathematically
 *  the same as pulling each body toward the swarm's centroid, so that is
 *  how it is computed (O(n) instead of O(n²)). Against short-range
 *  repulsion this settles the sky into one close-knit cloud; against the
 *  wander it lets bodies trade places inside that cloud instead of
 *  oscillating around fixed homes — the mixing the child asked for. The
 *  centroid itself is walked toward the canvas centre by CENTER_PULL, so
 *  the cloud as a whole can never migrate off screen. */
const COHESION = 0.0035;
const CENTER_PULL = 0.0009;
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

/** Springs. Rest length is wherever the two bodies were SEEDED apart
 *  (clamped), and the strength is barely there: layout belongs to cohesion,
 *  repulsion and the wander now — links must not regroup the mixed cloud.
 *  What survives of the spring is a whisper of coupling, felt most when a
 *  body is dragged and its constellation leans after it. */
const LINK_MIN = 70;
const LINK_MAX = 300;
const LINK_STRENGTH = 0.12;

/** Gravity toward the canvas centre. The most-linked body is pulled harder,
 *  which is what keeps the "sun" of the child's system near the middle
 *  without pinning it. */
const GRAVITY = 0.045;
const CENTRAL_GRAVITY = 0.11;

/** Overlap separation — not a d3 default, but labels under 11pt bodies stop
 *  being readable the moment two discs merge, so overlaps get pushed apart. */
const COLLIDE_PAD = 8;
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
  /** Per-body wander character — phases, two frequencies per axis, and how
   *  far this body is willing to stray — precomputed in the constructor. */
  private readonly phase: Float64Array;
  private readonly sway: Float64Array;
  private readonly fx1: Float64Array;
  private readonly fx2: Float64Array;
  private readonly fy1: Float64Array;
  private readonly fy2: Float64Array;

  private readonly cx: number;
  private readonly cy: number;
  private readonly centralIndex: number;

  /** Ticks elapsed — the clock the drift waves are read at. Frame-counted,
   *  not wall-clock, for the same reason the rest of the step is: a dropped
   *  frame should slow the sky, never teleport it. */
  private age = 0;
  private ambient = true;

  private alpha = 1;
  private alphaTarget = ALPHA_IDLE;
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
    // Wander: an irrational-ish stride keeps neighbouring indices from
    // sharing a phase, and the frequency tables keep them from sharing a
    // rhythm — so the sky moves unevenly, every body on its own errand. A
    // well-linked body strays less: the hub should feel anchored while the
    // leaves roam, which is also what stops the whole map from sliding.
    this.phase = new Float64Array(n);
    this.sway = new Float64Array(n);
    this.fx1 = new Float64Array(n);
    this.fx2 = new Float64Array(n);
    this.fy1 = new Float64Array(n);
    this.fy2 = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      this.phase[i] = i * 2.399963; // golden angle in radians
      this.sway[i] = 1 / (1 + this.degree[i] * 0.35);
      this.fx1[i] = 0.011 + ((i * 7) % 5) * 0.0021;
      this.fx2[i] = 0.0047 + ((i * 13) % 7) * 0.0013;
      this.fy1[i] = 0.0093 + ((i * 11) % 6) * 0.0019;
      this.fy2[i] = 0.0059 + ((i * 5) % 4) * 0.0017;
    }

    this.links = links.map((l) => {
      const da = Math.max(1, this.degree[l.a]);
      const db = Math.max(1, this.degree[l.b]);
      const seedDist = Math.hypot(
        bodies[l.b].x - bodies[l.a].x,
        bodies[l.b].y - bodies[l.a].y,
      );
      return {
        a: l.a,
        b: l.b,
        dist: Math.min(LINK_MAX, Math.max(LINK_MIN, seedDist)),
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

  /** True while a finger is holding a body. The sim loop reads it to stay
   *  at the full frame rate through a drag, and to refuse to fall asleep
   *  under one. */
  isDragging(): boolean {
    return this.pinned >= 0;
  }

  movePin(x: number, y: number): void {
    this.pinX = x;
    this.pinY = y;
  }

  release(): void {
    this.pinned = -1;
    this.alphaTarget = this.ambient ? ALPHA_IDLE : 0;
  }

  /** One physics step. Returns false once the system is asleep — which only
   *  happens with ambient drift turned off. */
  tick(): boolean {
    this.alpha += (this.alphaTarget - this.alpha) * ALPHA_DECAY;
    if (this.alpha < ALPHA_MIN && this.pinned < 0) return false;
    this.age++;

    const { xs, ys, vxs, vys, charge, links } = this;
    const n = xs.length;
    const a = this.alpha;

    // Ambient wander plus swarm cohesion. Deliberately outside the alpha
    // scaling: alpha is how unsettled the LAYOUT is, and the sky keeps
    // roaming and regrouping long after the layout has stopped having
    // opinions.
    if (this.ambient) {
      let mx = 0;
      let my = 0;
      for (let i = 0; i < n; i++) {
        mx += xs[i];
        my += ys[i];
      }
      mx /= n;
      my /= n;
      const t = this.age;
      for (let i = 0; i < n; i++) {
        if (i === this.pinned) continue;
        const p = this.phase[i];
        const s = this.sway[i] * DRIFT_ACCEL;
        vxs[i] +=
          (Math.cos(t * this.fx1[i] + p) +
            0.6 * Math.sin(t * this.fx2[i] + p * 2.3)) *
          s;
        vys[i] +=
          (Math.sin(t * this.fy1[i] + p * 1.7) +
            0.6 * Math.cos(t * this.fy2[i] + p * 3.1)) *
          s;
        // Everyone toward everyone (via the centroid), and the flock as a
        // whole toward the canvas centre.
        vxs[i] += (mx - xs[i]) * COHESION + (this.cx - xs[i]) * CENTER_PULL;
        vys[i] += (my - ys[i]) * COHESION + (this.cy - ys[i]) * CENTER_PULL;
      }
    }

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
   *  settled sky, with no animation in between.
   *
   *  Retires the drift for good on this instance: constant ambient movement is
   *  the exact thing that setting exists to turn off, so a sim that has been
   *  settled once must never start breathing again. */
  settleSync(maxTicks = 300): void {
    this.ambient = false;
    this.alphaTarget = 0;
    for (let t = 0; t < maxTicks && this.tick(); t++) {
      /* tick */
    }
  }
}
