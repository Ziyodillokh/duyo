import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { IS_PLAY_BUILD } from '@/lib/distribution';

/**
 * In-app update check for direct-APK installs.
 *
 * Phones that installed DUYO from the site's APK never hear about new builds —
 * there is no store to update them. But every mobile push already publishes
 * both the APK and a version manifest to fixed URLs (see build-apk.yml), and
 * the workflow stamps `versionCode = run number` into the build itself. So
 * the app can compare its own build number against the manifest and offer the
 * download when the server is ahead.
 *
 * This is the ONE implementation of that check: the UI is components/
 * update-prompt.tsx and nothing else may fetch the manifest, or a phone gets
 * asked twice.
 */

const VERSION_URL = 'https://admin.duyo.uz/apk/version.json';
/** Snooze key: the versionCode the user said "later" to. Asking again on
 * every launch for the same build would train them to dismiss updates. */
const DISMISSED_KEY = 'duyo-update-dismissed-vc';
const FETCH_TIMEOUT_MS = 8000;

export interface AvailableUpdate {
  versionCode: number;
  version: string;
  url: string;
  notes?: string;
}

/** The build number this APK was stamped with, or null when unknowable
 * (dev client, iOS, a build that skipped the stamp). */
function installedVersionCode(): number | null {
  if (Platform.OS !== 'android') return null;
  const raw = Number(Application.nativeBuildVersion);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

/** The manifest is a file on a server, so every field is checked before it is
 * believed — a malformed one must read as "no update", never as a crash. */
function parseManifest(data: unknown): AvailableUpdate | null {
  if (typeof data !== 'object' || data === null) return null;
  const android = (data as { android?: unknown }).android;
  if (typeof android !== 'object' || android === null) return null;
  const info = android as Partial<AvailableUpdate>;
  if (
    typeof info.versionCode !== 'number' ||
    !Number.isFinite(info.versionCode) ||
    typeof info.version !== 'string' ||
    typeof info.url !== 'string' ||
    !info.url.startsWith('https://')
  ) {
    return null;
  }
  return {
    versionCode: info.versionCode,
    version: info.version,
    url: info.url,
    notes: typeof info.notes === 'string' ? info.notes : undefined,
  };
}

/**
 * Returns the update the user should be offered, or null.
 *
 * Null covers every non-actionable case — the Play build, iOS, dev builds,
 * network failure, malformed manifest, already up to date, or snoozed —
 * because the caller's only job is "show the offer or stay silent", and
 * silence is always safe.
 */
export async function checkForAppUpdate(): Promise<AvailableUpdate | null> {
  // Play updates its own installs; an app that offers itself an APK there is
  // a policy violation, not a feature (see lib/distribution.ts).
  if (IS_PLAY_BUILD || __DEV__) return null;
  const installed = installedVersionCode();
  if (installed === null) return null;

  let latest: AvailableUpdate | null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const resp = await fetch(VERSION_URL, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    latest = parseManifest(await resp.json());
  } catch {
    return null; // offline or server down — just stay quiet
  }

  if (latest === null || latest.versionCode <= installed) return null;

  try {
    const dismissed = Number(await AsyncStorage.getItem(DISMISSED_KEY));
    if (Number.isFinite(dismissed) && dismissed >= latest.versionCode) {
      return null;
    }
  } catch {
    // unreadable snooze state = no snooze
  }

  return latest;
}

/** "Later" — stop offering THIS build; a newer one will prompt again. */
export async function snoozeAppUpdate(versionCode: number): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, String(versionCode));
  } catch {
    // losing the snooze only means one extra prompt next launch
  }
}
