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

/** Frames per second while the simulation is warm.
 *
 *  Not 60: unlike a game, the sky only moves in bursts — a few seconds after
 *  opening, after a note changes, or under a finger — and 30 steps a second
 *  reads as fluid at these speeds while doing half the SVG work. When the
 *  system falls asleep this loop stops entirely, so the steady state costs
 *  nothing at all.
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
export function useGraphSim(galaxy: Galaxy | null): GraphSim {
  const [tick, setTick] = useState(0);
  const [resting, setResting] = useState(false);
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
    return { sim, index, nodes: galaxy.nodes };
  }, [galaxy]);

  // A new simulation starts warm; remember where the old one left its bodies.
  useEffect(() => {
    if (!built) return;
    setResting(false);
    return () => {
      const store = lastSeen.current;
      built.nodes.forEach((n, i) => {
        store.set(n.title.toLowerCase(), { x: built.sim.xs[i], y: built.sim.ys[i] });
      });
    };
  }, [built]);

  // Reduce motion: skip the animation, keep the layout the physics chooses.
  useEffect(() => {
    if (!built || !reduceMotion) return;
    built.sim.settleSync();
    setResting(true);
    setTick((t) => t + 1);
  }, [built, reduceMotion]);

  useEffect(() => {
    if (!built || resting || reduceMotion || !focused) return;
    let frame: number | null = null;
    let last = 0;

    const loop = (now: number) => {
      if (now - last >= FRAME_MS) {
        last = now;
        if (built.sim.tick()) {
          setTick((t) => t + 1);
        } else {
          // Only reachable with drift retired (reduce motion); a breathing
          // sky never reports itself done.
          setResting(true);
          return;
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [built, resting, reduceMotion, focused]);

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
      setResting(false);
      return built.nodes[best].title;
    },
    dragTo(x: number, y: number) {
      built?.sim.movePin(x, y);
    },
    release() {
      built?.sim.release();
    },
    reduceMotion,
  };
}
