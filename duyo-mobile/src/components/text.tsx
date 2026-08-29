import { forwardRef } from 'react';
import {
  Platform,
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInput as RNTextInputType,
  type TextProps,
  type TextStyle,
  type TextInputProps,
  type Text as RNTextType,
} from 'react-native';

import { familyForWeight, FONTS } from '@/lib/fonts';

/**
 * `Text` and `TextInput`, in the app's typeface.
 *
 * Import these instead of the ones from react-native.
 *
 * ## Why a wrapper and not a global default
 *
 * React Native has no global text style. `Text` inherits only from a parent
 * `Text`, never from a `View`, so there is no root to set a typeface on, and
 * `Text.defaultProps` — the old trick — stopped being read when React 19
 * dropped defaultProps for function components. A wrapper is the remaining
 * way to say "all text, everywhere" once instead of at 731 call sites.
 *
 * ## How the weight finds its font
 *
 * Each Inter weight is its own family (see lib/fonts.ts), so something has to
 * turn a weight into a family name. That happens here, from the `fontWeight`
 * in the style.
 *
 * This used to be split in two: a `className` path, where the Tailwind plugin
 * set the family alongside the weight, and this one. The className path is
 * gone with the last of nativewind — nothing in the app passes one any more —
 * and losing it removes a regex test from every text node the app renders,
 * which at roughly a thousand nodes a screen is not nothing.
 */

/** One shared style object per family. There are four, and this component
 *  renders on the order of a thousand nodes a screen — handing React a
 *  freshly allocated `{ fontFamily }` each time would defeat the identity
 *  check it does before diffing styles at all. */
const FAMILY_STYLE: Record<string, TextStyle> = Object.fromEntries(
  Object.values(FONTS).map((family) => [family, { fontFamily: family }]),
);

/**
 * Android only: neutralise the numeric weight AFTER the caller sets it.
 *
 * Each family here holds exactly one face, so the weight is already in the
 * NAME — `Inter_700Bold` is bold because of what it is, not because of a
 * `fontWeight` beside it. Android does not see it that way. ReactFontManager
 * resolves (family, style, weight) together and, asked for the bold slot of a
 * family registered with a single normal-slot face, finds nothing and falls
 * back to Roboto — so the heaviest text in the app renders in the system
 * typeface while everything around it is Inter.
 *
 * iOS resolves the family by name and is not affected, so it is left alone:
 * overriding a caller's weight globally is a change this has no evidence
 * for on that platform, and the cost of being wrong is every bold word in
 * the app.
 */
const ANDROID_WEIGHT: TextStyle | null =
  Platform.OS === 'android' ? { fontWeight: 'normal' } : null;

function fontStyle(style: unknown) {
  // The overwhelmingly common case: no style at all, so nothing to flatten.
  if (style == null) return FAMILY_STYLE[FONTS[400]];
  const flat = StyleSheet.flatten(style as never) as TextStyle | undefined;
  return FAMILY_STYLE[familyForWeight(flat?.fontWeight)];
}

export const Text = forwardRef<RNTextType, TextProps>(function Text(
  { style, ...rest },
  ref,
) {
  return (
    <RNText
      ref={ref}
      // The family goes FIRST so a caller that sets its own still wins;
      // the Android weight reset goes LAST because it has to beat the
      // caller's numeric weight, which is what breaks the lookup.
      style={[fontStyle(style), style, ANDROID_WEIGHT]}
      {...rest}
    />
  );
});

export const TextInput = forwardRef<RNTextInputType, TextInputProps>(
  function TextInput({ style, ...rest }, ref) {
    return (
      <RNTextInput
        ref={ref}
        style={[fontStyle(style), style, ANDROID_WEIGHT]}
        {...rest}
      />
    );
  },
);
