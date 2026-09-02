import * as Application from 'expo-application';
import { useEffect, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { Text } from '@/components/text';
import { Card } from '@/components/v2/card';
import { PrimaryButton } from '@/components/v2/primary-button';
import { useT } from '@/i18n';
import { glass } from '@/lib/glass';

const INK = '#22406F';
const MUTED = '#8CA3CB';

// Statik fayl — build-apk.yml har APK chiqarganda yangilab turadi.
const VERSION_URL = 'https://admin.duyo.uz/apk/version.json';
const FETCH_TIMEOUT_MS = 8000;

interface AndroidVersionInfo {
  versionCode: number;
  version: string;
  url: string;
  notes?: string;
}

function parseVersionInfo(data: unknown): AndroidVersionInfo | null {
  if (typeof data !== 'object' || data === null) return null;
  const android = (data as { android?: unknown }).android;
  if (typeof android !== 'object' || android === null) return null;
  const info = android as Partial<AndroidVersionInfo>;
  if (
    typeof info.versionCode !== 'number' ||
    typeof info.version !== 'string' ||
    typeof info.url !== 'string' ||
    !info.url.startsWith('https://')
  ) {
    return null;
  }
  return info as AndroidVersionInfo;
}

/**
 * Ilova ochilganda serverdagi oxirgi APK versiyasini tekshiradi; o'rnatilgan
 * versiyadan yangi bo'lsa, yangilash oynasini ko'rsatadi. Internet bo'lmasa
 * yoki server javob bermasa — jim o'tib ketadi (ilova ishlashiga ta'sir yo'q).
 */
export function UpdatePrompt() {
  const t = useT();
  const [info, setInfo] = useState<AndroidVersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const installed = Number(Application.nativeBuildVersion);
    if (!Number.isFinite(installed)) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    fetch(VERSION_URL, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const latest = parseVersionInfo(data);
        if (latest && latest.versionCode > installed) setInfo(latest);
      })
      .catch(() => {
        // Offlayn yoki server vaqtincha ishlamayapti — indamay o'tamiz.
      })
      .finally(() => clearTimeout(timer));

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  if (!info || dismissed) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={() => setDismissed(true)}
    >
      <View style={styles.scrim}>
        <View style={styles.holder}>
          <Card style={styles.sheet}>
            <View style={styles.heading}>
              <Text style={styles.title}>{t('update.promptTitle')}</Text>
              <Text style={styles.body}>
                {t('update.promptBody', { version: info.version })}
              </Text>
              {info.notes ? (
                <Text style={styles.notes}>{info.notes}</Text>
              ) : null}
            </View>

            <View style={styles.cta}>
              <PrimaryButton
                onPress={() => Linking.openURL(info.url)}
                accessibilityLabel={t('update.now')}
              >
                {t('update.now')}
              </PrimaryButton>
            </View>

            <Pressable
              onPress={() => setDismissed(true)}
              accessibilityRole="button"
              accessibilityLabel={t('update.later')}
              style={styles.later}
            >
              <Text style={styles.laterText}>{t('update.later')}</Text>
            </Pressable>
          </Card>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // A navy scrim rather than a black one: the shade over a pale blue page is
  // still lit by the same sky the glass is (see lib/glass.ts), and neutral
  // black over this palette reads as dirt on the screen.
  scrim: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(16,32,58,0.55)',
  },
  holder: { width: '100%', maxWidth: 345, alignSelf: 'center' },

  // The Card's own 'md' is for a card lying on a page; this one floats OVER a
  // darkened one, so it takes the top of the ladder and a sheet's radius. The
  // fill goes nearly opaque too — 55% white over the scrim would let the
  // darkness through and grey the text out.
  sheet: { ...glass(28, 'xl', 0.96), padding: 24 },

  heading: { gap: 8, alignItems: 'center' },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
  },
  body: { fontSize: 16, lineHeight: 22, color: MUTED, textAlign: 'center' },
  notes: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    textAlign: 'center',
  },

  cta: { marginTop: 24 },

  // Padded rather than hitSlopped: hitSlop does not grow the element on web,
  // and this is the only way to dismiss the dialog.
  later: { marginTop: 16, paddingVertical: 8, alignItems: 'center' },
  laterText: { fontSize: 14, color: MUTED },
});
