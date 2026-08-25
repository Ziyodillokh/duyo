import { create } from 'zustand';

/**
 * Whether the app's chrome should get out of the way.
 *
 * ## Why a store and not a prop
 *
 * The dock is rendered by the tab navigator, which knows which TAB is open and
 * nothing else. Miya's map lives inside the Miya tab as one of several
 * sub-screens, so from the navigator's side the map and the Miya landing page
 * are the same place. Something has to carry "the screen you are looking at
 * wants the whole screen" across that boundary, and a prop cannot: there is no
 * path from a tab's content back up to the bar drawn beside it.
 *
 * ## Why it is a count and not a flag
 *
 * Two things can want the screen at once — Miya's map while a sheet opens over
 * it — and if both set a boolean, whichever finishes first hands the dock back
 * while the other is still full-bleed. Counting means the chrome returns when
 * the LAST claim is released. Every `enter()` owes an `exit()`, which in
 * practice means an effect that returns one.
 */
interface ChromeState {
  /** How many screens currently want the chrome hidden. */
  claims: number;
  immersive: boolean;
  enterImmersive: () => void;
  exitImmersive: () => void;
}

export const useChromeStore = create<ChromeState>((set) => ({
  claims: 0,
  immersive: false,
  enterImmersive: () =>
    set((s) => ({ claims: s.claims + 1, immersive: true })),
  exitImmersive: () =>
    set((s) => {
      const claims = Math.max(0, s.claims - 1);
      return { claims, immersive: claims > 0 };
    }),
}));
