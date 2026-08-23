import { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { lift, type Lift } from '@/lib/glass';

/**
 * The frosted-glass surfaces the Miya page is built from.
 *
 * ## Why these are tokens and not inline styles
 *
 * The look only holds together if every surface agrees on ONE light source.
 * Neumorphism reads as plastic the moment two cards disagree about where the
 * light comes from, and that is exactly what happens when each screen invents
 * its own shadow. Here the light is always upper-left, so every raised surface
 * carries a white highlight up-left and a cool shadow down-right.
 *
 * ## Where the light itself comes from
 *
 * The shadows are lib/glass.ts, shared with the home dashboard, so the two
 * light screens agree about how high things sit. This file keeps the Miya
 * PALETTE — the deep accent, the dark sky card — because those are Miya's
 * and nothing else uses them.
 */

export const GLASS = {
  /** The page itself. */
  pageTop: '#EEF2FC',
  pageBottom: '#DFE7F7',

  /** Raised surfaces. */
  surface: 'rgba(255,255,255,0.74)',
  surfaceSoft: 'rgba(255,255,255,0.52)',
  /** The highlight edge, up-left, where the light hits. */
  edge: 'rgba(255,255,255,0.92)',
  /** The cool shadow colour this page was built around. The shadows
   *  themselves come from lib/glass.ts now; this stays for anything that
   *  needs to tint against the same shade. */
  shade: '#A9B8D8',

  /** The dark sky card, the one place this page is not light. */
  sky: '#0A1024',

  /** Ink. A near-black with a blue bias — a neutral grey would read as dirty
   *  against a palette this cool. */
  ink: '#1B2540',
  muted: '#78879F',

  /** The accent. DUYO's #60A5FA is built for a dark ground and washes out on
   *  a light one, so the page uses the same hue several steps deeper while
   *  the sky card keeps the original. */
  blue: '#2450F0',
  blueSoft: '#5B7DF7',
} as const;

/**
 * Soft shadow for a raised glass surface.
 *
 * This used to be one iOS shadow and, on Android, a bare `elevation: 2` —
 * a grey rectangle with no colour control, accepted because `shadow*` gives
 * only one layer per view. `boxShadow` lifted that limit on both platforms,
 * so Miya now gets the same contact-plus-ambient pair as the dashboard and
 * Android stops being the flat version of the design.
 */
export function raised(strength: Lift = 'md'): ViewStyle {
  return { boxShadow: lift(strength) };
}

export function GlassCard({
  children,
  style,
  radius = 24,
  soft = false,
  strength = 'md',
}: {
  children?: ReactNode;
  style?: ViewStyle;
  radius?: number;
  /** A surface sitting INSIDE another glass card — lighter, less lifted. */
  soft?: boolean;
  strength?: 'sm' | 'md' | 'lg';
}) {
  return (
    <View
      style={[
        {
          borderRadius: radius,
          backgroundColor: soft ? GLASS.surfaceSoft : GLASS.surface,
          borderWidth: 1,
          borderColor: GLASS.edge,
        },
        raised(soft ? 'sm' : strength),
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A round glass control — the avatar and bell in the header, the info dot. */
export function GlassCircle({
  size = 52,
  children,
  style,
}: {
  size?: number;
  children?: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: GLASS.surface,
          borderWidth: 1,
          borderColor: GLASS.edge,
        },
        raised('sm'),
        style,
      ]}
    >
      {children}
    </View>
  );
}
