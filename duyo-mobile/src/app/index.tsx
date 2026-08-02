import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useAuthStore } from '@/store/auth';
import { useChildStore } from '@/store/child';

const SPLASH_DURATION_MS = 1500;

export default function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      const auth = useAuthStore.getState();
      const childState = useChildStore.getState();

      if (auth.isAuthenticated && childState.child) {
        router.replace('/(main)/(tabs)');
        return;
      }
      if (auth.isAuthenticated) {
        router.replace('/(onboarding)/child-name');
        return;
      }
      router.replace('/(onboarding)/language');
    }, SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Image
        source={require('@/assets/images/duyo-wordmark.png')}
        style={{ width: 280, height: 210 }}
        contentFit="contain"
        accessibilityLabel="DUYO"
      />
      <Text className="text-lg text-muted-foreground mt-2">
        Sizning AI hamrohingiz
      </Text>
      <ActivityIndicator size="large" color="#2563EB" className="mt-8" />
    </View>
  );
}
