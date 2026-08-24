import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowLeft,
  FolderPlus,
  MessageSquare,
  MoreVertical,
  Search,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SectionList,
  StyleSheet,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type ConversationSummary } from '@/api/endpoints/conversations';
import { ProjectPicker } from '@/components/history/project-picker';
import { TextPrompt } from '@/components/history/text-prompt';
import {
  useConversations,
  useDeleteConversation,
  useMoveConversation,
  useProjects,
  useRenameConversation,
} from '@/hooks/use-history';
import { glass } from '@/lib/glass';
import { groupConversations, shortWhen } from '@/lib/history-groups';
import { useChatStore } from '@/store/chat';
import { useChildStore } from '@/store/child';

// ── The glass sky, the same pale morning as settings and goal-mates ──────────
// The screen commits to the light look its siblings carry, so the theme hook
// that used to swap a navy backdrop in is gone: there is one look now.
const PRIMARY = '#2F6FE4';
const TITLE = '#2A63DC';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const PLACEHOLDER = '#7693C2';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

/**
 * "Suhbatlar" — every conversation this child has had, newest first.
 *
 * Grouped by recency rather than listed flat: a child looking for "the one
 * about the volcano" navigates by when it happened, not by scanning
 * timestamps.
 */
export default function HistoryScreen() {
  const child = useChildStore((s) => s.child);
  const childId = child?.id;

  const [query, setQuery] = useState('');
  const [moving, setMoving] = useState<ConversationSummary | null>(null);
  const [renaming, setRenaming] = useState<ConversationSummary | null>(null);

  const conversations = useConversations(childId);
  const projects = useProjects(childId);
  const rename = useRenameConversation(childId);
  const remove = useDeleteConversation(childId);
  const move = useMoveConversation(childId);

  const all = useMemo(() => conversations.data ?? [], [conversations.data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.preview ?? '').toLowerCase().includes(q),
    );
  }, [all, query]);

  const sections = useMemo(() => groupConversations(filtered), [filtered]);

  const projectById = useMemo(
    () => new Map((projects.data ?? []).map((p) => [p.id, p])),
    [projects.data],
  );

  const openConversation = (conv: ConversationSummary) => {
    // Hand the chat screen the conversation to resume; it loads the messages
    // from the server rather than trusting whatever is cached locally.
    useChatStore.getState().openConversation(conv.id);
    router.push('/(main)/(tabs)/chat');
  };

  const confirmDelete = (conv: ConversationSummary) =>
    Alert.alert(
      'Suhbatni o‘chirish',
      `"${conv.title}" o‘chirilsinmi? Bu amalni ortga qaytarib bo‘lmaydi.`,
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: 'O‘chirish',
          style: 'destructive',
          onPress: () => remove.mutate(conv.id),
        },
      ],
    );

  const openActions = (conv: ConversationSummary) =>
    Alert.alert(conv.title, undefined, [
      { text: 'Loyihaga solish', onPress: () => setMoving(conv) },
      { text: 'Nomini o‘zgartirish', onPress: () => setRenaming(conv) },
      {
        text: 'O‘chirish',
        style: 'destructive',
        onPress: () => confirmDelete(conv),
      },
      { text: 'Bekor qilish', style: 'cancel' },
    ]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            style={[glass(24, 'sm'), styles.headerButton, styles.focusable]}
          >
            <ArrowLeft size={23} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>Suhbatlar</Text>
          <Pressable
            onPress={() => router.push('/(main)/projects')}
            accessibilityRole="button"
            accessibilityLabel="Loyihalar"
            style={[glass(24, 'sm'), styles.headerButton, styles.focusable]}
          >
            <FolderPlus size={21} color={PRIMARY} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Search only. "Yangi suhbat" lives in the chat drawer now — at the
            top of this list it competed with the list itself, and the child
            arrives here to FIND a conversation, not to leave for a new one. */}
        <View style={styles.searchWrap}>
          <View style={[glass(20, 'sm'), styles.search]}>
            <Search size={20} color={PRIMARY} strokeWidth={2.1} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Suhbatlardan qidirish..."
              placeholderTextColor={PLACEHOLDER}
              accessibilityLabel="Suhbatlardan qidirish"
              style={styles.searchInput}
            />
          </View>
        </View>

        {conversations.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={PRIMARY} />
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 8 }}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionHeader}>{section.title}</Text>
            )}
            renderItem={({ item }) => (
              <ConversationRow
                conversation={item}
                projectName={
                  item.project_id
                    ? projectById.get(item.project_id)?.name
                    : undefined
                }
                projectColour={
                  item.project_id
                    ? projectById.get(item.project_id)?.colour ?? undefined
                    : undefined
                }
                onOpen={() => openConversation(item)}
                onActions={() => openActions(item)}
              />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyGlyph}>💬</Text>
                <Text style={styles.emptyTitle}>
                  {query ? 'Hech narsa topilmadi' : 'Hali suhbat yo‘q'}
                </Text>
                <Text style={styles.emptyBody}>
                  {query
                    ? 'Boshqa so‘z bilan qidirib ko‘r'
                    : 'DUYO bilan gaplashsang, suhbatlaring shu yerda saqlanadi'}
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>

      <ProjectPicker
        visible={moving !== null}
        projects={projects.data ?? []}
        currentProjectId={moving?.project_id ?? null}
        onClose={() => setMoving(null)}
        onPick={(projectId) => {
          if (moving) move.mutate({ id: moving.id, projectId });
          setMoving(null);
        }}
      />

      <TextPrompt
        // Remounts per row, which is what resets the field.
        key={renaming?.id ?? 'rename-none'}
        visible={renaming !== null}
        title="Nomini o‘zgartirish"
        initialValue={renaming?.title ?? ''}
        onCancel={() => setRenaming(null)}
        onSubmit={(title) => {
          if (renaming) rename.mutate({ id: renaming.id, title });
          setRenaming(null);
        }}
      />
    </View>
  );
}

function ConversationRow({
  conversation,
  projectName,
  projectColour,
  onOpen,
  onActions,
}: {
  conversation: ConversationSummary;
  projectName?: string;
  projectColour?: string;
  onOpen: () => void;
  onActions: () => void;
}) {
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={conversation.title}
      style={({ pressed }) => [
        glass(20, 'md'),
        styles.row,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.rowInner}>
        {/* 38 / radius 12 / 12%-tint is the icon tile used by every row in
            this area — projects, history, and the drawer — so the three read
            as one surface rather than three screens built at different times.
            Only the tint moved, from the old neon blue to the glass primary. */}
        <View style={styles.iconTile}>
          <MessageSquare size={17} color={PRIMARY} strokeWidth={2} />
        </View>

        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {conversation.title}
            </Text>
            <Text style={styles.rowWhen}>
              {shortWhen(conversation.updated_at)}
            </Text>
          </View>
          {!!conversation.preview && (
            <Text style={styles.rowPreview} numberOfLines={1}>
              {conversation.preview}
            </Text>
          )}
          {!!projectName && (
            <View style={styles.projectRow}>
              <View
                style={[
                  styles.projectDot,
                  { backgroundColor: projectColour ?? PRIMARY },
                ]}
              />
              <Text style={styles.projectName}>{projectName}</Text>
            </View>
          )}
        </View>

        <Pressable
          onPress={onActions}
          accessibilityRole="button"
          accessibilityLabel="Amallar"
          hitSlop={10}
          style={[styles.moreButton, styles.focusable]}
        >
          <MoreVertical size={16} color={MUTED} strokeWidth={2.2} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // ── Header: the inner-screen glass pattern ─────────────────────────────
  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The browser's default focus ring is a black rectangle around a round
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: TITLE,
  },

  // ── Search: an inline control, so it rests on the page rather than above it
  searchWrap: { paddingHorizontal: 20, paddingBottom: 8 },
  search: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: INK,
    paddingVertical: 0,
  },

  loading: { alignItems: 'center', padding: 32 },

  sectionHeader: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: MUTED,
  },

  // ── Conversation rows ──────────────────────────────────────────────────
  row: { padding: 14 },
  rowPressed: { opacity: 0.8 },
  rowInner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47,111,228,0.12)',
  },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: INK,
  },
  // Cast because a bare `['tabular-nums']` widens to string[] inside
  // StyleSheet.create, which TextStyle's FontVariant[] will not take.
  rowWhen: {
    fontSize: 12,
    color: MUTED,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
  rowPreview: {
    marginTop: 2,
    fontSize: 14,
    color: MUTED,
  },
  projectRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  projectDot: { width: 8, height: 8, borderRadius: 4 },
  projectName: { fontSize: 12, color: MUTED },
  // 32pt was below the comfortable target and `hitSlop` does not grow the
  // clickable box on web, so the Pressable itself carries the size.
  moreButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Empty state ────────────────────────────────────────────────────────
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyGlyph: { fontSize: 36, lineHeight: 44 },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
  },
  emptyBody: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    textAlign: 'center',
  },
});
