import '@/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/lib/query-client';
import { useIsDark, useThemeBridge } from '@/store/theme';

export default function RootLayout() {
  useThemeBridge();
  const isDark = useIsDark();

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
