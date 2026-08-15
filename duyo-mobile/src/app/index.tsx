import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { listChildren } from '@/api/endpoints/children';
import { getFamilyInvite } from '@/api/endpoints/family';
import { useT } from '@/i18n';
import { useAuthStore } from '@/store/auth';
import { useChildStore } from '@/store/child';
import { useMascotStore } from '@/store/mascot';

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
      // A parent who already sent their child a link code but closed the app
      // before the child claimed it must land back on the waiting screen,
      // not on "what's your name" — that question was already answered.
      const invite = await getFamilyInvite().catch(() => null);
      if (invite) {
        router.replace('/(onboarding)/family-waiting');
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
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Image
        source={require('@/assets/images/duyo-wordmark.png')}
        style={{ width: 280, height: 210 }}
        contentFit="contain"
        accessibilityLabel="DUYO"
      />
      <Text className="text-lg text-muted-foreground mt-2">
        {t('splash.tagline')}
      </Text>

      {failed ? (
        <View className="items-center mt-8 gap-3">
          <Text className="text-base text-foreground text-center">
            {t('splash.loadFailed')}
          </Text>
          <Pressable
            onPress={() => void decide()}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
            className="rounded-xl bg-primary px-6 py-3 active:opacity-80"
          >
            <Text className="text-base font-semibold text-white">
              {t('common.retry')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <ActivityIndicator size="large" color="#2563EB" className="mt-8" />
      )}
    </View>
  );
}
