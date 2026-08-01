import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Mic, Send, ThumbsDown, ThumbsUp } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  rateMessage,
  sendChatMessage,
  type FeedbackRating,
  type QuickReply,
} from '@/api/endpoints/chat';
import { getNextPuzzle, type Puzzle } from '@/api/endpoints/puzzles';
import { KeyboardAvoidingView } from '@/components/keyboard-avoiding-view';
import { PuzzleChalkboard } from '@/components/puzzle-chalkboard';
import { SuggestedReplies } from '@/components/suggested-replies';
import { TypingIndicator } from '@/components/typing-indicator';
import { MascotImage } from '@/components/v2/mascot-image';
import { type ChatMessage, useChatStore } from '@/store/chat';
import { useChildStore } from '@/store/child';

interface AxiosErrorShape {
  response?: { data?: { detail?: string } };
}

// Free tier daily limit — backend enforces real limits once subscription
// system lands (Faza 1). Until then we show a soft local count.
const DAILY_LIMIT = 30;
const GREETING_ID = 'seed-greeting';
// A puzzle every few turns keeps the chat from being wall-to-wall talking.
// Rare enough not to interrupt a real conversation the child is having.
const PUZZLE_EVERY_N_TURNS = 4;

const GREETING_TEMPLATE = (name?: string): ChatMessage => ({
  id: GREETING_ID,
  role: 'assistant',
  content: `Salom${name ? `, ${name}` : ''}! Men DUYO. Endi birga o'rganamiz, suhbatlashamiz va o'samiz. Bugun nima qilmoqchisiz?`,
  timestamp: Date.now(),
});

type DisplayItem =
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'typing' }
  | { kind: 'counter' }
  | { kind: 'puzzle'; puzzle: Puzzle }
  | { kind: 'suggested-replies' };

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function ChatScreen() {
  const child = useChildStore((s) => s.child);
  const messages = useChatStore((s) => s.messages);
  const conversationId = useChatStore((s) => s.conversationId);
  const hydrated = useChatStore((s) => s.hydrated);
  const setActiveChild = useChatStore((s) => s.setActiveChild);
  const setConversationId = useChatStore((s) => s.setConversationId);
  const appendMessage = useChatStore((s) => s.appendMessage);

  const [input, setInput] = useState('');
  // messageId -> chosen rating. Local only: the vote is fire-and-forget, so a
  // failed request just clears the highlight rather than blocking the chat.
  const [ratings, setRatings] = useState<Record<string, FeedbackRating>>({});
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);

  useEffect(() => {
    if (!child || !hydrated) return;
    setActiveChild(child.id);
    if (useChatStore.getState().messages.length === 0) {
      appendMessage(GREETING_TEMPLATE(child.name));
    }
  }, [child, hydrated, setActiveChild, appendMessage]);

  const todayCount = useMemo(() => {
    const start = startOfTodayMs();
    return messages.filter(
      (m) => m.role === 'child' && m.timestamp >= start,
    ).length;
  }, [messages]);
  const remaining = Math.max(0, DAILY_LIMIT - todayCount);
  const limitReached = todayCount >= DAILY_LIMIT;

  // Fetch a puzzle every Nth turn. Silent on failure and on an exhausted
  // catalogue (the endpoint returns null) — a missing puzzle is a non-event.
  const maybeOfferPuzzle = useCallback(() => {
    if (!child) return;
    const turns = useChatStore
      .getState()
      .messages.filter((m) => m.role === 'child').length;
    if (turns === 0 || turns % PUZZLE_EVERY_N_TURNS !== 0) return;
    getNextPuzzle(child.id)
      .then((p) => p && setPuzzle(p))
      .catch(() => {});
  }, [child]);

  const send = useMutation({
    mutationFn: (vars: { text: string; action?: 'web_search'; actionQuery?: string }) => {
      if (!child) {
        return Promise.reject(new Error('child profile missing'));
      }
      return sendChatMessage({
        child_id: child.id,
        message: vars.text,
        conversation_id: conversationId ?? undefined,
        action: vars.action,
        action_query: vars.actionQuery,
      });
    },
    onSuccess: (response) => {
      setConversationId(response.conversation_id);
      appendMessage({
        id: response.message_id,
        role: 'assistant',
        content: response.reply,
        timestamp: Date.now(),
        crisisLevel: response.crisis_level,
        source: response.source ?? null,
        quickReplies: response.quick_replies ?? [],
      });
      if (response.crisis_level !== 'green') {
        router.push({
          pathname: '/(main)/crisis',
          params: { level: response.crisis_level },
        });
        return; // never interrupt a crisis moment with a game
      }
      maybeOfferPuzzle();
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
    if (!text || !child || send.isPending || limitReached) return;
    appendMessage({
      id: `local-${Date.now()}`,
      role: 'child',
      content: text,
      timestamp: Date.now(),
    });
    setInput('');
    send.mutate({ text });
  };

  const handleQuickReply = (messageId: string, reply: QuickReply) => {
    useChatStore.getState().clearQuickReplies(messageId); // one-shot: chips vanish
    if (reply.action === 'dismiss' || !child) return;
    appendMessage({
      id: `local-${Date.now()}`,
      role: 'child',
      content: reply.label, // "Ha"
      timestamp: Date.now(),
    });
    send.mutate({ text: reply.label, action: 'web_search', actionQuery: reply.query });
  };

  const handleRate = useCallback(
    (messageId: string, rating: FeedbackRating) => {
      if (!child) return;
      setRatings((prev) => ({ ...prev, [messageId]: rating }));
      rateMessage(messageId, child.id, rating).catch(() => {
        // Rating is optional feedback — drop the highlight, never interrupt.
        setRatings((prev) => {
          const next = { ...prev };
          delete next[messageId];
          return next;
        });
      });
    },
    [child],
  );

  const showSuggestions =
    messages.length === 1 && messages[0]?.id === GREETING_ID;

  const items: DisplayItem[] = useMemo(
    () => [
      ...(send.isPending ? [{ kind: 'typing' as const }] : []),
      // The list is inverted, so index 0 sits at the bottom — the puzzle
      // lands directly above the composer, where the newest turn belongs.
      ...(puzzle ? [{ kind: 'puzzle' as const, puzzle }] : []),
      ...(showSuggestions
        ? [{ kind: 'suggested-replies' as const }]
        : []),
      ...[...messages]
        .reverse()
        .map((message): DisplayItem => ({ kind: 'message', message })),
      { kind: 'counter' as const },
    ],
    [send.isPending, showSuggestions, messages, puzzle],
  );

  const canSend =
    input.trim().length > 0 && !send.isPending && !!child && !limitReached;

  return (
    <SafeAreaView
      className="flex-1 bg-card dark:bg-dark-surface"
      edges={['top']}
    >
      <View className="bg-card dark:bg-dark-surface border-b border-neon-blue/20 px-4 py-3 flex-row items-center gap-3">
        <View className="w-16 h-16">
          <MascotImage size={64} glow="cosmic" />
        </View>
        <View className="flex-1">
          <Text className="font-bold text-base text-foreground dark:text-dark-text">DUYO</Text>
          <View className="flex-row items-center gap-2">
            <View className="w-2 h-2 rounded-full bg-neon-green" />
            <Text className="text-xs text-muted-foreground dark:text-dark-muted">
              {send.isPending ? "O'ylayapti..." : 'Xursand'}
            </Text>
          </View>
        </View>
        <View
          className={`px-3 py-1.5 rounded-md border ${
            limitReached
              ? 'border-destructive bg-destructive/10'
              : 'border-neon-blue/20'
          }`}
        >
          <Text
            className={`text-xs font-medium ${
              limitReached ? 'text-destructive' : 'text-foreground dark:text-dark-text'
            }`}
          >
            {todayCount}/{DAILY_LIMIT} suhbat
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView className="flex-1 bg-card dark:bg-dark-surface">
        <FlatList
          data={items}
          keyExtractor={(item, i) => {
            if (item.kind === 'typing') return 'typing-indicator';
            if (item.kind === 'puzzle') return `puzzle-${item.puzzle.puzzle_id}`;
            if (item.kind === 'suggested-replies') return 'suggested-replies';
            if (item.kind === 'counter') return 'daily-counter';
            return `${item.message.id}-${i}`;
          }}
          inverted
          // Without flex-1 the list is only as tall as its content, so with a
          // few messages it sat at the top and the composer floated in the
          // middle of the screen. Filling the space pins the composer to the
          // bottom and (being inverted) keeps the newest message just above it.
          className="flex-1"
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => {
            if (item.kind === 'typing') return <TypingIndicator />;
            if (item.kind === 'puzzle') {
              return child ? (
                <PuzzleChalkboard
                  puzzle={item.puzzle}
                  childId={child.id}
                  onDone={() => setPuzzle(null)}
                />
              ) : null;
            }
            if (item.kind === 'suggested-replies') {
              return <SuggestedReplies onSelect={setInput} />;
            }
            if (item.kind === 'counter') {
              return (
                <View className="bg-secondary dark:bg-card dark:bg-dark-surface-soft border border-glow-blue rounded-xl px-4 py-3">
                  <Text className="text-sm text-foreground dark:text-dark-text text-center">
                    Bugun{' '}
                    <Text className="font-bold text-neon-cyan">
                      {remaining}/{DAILY_LIMIT}
                    </Text>{' '}
                    suhbat qoldi
                  </Text>
                </View>
              );
            }
            return (
              <MessageBubble
                message={item.message}
                onQuickReply={handleQuickReply}
                rating={ratings[item.message.id]}
                onRate={handleRate}
              />
            );
          }}
        />

        <View className="bg-card dark:bg-dark-surface border-t border-neon-blue/20 px-3 py-3 flex-row items-end gap-2">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={
              limitReached
                ? 'Bugungi limit tugadi. Ertaga davom etamiz.'
                : 'Xabar yozing...'
            }
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={2000}
            editable={!send.isPending && !limitReached}
            accessibilityLabel="Chat xabari"
            className="flex-1 max-h-32 px-4 py-3 rounded-md text-base text-foreground dark:text-dark-text"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
          />
          <Pressable
            onPress={() => router.push('/(main)/voice')}
            accessibilityRole="button"
            accessibilityLabel="Ovozli suhbat"
            className="w-11 h-11 rounded-md items-center justify-center"
          >
            <Mic size={22} color="#94A3B8" />
          </Pressable>
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Yuborish"
            className={`w-11 h-11 rounded-md items-center justify-center ${
              canSend ? 'bg-neon-blue' : 'bg-secondary dark:bg-card dark:bg-dark-surface-soft'
            }`}
          >
            <Send size={20} color={canSend ? '#FFFFFF' : '#94A3B8'} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  onQuickReply: (messageId: string, reply: QuickReply) => void;
  rating?: FeedbackRating;
  onRate: (messageId: string, rating: FeedbackRating) => void;
}

function MessageBubble({
  message,
  onQuickReply,
  rating,
  onRate,
}: MessageBubbleProps) {
  const isChild = message.role === 'child';
  const source = message.source;
  const quickReplies = message.quickReplies;
  // Only server-persisted DUYO replies can be rated — the seeded greeting and
  // optimistic `local-` bubbles have no row to attach feedback to.
  const canRate =
    !isChild && message.id !== GREETING_ID && !message.id.startsWith('local-');
  return (
    <View className={`flex-row ${isChild ? 'justify-end' : 'justify-start'}`}>
      <View className="max-w-[80%]">
        <View
          className={`rounded-2xl px-4 py-3 ${
            isChild
              ? 'bg-neon-blue'
              : 'bg-card dark:bg-dark-surface border border-neon-blue/20'
          }`}
        >
          <Text
            className={`text-base leading-6 ${
              isChild ? 'text-white' : 'text-foreground dark:text-dark-text'
            }`}
          >
            {message.content}
          </Text>
        </View>
        {source && source.type !== 'none' && (
          <Text className="text-xs text-muted-foreground dark:text-dark-muted mt-1 ml-2">
            {source.type === 'textbook' ? '📚 ' : '🌐 '}
            {source.type === 'web'
              ? source.refs.map((r) => r.title).join(', ') || source.label
              : source.label}
          </Text>
        )}
        {!!quickReplies?.length && (
          <View className="flex-row gap-2 mt-1.5 ml-2">
            {quickReplies.map((qr) => (
              <Pressable
                key={qr.label}
                onPress={() => onQuickReply(message.id, qr)}
                accessibilityRole="button"
                accessibilityLabel={qr.label}
                className="py-1.5 px-4 rounded-2xl bg-neon-blue/15 border border-neon-blue/30"
              >
                <Text className="text-neon-blue font-semibold">{qr.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {canRate && (
          <View className="flex-row gap-3 mt-1.5 ml-2">
            <Pressable
              onPress={() => onRate(message.id, 'up')}
              accessibilityRole="button"
              accessibilityLabel="Bu javob yoqdi"
              accessibilityState={{ selected: rating === 'up' }}
              hitSlop={8}
            >
              <ThumbsUp
                size={16}
                color={rating === 'up' ? '#05DF72' : '#94A3B8'}
              />
            </Pressable>
            <Pressable
              onPress={() => onRate(message.id, 'down')}
              accessibilityRole="button"
              accessibilityLabel="Bu javob yoqmadi"
              accessibilityState={{ selected: rating === 'down' }}
              hitSlop={8}
            >
              <ThumbsDown
                size={16}
                color={rating === 'down' ? '#FB64B6' : '#94A3B8'}
              />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
