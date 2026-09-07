/**
 * The Play build's replacement for `app-update.ts` — deliberately inert.
 *
 * The real module fetches a version manifest and sends the user to a page that
 * hands them an APK. That is how DUYO updates itself outside the store, and it
 * is the thing Google Play's Device and Network Abuse policy is about: an app
 * that offers to install another app.
 *
 * Two things already stopped it RUNNING in a Play build — the manifest URL is
 * never set at build time, so it is `undefined`, and `IS_PLAY_BUILD` returns
 * before the fetch. But Metro does not tree-shake, so the function bodies
 * still shipped inside the bundle, and "it cannot run" is a weaker answer than
 * "it is not in the file".
 *
 * metro.config.js swaps this in when EXPO_PUBLIC_DISTRIBUTION is "play", so
 * the Play bundle carries these two no-ops and nothing else. The sideload APK
 * build resolves the real module and still updates itself.
 *
 * The shape has to match app-update.ts exactly — update-prompt.tsx imports
 * from one name and gets whichever file the resolver picked.
 */

export interface AvailableUpdate {
  versionCode: number;
  version: string;
  url: string;
  notes?: string;
}

export async function checkForAppUpdate(): Promise<AvailableUpdate | null> {
  return null;
}

export async function snoozeAppUpdate(_versionCode: number): Promise<void> {
  // Nothing to snooze: nothing ever prompts.
}
