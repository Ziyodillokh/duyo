import { Pressable, View } from 'react-native';
import { Text } from '@/components/text';

interface SuggestedRepliesProps {
  onSelect: (text: string) => void;
}

// Hardcoded for Bosqich B beta — Phase 1+ moves these to per-age-segment
// suggestions returned alongside the chat response.
const REPLIES: readonly string[] = [
  'Boshlaymiz',
  "Menga she'r o'qib ber",
  "Bugungi missiyani ko'rsat",
  'Men bilan gaplash',
];

export function SuggestedReplies({ onSelect }: SuggestedRepliesProps) {
  return (
    <View className="flex-row flex-wrap gap-2 justify-center">
      {REPLIES.map((reply) => (
        <Pressable
          key={reply}
          onPress={() => onSelect(reply)}
          accessibilityRole="button"
          className="px-4 py-2 rounded-md border border-neon-blue/20 active:opacity-70"
        >
          <Text className="text-sm font-medium text-foreground dark:text-dark-text">{reply}</Text>
        </Pressable>
      ))}
    </View>
  );
}
