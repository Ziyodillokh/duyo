import { rand01 } from '@/lib/seeded';

/**
 * The ambient sky's budget, in one place.
 *
 * Every layer here is its own SvgView, and an SvgView is its own Android
 * bitmap — so the constraint is AREA, not element count. Twelve 72pt clusters
 * are 12 x 216^2 x 4 = 2.24 MB on a 3x phone; one viewport-sized layer would
 * be 11.8 MB for the same job. The rule: an ambient layer is small or it does
 * not exist.
 *
 * All of it is O(1) in the notebook's size. A hundred and fifty notes get
 * exactly the same twelve clusters as three do, which is why none of this can
 * ever be what freezes the map.
 */
export const TWINKLE_CLUSTERS = 12;
export const CLUSTER_PT = 72;
const CLUSTER_STARS = 7;

/** How far an unlinked planet is willing to stray from its physics home. */
export const WANDER_REACH = 16;
/** And how many are allowed to. Four, whatever the notebook holds. */
export const WANDER_MAX = 4;
/** Below this many bodies nothing wanders: on a six-note sky four drifting
 *  planets is most of the map, and a wanderer is not draggable the ordinary
 *  way (see note-graph's landing path). */
export const WANDER_MIN_NODES = 8;
/** One lap. Slow enough that no one catches a planet moving, short enough
 *  that a child who stays on the map sees it somewhere else. */
export const WANDER_LAP_MS = 48000;

export interface Cluster {
  /** Top-left of this cluster's own canvas, in FIELD coordinates. */
  left: number;
  top: number;
  /** One <Path> `d` per brightness bucket, in cluster-local coordinates. */
  paths: string[];
  /** One full breath, and where in it this cluster starts. No two clusters
   *  share either, so the field never falls into step and the loop never
   *  becomes visible. */
  periodMs: number;
  delayMs: number;
  /** How dark it gets at the bottom of its breath. */
  floor: number;
}

/**
 * Where the twinkling clusters sit and what is in them.
 *
 * A golden-angle spiral over a disc covering the field — the same device the
 * physics seeds use — so coverage is even without a grid's visible rows, and
 * deterministic, so the sky twinkles identically on every device and every
 * launch.
 *
 * The disc's reach is measured off the SHORT side: the field is
 * `max(viewport, span)` per axis and those two are not equal, so a reach taken
 * from the width alone would push clusters off the top and bottom of a canvas
 * that is wider than it is tall.
 *
 * These are ADDITIONAL to the static starfield in the main canvas, not a
 * replacement for it: those four <Path>s are free and stay exactly as they
 * are. Twelve times seven is 84 stars that breathe over about a thousand that
 * do not, which is the ratio a real sky has.
 */
export function twinkleClusters(width: number, height: number): Cluster[] {
  const out: Cluster[] = [];
  const reach = Math.max(0, Math.min(width, height) / 2 - CLUSTER_PT);
  for (let c = 0; c < TWINKLE_CLUSTERS; c++) {
    const u = (c + 0.5) / TWINKLE_CLUSTERS;
    const th = c * 2.399963; // golden angle
    const cx = width / 2 + Math.cos(th) * reach * Math.sqrt(u);
    const cy = height / 2 + Math.sin(th) * reach * Math.sqrt(u);

    const buckets: string[][] = [[], [], []];
    for (let s = 0; s < CLUSTER_STARS; s++) {
      const k = c * 977 + s * 31;
      const x = rand01(k + 1) * CLUSTER_PT;
      const y = rand01(k + 2) * CLUSTER_PT;
      // A touch larger than the static field's 0.5..1.8: these are the stars
      // the eye is meant to catch.
      const r = 0.9 + rand01(k + 3) * 1.5;
      const b = Math.min(2, Math.floor(rand01(k + 4) * 3));
      buckets[b].push(
        `M ${x} ${y} m ${-r} 0 a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`,
      );
    }

    out.push({
      left: cx - CLUSTER_PT / 2,
      top: cy - CLUSTER_PT / 2,
      paths: buckets.filter((b) => b.length > 0).map((b) => b.join(' ')),
      // 2.6s to 6.2s. Below about two seconds a star reads as blinking, which
      // is an alarm; above seven it reads as nothing happening.
      periodMs: 2600 + Math.round(rand01(c * 5779 + 7) * 3600),
      delayMs: Math.round(rand01(c * 8191 + 11) * 3000),
      floor: 0.18 + rand01(c * 3301 + 5) * 0.3,
    });
  }
  return out;
}

/**
 * The ambient wander offset for a body, as a pure function of a 0..1 clock.
 *
 * Two integer harmonics per axis, so the path is a Lissajous figure that
 * CLOSES exactly at u = 1 — the repeating clock can restart without the body
 * jumping. Everything derives from the body's seed, so no two wander alike and
 * the same note wanders the same way forever.
 *
 * A worklet: the animated style calls it on the UI thread, and the pan gesture
 * calls it on the JS thread so a finger finds the planet where it is DRAWN
 * rather than where the physics parked it. Worklets are ordinary functions on
 * the JS side, so one definition serves both and they can never disagree.
 */
export function wanderAt(
  u: number,
  seed: number,
  reach: number,
): { x: number; y: number } {
  'worklet';
  const p = ((seed % 1000) / 1000) * Math.PI * 2;
  const kx = 1 + (seed % 2);
  const ky = 2 + ((seed >> 3) % 2);
  const t = u * Math.PI * 2;
  return {
    x: (0.7 * Math.sin(kx * t + p) + 0.3 * Math.sin(3 * t + p * 1.7)) * reach,
    y: (0.7 * Math.cos(ky * t + p * 1.3) + 0.3 * Math.cos(2 * t + p * 2.1)) * reach,
  };
}
