import '@/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { UpdatePrompt } from '@/components/update-prompt';
import { queryClient } from '@/lib/query-client';
import { useIsDark, useThemeBridge } from '@/store/theme';

export default function RootLayout() {
  useThemeBridge();
  const isDark = useIsDark();

  return (
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
  );
}
