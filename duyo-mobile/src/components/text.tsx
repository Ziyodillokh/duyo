import { forwardRef } from 'react';
import {
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
 * Import these instead of the ones from react-native. Everything else about
 * them — props, styles, `className` — is unchanged.
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
 * turn a weight into a family name. That happens in two places, and the split
 * is the only subtle thing here:
 *
 *   - `className="font-bold"` and friends are handled by the Tailwind plugin
 *     in tailwind.config.js, which makes every weight utility set the family
 *     as well as the weight. It has to be done there: NativeWind resolves
 *     className inside the element below, where this component cannot see it.
 *   - `style={{ fontWeight }}`, from a StyleSheet or inline, is handled here.
 *
 * So when a weight utility is present this component adds NOTHING, and lets
 * the class win. That is not just tidiness: NativeWind applies the `style`
 * prop AFTER className, so a family injected here would quietly beat the one
 * the class asked for, and every `font-bold` in the app would render regular.
 */

/** Matches a Tailwind weight utility, including a `dark:`/`sm:` prefixed one. */
const WEIGHT_CLASS =
  /(?:^|\s|:)font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)(?:\s|$)/;

/** One shared style object per family. There are four, and this component
 *  renders on the order of a thousand nodes a screen — handing React a
 *  freshly allocated `{ fontFamily }` each time would defeat the identity
 *  check it does before diffing styles at all. */
const FAMILY_STYLE: Record<string, TextStyle> = Object.fromEntries(
  Object.values(FONTS).map((family) => [family, { fontFamily: family }]),
);

function fontStyle(className: string | undefined, style: unknown) {
  if (className && WEIGHT_CLASS.test(className)) return null;
  // The overwhelmingly common case: no style at all, so nothing to flatten.
  if (style == null) return FAMILY_STYLE[FONTS[400]];
  const flat = StyleSheet.flatten(style as never) as TextStyle | undefined;
  return FAMILY_STYLE[familyForWeight(flat?.fontWeight)];
}

type Props = TextProps & { className?: string };

export const Text = forwardRef<RNTextType, Props>(function Text(
  { className, style, ...rest },
  ref,
) {
  return (
    <RNText
      ref={ref}
      className={className}
      // The family goes FIRST so a caller that sets its own still wins.
      style={[fontStyle(className, style), style]}
      {...rest}
    />
  );
});

type InputProps = TextInputProps & { className?: string };

export const TextInput = forwardRef<RNTextInputType, InputProps>(function TextInput(
  { className, style, ...rest },
  ref,
) {
  return (
    <RNTextInput
      ref={ref}
      className={className}
      style={[fontStyle(className, style), style]}
      {...rest}
    />
  );
});
