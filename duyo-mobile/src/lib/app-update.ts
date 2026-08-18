import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

/**
 * In-app update check for direct-APK installs.
 *
 * Phones that installed DUYO from the site's APK never hear about new builds —
 * there is no store to update them. But every mobile push already publishes
 * both the APK and a version manifest to fixed URLs (see build-apk.yml), and
 * the workflow stamps `versionCode = run number` into the build itself. So
 * the app can compare its own build number against the manifest and offer the
 * download when the server is ahead.
 */

const VERSION_URL = 'https://admin.duyo.uz/apk/version.json';
/** Snooze key: the versionCode the user said "later" to. Asking again on
 * every launch for the same build would train them to dismiss updates. */
const DISMISSED_KEY = 'duyo-update-dismissed-vc';
const FETCH_TIMEOUT_MS = 8000;

export interface AvailableUpdate {
  versionCode: number;
  url: string;
}

/** The build number this APK was stamped with, or null when unknowable
 * (dev client, iOS, a build that skipped the stamp). */
function installedVersionCode(): number | null {
  if (Platform.OS !== 'android') return null;
  const raw = Number(Application.nativeBuildVersion);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

/**
 * Returns the update the user should be offered, or null.
 *
 * Null covers every non-actionable case — iOS, dev builds, network failure,
 * malformed manifest, already up to date, or snoozed — because the caller's
 * only job is "show the offer or stay silent", and silence is always safe.
 */
export async function checkForAppUpdate(): Promise<AvailableUpdate | null> {
  if (__DEV__) return null;
  const installed = installedVersionCode();
  if (installed === null) return null;

  let manifest: { android?: { versionCode?: unknown; url?: unknown } };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const resp = await fetch(VERSION_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    manifest = await resp.json();
  } catch {
    return null; // offline or server down — just stay quiet
  }

  const latest = Number(manifest?.android?.versionCode);
  const url = manifest?.android?.url;
  if (!Number.isFinite(latest) || latest <= installed) return null;
  if (typeof url !== 'string' || !url.startsWith('https://')) return null;

  try {
    const dismissed = Number(await AsyncStorage.getItem(DISMISSED_KEY));
    if (Number.isFinite(dismissed) && dismissed >= latest) return null;
  } catch {
    // unreadable snooze state = no snooze
  }

  return { versionCode: latest, url };
}

/** "Later" — stop offering THIS build; a newer one will prompt again. */
export async function snoozeAppUpdate(versionCode: number): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, String(versionCode));
  } catch {
    // losing the snooze only means one extra prompt next launch
  }
}
