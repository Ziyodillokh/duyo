import { Stack } from 'expo-router';

export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F4F8FF' },
      }}
    >
      <Stack.Screen name="chat" />
      <Stack.Screen name="voice" />
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
