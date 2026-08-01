import { Stack } from 'expo-router';

export default function MainLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="voice" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="settings-language" />
      <Stack.Screen name="settings-voice" />
      <Stack.Screen name="settings-privacy" />
      <Stack.Screen name="settings-help" />
      <Stack.Screen name="avatar-customization" />
      <Stack.Screen name="library" />
      <Stack.Screen name="peer-chat" />
      <Stack.Screen name="library-item" />
      <Stack.Screen name="dtm" />
      <Stack.Screen name="language-practice" />
      <Stack.Screen name="lesson-help" />
      <Stack.Screen name="parent-connection" />
      <Stack.Screen name="parent-dashboard" />
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
  );
}
