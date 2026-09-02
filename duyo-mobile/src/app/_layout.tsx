import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { UpdatePrompt } from '@/components/update-prompt';
import { FONT_FILES } from '@/lib/fonts';
import { queryClient } from '@/lib/query-client';
import { useIsDark } from '@/store/theme';

// Hold the native splash until Inter is in memory. Without this the first
// frame paints in the system face and every screen visibly reflows a moment
// later, because Inter's metrics are not Roboto's or SF Pro's.
//
// Fire-and-forget on purpose: if it rejects (it can, if the splash is
// already gone) there is nothing to recover, and an unhandled rejection at
// module scope would be worse than a frame of system text.
void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const isDark = useIsDark();
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  // Loudly, because the failure mode is silent: RN falls back to the
  // system typeface and the app merely looks slightly wrong, which is
  // exactly the report that took a day to track down.
  if (fontError) {
    console.warn('[fonts] Inter failed to load — text will fall back', fontError);
  }

  useEffect(() => {
    // `fontError` counts as done. A missing typeface must not be able to
    // hold the app behind a splash screen forever — the text falls back to
    // the system face and the child can still use DUYO.
    if (fontsLoaded || fontError) void SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;


  // GestureHandlerRootView must wrap everything that uses gesture-handler —
  // without it GestureDetector silently never fires (the graph's pinch/pan).
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          {/* Reads IME insets natively — RN's KeyboardAvoidingView is a no-op on
              Android since edge-to-edge became the default (Expo SDK 53+). */}
          <KeyboardProvider>
            <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
            <UpdatePrompt />
          </KeyboardProvider>
          <StatusBar style={isDark ? 'light' : 'dark'} />
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
