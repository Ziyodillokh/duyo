import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GoalsScreen from '@/screens/goals/goals-screen';

// The child's own goals — the screen that used to BE the goals tab. The tab
// shows Maqsaddoshlar now; this is where its "Qo'shish" story (and the brain
// screen's "Yangi maqsad") land, because adding a goal is what creates new
// matches. As a pushed route it needs the back button the tab never did.
export default function MyGoalsRoute() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <GoalsScreen />
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(main)/(tabs)/goals'))}
        accessibilityRole="button"
        accessibilityLabel="Orqaga"
        style={{
          position: 'absolute',
          top: Math.max(insets.top, 14) + 6,
          left: 16,
          width: 46,
          height: 46,
          borderRadius: 23,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.9)',
          boxShadow: '0 8px 20px rgba(80,120,200,0.3)',
        }}
      >
        <ArrowLeft size={22} color="#2F6FE4" strokeWidth={2.1} />
      </Pressable>
    </View>
  );
}
