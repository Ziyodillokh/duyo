import type { Galaxy } from '@/lib/galaxy-layout';

/**
 * What the sky costs to repaint, counted in native views.
 *
 * Android rasterises an SvgView's children into one bitmap and repaints all
 * of it when any child changes, so the only thing that decides whether the
 * settle can be ANIMATED is how many elements a frame has to repaint. This
 * counts them exactly, off the same branches note-graph.tsx renders.
 */

/** 47 <Defs> children + 4 star paths. Paid once whatever the notebook holds.
 *
 *  The sun's glow gradient and its three stops moved to sky-ambient.tsx, where
 *  they are rasterised once into a canvas of their own. Counted as gone
 *  unconditionally: the still paths (a thumbnail, reduce-motion) keep the glow
 *  in this canvas, but neither of them animates a settle, so the only number
 *  this count ever decides is the one for the animated case. */
const FIXED = 51;
/** <G> + the core circle. The glow is a separate canvas now. */
const SUN = 2;
const TAG_STAR = 5;
const UNWRITTEN = 1;
const FLAT_PLANET = 2;
const DETAILED_PLANET = 13;

/**
 * Below this drawn radius a planet is one flat disc instead of a shaded
 * sphere.
 *
 * A full planet is about thirteen SVG elements: a Defs, a ClipPath, the
 * albedo, the surface features, the night side, a specular highlight and a
 * rim light. At 8px across on a 2x screen the whole body is sixteen device
 * pixels — the terminator, the highlight and the features are each well
 * under one pixel and average into the same colour the albedo already is.
 * The detail is not lost at this size; it was never visible.
 *
 * It lives here rather than in the renderer so the renderer and the cost
 * model can never drift apart.
 */
export const PLANET_DETAIL_ABOVE = 8;

/**
 * The element budget for one frame of an ANIMATED settle.
 *
 * Measured: the old 83-render freeze was ~3000ms over a ~485-element scene,
 * so a render-plus-repaint costs about 0.074ms an element on the phone that
 * showed it. A settle frame is allowed 40ms — under the ~50ms where a touch
 * starts feeling late, and 60% duty against the 66ms playback interval — which
 * is 540 elements. 480 leaves a margin for a slower device.
 *
 * Labels and touch targets are excluded from the count on purpose: neither is
 * drawn while the sky is in flight (you cannot read a moving name or tap a
 * planet that has not landed), which is most of what buys N=100 its animation.
 */
export const ANIMATED_SETTLE_MAX_ELEMENTS = 480;

/** Native views in one repaint of the sky. `withLabels` false is the settle. */
export function sceneElements(
  galaxy: Galaxy,
  withLabels: boolean,
  labels: number,
  /** Unlinked bodies lifted out into their own drifting canvases. Each takes
   *  a flat planet off this count — the main sky is cheaper for having them. */
  lifted = 0,
): number {
  let total = FIXED + galaxy.edges.length;
  for (const n of galaxy.nodes) {
    if (n.ring === 0) {
      total += SUN;
      continue;
    }
    if (n.kind === 'tag') total += TAG_STAR;
    else if (n.kind === 'unwritten') total += UNWRITTEN;
    else {
      total +=
        Math.max(5.5, n.r * 0.74) < PLANET_DETAIL_ABOVE
          ? FLAT_PLANET
          : DETAILED_PLANET;
    }
  }
  return (withLabels ? total + labels : total) - lifted * FLAT_PLANET;
}
