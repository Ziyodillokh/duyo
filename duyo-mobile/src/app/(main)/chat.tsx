import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DuyoAvatar } from '@/components/duyo-avatar';
import { useChildStore } from '@/store/child';

interface ChatMessage {
  id: string;
  role: 'child' | 'assistant';
  content: string;
  timestamp: number;
}

const GREETING: ChatMessage = {
  id: 'seed-greeting',
  role: 'assistant',
  content:
    "Salom! Men DUYO. Endi birga o'rganamiz, suhbatlashamiz va o'samiz. Bugun nima qilmoqchisiz?",
  timestamp: Date.now(),
};

export default function ChatScreen() {
  const child = useChildStore((s) => s.child);
  // Phase 2.3 promotes messages to a persisted store.
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');

  // FlatList is inverted — newest item first (index 0).
  const inverted = [...messages].reverse();

  // Phase 2.2 wires the real send mutation.
  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        role: 'child',
        content: input.trim(),
        timestamp: Date.now(),
      },
    ]);
    setInput('');
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="bg-card border-b border-border px-4 py-3 flex-row items-center gap-3">
        <DuyoAvatar size="sm" state="happy" />
        <View className="flex-1">
          <Text className="font-bold text-base text-foreground">DUYO</Text>
          <Text className="text-xs text-muted-foreground">Har doim online</Text>
        </View>
        <View className="px-3 py-1 rounded-full border border-border bg-card">
          <Text className="text-xs text-muted-foreground">
            0/30 {/* TODO Phase 2.4 — real daily limit */}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        className="flex-1"
      >
        <FlatList
          data={inverted}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => <MessageBubble message={item} />}
        />

        {/* Input bar */}
        <View className="bg-card border-t border-border px-3 py-2 flex-row items-center gap-2">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={`Xabar yozing${child ? `, ${child.name}` : ''}...`}
            multiline
            maxLength={2000}
            accessibilityLabel="Chat xabari"
            className="flex-1 max-h-32 px-4 py-3 border-2 border-border rounded-2xl bg-background text-base text-foreground"
          />
          <Pressable
            onPress={handleSend}
            disabled={!input.trim()}
            accessibilityRole="button"
            accessibilityLabel="Yuborish"
            className={`w-12 h-12 rounded-full items-center justify-center ${
              input.trim() ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <Text
              className={`text-xl font-bold ${
                input.trim() ? 'text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              ↑
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isChild = message.role === 'child';
  return (
    <View className={`flex-row ${isChild ? 'justify-end' : 'justify-start'}`}>
      <View
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isChild ? 'bg-primary' : 'bg-card border border-border'
        }`}
      >
        <Text
          className={`text-base ${
            isChild ? 'text-primary-foreground' : 'text-foreground'
          }`}
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
}
