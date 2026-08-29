import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import type { Galaxy } from '@/lib/galaxy-layout';
import { GraphPhysics } from '@/lib/graph-physics';

/** Stable per-title number for the scatter order. */
function hashOf(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Deterministic scattered homes. The galaxy layout groups by connectivity —
 * linked notes ring their hub — but the sky is asked to read as ONE mixed
 * field, connected and unconnected planets shuffled together, with the
 * threads almost invisible until a selection reveals them. So bodies land on
 * an even golden-angle spiral in title-hash order: coverage is uniform, the
 * order is effectively random, and the same notebook scatters the same way
 * on every device. The hub stays at the centre — it is the sun.
 */
function scatterSeeds(
  galaxy: Galaxy,
  centralIndex: number,
): { x: number; y: number }[] {
  const { nodes, cx, cy } = galaxy;
  const order = nodes
    .map((n, i) => ({ i, h: hashOf(n.title) }))
    .sort((a, b) => a.h - b.h || a.i - b.i);
  const pos = new Array<{ x: number; y: number }>(nodes.length);
  // A tight cloud, not a full-canvas spread — cohesion holds the swarm close
  // and the seeds should already agree with it.
  const reach = Math.min(cx, cy) * 0.68;
  const rx = reach;
  const ry = reach * 1.15;
  const count = Math.max(1, nodes.length - (centralIndex >= 0 ? 1 : 0));
  let rank = 0;
  for (const { i } of order) {
    if (i === centralIndex) {
      pos[i] = { x: cx, y: cy };
      continue;
    }
    const u = (rank + 0.5) / count;
    const th = rank * 2.399963; // golden angle
    pos[i] = {
      x: cx + Math.cos(th) * rx * Math.sqrt(u),
      y: cy + Math.sin(th) * ry * Math.sqrt(u),
    };
    rank++;
  }
  return pos;
}

/**
 * How often the sky steps, and when it stops.
 *
 * Every step is a `setTick`, which is a full React render of the whole SVG
 * scene — react-native-svg elements are real views, and on Android the
 * canvas is re-rasterised into a bitmap each time. At 30 steps a second
 * with a few hundred planets that is the entire freeze the map suffers
 * from; the physics itself is not the expensive part.
 *
 * So the rate follows what is actually happening:
 *
 *  - SETTLING (the first ~90 steps after a build, or any step with a finger
 *    down) is the only time the layout genuinely moves, and it gets the full
 *    30 — this is the part a child watches.
 *  - DRIFTING afterwards is a slow ambient wander. At 8 steps a second it
 *    still reads as alive and costs a quarter as much.
 *  - SLEEPING: after 20 seconds untouched the loop parks completely. The
 *    sky is then a still picture costing nothing, and the first touch, a
 *    rebuild, or coming back to the screen wakes it.
 */
const FPS = 30;
const FRAME_MS = 1000 / FPS;

export interface GraphSim {
  /** Bumps on every physics step — reading it makes a component follow the sim. */
  tick: number;
  /** Live position for a node, by title. Null before layout has run. */
  positionOf(title: string): { x: number; y: number } | null;
  /**
   * Try to grab the body under the finger (canvas coordinates). Returns its
   * title, or null when the touch missed everything — the caller should treat
   * that as a canvas pan. No-op under "reduce motion", where the sky is a
   * still picture.
   */
  grabAt(x: number, y: number): string | null;
  dragTo(x: number, y: number): void;
  release(): void;
  reduceMotion: boolean;
  /** True once the physics has run out of energy and the loop has parked.
   *  Anything using `tick` as an animation clock must stop when this is
   *  set, or it will animate against a number that no longer moves. */
  resting: boolean;
}

/**
 * The brain map's live physics, as a hook.
 *
 * Owns the simulation loop: hot after anything changes, idling warm forever
 * after, hot again under a finger. The sky never stops moving, so this loop
 * runs for as long as the map is on screen and is parked when it is not.
 * Positions live in typed arrays inside `GraphPhysics`; `tick` is the only
 * React state, so a physics step costs exactly one render and nothing
 * re-mounts.
 *
 * Node positions survive a data refetch: when the galaxy is rebuilt (a note
 * was added, a link changed), every body that still exists starts from where
 * the child last saw it and only the newcomers swing into place. The map
 * stays "their" sky instead of reshuffling on every save.
 *
 * Under the OS "reduce motion" setting the same physics still decides the
 * layout — it runs to rest synchronously, with the drift retired, and renders
 * only the settled sky. Constant ambient movement is exactly what that
 * setting exists to turn off, and dragging is disabled with it: a drag's
 * whole feedback is motion.
 */
export function useGraphSim(
  galaxy: Galaxy | null,
  opts?: {
    /** Settle synchronously and never animate. For a thumbnail: the
     *  preview card is 330x230 and nobody watches it settle, so paying
     *  83 full re-rasterisations to show them is pure cost. */
    still?: boolean;
  },
): GraphSim {
  const still = opts?.still ?? false;
  const [tick, setTick] = useState(0);
  // The built the loop has finished for. A NEW built is by definition not
  // resting, so no reset-effect is needed — the derivation answers it.
  const [restingFor, setRestingFor] = useState<object | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [focused, setFocused] = useState(true);

  // The sky never settles, so nothing else would ever stop this loop. A tab
  // the child has navigated away from stays mounted, and a physics step per
  // frame behind another screen is battery spent on something nobody is
  // looking at.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  /** Where each body was last drawn, so a rebuilt galaxy keeps the sky. */
  const lastSeen = useRef(new Map<string, { x: number; y: number }>());

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (alive) setReduceMotion(on);
      })
      .catch(() => {
        // Unsupported platform: leave motion on rather than silently
        // disabling a feature over a query that never worked.
      });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (on: boolean) => setReduceMotion(on),
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const built = useMemo(() => {
    if (!galaxy || galaxy.nodes.length === 0) return null;

    const index = new Map<string, number>();
    galaxy.nodes.forEach((n, i) => index.set(n.title.toLowerCase(), i));

    const centralSeed = galaxy.nodes.findIndex((n) => n.ring === 0);
    const scattered = scatterSeeds(galaxy, centralSeed);
    const bodies = galaxy.nodes.map((n, i) => {
      const seen = lastSeen.current.get(n.title.toLowerCase());
      const seed = seen ?? scattered[i];
      return { x: seed.x, y: seed.y, r: n.r };
    });
    const links = galaxy.edges
      .map((e) => ({
        a: index.get(e.sourceTitle.toLowerCase()),
        b: index.get(e.targetTitle.toLowerCase()),
      }))
      .filter((l): l is { a: number; b: number } => l.a !== undefined && l.b !== undefined);

    const centralIndex = galaxy.nodes.findIndex((n) => n.ring === 0);
    const sim = new GraphPhysics(
      bodies,
      links,
      galaxy.cx,
      galaxy.cy,
      Math.max(0, centralIndex),
    );
    // Under reduce-motion the sky is a still picture: settle right here,
    // where the sim is born, so the first render already shows the settled
    // layout — no effect, no extra tick, no one-frame flash of the seeds.
    if (reduceMotion || still) sim.settleSync();
    return { sim, index, nodes: galaxy.nodes };
  }, [galaxy, reduceMotion, still]);

  // Remember where a retiring simulation left its bodies.
  useEffect(() => {
    if (!built) return;
    return () => {
      const store = lastSeen.current;
      built.nodes.forEach((n, i) => {
        store.set(n.title.toLowerCase(), { x: built.sim.xs[i], y: built.sim.ys[i] });
      });
    };
  }, [built]);

  const resting = built !== null && restingFor === built;

  useEffect(() => {
    if (!built || resting || reduceMotion || still || !focused) return;
    let frame: number | null = null;
    let last = 0;

    const loop = (now: number) => {
      if (now - last >= FRAME_MS) {
        last = now;

        if (built.sim.tick()) {
          setTick((t) => t + 1);
        } else {
          // The sole stop condition now. With the ambient drift retired,
          // alpha decays 0.92 per tick from 1, so tick() reports itself
          // done after 83 steps — 2.8 seconds — and after a drag release
          // (alpha 0.3) after 69. A held finger pins a body, which keeps
          // the bail from firing, so a drag never ends early.
          setRestingFor(built);
          return;
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [built, resting, reduceMotion, still, focused]);

  // Fresh object every render on purpose: consumers key their memoisation on
  // it, and a stable identity here would let a memo keep drawing a sky the
  // physics has already moved on from.
  return {
    tick,
    positionOf(title: string) {
      if (!built) return null;
      const i = built.index.get(title.toLowerCase());
      if (i === undefined) return null;
      return { x: built.sim.xs[i], y: built.sim.ys[i] };
    },
    grabAt(x: number, y: number) {
      if (!built || reduceMotion) return null;
      let best = -1;
      let bestD2 = Infinity;
      built.nodes.forEach((n, i) => {
        const hit = Math.max(n.r + 12, 24);
        const dx = built.sim.xs[i] - x;
        const dy = built.sim.ys[i] - y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= hit * hit && d2 < bestD2) {
          best = i;
          bestD2 = d2;
        }
      });
      if (best < 0) return null;
      built.sim.pin(best, built.sim.xs[best], built.sim.ys[best]);
      setRestingFor(null);
      return built.nodes[best].title;
    },
    dragTo(x: number, y: number) {
      built?.sim.movePin(x, y);
    },
    release() {
      built?.sim.release();
      // Wake it: the bodies have to settle back after a drag, and the
      // sleep timer restarts from here rather than from the build.
      setRestingFor(null);
    },
    reduceMotion,
    resting,
  };
}
