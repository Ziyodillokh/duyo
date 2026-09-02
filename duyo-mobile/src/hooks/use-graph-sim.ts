import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { FIELD_PAD, galaxyRadius, type Galaxy } from '@/lib/galaxy-layout';
import { GraphPhysics, type SettleFilm } from '@/lib/graph-physics';
import { hash32 } from '@/lib/seeded';

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
    .map((n, i) => ({ i, h: hash32(n.title) }))
    .sort((a, b) => a.h - b.h || a.i - b.i);
  const pos = new Array<{ x: number; y: number }>(nodes.length);
  // Seeds land at a fraction of the size the physics will settle to, and the
  // fraction is what decides whether the settle is worth watching.
  //
  // `reach` used to be 0.68 * min(cx, cy) — about 133pt on a phone, whatever
  // the notebook held — so a hundred bodies were seeded inside a disc a third
  // the width of the cloud they were headed for, and the settle's whole job
  // became inflating a balloon on an alpha budget that runs out in 83 steps.
  //
  // But seeding AT the answer has the opposite failure, and it bites at the
  // size most notebooks actually are. A golden-angle spiral at the right
  // radius is already almost the settled arrangement when there are few
  // bodies and few links for the springs to argue about: measured, ten notes
  // moved 17pt in total, which over sixteen painted frames is one point a
  // frame and reads as nothing happening at all.
  //
  // So the fraction follows the count. A small sky is seeded tight and the
  // child watches it open; a large one is seeded near its answer, where the
  // settle has real work — untangling neighbours — and an expansion on top of
  // that would only look like chaos.
  const n = nodes.length;
  const closeness = 0.55 + 0.37 * Math.min(1, Math.max(0, (n - 12) / 68));
  const reach = Math.max(40, galaxyRadius(n) * closeness);
  const rx = reach;
  const ry = reach;
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
 * Why the sky no longer has a clock the physics runs on.
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
 * So the physics runs to rest SYNCHRONOUSLY, and the two numbers that loop had
 * welded together come apart: the layout still takes 83 steps, and the sky is
 * repainted sixteen times, because what is animated is a RECORDING of the
 * settle rather than the settle itself. See {@link SETTLE_MS}. `version` bumps
 * when the drawn sky changes — a playback frame, a drag step, a release — and
 * never on a timer of the physics' own.
 *
 * The one thing that genuinely needs the physics on a clock is the drag
 * itself: a finger moving a planet has to see its neighbours respond. That
 * gets a loop, but only while the finger is down, and at {@link DRAG_FPS}
 * rather than 30 — bounded by an interaction the child is actively
 * performing, instead of running on its own the moment the screen opens.
 */
const DRAG_FPS = 20;
const DRAG_FRAME_MS = 1000 / DRAG_FPS;

/**
 * The opening settle, played back rather than simulated.
 *
 * The physics still runs to rest synchronously in a few milliseconds. What is
 * animated is a RECORDING of it, and that is the whole trick: the layout needs
 * 83 steps, the sky gets repainted 16 times, and the JS thread does nothing
 * between frames but read an offset into a Float32Array. What used to be 83
 * full repaints is 16.
 *
 * Playback is driven by the WALL CLOCK, not by a frame counter. A phone that
 * can only paint six of the sixteen frames still finishes in 1.1 seconds — the
 * animation gets chunkier, never longer, which is the failure mode you want.
 *
 * Exported because the camera's fit glides over exactly this long, so the sky
 * and the view it is seen through arrive together.
 */
export const SETTLE_MS = 1100;
/** A drag release is a smaller settle and the child is still holding the
 *  phone from the gesture — it should feel like a recoil, not a title card. */
const RELEASE_MS = 420;
/**
 * 15fps. Twelve is the real floor — classic animation runs on twos at 24fps,
 * i.e. twelve distinct drawings a second, and below about ten continuous
 * translation reads as stepping rather than motion. There is no motion blur
 * here to help, so 15 buys a margin for one dropped frame without falling
 * through it.
 */
const SETTLE_FPS = 15;
const SETTLE_FRAME_MS = 1000 / SETTLE_FPS;

/** Wall-clock progress -> position in the film, as a FRACTIONAL frame.
 *
 *  A settle does most of its moving in the first handful of steps and shuffles
 *  for the rest, so reading the film at a constant rate would show the galaxy
 *  snapping into place in the first fifth of a second and then a second of
 *  nothing. The film carries the curve it has to be read on — the fraction of
 *  its whole travel done by each frame — so this is a lookup, and the
 *  displayed motion comes out even however the physics behaved. Late frames
 *  advance ten steps at a time.
 *
 *  Fractional, and read by interpolating between the two frames it lands
 *  between, because at the other end the correction runs out of film: the
 *  first few steps of a hundred-body settle each carry more than a sixteenth
 *  of the whole travel, so a whole-frame lookup would hold the same drawing
 *  for two or three of the sixteen paintings and then jump. Half a step of
 *  linear interpolation costs a multiply per body and buys back the smooth
 *  half of the animation. */
function filmAt(u: number, film: SettleFilm): number {
  const last = film.frames - 1;
  if (u >= 1) return last;
  for (let f = 1; f <= last; f++) {
    if (film.progress[f] < u) continue;
    const span = film.progress[f] - film.progress[f - 1];
    return span > 0 ? f - 1 + (u - film.progress[f - 1]) / span : f;
  }
  return last;
}

export interface GraphSim {
  /**
   * Bumps when the settled sky CHANGES — a rebuild, a drag step, a release.
   * This is a version, not a clock: it does not advance on its own, so a memo
   * keyed on it rebuilds exactly as often as the layout actually moves.
   */
  version: number;
  /** Live position for a node, by title — the film's frame while the settle is
   *  playing back, the simulation's own arrays otherwise. Null before layout
   *  has run. */
  positionOf(title: string): { x: number; y: number } | null;
  /** Where a body will COME TO REST, ignoring any settle in progress. The
   *  camera fits to this, so it lands on the answer at frame zero instead of
   *  chasing the sky across the second it takes to arrive. */
  settledPositionOf(title: string): { x: number; y: number } | null;
  /**
   * Try to grab the body under the finger (canvas coordinates). Returns its
   * title, or null when the touch missed everything — the caller should treat
   * that as a canvas pan. No-op under "reduce motion", where the sky is a
   * still picture.
   */
  grabAt(x: number, y: number): string | null;
  /**
   * Grab a body BY TITLE, pinning it at a point the caller supplies rather
   * than at the physics position.
   *
   * This exists for the wanderers. A drifting planet is drawn up to sixteen
   * points from where the simulation thinks it is, so the ordinary
   * position-based `grabAt` would either miss it or snap it back. Pinning it
   * where it was drawn hands it to the physics with no jump at all, and from
   * that moment it is an ordinary planet.
   */
  grabTitleAt(title: string, x: number, y: number): boolean;
  dragTo(x: number, y: number): void;
  release(): void;
  reduceMotion: boolean;
  /** True while a recorded settle is being played back. The view uses it to
   *  hold back the names and the touch targets — neither means anything on a
   *  body still in flight, and both are the dearest elements in the frame. */
  settling: boolean;
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
    /** Whether this scene is small enough to repaint sixteen times in a
     *  second. The caller counts it — see lib/scene-cost. False falls back to
     *  the whole-canvas reveal, which costs no SVG repaints at all. */
    canAnimate?: boolean;
  },
): GraphSim {
  const still = opts?.still ?? false;
  const canAnimate = opts?.canAnimate ?? true;
  const [version, setVersion] = useState(0);
  /** Non-null only while a finger holds a body. Doubles as the drag flag. */
  const [dragging, setDragging] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  /** Which build has already had its opening settle played, so a re-render —
   *  or reduce-motion resolving a tick or two after mount — can never replay
   *  it. Set from the playback loop, or by a finger that beats it. */
  const [opened, setOpened] = useState<object | null>(null);
  /** A drag release records its own, shorter film. */
  const [releaseFilm, setReleaseFilm] = useState<SettleFilm | null>(null);
  /** Where in the film the sky is, as a fractional frame — or -1 for "at rest,
   *  positions come from the simulation's own arrays". */
  const [frameAt, setFrameAt] = useState(-1);

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
      // The field is square-ish and centred on the galaxy, so either half-span
      // works; the short one is the one that can clip.
      Math.min(galaxy.cx, galaxy.cy) - FIELD_PAD,
    );
    // Settled here, as before, and for the same reason: nothing between the
    // first step and the last is ever painted, so doing it inline costs one
    // render instead of 83. The film is the difference — it is what the
    // playback loop below shows, so the child watches the galaxy find its
    // shape without the sky being simulated per frame to do it.
    const film = sim.settleFilm();
    return { sim, index, nodes: galaxy.nodes, film };
  }, [galaxy]);

  /**
   * The film currently on screen, if any.
   *
   * Derived rather than stored, so that reduce-motion arriving late — it
   * resolves a tick or two after mount — simply removes the flight and cuts to
   * the settled sky the simulation arrays already hold, with no effect having
   * to reach in and stop anything.
   */
  const opening =
    built && opened !== built && canAnimate && !reduceMotion && !still
      ? built.film
      : null;
  const film = (reduceMotion || still ? null : releaseFilm) ?? opening;
  const ms = releaseFilm ? RELEASE_MS : SETTLE_MS;

  // Playback. A frame is an offset into a Float32Array and a state bump; the
  // physics is long finished. Wall-clock driven, so a phone that cannot paint
  // fifteen frames a second drops frames instead of stretching the settle.
  useEffect(() => {
    if (!film) return;
    let raf: number | null = null;
    let started = -1;
    let last = -Infinity;

    const step = (now: number) => {
      if (started < 0) started = now;
      const u = Math.min(1, (now - started) / ms);
      const done = u >= 1;
      if (done || now - last >= SETTLE_FRAME_MS) {
        last = now;
        setFrameAt(done ? -1 : filmAt(u, film));
        setVersion((v) => v + 1);
      }
      if (done) {
        setReleaseFilm(null);
        setOpened(built);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [film, ms, built]);

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
        if (film && frameAt >= 0 && i < film.n) {
          const f0 = Math.floor(frameAt);
          const f1 = Math.min(film.frames - 1, f0 + 1);
          const t = frameAt - f0;
          const a = f0 * film.n * 2 + i * 2;
          const b = f1 * film.n * 2 + i * 2;
          return {
            x: film.xy[a] + (film.xy[b] - film.xy[a]) * t,
            y: film.xy[a + 1] + (film.xy[b + 1] - film.xy[a + 1]) * t,
          };
        }
        return { x: built.sim.xs[i], y: built.sim.ys[i] };
      },
      settledPositionOf(title: string) {
        if (!built) return null;
        const i = built.index.get(title.toLowerCase());
        return i === undefined ? null : { x: built.sim.xs[i], y: built.sim.ys[i] };
      },
      grabAt(x: number, y: number) {
        // `still` is the thumbnail: it is 330x230 and nobody drags it, so it
        // never starts the one loop that is left.
        if (!built || reduceMotion || still) return null;
        // A finger beats a title sequence: the grab takes over the real sky,
        // which the simulation arrays already hold.
        setOpened(built);
        setReleaseFilm(null);
        setFrameAt(-1);
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
      grabTitleAt(title: string, x: number, y: number) {
        if (!built || reduceMotion || still) return false;
        const i = built.index.get(title.toLowerCase());
        if (i === undefined) return false;
        setOpened(built);
        setReleaseFilm(null);
        setFrameAt(-1);
        // Where it was DRAWN becomes where it is. The bodies around it will
        // find the new arrangement on the drag's own loop.
        built.sim.xs[i] = x;
        built.sim.ys[i] = y;
        built.sim.pin(i, x, y);
        setDragging(true);
        return true;
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
        // The bodies have to settle back after a drag — 69 steps of it. The
        // child gets to watch the constellation relax instead of seeing it
        // teleport, and it costs six repaints.
        built.sim.release();
        if (canAnimate && !reduceMotion && !still) {
          // Frame zero here rather than from the loop's first tick: the labels
          // and the touch targets have to be gone in the SAME commit the drag
          // ends in, or they blink out a frame into the flight.
          setReleaseFilm(built.sim.settleFilm());
          setFrameAt(0);
        } else {
          built.sim.settleSync();
        }
        setVersion((v) => v + 1);
      },
      reduceMotion,
      settling: film !== null,
      // `resting` stays TRUE through a playback: nothing is being dragged, and
      // the camera fit is gated on it and must fire at the START of the settle
      // — it fits to `settledPositionOf`, which is already final — rather than
      // a second after it.
      resting: !dragging,
    }),
    [built, version, dragging, reduceMotion, still, film, frameAt, canAnimate],
  );
}
