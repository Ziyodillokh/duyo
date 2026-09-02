import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  CloudOff,
  FolderPlus,
  MessageSquare,
  FolderInput,
  MoreVertical,
  Pencil,
  Trash2,
  Search,
  X,
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  type ConversationSummary,
  type Project,
} from '@/api/endpoints/conversations';
import { ActionSheet, type SheetAction } from '@/components/action-sheet';
import { ProjectPicker } from '@/components/history/project-picker';
import { TextPrompt } from '@/components/history/text-prompt';
import {
  useConversations,
  useDeleteConversation,
  useMoveConversation,
  useProjects,
  useRenameConversation,
} from '@/hooks/use-history';
import { useT, type TranslateFn } from '@/i18n';
import { glass, lift, TINT } from '@/lib/glass';
import {
  groupConversations,
  shortWhen,
  type HistorySection,
} from '@/lib/history-groups';
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
 * The panes, resolved once.
 *
 * `glass()` builds a fresh object every call, and these three never vary. A
 * new style identity per row is a diff React cannot skip, which on a long
 * list is paid on every keystroke in the search box.
 */
const CONTROL_GLASS = glass(24, 'sm');
const SEARCH_GLASS = glass(20, 'sm');
const HERO_GLASS = glass(26, 'lg');
const CARD_GLASS = glass(24, 'md');

/**
 * "Suhbatlar" — every conversation this child has had, newest first.
 *
 * Grouped by recency rather than listed flat: a child looking for "the one
 * about the volcano" navigates by when it happened, not by scanning
 * timestamps.
 *
 * The depth ladder is what makes the page read as designed rather than as a
 * column of rectangles: the hero is `lg`, each bucket card is `md`, and the
 * rows inside a card are `flush` — they are its contents, not objects resting
 * on it. Every row used to be `md`, forty panes at one height, which is the
 * failure lib/glass.ts exists to prevent.
 */
export default function HistoryScreen() {
  const t = useT();
  const child = useChildStore((s) => s.child);
  const childId = child?.id;

  const [query, setQuery] = useState('');
  const [moving, setMoving] = useState<ConversationSummary | null>(null);
  const [renaming, setRenaming] = useState<ConversationSummary | null>(null);
  const [actionsFor, setActionsFor] = useState<ConversationSummary | null>(null);
  const [deleting, setDeleting] = useState<ConversationSummary | null>(null);

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

  // `t` is a dependency, not decoration: the bucket titles are built here, so
  // a language switch has to invalidate this memo or the headings stay put.
  const sections = useMemo(
    () => groupConversations(filtered, t),
    [filtered, t],
  );

  const projectById = useMemo(
    () => new Map((projects.data ?? []).map((p) => [p.id, p])),
    [projects.data],
  );

  const openConversation = useCallback((conv: ConversationSummary) => {
    // Hand the chat screen the conversation to resume; it loads the messages
    // from the server rather than trusting whatever is cached locally.
    useChatStore.getState().openConversation(conv.id);
    router.push('/(main)/(tabs)/chat');
  }, []);

  const projectFor = useCallback(
    (c: ConversationSummary): Project | undefined =>
      c.project_id ? projectById.get(c.project_id) : undefined,
    [projectById],
  );

  /**
   * Which row's menu is open, and which row is being confirmed for deletion.
   *
   * Both were `Alert.alert` before. On web that call is an empty function
   * (react-native-web ships `class Alert { static alert() {} }`), so the
   * three-dot menu opened nothing at all — silently, with no error — and
   * renaming, filing into a project and deleting were unreachable there.
   */
  const actions: SheetAction[] = actionsFor
    ? [
        {
          label: t('history.moveToProject'),
          icon: FolderInput,
          onPress: () => setMoving(actionsFor),
        },
        {
          label: t('common.rename'),
          icon: Pencil,
          onPress: () => setRenaming(actionsFor),
        },
        {
          label: t('common.delete'),
          icon: Trash2,
          destructive: true,
          onPress: () => setDeleting(actionsFor),
        },
      ]
    : [];

  // The hero shows the newest conversation — the API already sorts by last
  // activity — and only when the child is browsing. `all`, not `filtered`:
  // it is never a search result.
  const lead = query.trim() ? undefined : all[0];

  const renderGroup = useCallback(
    ({ item }: { item: HistorySection }) => (
      <HistoryGroup
        section={item}
        projectById={projectById}
        t={t}
        onOpen={openConversation}
        onActions={setActionsFor}
      />
    ),
    [projectById, t, openConversation],
  );

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
            accessibilityLabel={t('common.back')}
            style={[CONTROL_GLASS, styles.headerButton, styles.focusable]}
          >
            <ArrowLeft size={23} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>{t('history.title')}</Text>
          <Pressable
            onPress={() => router.push('/(main)/projects')}
            accessibilityRole="button"
            accessibilityLabel={t('projects.title')}
            style={[CONTROL_GLASS, styles.headerButton, styles.focusable]}
          >
            <FolderPlus size={21} color={PRIMARY} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Search only. "Yangi suhbat" lives in the chat drawer now — at the
            top of this list it competed with the list itself, and the child
            arrives here to FIND a conversation, not to leave for a new one.
            It also stays OUTSIDE the list: a header that carries an input
            loses focus mid-word whenever the list remounts it. */}
        <View style={styles.searchWrap}>
          <View style={[SEARCH_GLASS, styles.search]}>
            <Search size={20} color={PRIMARY} strokeWidth={2.1} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('history.searchPlaceholder')}
              placeholderTextColor={PLACEHOLDER}
              accessibilityLabel={t('history.a11y.search')}
              style={styles.searchInput}
            />
            {/* Written out rather than left to `clearButtonMode`, which does
                not exist on Android — and a search that found nothing needs
                a way back that is not deleting a word at a time. */}
            {!!query && (
              <Pressable
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel={t('common.clear')}
                hitSlop={10}
                style={styles.focusable}
              >
                <X size={18} color={MUTED} strokeWidth={2.2} />
              </Pressable>
            )}
          </View>
        </View>

        {conversations.isLoading ? (
          <HistorySkeleton />
        ) : conversations.isError ? (
          /* An empty history and an unreachable server look identical from
             here, and only one of them should tell a child they have never
             talked to DUYO. The Miya map already got this right; this screen
             still said "Hali suhbat yo'q" when the network was down. */
          <View style={styles.stateWrap}>
            <Pressable
              onPress={() => conversations.refetch()}
              accessibilityRole="button"
              accessibilityLabel={t('common.retry')}
              style={({ pressed }) => [
                CARD_GLASS,
                styles.state,
                pressed && styles.rowPressed,
                styles.focusable,
              ]}
            >
              <CloudOff size={30} color={MUTED} strokeWidth={1.8} />
              <Text style={styles.stateTitle}>
                {t('history.loadFailed.title')}
              </Text>
              <Text style={styles.stateBody}>
                {t('history.loadFailed.body')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={sections}
            keyExtractor={(s) => s.bucket}
            // The whole array is already in memory — the drawer slices it and
            // search filters it client-side — so row-level virtualization was
            // buying nothing, and there are at most five sections. Listing the
            // groups instead is what lets a bucket be one object.
            renderItem={renderGroup}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              lead ? (
                <ContinueCard
                  conversation={lead}
                  projectName={projectFor(lead)?.name}
                  tint={projectFor(lead)?.colour ?? PRIMARY}
                  t={t}
                  onOpen={() => openConversation(lead)}
                />
              ) : null
            }
            ListEmptyComponent={
              query.trim() ? (
                // A failed SEARCH is a flat message inside the page — no card,
                // because nothing was lost; the child just needs another word.
                <View style={styles.searchMiss}>
                  <Text style={styles.stateTitle}>
                    {t('common.nothingFound')}
                  </Text>
                  <Text style={styles.stateBody}>
                    {t('history.emptySearchBody', { query: query.trim() })}
                  </Text>
                </View>
              ) : (
                <View style={[CARD_GLASS, styles.state]}>
                  <MessageSquare size={30} color={PRIMARY} strokeWidth={1.8} />
                  <Text style={styles.stateTitle}>
                    {t('history.emptyTitle')}
                  </Text>
                  <Text style={styles.stateBody}>{t('history.emptyBody')}</Text>
                </View>
              )
            }
          />
        )}
      </SafeAreaView>

      <ActionSheet
        visible={!!actionsFor}
        title={actionsFor?.title}
        actions={actions}
        onClose={() => setActionsFor(null)}
      />

      <ActionSheet
        visible={!!deleting}
        title={t('history.delete.title')}
        message={
          deleting ? t('history.delete.body', { title: deleting.title }) : undefined
        }
        actions={
          deleting
            ? [
                {
                  label: t('common.delete'),
                  icon: Trash2,
                  destructive: true,
                  onPress: () => remove.mutate(deleting.id),
                },
              ]
            : []
        }
        onClose={() => setDeleting(null)}
      />

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
        title={t('common.rename')}
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

/**
 * The last conversation, as the one object this page leads with.
 *
 * brain-home is the standard, and its defining move is that ONE thing is big:
 * the sky is `lg`, everything else is `md` or under, and the eye is told
 * where to start. History had no such object — its largest type was the
 * screen title in the chrome — so it opened on forty equal rectangles and the
 * child had to read to find anything.
 *
 * Absent while searching: a child hunting for one chat does not want a card
 * promoting a different one in the way.
 */
function ContinueCard({
  conversation,
  projectName,
  tint,
  t,
  onOpen,
}: {
  conversation: ConversationSummary;
  projectName?: string;
  tint: string;
  t: TranslateFn;
  onOpen: () => void;
}) {
  const when = shortWhen(conversation.updated_at, t);
  const meta = [
    when,
    projectName,
    t('history.messageCount', { count: conversation.message_count }),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={t('history.a11y.continue', {
        title: conversation.title,
        when,
      })}
      style={({ pressed }) => [
        HERO_GLASS,
        styles.hero,
        pressed && styles.heroPressed,
        styles.focusable,
      ]}
    >
      <View style={styles.heroHead}>
        {/* Bigger than the 38/12 list tile on purpose — it is the same object
            one rung up, which is how the card says it outranks the rows
            without being a different design. */}
        <View style={[styles.heroTile, { backgroundColor: `${tint}22` }]}>
          <MessageSquare size={19} color={tint} strokeWidth={2.2} />
        </View>

        <View style={styles.fill}>
          <Text style={styles.heroKicker}>{t('history.continue')}</Text>
          <Text style={styles.heroMeta} numberOfLines={1}>
            {meta}
          </Text>
        </View>

        {/* The only filled control on the page, so where the card goes when
            you press it is not in question. */}
        <View style={styles.heroGo}>
          <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.6} />
        </View>
      </View>

      <Text style={styles.heroTitle} numberOfLines={2}>
        {conversation.title}
      </Text>

      {!!conversation.preview && (
        <Text style={styles.heroPreview} numberOfLines={2}>
          {conversation.preview}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * One bucket, as one pane.
 *
 * The card is the object and the rows are its contents, so they take `flush`
 * — edges, no drop. A row that casts a shadow onto the pane it is part of is
 * the tell that a design is stacking styles rather than modelling depth.
 */
function HistoryGroup({
  section,
  projectById,
  t,
  onOpen,
  onActions,
}: {
  section: HistorySection;
  projectById: Map<string, Project>;
  t: TranslateFn;
  onOpen: (c: ConversationSummary) => void;
  onActions: (c: ConversationSummary) => void;
}) {
  return (
    <View>
      <View style={styles.groupHead}>
        <Text style={styles.groupLabel}>{section.title}</Text>
        {/* The count is what turns a label into a heading: it says how much is
            under it before the child scrolls to find out. */}
        <Text style={styles.groupCount}>{section.data.length}</Text>
      </View>

      <View style={[CARD_GLASS, styles.groupCard]}>
        {section.data.map((conv, i) => {
          const project = conv.project_id
            ? projectById.get(conv.project_id)
            : undefined;
          return (
            <ConversationRow
              key={conv.id}
              conversation={conv}
              projectName={project?.name}
              tint={project?.colour ?? PRIMARY}
              ruled={i > 0}
              t={t}
              onOpen={onOpen}
              onActions={onActions}
            />
          );
        })}
      </View>
    </View>
  );
}

const ConversationRow = memo(function ConversationRow({
  conversation,
  projectName,
  tint,
  ruled,
  t,
  onOpen,
  onActions,
}: {
  conversation: ConversationSummary;
  projectName?: string;
  /** The project's colour, or PRIMARY when the chat is unfiled. */
  tint: string;
  /** Draw the rule above: every row but the first in its card. */
  ruled?: boolean;
  t: TranslateFn;
  onOpen: (c: ConversationSummary) => void;
  onActions: (c: ConversationSummary) => void;
}) {
  const when = shortWhen(conversation.updated_at, t);

  return (
    // The two controls are still SIBLINGS, not nested. A Pressable inside a
    // Pressable is a <button> inside a <button> on web: React warns about it,
    // browsers are free to reparent it, and the inner press has to fight the
    // outer one for the same tap.
    <View style={[styles.row, ruled && styles.rowRuled]}>
      <Pressable
        onPress={() => onOpen(conversation)}
        accessibilityRole="button"
        // The time and the project were both invisible to a screen reader
        // before, because the label was the title alone.
        accessibilityLabel={[conversation.title, when, projectName]
          .filter(Boolean)
          .join(', ')}
        style={({ pressed }) => [styles.rowTap, pressed && styles.rowPressed]}
      >
        {/* 38 / radius 12 / 12%-tint is still the icon tile shared with
            projects, project-detail and the drawer. Only the SOURCE of the
            tint moved: the project's own colour, which used to be an 8px dot
            on a third line nobody scans, now paints the one element the eye
            actually lands on. Unfiled chats keep PRIMARY, so the amount of
            colour in the list is exactly the amount of meaning in it. */}
        <View style={[styles.iconTile, { backgroundColor: `${tint}22` }]}>
          <MessageSquare size={17} color={tint} strokeWidth={2} />
        </View>

        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {conversation.title}
            </Text>
            <Text style={styles.rowWhen}>{when}</Text>
          </View>
          {/* Always a second line, never a conditional one. Three optional
              lines gave the list rows of ~66, ~86 and ~106pt in no order,
              which is what made a column of them look unlaid-out. The message
              count is the fallback because it is already fetched and was
              being thrown away. */}
          <Text style={styles.rowPreview} numberOfLines={1}>
            {conversation.preview ??
              t('history.messageCount', { count: conversation.message_count })}
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={() => onActions(conversation)}
        accessibilityRole="button"
        accessibilityLabel={t('common.actions')}
        hitSlop={10}
        style={[styles.moreButton, styles.focusable]}
      >
        <MoreVertical size={16} color={MUTED} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
});

/**
 * Six rows in a real card, so the layout does not jump when data lands.
 *
 * A bare centred spinner told the child nothing about what was coming AND let
 * the page reflow completely underneath them a moment later.
 */
const SKELETON_WIDTHS = ['64%', '48%', '72%', '55%', '68%', '42%'] as const;

function HistorySkeleton() {
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(0.85, { duration: 900 }), -1, true));
  }, [pulse]);
  const breathe = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  return (
    <View style={styles.listContent}>
      <View style={[CARD_GLASS, styles.groupCard]}>
        {SKELETON_WIDTHS.map((w, i) => (
          <View key={w + i} style={[styles.row, i > 0 && styles.rowRuled]}>
            <View style={styles.rowTap}>
              <Animated.View style={[styles.iconTile, styles.bone, breathe]} />
              <View style={styles.rowBody}>
                <Animated.View
                  style={[styles.boneLine, { width: w }, breathe]}
                />
                <Animated.View
                  style={[styles.boneLine, styles.boneLineThin, breathe]}
                />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
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
    flexGrow: 1, flexShrink: 1,
    fontSize: 22,
    fontWeight: '700',
    color: TITLE,
  },
  fill: { flex: 1 },

  // ── Search: an inline control, so it rests on the page rather than above it
  searchWrap: { paddingHorizontal: 20, paddingBottom: 8 },
  // minHeight, not height: at 200% system font scale a fixed pill clips the
  // text it exists to hold.
  search: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flexGrow: 1, flexShrink: 1,
    fontSize: 16,
    color: INK,
    paddingVertical: 0,
  },

  listContent: {
    paddingHorizontal: 20,
    // Room for the hero's `lg` ambient (y20/blur40) to fall inside the
    // scroller instead of being clipped at the top edge on Android.
    paddingTop: 8,
    paddingBottom: 48,
    gap: 22,
  },

  // ── The hero ───────────────────────────────────────────────────────────
  hero: { padding: 18 },
  heroPressed: { opacity: 0.9 },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroTile: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: PRIMARY,
  },
  heroMeta: { marginTop: 2, fontSize: 12, color: MUTED },
  heroGo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    boxShadow: lift('sm'),
  },
  // 20/700 against the rows' 15.5/600. The page's whole content range used to
  // be 16 → 12, three steps too close together to register as hierarchy.
  heroTitle: {
    marginTop: 14,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: INK,
  },
  heroPreview: { marginTop: 6, fontSize: 14, lineHeight: 20, color: MUTED },

  // ── Bucket groups ──────────────────────────────────────────────────────
  groupHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: MUTED,
  },
  groupCount: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
  // Hidden overflow so the first and last rows are cut by the card's radius
  // instead of squaring off its corners. Android clips children but not the
  // view's own shadow, so the card keeps its `md` drop.
  groupCard: { overflow: 'hidden' },

  // ── Rows: contents of the card, not objects on the page ────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 6,
  },
  // The rule goes BETWEEN rows, never around them — a border on all four
  // sides would draw a box inside a box. Tinted with TINT, the same navy the
  // shadows are made of, so it belongs to the light rather than sitting on
  // top of it as a grey line.
  rowRuled: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: `rgba(${TINT},0.14)`,
  },
  // Takes the row minus the three-dot button, so tapping anywhere in the text
  // still opens the conversation. minHeight, not height: a fixed row clips its
  // second line outright at 200% system font scale, and this app's readers
  // are 13.
  rowTap: {
    flex: 1,
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  // Load-bearing, not decorative: a row inside a clipped card cannot cast
  // anything outside it, so opacity is the whole press state.
  rowPressed: { opacity: 0.75 },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: {
    flexGrow: 1, flexShrink: 1,
    fontSize: 15.5,
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
  rowPreview: { marginTop: 2, fontSize: 13.5, color: MUTED },
  // 32pt was below the comfortable target and `hitSlop` does not grow the
  // clickable box on web, so the Pressable itself carries the size.
  moreButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Loading, empty and unreachable ─────────────────────────────────────
  stateWrap: { paddingHorizontal: 20, paddingTop: 8 },
  state: { alignItems: 'center', gap: 8, padding: 28, marginTop: 8 },
  stateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
  },
  stateBody: {
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    textAlign: 'center',
  },
  searchMiss: { alignItems: 'center', gap: 6, paddingVertical: 40 },

  bone: { backgroundColor: `rgba(${TINT},0.16)` },
  boneLine: { height: 11, borderRadius: 6, backgroundColor: `rgba(${TINT},0.16)` },
  boneLineThin: { marginTop: 8, height: 9, width: '34%' },
});
