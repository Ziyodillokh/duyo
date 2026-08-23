import type { ViewStyle } from 'react-native';

/**
 * The light DUYO surfaces — one light source for every glass pane in the app.
 *
 * ## Why a shared ladder instead of a shadow per screen
 *
 * Three screens had each grown their own `glass()` helper, and all three cast
 * the SAME shadow on everything they drew: a 56pt icon well, a stat tile and
 * the hero card were all `0 16px 34px`. That single fact is what made the
 * glass read as computer-generated. Depth is not a texture you apply, it is a
 * RATIO the eye measures between objects — when a chip and a hero card cast
 * identical shadows, the eye is told they are the same height off the page,
 * and a screen where nothing is nearer than anything else looks printed.
 *
 * ## Why every level is two shadows
 *
 * Real light puts two shadows under an object at once:
 *
 *   - a CONTACT shadow — tight, barely offset, comparatively dark. It is what
 *     says the object touches the page here and not two centimetres away.
 *   - an AMBIENT shadow — wide, soft, faint. Skylight wrapping around the
 *     object from every direction.
 *
 * Their ratio is the height cue. One blurred rectangle has no ratio in it, so
 * it reads as a grey smear that someone drew under a box — the default look of
 * every framework's `shadow: md`. Doubling up costs one more comma.
 *
 * ## Why the shadows are blue and not grey
 *
 * A shadow is not "less light", it is light of a different colour: the sky
 * fills it. On this pale blue page a neutral grey shadow looks like dirt on
 * the glass. Every level therefore tints with {@link TINT}, a desaturated
 * navy that belongs to the same family as the background gradient.
 *
 * ## Why `boxShadow` and not `shadow*` / `elevation`
 *
 * `shadowColor` and friends give exactly ONE shadow per view on iOS, and
 * Android used to have only `elevation` — a grey drop with no colour control,
 * which is why the older code shipped a deliberately flatter Android look.
 * Under the New Architecture (RN 0.85 here) `boxShadow` takes a comma-
 * separated list on both platforms and on web, so the same two-layer ladder
 * renders everywhere and the Android compromise is gone.
 */

/** The colour the sky fills shadows with, as bare `r,g,b` for interpolation. */
export const TINT = '70,108,168';

/**
 * How far off the page a surface sits.
 *
 * Pick by what the thing IS, not by how big it is: an icon well inside a card
 * is `sm` however wide it gets, because it belongs to the card it sits on.
 *
 * - `flush` — drawn on another glass surface; edges only, no shadow. A pane
 *   that casts a shadow onto the pane it is part of is the tell that a design
 *   is stacking styles rather than modelling depth.
 * - `sm` — chips, icon wells, inline controls. Resting on the page.
 * - `md` — cards and standalone buttons. The default.
 * - `lg` — the one hero object a screen leads with.
 * - `xl` — chrome floating OVER the content: the dock, a sheet.
 */
export type Lift = 'flush' | 'sm' | 'md' | 'lg' | 'xl';

/** [contact y, contact blur, contact alpha, ambient y, ambient blur, ambient alpha] */
const LADDER: Record<Exclude<Lift, 'flush'>, [number, number, number, number, number, number]> = {
  sm: [1, 2, 0.10, 3, 8, 0.12],
  md: [2, 4, 0.10, 10, 20, 0.16],
  lg: [3, 6, 0.10, 20, 40, 0.18],
  xl: [4, 8, 0.10, 28, 56, 0.20],
};

/**
 * The two inner edges that give a pane thickness.
 *
 * The bright line along the top is the light catching the pane's near edge;
 * the faint tinted line along the bottom is its far edge falling into shade.
 * Together they are what separates "a pane of glass" from "a white rectangle
 * at 55% opacity" — and they cost nothing, because they ride in the same
 * `boxShadow` list as the drop shadows.
 *
 * Kept as insets rather than as per-side `borderTopColor`/`borderBottomColor`:
 * per-side border colours blend unpredictably through a large `borderRadius`
 * on Android, and the corners are exactly where a glass edge is most visible.
 */
const EDGES = `inset 0 1.5px 0 rgba(255,255,255,0.92), inset 0 -1px 0 rgba(${TINT},0.10)`;

/**
 * The shadow list for one height off the page.
 *
 * Use when you only want the light and are styling the surface yourself —
 * {@link glass} is the whole material.
 */
export function lift(level: Lift = 'md'): string {
  if (level === 'flush') return EDGES;
  const [cy, cb, ca, ay, ab, aa] = LADDER[level];
  return (
    `0 ${cy}px ${cb}px rgba(${TINT},${ca}), ` +
    `0 ${ay}px ${ab}px rgba(${TINT},${aa}), ` +
    EDGES
  );
}

/**
 * A pane of frosted glass.
 *
 * @param radius corner radius; there is no default because the radius is what
 *   makes a pane read as a chip, a card or a sheet, and a wrong one silently
 *   changes what the object appears to be.
 * @param level  how high it sits — see {@link Lift}.
 * @param fill   white alpha of the pane. The default suits the pale blue
 *   pages; a pane over a dark ground wants a lower one.
 */
export function glass(radius: number, level: Lift = 'md', fill = 0.55): ViewStyle {
  return {
    backgroundColor: `rgba(255,255,255,${fill})`,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    boxShadow: lift(level),
  };
}
