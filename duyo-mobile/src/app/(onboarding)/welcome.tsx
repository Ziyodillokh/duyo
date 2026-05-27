import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DuyoAvatar } from '@/components/duyo-avatar';
import { useChildStore } from '@/store/child';

// Phase 1 final destination. Replaced by /(main)/chat in Phase 2.
export default function WelcomeScreen() {
  const child = useChildStore((s) => s.child);
  const name = child?.name ?? 'do\'stim';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6 gap-6">
        <DuyoAvatar size="xl" state="celebrating" />
        <Text className="text-3xl font-bold text-primary text-center">
          Salom, {name}!
        </Text>
        <Text className="text-lg text-foreground text-center">
          Onboarding tugadi. Chat ekrani Phase 2'da keladi.
        </Text>
      </View>
    </SafeAreaView>
  );
}
