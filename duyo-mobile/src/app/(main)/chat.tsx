import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { sendChatMessage } from '@/api/endpoints/chat';
import { type CrisisLevel } from '@/api/types';
import { DuyoAvatar } from '@/components/duyo-avatar';
import { TypingIndicator } from '@/components/typing-indicator';
import { useChildStore } from '@/store/child';

interface ChatMessage {
  id: string;
  role: 'child' | 'assistant';
  content: string;
  timestamp: number;
  crisisLevel?: CrisisLevel;
}

interface AxiosErrorShape {
  response?: { data?: { detail?: string } };
}

const GREETING: ChatMessage = {
  id: 'seed-greeting',
  role: 'assistant',
  content:
    "Salom! Men DUYO. Endi birga o'rganamiz, suhbatlashamiz va o'samiz. Bugun nima qilmoqchisiz?",
  timestamp: Date.now(),
};

type DisplayItem =
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'typing' };

export default function ChatScreen() {
  const child = useChildStore((s) => s.child);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: (text: string) => {
      if (!child) {
        return Promise.reject(new Error('child profile missing'));
      }
      return sendChatMessage({
        child_id: child.id,
        message: text,
        conversation_id: conversationId ?? undefined,
      });
    },
    onSuccess: (response) => {
      setConversationId(response.conversation_id);
      setMessages((prev) => [
        ...prev,
        {
          id: response.message_id,
          role: 'assistant',
          content: response.reply,
          timestamp: Date.now(),
          crisisLevel: response.crisis_level,
        },
      ]);
    },
    onError: (err) => {
      const detail =
        (err as AxiosErrorShape).response?.data?.detail ??
        'Xabar yuborilmadi. Internetni tekshiring.';
      Alert.alert('Xatolik', detail);
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text || !child || send.isPending) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        role: 'child',
        content: text,
        timestamp: Date.now(),
      },
    ]);
    setInput('');
    send.mutate(text);
  };

  // Inverted FlatList — newest item first (index 0).
  const items: DisplayItem[] = [
    ...(send.isPending ? [{ kind: 'typing' as const }] : []),
    ...[...messages].reverse().map(
      (message): DisplayItem => ({ kind: 'message', message }),
    ),
  ];

  const canSend = input.trim().length > 0 && !send.isPending && !!child;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="bg-card border-b border-border px-4 py-3 flex-row items-center gap-3">
        <DuyoAvatar size="sm" state={send.isPending ? 'thinking' : 'happy'} />
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
        className="flex-1"
      >
        <FlatList
          data={items}
          keyExtractor={(item, i) =>
            item.kind === 'typing' ? 'typing-indicator' : `${item.message.id}-${i}`
          }
          inverted
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) =>
            item.kind === 'typing' ? (
              <TypingIndicator />
            ) : (
              <MessageBubble message={item.message} />
            )
          }
        />

        {/* Input bar */}
        <View className="bg-card border-t border-border px-3 py-2 flex-row items-end gap-2">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={`Xabar yozing${child ? `, ${child.name}` : ''}...`}
            multiline
            maxLength={2000}
            editable={!send.isPending}
            accessibilityLabel="Chat xabari"
            className="flex-1 max-h-32 px-4 py-3 border-2 border-border rounded-2xl bg-background text-base text-foreground"
          />
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Yuborish"
            className={`w-12 h-12 rounded-full items-center justify-center ${
              canSend ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <Text
              className={`text-xl font-bold ${
                canSend ? 'text-primary-foreground' : 'text-muted-foreground'
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
