import { useEffect } from 'react';
import { Alert, Linking } from 'react-native';

import { checkForAppUpdate, snoozeAppUpdate } from '@/lib/app-update';
import { useT } from '@/i18n';

/**
 * Once per app launch: if a newer APK is published, offer it.
 *
 * "Yuklab olish" opens the fixed APK URL in the browser — the same flow the
 * user already did once to install the app, so the "unknown sources"
 * permission is already granted. "Keyinroq" snoozes that build for good;
 * only a NEWER build prompts again (see lib/app-update.ts).
 *
 * Mounted from the (main) layout, so it only ever fires for a signed-in
 * user on a real screen — never over onboarding or the crisis flow.
 */
export function useAppUpdateCheck(): void {
  const t = useT();

  useEffect(() => {
    let cancelled = false;
    void checkForAppUpdate().then((update) => {
      if (cancelled || update === null) return;
      Alert.alert(t('update.title'), t('update.body'), [
        {
          text: t('update.later'),
          style: 'cancel',
          onPress: () => void snoozeAppUpdate(update.versionCode),
        },
        {
          text: t('update.download'),
          onPress: () => void Linking.openURL(update.url).catch(() => undefined),
        },
      ]);
    });
    return () => {
      cancelled = true;
    };
    // Deliberately mount-only: one offer per launch is enough, and a language
    // switch mid-session must not re-raise a dismissed dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
