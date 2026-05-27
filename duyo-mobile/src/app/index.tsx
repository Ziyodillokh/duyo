import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { DuyoAvatar } from '@/components/duyo-avatar';
import { useAuthStore } from '@/store/auth';
import { useChildStore } from '@/store/child';

const SPLASH_DURATION_MS = 1500;

export default function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      const auth = useAuthStore.getState();
      const childState = useChildStore.getState();

      if (auth.isAuthenticated && childState.child) {
        router.replace('/(main)/chat');
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
    <View className="flex-1 items-center justify-center bg-background gap-6 px-6">
      <DuyoAvatar size="xl" state="happy" />
      <Text className="text-4xl font-bold text-primary">DUYO</Text>
      <Text className="text-lg text-muted-foreground">Sening AI Hamrohingiz</Text>
      <ActivityIndicator size="large" color="#2563EB" className="mt-4" />
    </View>
  );
}
