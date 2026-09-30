/**
 * PALETTE, handed to CSS.
 *
 * The page's stylesheet (page.css) never writes a hex of its own: it reads
 * these custom properties, which are set once on the page root from the same
 * PALETTE object the 3D modules use. Change a brand colour in contract.ts and
 * the copy, the chrome and the galaxy all move together.
 */

import type { CSSProperties } from 'react';
import { PALETTE } from '../scene/contract';

export const paletteVars = {
  '--c-paper': PALETTE.paper,
  '--c-space': PALETTE.space,
  '--c-navy': PALETTE.navy,
  '--c-blue': PALETTE.blue,
  '--c-blue-bright': PALETTE.blueBright,
  '--c-sky': PALETTE.sky,
  '--c-white': PALETTE.white,
} as CSSProperties;

/** Above this darkness the chrome switches to its on-dark treatment. */
export const DARK_CHROME_AT = 0.5;
