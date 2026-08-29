import { Stack, router } from 'expo-router';
import { useEffect } from 'react';

import { MemoryConsentSheet } from '@/components/memory/memory-consent-sheet';
import { useAppUpdateCheck } from '@/hooks/use-app-update';
import { useAuthStore } from '@/store/auth';

export default function MainLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);

  // Direct-APK installs have no store to update them — offer new builds here.
  useAppUpdateCheck();

  // The session can end mid-screen: the refresh token expires (30 days) or is
  // rejected, and the API client clears auth. Without this the child stays on
  // whatever screen they were on while every request 401s — the save button
  // just keeps failing with no explanation. Send them to sign-in instead.
  //
  // Waits for `hydrated` so the first frame after a cold start, when the store
  // is still empty, doesn't bounce a logged-in child out to onboarding.
  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace('/(onboarding)/phone');
    }
  }, [hydrated, isAuthenticated]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="voice" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="settings-language" />
      <Stack.Screen name="settings-voice" />
      <Stack.Screen name="settings-privacy" />
      <Stack.Screen name="settings-help" />
      <Stack.Screen name="avatar-customization" />
      <Stack.Screen name="library" />
      <Stack.Screen name="peer-chat" />
      <Stack.Screen name="history" />
      <Stack.Screen name="projects" />
      <Stack.Screen name="project-detail" />
      <Stack.Screen name="library-item" />
      <Stack.Screen name="lesson-help" />
      <Stack.Screen name="subscription" />
      <Stack.Screen name="payment" />
      <Stack.Screen
        name="crisis"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      </Stack>

      {/* Mounted once, above every screen: the chat and voice surfaces both
          raise the same sheet rather than each rendering their own. */}
      <MemoryConsentSheet />
    </>
  );
}
