import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

// Splash duration before auto-navigating to the onboarding flow.
const SPLASH_DURATION_MS = 1500;

export default function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/(onboarding)/language');
    }, SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-background gap-6 px-6">
      {/* TODO Phase 1.4 — replace with DuyoAvatar size="xl" state="happy" */}
      <View className="w-40 h-40 rounded-full bg-primary items-center justify-center">
        <Text className="text-white text-6xl font-bold">D</Text>
      </View>
      <Text className="text-4xl font-bold text-primary">DUYO</Text>
      <Text className="text-lg text-muted-foreground">Sening AI Hamrohingiz</Text>
      <ActivityIndicator size="large" color="#2563EB" className="mt-4" />
    </View>
  );
}
