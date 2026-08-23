import { type ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';

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
 * ## Why the shadow is split in two on iOS and flat on Android
 *
 * React Native gives one shadow per view on iOS and only `elevation` on
 * Android, which is always a grey drop-shadow with no colour control and no
 * highlight. Rather than fake a second layer with nested Views on every card
 * — which doubles the view count on the cheapest phones — Android gets a
 * slightly stronger border instead. It reads as glass without the cost.
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
  /** The cool shadow, down-right, where it does not. */
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

/** Soft shadow for a raised glass surface. */
export function raised(strength: 'sm' | 'md' | 'lg' = 'md'): ViewStyle {
  const depth = { sm: 6, md: 14, lg: 22 }[strength];
  if (Platform.OS === 'android') {
    // No coloured shadow available; the border carries the edge instead.
    return { elevation: strength === 'sm' ? 1 : 2 };
  }
  return {
    shadowColor: GLASS.shade,
    shadowOffset: { width: 0, height: depth * 0.42 },
    shadowOpacity: 0.34,
    shadowRadius: depth,
  };
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
