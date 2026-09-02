import { useEffect, useMemo, useRef, useState } from 'react';
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
 * Why the sky no longer has a clock.
 *
 * This used to step the physics on a 30fps `requestAnimationFrame` loop, and
 * every step was a `setTick` — a full React render of the whole SVG scene.
 * react-native-svg elements are real native views, and on Android the canvas
 * is re-rasterised into one bitmap whenever any child changes, so a step cost
 * a repaint of the entire sky. Opening the map ran 83 of those before the
 * physics ran out of energy (alpha decays 0.92 per tick from 1), and every
 * drag release ran 69 more. That was the freeze: not the physics, which is
 * six typed arrays and finishes in milliseconds, but the 83 repaints.
 *
 * So the physics now runs to rest SYNCHRONOUSLY and React hears about it
 * once. `version` bumps when the settled layout actually changes — a build,
 * a drag release — and never on a timer. What used to be 83 renders is one.
 *
 * The one thing that genuinely needs a clock is the drag itself: a finger
 * moving a planet has to see it move. That gets a loop, but only while the
 * finger is down, and at {@link DRAG_FPS} rather than 30 — bounded by an
 * interaction the child is actively performing, instead of running on its
 * own the moment the screen opens.
 */
const DRAG_FPS = 20;
const DRAG_FRAME_MS = 1000 / DRAG_FPS;

export interface GraphSim {
  /**
   * Bumps when the settled sky CHANGES — a rebuild, a drag step, a release.
   * This is a version, not a clock: it does not advance on its own, so a memo
   * keyed on it rebuilds exactly as often as the layout actually moves.
   */
  version: number;
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
  /** True whenever no finger is dragging a body — which, with the settle now
   *  synchronous, is every moment except an active drag. */
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
  const [version, setVersion] = useState(0);
  /** Non-null only while a finger holds a body. Doubles as the drag flag. */
  const [dragging, setDragging] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

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
    // Always, not just under reduce-motion. The settle is the same work
    // either way — 83 steps over six typed arrays — and doing it here costs
    // one render instead of 83, because nothing between the first step and
    // the last is ever painted. What the child used to watch was not the
    // physics finding its shape; it was the sky stuttering while it did.
    sim.settleSync();
    return { sim, index, nodes: galaxy.nodes };
  }, [galaxy]);

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

  // No version bump for a build, deliberately. `built` is rebuilt only when
  // `galaxy` changes, and every consumer already keys on `galaxy` — so the
  // rebuild is announced by the same render that caused it. `version` is
  // therefore only ever moved by a drag, which is the one thing that changes
  // positions without changing the galaxy.

  // The only loop left, and it exists solely so a dragged planet follows the
  // finger. It runs while `dragging` and stops the moment the touch ends —
  // there is no path by which it starts on its own.
  useEffect(() => {
    if (!dragging || !built) return;
    let frame: number | null = null;
    let last = 0;

    const loop = (now: number) => {
      if (now - last >= DRAG_FRAME_MS) {
        last = now;
        built.sim.tick();
        setVersion((v) => v + 1);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [dragging, built]);

  // Stable identity, unlike the object this used to return fresh on every
  // render. Nothing ever keyed a memo on the object — consumers read
  // `version` and `resting`, which are primitives — so the instability bought
  // nothing and cost every downstream memo its bail-out.
  return useMemo<GraphSim>(
    () => ({
      version,
      positionOf(title: string) {
        if (!built) return null;
        const i = built.index.get(title.toLowerCase());
        if (i === undefined) return null;
        return { x: built.sim.xs[i], y: built.sim.ys[i] };
      },
      grabAt(x: number, y: number) {
        // `still` is the thumbnail: it is 330x230 and nobody drags it, so it
        // never starts the one loop that is left.
        if (!built || reduceMotion || still) return null;
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
        setDragging(true);
        return built.nodes[best].title;
      },
      dragTo(x: number, y: number) {
        // No setState: the drag loop is already running and will pick the new
        // pin position up on its next step. Bumping here as well would put a
        // render on every gesture event, which is the 60fps this change
        // exists to remove.
        built?.sim.movePin(x, y);
      },
      release() {
        setDragging(false);
        if (!built) return;
        built.sim.release();
        // The bodies have to settle back after a drag — 69 steps of it.
        // Synchronously, so the child sees the answer rather than the
        // arithmetic.
        built.sim.settleSync();
        setVersion((v) => v + 1);
      },
      reduceMotion,
      // With the settle synchronous there is no "still cooling" state left to
      // describe: the sky is at rest except while a finger is on it.
      resting: !dragging,
    }),
    [built, version, dragging, reduceMotion, still],
  );
}
