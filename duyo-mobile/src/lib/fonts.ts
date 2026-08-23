import type { TextStyle } from 'react-native';

/**
 * Inter, in the four weights the design uses.
 *
 * ## Why the app ships a typeface at all
 *
 * It used to ship none, so text rendered in SF Pro on iOS and Roboto on
 * Android — two different typefaces with different widths, different digits
 * and different ideas of how heavy "semibold" is. A layout tuned on one is
 * wrong on the other, and no mock can match both.
 *
 * ## Why each weight is its OWN family name
 *
 * The obvious arrangement — one family called `Inter`, weight chosen with
 * `fontWeight` — does not survive contact with the two platforms.
 *
 * Google's static Inter files disagree about their own names: the 400 and 700
 * files both report the family `Inter`, but the 500 reports `Inter Medium`
 * and the 600 reports `Inter SemiBold` (their typographic family is `Inter`,
 * which only some text engines read). Embed them with the expo-font config
 * plugin and iOS takes those names literally, so `fontFamily: 'Inter'` knows
 * about Regular and Bold and nothing else: ask it for 600 and it hands back
 * Bold, which is precisely the collapsed hierarchy we set out to fix.
 *
 * Loading them at runtime instead lets US name the families, and the name we
 * pass is the name BOTH platforms use. So there are four families, each
 * holding exactly one face, and nothing has to resolve a weight at render
 * time. `fontWeight` is still set alongside — it costs nothing, and it keeps
 * the styles honest for anyone reading them.
 *
 * ## Why the files are the full Inter and not a Latin subset
 *
 * The app speaks uz, ru and en (onboarding/language.tsx), so Cyrillic has to
 * be in the file. Subsetting to Latin would save about half the 1.4 MB and
 * break Russian.
 */

export const FONT_FILES = {
  Inter_400Regular: require('../../assets/fonts/Inter_400Regular.ttf'),
  Inter_500Medium: require('../../assets/fonts/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('../../assets/fonts/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('../../assets/fonts/Inter_700Bold.ttf'),
} as const;

/** The family name for each weight the design uses. */
export const FONTS = {
  400: 'Inter_400Regular',
  500: 'Inter_500Medium',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold',
} as const;

/**
 * The family for a `fontWeight`, for the weights we actually ship.
 *
 * Anything else rounds to the nearest face we have rather than falling back
 * to the system font: a stray `fontWeight: '800'` should look like the app,
 * not like a different app for one word. `'normal'` and `'bold'` are the two
 * keyword weights RN allows.
 */
export function familyForWeight(weight: TextStyle['fontWeight']): string {
  switch (weight) {
    case '100':
    case '200':
    case '300':
    case '400':
    case 'normal':
    case undefined:
      return FONTS[400];
    case '500':
      return FONTS[500];
    case '600':
      return FONTS[600];
    default:
      // '700' | '800' | '900' | 'bold' | numeric variants
      return FONTS[700];
  }
}
