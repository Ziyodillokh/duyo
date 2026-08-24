import { useMutation } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useNavigation } from 'expo-router';
import {
  ArrowLeft,
  Menu,
  Mic,
  Send,
  SquarePen,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  rateMessage,
  sendChatMessage,
  type FeedbackRating,
  type QuickReply,
} from '@/api/endpoints/chat';
import { getNextPuzzle, type Puzzle } from '@/api/endpoints/puzzles';
import { useNavClearance } from '@/components/v2/dark/bottom-nav';
import { useKeyboardState } from 'react-native-keyboard-controller';

import { KeyboardAvoidingView } from '@/components/keyboard-avoiding-view';
import { PuzzleChalkboard } from '@/components/puzzle-chalkboard';
import { SuggestedReplies } from '@/components/suggested-replies';
import { TypingIndicator } from '@/components/typing-indicator';
import { ChatDrawer } from '@/components/chat/chat-drawer';
import { MascotImage } from '@/components/v2/mascot-image';
import { useMemoryConsent } from '@/hooks/use-memory-consent';
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
const HAIRLINE = 'rgba(47,111,228,0.10)';
/** The two states the status dot ever has: settled, and mid-thought. */
const GREEN = '#22B573';
const AMBER = '#F0B429';

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
  const projectId = useChatStore((s) => s.projectId);
  const loadingHistory = useChatStore((s) => s.loadingHistory);
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
  // Sibling tabs are reached through this screen's navigator; router.push
  // into the (tabs) group from inside it is a silent no-op on web.
  const navigation = useNavigation() as { navigate(name: string): void };
  // While the keyboard is up it covers the bar, so the composer must sit on
  // the keyboard rather than hold a dead 92pt band above it.
  const keyboard = useKeyboardState();
  const navClearance = useNavClearance();
  const composerPad = keyboard.isVisible ? 12 : navClearance;

  useEffect(() => {
    if (!child || !hydrated) return;
    setActiveChild(child.id);
    const state = useChatStore.getState();
    // The greeting seeds an EMPTY new chat only. A conversation opened from
    // the history list is about to be filled from the server, and greeting a
    // child at the top of a conversation they had last week reads as DUYO
    // having forgotten it.
    if (state.messages.length === 0 && !state.conversationId) {
      appendMessage(GREETING_TEMPLATE(child.name));
    }
    // Local encrypted memory for THIS child — see store/memory.ts. Loaded
    // eagerly so the first send() of the session already has something to
    // search; a slow/failed load just means that one message goes out
    // without local context, never a blocked chat.
    useMemoryStore.getState().load(child.id).catch(() => {});
  }, [child, hydrated, setActiveChild, appendMessage]);

  // Fill a conversation opened from the history list. `loadingHistory` is set
  // by openConversation, so this fires once per open and never on a chat the
  // child is already in the middle of.
  useEffect(() => {
    if (!child || !conversationId || !loadingHistory) return;
    void useChatStore.getState().loadConversation(child.id, conversationId);
  }, [child, conversationId, loadingHistory]);

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

  const handleNewChat = useCallback(() => {
    if (!child) return;
    // Reset the mutation, not just the messages. A request still in flight
    // keeps `isPending` true, and the typing indicator is driven by it — so
    // starting a fresh chat while one was stuck left the new, empty chat
    // showing DUYO permanently "typing" and looked like the button had done
    // nothing at all.
    send.reset();
    useChatStore.getState().startNewConversation();
    appendMessage(GREETING_TEMPLATE(child.name));
    setPuzzle(null);
  }, [child, appendMessage, send]);

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
    <View style={styles.root}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.fill} edges={['top']}>
        {/* Header: menu — identity — new chat. The two unlabelled icons that
            used to sit here moved into the drawer, where they have names. */}
        <View style={styles.header}>
          {/* The dock is three doors now; the hub is reached by going back, so
              every section carries this. */}
          <Pressable
            onPress={() => navigation.navigate('index')}
            accessibilityRole="button"
            accessibilityLabel="Bosh sahifa"
            hitSlop={8}
            style={[styles.headerIcon, styles.focusable]}
          >
            <ArrowLeft size={22} color={PRIMARY} />
          </Pressable>
          <Pressable
            onPress={() => setDrawerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Menyu"
            hitSlop={8}
            style={[styles.headerIcon, styles.focusable]}
          >
            <Menu size={22} color={PRIMARY} />
          </Pressable>

          <View style={styles.mascot}>
            <MascotImage size={44} glow="cosmic" />
          </View>
          <View style={styles.identity}>
            <Text style={styles.name} numberOfLines={1}>
              DUYO
            </Text>
            <View style={styles.statusRow}>
              {/* The dot carries the same state as the words beside it, so the
                  status reads at a glance without being parsed. */}
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: send.isPending ? AMBER : GREEN },
                ]}
              />
              <Text style={styles.statusText}>
                {send.isPending ? "O'ylayapti..." : 'Xursand'}
              </Text>
            </View>
          </View>

          {/* Tinted, unlike the plain menu glyph on the left: this one performs
              an action rather than opening navigation, and a child reported not
              realising it was tappable at all. */}
          <Pressable
            onPress={handleNewChat}
            accessibilityRole="button"
            accessibilityLabel="Yangi suhbat"
            hitSlop={8}
            style={[glass(20, 'sm'), styles.headerAction, styles.focusable]}
          >
            <SquarePen size={19} color={PRIMARY} />
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
            style={styles.fill}
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
                    <Text style={styles.counterText}>
                      Bugun{' '}
                      <Text style={styles.counterCount}>
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

          {/* The tab bar floats over this screen now, so the composer keeps
              its own clearance beneath it (see NAV_CLEARANCE). */}
          <View
            style={[
              glass(28, 'xl', 0.72),
              styles.composer,
              { paddingBottom: composerPad },
            ]}
          >
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={
                limitReached
                  ? 'Bugungi limit tugadi. Ertaga davom etamiz.'
                  : 'Xabar yozing...'
              }
              placeholderTextColor={PLACEHOLDER}
              multiline
              maxLength={2000}
              editable={!send.isPending && !limitReached}
              accessibilityLabel="Chat xabari"
              // `glass()` is typed ViewStyle, and React Native's TextStyle is
              // NOT a superset of it — the two disagree about `userSelect`. The
              // properties actually used here (fill, radius, border) are valid
              // on both, so the cast is the narrow lie rather than a wrong one.
              style={[glass(16, 'flush', 0.62) as TextStyle, styles.input]}
            />
            <Pressable
              onPress={() => router.push('/(main)/voice')}
              accessibilityRole="button"
              accessibilityLabel="Ovozli suhbat"
              style={[glass(16, 'flush', 0.62), styles.composerButton, styles.focusable]}
            >
              <Mic size={22} color={PRIMARY} />
            </Pressable>
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Yuborish"
              style={[
                styles.composerButton,
                canSend ? styles.sendOn : styles.sendOff,
                styles.focusable,
              ]}
            >
              <Send size={20} color={canSend ? '#FFFFFF' : MUTED} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
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
    <View style={isChild ? styles.rowEnd : styles.rowStart}>
      <View style={styles.bubbleColumn}>
        <View
          style={
            isChild
              ? [styles.bubble, styles.bubbleChild]
              : [glass(22, 'sm', 0.62), styles.bubble]
          }
        >
          <Text style={[styles.bubbleText, isChild && styles.bubbleTextChild]}>
            {message.content}
          </Text>
        </View>
        {source && source.type !== 'none' && (
          <Text style={styles.sourceText}>
            {source.type === 'textbook' ? '📚 ' : '🌐 '}
            {source.type === 'web'
              ? source.refs.map((r) => r.title).join(', ') || source.label
              : source.label}
          </Text>
        )}
        {!!quickReplies?.length && (
          <View style={styles.quickRow}>
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
          <View style={styles.rateRow}>
            <Pressable
              onPress={() => onRate(message.id, 'up')}
              accessibilityRole="button"
              accessibilityLabel="Bu javob yoqdi"
              accessibilityState={{ selected: rating === 'up' }}
              hitSlop={8}
              style={[styles.rateButton, styles.focusable]}
            >
              <ThumbsUp size={16} color={rating === 'up' ? GREEN : MUTED} />
            </Pressable>
            <Pressable
              onPress={() => onRate(message.id, 'down')}
              accessibilityRole="button"
              accessibilityLabel="Bu javob yoqmadi"
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
  // The browser's default focus ring is a black rectangle around a round
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  // ── Header ─────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    // Overrides the pane's white fill: this chip is the one that acts.
    backgroundColor: 'rgba(47,111,228,0.14)',
  },
  mascot: { width: 44, height: 44 },
  identity: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: INK },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, color: MUTED },

  loading: { alignItems: 'center', paddingVertical: 12 },

  // ── List ───────────────────────────────────────────────────────────────
  listContent: { padding: 16, gap: 12 },
  counter: { paddingHorizontal: 16, paddingVertical: 12 },
  counterText: { fontSize: 14, lineHeight: 20, color: INK, textAlign: 'center' },
  counterCount: { fontWeight: '700', color: PRIMARY },

  // ── Bubbles ────────────────────────────────────────────────────────────
  rowStart: { flexDirection: 'row', justifyContent: 'flex-start' },
  rowEnd: { flexDirection: 'row', justifyContent: 'flex-end' },
  bubbleColumn: { maxWidth: '80%' },
  bubble: { borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12 },
  // A filled bubble still belongs to the ladder: same contact/ambient pair as
  // the glass one beside it, so the two sides sit at the same height.
  bubbleChild: { backgroundColor: PRIMARY, boxShadow: lift('sm') },
  bubbleText: { fontSize: 16, lineHeight: 24, color: INK },
  bubbleTextChild: { color: '#FFFFFF' },
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

  // ── Composer ───────────────────────────────────────────────────────────
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    // Squared off at the screen edge — only the top of this sheet is ever
    // seen, and rounding the bottom would leak the gradient into the corners.
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  input: {
    flex: 1,
    maxHeight: 128,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: INK,
  },
  composerButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOn: { backgroundColor: PRIMARY },
  sendOff: { backgroundColor: 'rgba(140,163,203,0.25)' },
});
