import { useMutation } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Mic,
  MoreHorizontal,
  NotebookPen,
  Plus,
  Send,
  Smile,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  rateMessage,
  sendChatMessage,
  type FeedbackRating,
  type QuickReply,
} from '@/api/endpoints/chat';
import { getNextPuzzle, type Puzzle } from '@/api/endpoints/puzzles';
import { useKeyboardState } from 'react-native-keyboard-controller';

import { KeyboardAvoidingView } from '@/components/keyboard-avoiding-view';
import { PuzzleChalkboard } from '@/components/puzzle-chalkboard';
import { SuggestedReplies } from '@/components/suggested-replies';
import { TypingIndicator } from '@/components/typing-indicator';
import { ChatDrawer } from '@/components/chat/chat-drawer';
import { ChatHero } from '@/components/chat/chat-hero';
import { EmojiPicker } from '@/components/goals/emoji-picker';
import { MascotHead } from '@/components/v2/mascot-image';
import { useMemoryConsent } from '@/hooks/use-memory-consent';
import { useT, type TranslateFn } from '@/i18n';
import { glass, lift } from '@/lib/glass';
import { selectRelevantMemories, toMemoryContextLines } from '@/lib/memory-retrieval';
import { type ChatMessage, useChatStore } from '@/store/chat';
import { useChildStore } from '@/store/child';
import { useMemoryStore } from '@/store/memory';

interface AxiosErrorShape {
  response?: { data?: { detail?: string } };
}

// ── The glass sky, the same pale blue morning the rest of the app woke in ────
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const DANGER = '#E0455E';
const PLACEHOLDER = '#7693C2';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';
/** The two states the status dot ever has: settled, and mid-thought. */
const GREEN = '#22B573';

// Free tier daily limit — backend enforces real limits once subscription
// system lands (Faza 1). Until then we show a soft local count.
const DAILY_LIMIT = 30;
const GREETING_ID = 'seed-greeting';
// A puzzle every few turns keeps the chat from being wall-to-wall talking.
// Rare enough not to interrupt a real conversation the child is having.
const PUZZLE_EVERY_N_TURNS = 4;

/** The translator is threaded in rather than read here: this greeting is
 *  appended to the thread as a MESSAGE, so whatever language it is written in
 *  is the language it keeps — a later switch cannot rewrite a message already
 *  said. Building it at call time at least means it is said in the language
 *  the child is reading in right now. */
const GREETING_TEMPLATE = (t: TranslateFn, name?: string): ChatMessage => ({
  id: GREETING_ID,
  role: 'assistant',
  content: name
    ? t('chat.greetingNamed', { name })
    : t('onboarding.firstChat.greeting'),
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
  const t = useT();
  const child = useChildStore((s) => s.child);
  const messages = useChatStore((s) => s.messages);
  const conversationId = useChatStore((s) => s.conversationId);
  const projectId = useChatStore((s) => s.projectId);
  const loadingHistory = useChatStore((s) => s.loadingHistory);
  const voiceDirty = useChatStore((s) => s.voiceDirty);
  const hydrated = useChatStore((s) => s.hydrated);
  const setActiveChild = useChatStore((s) => s.setActiveChild);
  const setConversationId = useChatStore((s) => s.setConversationId);
  const appendMessage = useChatStore((s) => s.appendMessage);

  const [input, setInput] = useState('');
  // messageId -> chosen rating. Local only: the vote is fire-and-forget, so a
  // failed request just clears the highlight rather than blocking the chat.
  const [ratings, setRatings] = useState<Record<string, FeedbackRating>>({});
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  // The quick actions are folded away by default: this is a conversation
  // first, and two chips pinned above the composer cost a message of
  // height on every screen for something reached twice a session.
  const [actionsOpen, setActionsOpen] = useState(false);
  const plus = useSharedValue(0);
  useEffect(() => {
    plus.set(withSpring(actionsOpen ? 1 : 0, { damping: 16, stiffness: 200 }));
  }, [actionsOpen, plus]);
  const plusStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${plus.get() * 45}deg` }],
  }));
  // Sibling tabs are reached through this screen's navigator; router.push
  // into the (tabs) group from inside it is a silent no-op on web.
  const navigation = useNavigation() as { navigate(name: string): void };
  const keyboard = useKeyboardState();
  const insets = useSafeAreaInsets();
  // This tab carries no dock (see (tabs)/_layout.tsx), so the composer sits
  // on the home indicator rather than clearing a floating bar. With the
  // keyboard up the inset is already covered by the keyboard itself.
  const composerPad = keyboard.isVisible ? 12 : Math.max(insets.bottom, 10) + 6;

  useEffect(() => {
    if (!child || !hydrated) return;
    setActiveChild(child.id);
    const state = useChatStore.getState();
    // The greeting seeds an EMPTY new chat only. A conversation opened from
    // the history list is about to be filled from the server, and greeting a
    // child at the top of a conversation they had last week reads as DUYO
    // having forgotten it.
    if (state.messages.length === 0 && !state.conversationId) {
      appendMessage(GREETING_TEMPLATE(t, child.name));
    }
    // Local encrypted memory for THIS child — see store/memory.ts. Loaded
    // eagerly so the first send() of the session already has something to
    // search; a slow/failed load just means that one message goes out
    // without local context, never a blocked chat.
    useMemoryStore.getState().load(child.id).catch(() => {});
  }, [child, hydrated, setActiveChild, appendMessage, t]);

  // Fill a conversation opened from the history list. `loadingHistory` is set
  // by openConversation, so this fires once per open and never on a chat the
  // child is already in the middle of.
  useEffect(() => {
    if (!child || !conversationId || !loadingHistory) return;
    void useChatStore.getState().loadConversation(child.id, conversationId);
  }, [child, conversationId, loadingHistory]);

  /**
   * Read the conversation back after a spoken session.
   *
   * The voice screen speaks INTO this same conversation and the server saves
   * both sides as messages, but it saves them server-side: this store holds a
   * local copy that knows nothing about it. Without this, a child could talk
   * for five minutes, come back, and see none of it.
   *
   * Gated on the flag rather than firing on every focus — re-fetching a long
   * thread every time the tab is touched is a request nobody asked for.
   */
  useFocusEffect(
    useCallback(() => {
      if (!voiceDirty || !child || !conversationId) return;
      void useChatStore.getState().loadConversation(child.id, conversationId);
    }, [voiceDirty, child, conversationId]),
  );

  // Shared with the voice screen so both surfaces prompt, screen and store
  // identically — see hooks/use-memory-consent.ts.
  const offerMemoryConsent = useMemoryConsent();

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
      // Device-side retrieval (spec §6): pick the few local memories
      // relevant to THIS message, out of however many the child has, so the
      // request carries only what this turn needs — never the whole store.
      //
      // Wrapped because memory is an ENHANCEMENT and chat is the product. A
      // throw here used to propagate out of mutationFn, so the message never
      // reached the network and the child got "Internetni tekshiring" with a
      // working connection. Whatever breaks in the memory subsystem, the
      // child still gets to talk to DUYO — just without local context.
      let memoryContext: string[] = [];
      try {
        memoryContext = toMemoryContextLines(
          selectRelevantMemories(vars.text, useMemoryStore.getState().items),
        );
      } catch (err) {
        console.warn('memory retrieval failed; sending without local context', err);
      }
      return sendChatMessage({
        child_id: child.id,
        message: vars.text,
        conversation_id: conversationId ?? undefined,
        // Only meaningful when a NEW conversation is being created — the
        // server ignores it otherwise. This is what files a chat started
        // from inside a project into that project from its first message.
        project_id: conversationId ? undefined : projectId ?? undefined,
        action: vars.action,
        action_query: vars.actionQuery,
        memory_context: memoryContext,
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
      offerMemoryConsent(response.memory_candidate);
    },
    onError: (err) => {
      const detail =
        (err as AxiosErrorShape).response?.data?.detail ??
        t('chat.sendFailed');
      Alert.alert(t('common.error'), detail);
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

  const handleNewChat = useCallback(() => {
    if (!child) return;
    // Reset the mutation, not just the messages. A request still in flight
    // keeps `isPending` true, and the typing indicator is driven by it — so
    // starting a fresh chat while one was stuck left the new, empty chat
    // showing DUYO permanently "typing" and looked like the button had done
    // nothing at all.
    send.reset();
    useChatStore.getState().startNewConversation();
    appendMessage(GREETING_TEMPLATE(t, child.name));
    setPuzzle(null);
  }, [child, appendMessage, send, t]);

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

  // The newest child message, while its reply is still in flight. Delivery
  // here means "DUYO answered", which is the only delivery signal this
  // chat actually has: child messages keep their local id forever, so an
  // id check would mark every message undelivered for good.
  const pendingChildId = useMemo(
    () =>
      send.isPending
        ? [...messages].reverse().find((m) => m.role === 'child')?.id
        : undefined,
    [send.isPending, messages],
  );

  const canSend =
    input.trim().length > 0 && !send.isPending && !!child && !limitReached;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.fill} edges={['top']}>
        {/* Back, title, menu — the mock's shape, and the honest one too:
            the two unlabelled glyphs that used to sit here are both rows
            in the drawer now, where they have names. */}
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.navigate('index')}
            accessibilityRole="button"
            accessibilityLabel={t('nav.home')}
            style={[glass(22, 'sm'), styles.headerIcon, styles.focusable]}
          >
            <ArrowLeft size={22} color={PRIMARY} />
          </Pressable>

          <Text style={styles.headerTitle}>{t('chat.title')}</Text>

          <Pressable
            onPress={() => setDrawerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('common.menu')}
            style={[glass(22, 'sm'), styles.headerIcon, styles.focusable]}
          >
            <MoreHorizontal size={22} color={PRIMARY} />
          </Pressable>
        </View>

        <ChatDrawer
          visible={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onNewChat={handleNewChat}
        />

        {loadingHistory && (
          <View style={styles.loading}>
            <ActivityIndicator color={PRIMARY} />
          </View>
        )}

        <KeyboardAvoidingView style={styles.fill}>
          {/* Empty thread: the hero and the greeting are ONE block, centred in
              whatever the composer leaves. Centring the hero alone still left
              the greeting glued to the composer with a hole above it — the
              hole only closes when the two are centred together. With a real
              thread this wrapper steps aside and the list takes the column,
              newest message against the composer, as a thread should. */}
          <View style={showSuggestions ? styles.emptyStack : styles.fill}>
          {/* Only while the conversation is empty.


              It used to ride inside the list, and an inverted list fills from
              the bottom: on a short phone the hero was the part pushed off the
              top, and on a tall one it floated mid-screen under a void. Fixed
              above the list, it is in the same place on every phone, and it
              stands down the moment there is a thread worth the room — by
              which point the header names the screen and every reply carries
              DUYO's face anyway. */}
          {showSuggestions && (
            <View style={styles.heroSlot}>
              <ChatHero
                thinking={send.isPending}
                onVoice={() => router.push('/(main)/voice')}
              />
            </View>
          )}

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
            // Without `flex: 1` the list is only as tall as its content, so with
            // a few messages it sat at the top and the composer floated in the
            // middle of the screen. Filling the space pins the composer to the
            // bottom and (being inverted) keeps the newest message just above it.
            style={showSuggestions ? styles.listAuto : styles.fill}
            contentContainerStyle={styles.listContent}
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
                  <View style={[glass(18, 'sm', 0.5), styles.counter]}>
                    {/* One Text, one key. The count used to be a tinted
                        span inside the sentence, which meant translating two
                        halves around it and pinning Uzbek's word order onto
                        Russian and English. The colour is not worth that. */}
                    <Text style={styles.counterText}>
                      {t('chat.remaining', {
                        remaining,
                        limit: DAILY_LIMIT,
                      })}
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
                  sending={item.message.id === pendingChildId}
                />
              );
            }}
          />
          </View>

          {/* The tab bar floats over this screen, so the composer keeps its
              own clearance beneath it (see useNavClearance). */}
          <View
            style={[
              glass(28, 'xl', 0.72),
              styles.composerSheet,
              { paddingBottom: composerPad },
            ]}
          >
            {/* Both panels close each other: two sheets open at once would
                push the input off the top of the keyboard. */}
            {emojiOpen && (
              // The panel carries its own 12pt gutter, so this cancels the
              // sheet's padding rather than stacking on it — otherwise the
              // emoji grid sits visibly narrower than the field above it.
              <View style={styles.emojiSlot}>
                <EmojiPicker
                  onPick={(e) => setInput((v) => v + e)}
                  onClose={() => setEmojiOpen(false)}
                />
              </View>
            )}

            {actionsOpen && (
              <View style={styles.actionsRow}>
                <ActionChip
                  Icon={Mic}
                  label={t('chat.action.voice')}
                  onPress={() => {
                    setActionsOpen(false);
                    router.push('/(main)/voice');
                  }}
                />
                <ActionChip
                  Icon={NotebookPen}
                  label={t('chat.action.note')}
                  onPress={() => {
                    setActionsOpen(false);
                    navigation.navigate('brain');
                  }}
                />
              </View>
            )}

            <View style={styles.composerRow}>
              <Pressable
                onPress={() => {
                  setActionsOpen((v) => !v);
                  setEmojiOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  actionsOpen
                    ? t('chat.a11y.closeActions')
                    : t('chat.a11y.moreActions')
                }
                style={[
                  glass(16, 'sm', 0.92),
                  styles.composerButton,
                  styles.focusable,
                ]}
              >
                {/* The same glyph turns into the close, rather than swapping
                    for an X — the button keeps its identity while its job
                    reverses. */}
                <Animated.View style={plusStyle}>
                  <Plus size={22} color={PRIMARY} />
                </Animated.View>
              </Pressable>

              <View style={[glass(20, 'sm', 0.92), styles.inputWrap]}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder={
                    limitReached
                      ? t('chat.limitReached')
                      : t('chat.inputPlaceholder')
                  }
                  placeholderTextColor={PLACEHOLDER}
                  multiline
                  maxLength={2000}
                  editable={!send.isPending && !limitReached}
                  accessibilityLabel={t('chat.a11y.input')}
                  style={styles.input}
                />
                <Pressable
                  onPress={() => {
                    setEmojiOpen((v) => !v);
                    setActionsOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Emoji"
                  style={[styles.emojiButton, styles.focusable]}
                >
                  <Smile size={21} color={emojiOpen ? PRIMARY : MUTED} />
                </Pressable>
              </View>

              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel={t('common.send')}
                style={[
                  styles.send,
                  canSend ? styles.sendOn : styles.sendOff,
                  styles.focusable,
                ]}
              >
                <Send size={19} color={canSend ? '#FFFFFF' : MUTED} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/** `08:32` — the clock under every bubble, in the phone's local time. */
function clock(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * A tint per bullet, cycled down the list.
 *
 * DUYO answers "how do I manage my time" with five steps, and five identical
 * grey dots is a wall a child skims past. Giving each its own colour makes
 * the list countable at a glance — you can see there are five before you
 * have read one. The order is fixed, so the same answer always comes back
 * wearing the same colours.
 */
const BULLET_TINTS = ['#7C6CF5', '#2F6FE4', '#12A182', '#F0B429', '#EA7A2C'];

/** A markdown-ish list line: `- item`, `* item` or `• item`. */
const BULLET = /^\s*[-*•]\s+(.*)$/;

/**
 * The text inside a bubble.
 *
 * Only DUYO's replies get list treatment, and only when they actually contain
 * a list — a child typing a dash at the start of a line meant a dash.
 * Anything that is not a bullet is left exactly as written, because this is a
 * renderer for one pattern, not a markdown engine.
 */
function BubbleBody({ text, isChild }: { text: string; isChild: boolean }) {
  const lines = text.split('\n');
  if (isChild || !lines.some((l) => BULLET.test(l))) {
    return (
      <Text style={[styles.bubbleText, isChild && styles.bubbleTextChild]}>
        {text}
      </Text>
    );
  }
  let n = 0;
  return (
    <View style={styles.body}>
      {lines.map((line, i) => {
        const m = BULLET.exec(line);
        if (!m) {
          return line.trim() ? (
            <Text key={i} style={styles.bubbleText}>
              {line}
            </Text>
          ) : null;
        }
        const tint = BULLET_TINTS[n++ % BULLET_TINTS.length];
        return (
          <View key={i} style={styles.bulletRow}>
            <View style={[styles.bulletDot, { backgroundColor: tint }]} />
            <Text style={[styles.bubbleText, styles.bulletText]}>{m[1]}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** One of the two things the composer's `+` opens onto. */
function ActionChip({
  Icon,
  label,
  onPress,
}: {
  Icon: typeof Mic;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[glass(18, 'sm', 0.6), styles.actionChip, styles.focusable]}
    >
      <Icon size={17} color={PRIMARY} strokeWidth={2.1} />
      <Text style={styles.actionLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  onQuickReply: (messageId: string, reply: QuickReply) => void;
  rating?: FeedbackRating;
  onRate: (messageId: string, rating: FeedbackRating) => void;
  /** This child message is the one whose reply is still in flight. */
  sending?: boolean;
}

function MessageBubble({
  message,
  onQuickReply,
  rating,
  onRate,
  sending,
}: MessageBubbleProps) {
  const t = useT();
  const isChild = message.role === 'child';
  const source = message.source;
  const quickReplies = message.quickReplies;
  // Only server-persisted DUYO replies can be rated — the seeded greeting
  // and optimistic `local-` bubbles have no row to attach feedback to.
  const canRate =
    !isChild && message.id !== GREETING_ID && !message.id.startsWith('local-');
  return (
    <View style={isChild ? styles.rowEnd : styles.rowStart}>
      <View style={styles.bubbleColumn}>
        {/* The avatar is bottom-aligned to the BUBBLE, not to the column.
            It used to sit outside this row, so once a reply grew a source
            line and a thumbs row the face drifted down beside the ratings
            and stopped reading as the speaker at all. */}
        <View style={styles.bubbleRow}>
          {!isChild && (
            <View style={[glass(16, 'sm', 0.6), styles.avatar]}>
              <MascotHead size={26} />
            </View>
          )}
          <View
            style={
              isChild
                ? [styles.bubble, styles.bubbleChild]
                : [glass(22, 'sm', 0.62), styles.bubble]
            }
          >
            <BubbleBody text={message.content} isChild={isChild} />
            <View style={styles.metaRow}>
              <Text style={[styles.time, isChild && styles.timeChild]}>
                {clock(message.timestamp)}
              </Text>
              {/* One tick while DUYO is still answering, two once it has —
                  the only delivery signal this chat genuinely has. */}
              {isChild &&
                (sending ? (
                  <Check size={14} color="rgba(255,255,255,0.75)" strokeWidth={2.6} />
                ) : (
                  <CheckCheck size={14} color="rgba(255,255,255,0.85)" strokeWidth={2.6} />
                ))}
            </View>
          </View>
        </View>
        {source && source.type !== 'none' && (
          <Text style={[styles.sourceText, !isChild && styles.metaIndent]}>
            {source.type === 'textbook' ? '📚 ' : '🌐 '}
            {source.type === 'web'
              ? source.refs.map((r) => r.title).join(', ') || source.label
              : source.label}
          </Text>
        )}
        {!!quickReplies?.length && (
          <View style={[styles.quickRow, !isChild && styles.metaIndent]}>
            {quickReplies.map((qr) => (
              <Pressable
                key={qr.label}
                onPress={() => onQuickReply(message.id, qr)}
                accessibilityRole="button"
                accessibilityLabel={qr.label}
                style={[glass(16, 'sm', 0.55), styles.quickReply, styles.focusable]}
              >
                <Text style={styles.quickReplyText}>{qr.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {canRate && (
          <View style={[styles.rateRow, !isChild && styles.metaIndent]}>
            <Pressable
              onPress={() => onRate(message.id, 'up')}
              accessibilityRole="button"
              accessibilityLabel={t('chat.a11y.rateUp')}
              accessibilityState={{ selected: rating === 'up' }}
              hitSlop={8}
              style={[styles.rateButton, styles.focusable]}
            >
              <ThumbsUp size={16} color={rating === 'up' ? GREEN : MUTED} />
            </Pressable>
            <Pressable
              onPress={() => onRate(message.id, 'down')}
              accessibilityRole="button"
              accessibilityLabel={t('chat.a11y.rateDown')}
              accessibilityState={{ selected: rating === 'down' }}
              hitSlop={8}
              style={[styles.rateButton, styles.focusable]}
            >
              <ThumbsDown size={16} color={rating === 'down' ? DANGER : MUTED} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  /**
   * Two rectangles the platform draws for us, both suppressed. `outline*` is
   * the browser's focus ring; `WebkitTapHighlightColor` is the translucent
   * grey box every WebView flashes over a tapped element, ignoring its
   * border radius. Native ignores both keys.
   */
  focusable: {
    outlineStyle: 'none',
    outlineWidth: 0,
    WebkitTapHighlightColor: 'transparent',
  } as unknown as ViewStyle,

  // ── Header ─────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Centred by taking the row’s slack, so the title stays on the screen’s
  // midline whatever the two round buttons beside it end up measuring.
  headerTitle: {
    flexGrow: 1, flexShrink: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: PRIMARY,
    letterSpacing: -0.2,
  },

  loading: { alignItems: 'center', paddingVertical: 12 },

  // ── List ───────────────────────────────────────────────────────
  /**
   * While the thread is empty the hero takes the slack, centred.
   *
   * An inverted list pins its content to the bottom, so on a 430x932 phone the
   * greeting sat on the composer and the hero stayed under the header with
   * about 600pt of nothing between them — a hole big enough to read as a
   * rendering failure rather than as spacing. Letting this slot flex and
   * centring the block inside it splits that hole into two even margins, which
   * is what a deliberately airy screen looks like.
   */
  heroSlot: { paddingHorizontal: 16, paddingBottom: 4 },
  emptyStack: { flex: 1, minHeight: 0, justifyContent: 'center' },
  /** Content height, not column height — the hero above has the column. Still
   *  shrinkable, so a small phone scrolls the thread instead of clipping it. */
  listAuto: { flexGrow: 0, flexShrink: 1 },

  listContent: { padding: 16, gap: 12 },
  counter: { paddingHorizontal: 16, paddingVertical: 12 },
  counterText: { fontSize: 14, lineHeight: 20, color: INK, textAlign: 'center' },
  counterCount: { fontWeight: '700', color: PRIMARY },

  // ── Bubbles ────────────────────────────────────────────────
  // Bottom-aligned so the avatar sits level with the last line of the
  // bubble, the way it does when a paragraph runs long.
  rowStart: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    gap: 8,
  },
  rowEnd: { flexDirection: 'row', justifyContent: 'flex-end' },
  avatar: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleColumn: { maxWidth: '86%' },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  /** Avatar width plus the row's gap, so everything under a reply hangs off
   *  the bubble's left edge rather than the avatar's. */
  metaIndent: { marginLeft: 46 },

  // flexShrink so a long reply wraps inside the row instead of pushing the
  // avatar off the left edge.
  bubble: { flexShrink: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12 },
  // A filled bubble still belongs to the ladder: same contact/ambient pair
  // as the glass one beside it, so the two sides sit at the same height.
  bubbleChild: { backgroundColor: PRIMARY, boxShadow: lift('sm') },
  bubbleText: { fontSize: 16, lineHeight: 24, color: INK },
  bubbleTextChild: { color: '#FFFFFF' },

  body: { gap: 8 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  // Nudged down to sit on the first line’s optical centre rather than its
  // top edge — a dot level with the ascenders reads as floating.
  bulletDot: { width: 9, height: 9, borderRadius: 5, marginTop: 8 },
  bulletText: { flex: 1 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  time: { fontSize: 11.5, color: MUTED },
  timeChild: { color: 'rgba(255,255,255,0.78)' },

  sourceText: { marginTop: 4, marginLeft: 8, fontSize: 12, color: MUTED },

  quickRow: { flexDirection: 'row', gap: 8, marginTop: 6, marginLeft: 8 },
  quickReply: {
    minHeight: 34,
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickReplyText: { fontSize: 14, fontWeight: '600', color: PRIMARY },

  // 32pt boxes rather than the bare 16pt glyphs these used to be: hitSlop
  // does not enlarge the clickable element on web.
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginLeft: 2,
  },
  rateButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Composer ───────────────────────────────────────────────
  composerSheet: {
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 10,
    // Squared off at the screen edge — only the top of this sheet is ever
    // seen, and rounding the bottom would leak the gradient into the corners.
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  // The emoji button lives INSIDE the field, as it does in every messenger
  // a child has used, rather than becoming a fourth control in the row.
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  input: {
    flexGrow: 1, flexShrink: 1,
    maxHeight: 128,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: INK,
  },
  emojiButton: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Round, not rounded-square like the other two: the one control here that
  // commits rather than opens.
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOn: { backgroundColor: PRIMARY, boxShadow: lift('sm') },
  sendOff: { backgroundColor: 'rgba(140,163,203,0.25)' },

  emojiSlot: { marginHorizontal: -12 },
  actionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  actionLabel: { fontSize: 13.5, fontWeight: '600', color: PRIMARY },
});
