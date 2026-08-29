import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { Text } from '@/components/text';

import { listChildren } from '@/api/endpoints/children';
// OTA-ONA BO'LIMI O'CHIRILGAN:
// import { getFamilyInvite } from '@/api/endpoints/family';
import { useT } from '@/i18n';
import { lift } from '@/lib/glass';
import { useAuthStore } from '@/store/auth';
import { useChildStore } from '@/store/child';
import { useMascotStore } from '@/store/mascot';

// ── The glass sky, on the app's very first frame ─────────────────────────────
// The splash paints the same gradient the screens behind it will, so the
// hand-off from launch to onboarding is a fade of content, not of ground.
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

const SPLASH_DURATION_MS = 1500;

export default function SplashScreen() {
  const t = useT();
  const [failed, setFailed] = useState(false);

  const decide = useCallback(async () => {
    setFailed(false);
    const auth = useAuthStore.getState();
    const childState = useChildStore.getState();

    if (!auth.isAuthenticated) {
      router.replace('/(onboarding)/language');
      return;
    }
    if (childState.child) {
      router.replace('/(main)/(tabs)');
      return;
    }

    // Signed in with nothing stored locally — a reinstall, cleared data, or a
    // second device. Ask the server before assuming this is a new child:
    // assuming is what left a duplicate profile behind on every pass.
    try {
      const children = await listChildren();
      const existing = children[0];
      if (existing) {
        useChildStore.getState().setChild(existing);
        if (existing.mascot === 'raccoon' || existing.mascot === 'duyo') {
          useMascotStore.getState().setVariant(existing.mascot);
        }
        router.replace('/(main)/(tabs)');
        return;
      }
      router.replace('/(onboarding)/child-name');
    } catch {
      // Never fall through to onboarding on a failed lookup — that is exactly
      // how a returning child ends up with a second profile.
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void decide();
    }, SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [decide]);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Image
        source={require('@/assets/images/duyo-wordmark.png')}
        style={styles.wordmark}
        contentFit="contain"
        accessibilityLabel="DUYO"
      />
      <Text style={styles.tagline}>{t('splash.tagline')}</Text>

      {failed ? (
        <View style={styles.failure}>
          <Text style={styles.failureText}>{t('splash.loadFailed')}</Text>
          <Pressable
            onPress={() => void decide()}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
            style={({ pressed }) => [
              styles.retry,
              styles.focusable,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <ActivityIndicator size="large" color={PRIMARY} style={styles.spinner} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  wordmark: { width: 280, height: 210 },
  tagline: {
    marginTop: 8,
    fontSize: 18,
    color: MUTED,
  },

  spinner: { marginTop: 32 },

  failure: {
    alignItems: 'center',
    marginTop: 32,
    gap: 12,
  },
  failureText: {
    fontSize: 16,
    lineHeight: 22,
    color: INK,
    textAlign: 'center',
  },

  // Solid rather than glass: the one action on the screen should not read as
  // another pane of the same frosted material the page is made of.
  retry: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 18,
    backgroundColor: PRIMARY,
    boxShadow: lift('md'),
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pressed: { opacity: 0.8 },
  // The browser's default focus ring is a black rectangle around a round
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
});
