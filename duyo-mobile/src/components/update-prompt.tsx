import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Card } from '@/components/v2/card';
import { PrimaryButton } from '@/components/v2/primary-button';
import { useT } from '@/i18n';
import {
  checkForAppUpdate,
  snoozeAppUpdate,
  type AvailableUpdate,
} from '@/lib/app-update';
import { glass } from '@/lib/glass';

const INK = '#22406F';
const MUTED = '#8CA3CB';

/**
 * Ilova ochilganda serverdagi oxirgi APK versiyasini tekshiradi; o'rnatilgan
 * versiyadan yangi bo'lsa, yangilash oynasini ko'rsatadi. Internet bo'lmasa
 * yoki server javob bermasa — jim o'tib ketadi (ilova ishlashiga ta'sir yo'q).
 *
 * The check itself lives in lib/app-update.ts, which returns null for the
 * Play build, for iOS and for dev — so this modal simply never opens there.
 * This is the only update offer in the app; the root layout mounts it once.
 */
export function UpdatePrompt() {
  const t = useT();
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);

  useEffect(() => {
    let cancelled = false;
    void checkForAppUpdate().then((found) => {
      if (!cancelled) setUpdate(found);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (update === null) return null;

  // "Keyinroq" is remembered: the same build must not ask again on every
  // launch, or the child learns to dismiss the dialog without reading it.
  const later = () => {
    void snoozeAppUpdate(update.versionCode);
    setUpdate(null);
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={later}>
      <View style={styles.scrim}>
        <View style={styles.holder}>
          <Card style={styles.sheet}>
            <View style={styles.heading}>
              <Text style={styles.title}>{t('update.promptTitle')}</Text>
              <Text style={styles.body}>
                {t('update.promptBody', { version: update.version })}
              </Text>
              {update.notes ? (
                <Text style={styles.notes}>{update.notes}</Text>
              ) : null}
            </View>

            <View style={styles.cta}>
              <PrimaryButton
                onPress={() => void Linking.openURL(update.url)}
                accessibilityLabel={t('update.now')}
              >
                {t('update.now')}
              </PrimaryButton>
            </View>

            <Pressable
              onPress={later}
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
