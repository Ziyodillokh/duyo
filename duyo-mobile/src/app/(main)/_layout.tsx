import { Stack } from 'expo-router';

export default function MainLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="voice" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="library-item" />
      <Stack.Screen name="dtm" />
      <Stack.Screen name="lesson-help" />
      <Stack.Screen
        name="crisis"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  );
}
