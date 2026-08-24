import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  Eye,
  List,
  Pencil,
  Plus,
  Search,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createNote,
  deleteNote,
  getBacklinks,
  getNote,
  getNoteGraph,
  getUnlinkedMentions,
  linkMention,
  listNotes,
  listTags,
  renameTag,
  searchNotes,
  updateNote,
  type GraphNode,
  type NoteSort,
} from '@/api/endpoints/notes';
import { BrainBackdrop } from '@/components/brain-backdrop';
import { BrainClusterCard } from '@/components/brain-cluster-card';
import { GLASS, GlassCircle, raised } from '@/components/brain/glass';
import { KeyboardAvoidingView } from '@/components/keyboard-avoiding-view';
import {
  extractEmbeds,
  MarkdownNote,
  toggleCheckbox,
} from '@/components/markdown-note';
import { NoteGraph } from '@/components/note-graph';
import { useNavClearance } from '@/components/v2/dark/bottom-nav';
import { useUnreadNotificationCount } from '@/hooks/use-notifications';
import { colourForTag, PALETTE, UNTAGGED } from '@/lib/galaxy-layout';
import { useChildStore } from '@/store/child';
import { useIsDark } from '@/store/theme';

import BrainHome from './brain-home';

type Screen =
  | { kind: 'home' }
  | { kind: 'map' }
  | { kind: 'note'; id: string }
  | { kind: 'new' };

const SORT_LABEL: Record<NoteSort, string> = {
  updated: "O'zgargan",
  created: 'Yaratilgan',
  title: 'Nomi',
};

// An unclosed [[ before the caret means the child is picking a link target.
const OPEN_LINK = /\[\[([^\[\]]*)$/;

// ── Two palettes, because this screen has two grounds ────────────────────────
// The HOME page is light glass and takes its colours from GLASS
// (components/brain/glass.ts), the same tokens BrainHome paints with. Anything
// over the MAP sits on deep space in BOTH themes, so it keeps DUYO's neon
// vocabulary — a light glass pane there would hide the stars it floats over.
// Depth for both comes from lib/glass.ts through `raised()`, so the ladder is
// the app's and nothing here hand-rolls a shadow.

/** The map's chrome ink: the wordmark, and the outlined controls beside it. */
const SKY_INK = '#E8EEFF';
const SKY_INK_SOFT = '#DCE6FA';
/** DUYO's neon blue — every action that sits over the sky wears it. */
const ACCENT = '#60A5FA';
/** Ink on top of a filled ACCENT surface. */
const ON_ACCENT = '#0A1628';
const PINK = '#FB64B6';
const YELLOW = '#FDC700';
/** Body ink per theme — what `text-foreground dark:text-dark-text` resolved to. */
const INK_LIGHT = '#102033';
const INK_DARK = '#E0E7FF';
const MUTED_LIGHT = '#64748B';
const MUTED_DARK = '#94A3B8';
const PLACEHOLDER = '#94A3B8';
/** The hairline and the wash the accent leaves on a dark surface. */
const ACCENT_LINE = 'rgba(96,165,250,0.20)';
const ACCENT_WASH = 'rgba(96,165,250,0.15)';
const ACCENT_WASH_STRONG = 'rgba(96,165,250,0.18)';

export default function BrainScreen() {
  const isDark = useIsDark();
  const child = useChildStore((s) => s.child);
  const childId = child?.id ?? '';
  const qc = useQueryClient();

  const router = useRouter();
  const unreadQuery = useUnreadNotificationCount();
  const unread = unreadQuery.data?.count ?? 0;
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });
  // Sibling tabs go through this screen's navigator; router.push into
  // the (tabs) group from inside it is a silent no-op on web.
  const navigation = useNavigation() as { navigate(name: string): void };
  // The tab bar floats over this screen, so anything pinned to the bottom
  // has to start above its footprint or it is both invisible and, being
  // under a live bar, tappable only by the bar.
  const navClearance = useNavClearance();
  const toHomeTab = () => navigation.navigate('index');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sort, setSort] = useState<NoteSort>('updated');
  const [peek, setPeek] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState('');
  const [listOpen, setListOpen] = useState(false);
  // null = auto. Only ever reaches the map for a note with no #tag; see
  // lib/galaxy-layout.ts colourOf for why a tag outranks it.
  const [colour, setColour] = useState<string | null>(null);

  // Does the note being edited carry a #tag? Drives the colour row below,
  // which is hidden for a tagged note because the tag decides its colour on
  // the map. Same shape as the backend's _TAG (services/notes.py) and the
  // renderer's INLINE (components/markdown-note.tsx): a tag needs a leading
  // boundary, so "#FF0000" mid-sentence or a markdown "# heading" is not one.
  const hasTag = useMemo(
    () => /(?:^|\s)#(?!\d+(?:\s|$))[^\s#.,;:!?()[\]{}'"]{1,40}/.test(body),
    [body],
  );

  const graph = useQuery({
    queryKey: ['note-graph', childId],
    queryFn: () => getNoteGraph(childId),
    enabled: !!childId,
  });
  const notes = useQuery({
    queryKey: ['notes', childId, activeTag, sort],
    queryFn: () => listNotes(childId, activeTag ?? undefined, sort),
    enabled: !!childId,
  });
  const tags = useQuery({
    queryKey: ['note-tags', childId],
    queryFn: () => listTags(childId),
    enabled: !!childId,
  });
  const results = useQuery({
    queryKey: ['note-search', childId, query, activeTag],
    queryFn: () => searchNotes(childId, query, activeTag ?? undefined),
    enabled: !!childId && query.trim().length > 0,
  });
  const backlinks = useQuery({
    queryKey: ['backlinks', screen.kind === 'note' ? screen.id : null],
    queryFn: () => getBacklinks((screen as { id: string }).id),
    enabled: screen.kind === 'note',
  });

  const mentions = useQuery({
    queryKey: ['mentions', screen.kind === 'note' ? screen.id : null],
    queryFn: () => getUnlinkedMentions((screen as { id: string }).id),
    enabled: screen.kind === 'note',
  });

  // Every title the child has written, so a [[link]] to nothing reads as
  // unwritten rather than as a working link that goes nowhere.
  const existing = useMemo(
    () => new Set((notes.data ?? []).map((n) => n.title.toLowerCase())),
    [notes.data],
  );

  // ![[Embeds]] need the embedded note's body, which the list view omits.
  const embedIds = useMemo(() => {
    const wanted = extractEmbeds(body).map((t) => t.toLowerCase());
    return (notes.data ?? [])
      .filter((n) => wanted.includes(n.title.toLowerCase()))
      .map((n) => n.id);
  }, [body, notes.data]);

  const embedQueries = useQueries({
    queries: embedIds.map((id) => ({
      queryKey: ['note', id],
      queryFn: () => getNote(id),
    })),
  });

  const embeds = useMemo(() => {
    const map: Record<string, string> = {};
    for (const q of embedQueries) {
      if (q.data) map[q.data.title.toLowerCase()] = q.data.body;
    }
    return map;
  }, [embedQueries]);

  const peeked = useQuery({
    queryKey: ['peek', childId, peek],
    queryFn: async () => {
      const hit = (notes.data ?? []).find(
        (n) => n.title.toLowerCase() === peek?.toLowerCase(),
      );
      return hit ? getNote(hit.id) : null;
    },
    enabled: !!peek,
  });

  const refresh = () => {
    for (const key of ['note-graph', 'notes', 'note-tags', 'note-search']) {
      void qc.invalidateQueries({ queryKey: [key, childId] });
    }
  };

  const open = useMutation({
    mutationFn: (id: string) => getNote(id),
    onSuccess: (note) => {
      setTitle(note.title);
      setBody(note.body);
      setColour(note.colour);
      setPreview(true);
      setScreen({ kind: 'note', id: note.id });
    },
  });

  const save = useMutation({
    mutationFn: async () =>
      screen.kind === 'note'
        ? // '' is the backend's "clear it back to auto" — distinct from
          // omitting the key, which would leave the old colour in place.
          updateNote(screen.id, { title: title.trim(), body, colour: colour ?? '' })
        : createNote(childId, title.trim(), body, colour),
    onSuccess: (note) => {
      refresh();
      void qc.invalidateQueries({ queryKey: ['backlinks', note.id] });
      setScreen({ kind: 'note', id: note.id });
      setPreview(true);
    },
  });

  // Ticking a box is a save, not a draft edit — a child who ticks "uy vazifasi"
  // and closes the app expects it to still be ticked.
  const toggleCheck = useMutation({
    mutationFn: async (index: number) => {
      const next = toggleCheckbox(body, index);
      setBody(next);
      if (screen.kind !== 'note') return null;
      return updateNote(screen.id, { body: next });
    },
    onSuccess: () => refresh(),
  });

  const link = useMutation({
    mutationFn: (sourceId: string) =>
      linkMention((screen as { id: string }).id, sourceId),
    onSuccess: () => {
      refresh();
      void qc.invalidateQueries({ queryKey: ['mentions'] });
      void qc.invalidateQueries({ queryKey: ['backlinks'] });
    },
  });

  // Renaming a tag rewrites it in every note — a child who typed #kosmoss once
  // shouldn't be stuck with a second node meaning the same thing.
  const rename = useMutation({
    mutationFn: () => renameTag(childId, renaming ?? '', renameTo),
    onSuccess: () => {
      if (activeTag === renaming) setActiveTag(renameTo.trim().toLowerCase());
      setRenaming(null);
      setRenameTo('');
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => {
      refresh();
      setScreen({ kind: 'map' });
    },
  });

  const startNew = (preset = '') => {
    setTitle(preset);
    setBody('');
    setColour(null);
    setPreview(false);
    setScreen({ kind: 'new' });
  };

  const openByTitle = (linkTitle: string) => {
    const hit = notes.data?.find(
      (n) => n.title.toLowerCase() === linkTitle.toLowerCase(),
    );
    if (hit) open.mutate(hit.id);
    else startNew(linkTitle);
  };

  const onSelectNode = (node: GraphNode) => {
    // A tag node isn't a note — tapping it filters the map by that tag.
    if (node.kind === 'tag') {
      setActiveTag(node.title.replace(/^#/, '').toLowerCase());
      return;
    }
    if (node.id) open.mutate(node.id);
    else startNew(node.title);
  };

  // Link suggestions while typing [[…
  const suggestions = useMemo(() => {
    if (preview) return [];
    const m = OPEN_LINK.exec(body);
    if (!m) return [];
    const partial = m[1].toLowerCase();
    return (notes.data ?? [])
      .filter((n) => n.title.toLowerCase().includes(partial))
      .slice(0, 5);
  }, [body, notes.data, preview]);

  const words = useMemo(
    () => body.trim().split(/\s+/).filter(Boolean).length,
    [body],
  );

  const completeLink = (linkTitle: string) => {
    setBody((prev) => prev.replace(OPEN_LINK, `[[${linkTitle}]]`));
  };

  /**
   * The tag clusters, counted off the graph the map is already drawing —
   * a tag edge names the note filed under it, so the numbers come free
   * rather than from one request per tag.
   *
   * "Links" counts connections that stay INSIDE the cluster, which is the
   * number worth showing: it says how woven this collection is, where a
   * count of every edge touching it would mostly measure its size again.
   */
  const clusters = useMemo(() => {
    const edges = graph.data?.edges ?? [];
    const known = new Set(tags.data ?? []);
    const members = new Map<string, Set<string>>();
    for (const e of edges) {
      if (e.kind !== 'tag') continue;
      // A tag edge runs between the tag node and the note; whichever end is
      // the tag names the cluster.
      const tag = known.has(e.source) ? e.source : e.target;
      if (!known.has(tag)) continue;
      const note = tag === e.source ? e.target : e.source;
      let inside = members.get(tag);
      if (!inside) {
        inside = new Set<string>();
        members.set(tag, inside);
      }
      inside.add(note);
    }
    return (tags.data ?? [])
      .map((tag) => {
        const inside = members.get(tag) ?? new Set<string>();
        let links = 0;
        for (const e of edges) {
          if (e.kind === 'tag') continue;
          if (inside.has(e.source) && inside.has(e.target)) links++;
        }
        return { tag, colour: colourForTag(tag), notes: inside.size, links };
      })
      .sort((a, b) => b.notes - a.notes);
  }, [graph.data?.edges, tags.data]);

  const cardBg = isDark ? '#132340' : '#FFFFFF';
  // The two theme-dependent inks the classNames used to carry, as values.
  const inkText = { color: isDark ? INK_DARK : INK_LIGHT };
  const mutedText = { color: isDark ? MUTED_DARK : MUTED_LIGHT };
  // The note editor/preview is its own header mode; 'home' and 'map' share
  // the plain "Miya" header with a "+" instead of the back/preview/trash row.
  const editingNote = screen.kind === 'note' || screen.kind === 'new';

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Deep space, in both themes. The map draws white stars and coloured
          nebulae straight onto this backdrop, so a light background would not
          just look wrong — it would make half the sky invisible. The chrome
          above it (search, chips, cards) still follows the theme. */}
      {/* Two grounds, one screen. The MAP is immersive and stays deep space;
          the HOME is a light glass page carrying one dark sky card, so the
          card reads as a window rather than as the whole world. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: screen.kind === 'home' ? GLASS.pageTop : '#070B1A' },
        ]}
      />
      {screen.kind === 'home' && (
        <LinearGradient
          colors={[GLASS.pageTop, GLASS.pageBottom]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {screen.kind !== 'home' && (
        <LinearGradient
          colors={[
            'rgba(60, 3, 102, 0.55)',   // dark-bg-from, purple
            'rgba(81, 4, 36, 0.30)',    // dark-bg-mid, burgundy
            'rgba(22, 36, 86, 0.65)',   // dark-bg-to, navy
          ]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* The video backdrop, ABOVE the nebula gradient so the clip actually
          reads — stacking it under two tints muted it to nothing. It carries
          its own lighter tint instead, so swapping the video cannot change
          DUYO's colours.

          Screen level on purpose: the sky's pinch/pan transforms only
          NoteGraph's inner canvas, so anything out here is immune to the zoom
          — the planets scale against a backdrop that stays put.
          Swap the clip in src/config/brain-backdrop.ts. */}
      {screen.kind !== 'home' && <BrainBackdrop />}

      <SafeAreaView style={styles.fill} edges={['top']}>
        <KeyboardAvoidingView style={styles.fill}>
          {/* Header. The map gets its own: a wordmark between two bordered
              controls, and search folded behind a button so the sky keeps the
              whole screen until it is asked for. */}
          {screen.kind === 'map' ? (
            <View style={styles.mapHeader}>
              <MapButton
                Icon={ArrowLeft}
                label="Bosh sahifaga qaytish"
                onPress={() => setScreen({ kind: 'home' })}
              />
              <Text style={styles.mapWordmark}>DUYO MIYA</Text>
              <MapButton
                Icon={Search}
                label="Qidirish"
                on={searchOpen}
                onPress={() => {
                  setSearchOpen((v) => !v);
                  if (searchOpen) setQuery('');
                }}
              />
              <MapButton Icon={Plus} label="Yangi qayd" onPress={() => startNew()} />
            </View>
          ) : screen.kind === 'home' ? (
            /* Glass header. The wordmark carries the page, so the two controls
               beside it are round glass rather than boxed buttons — a bordered
               square next to a light glass circle reads as two design systems
               on one row.

               The left circle is the way OUT, not the profile. The dock is three
               doors (Bir maqsad · DUYO · Neo Miyya) and the hub is reached by
               going back, so every section carries one; Profil is one tap away
               on the home header. */
            <View style={styles.homeHeader}>
              <Pressable
                onPress={() => toHomeTab()}
                accessibilityRole="button"
                accessibilityLabel="Bosh sahifa"
                style={({ pressed }) => [styles.focusable, pressed && styles.pressed70]}
              >
                <GlassCircle size={52}>
                  <ArrowLeft size={22} color={GLASS.blue} strokeWidth={2.2} />
                </GlassCircle>
              </Pressable>

              <Text style={styles.homeWordmark}>DUYO</Text>

              <Pressable
                onPress={() => router.push('/(main)/notifications')}
                accessibilityRole="button"
                accessibilityLabel="Bildirishnomalar"
                style={({ pressed }) => [styles.focusable, pressed && styles.pressed70]}
              >
                <GlassCircle size={52}>
                  <Bell size={21} color={GLASS.blue} strokeWidth={2.2} />
                  {/* The unread dot. Shown only when there is something to
                      read — a badge that is always on stops being a signal. */}
                  {unread > 0 && <View style={styles.bellDot} />}
                </GlassCircle>
              </Pressable>
            </View>
          ) : (
          <View style={styles.noteHeader}>
            <Pressable
              onPress={() => setScreen({ kind: 'map' })}
              accessibilityRole="button"
              accessibilityLabel="Xaritaga qaytish"
              style={styles.iconButton}
            >
              <ArrowLeft size={20} color={inkText.color} />
            </Pressable>
            <Text style={[styles.noteHeaderTitle, inkText]}>
              {preview ? title || 'Qayd' : 'Tahrir'}
            </Text>

            <View style={styles.noteHeaderActions}>
              <Pressable
                onPress={() => setPreview((p) => !p)}
                accessibilityRole="button"
                accessibilityLabel={preview ? 'Tahrirlash' : "Ko'rish"}
                style={styles.previewToggle}
              >
                {preview ? (
                  <Pencil size={18} color={ACCENT} />
                ) : (
                  <Eye size={18} color={ACCENT} />
                )}
              </Pressable>
              {screen.kind === 'note' && (
                <Pressable
                  onPress={() => remove.mutate(screen.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Qaydni o'chirish"
                  style={styles.iconButton}
                >
                  <Trash2 size={18} color={PINK} />
                </Pressable>
              )}
            </View>
          </View>
          )}

          {screen.kind === 'home' ? (
            <View style={styles.fill}>
              <BrainHome
                notes={notes.data ?? []}
                graphNodes={graph.data?.nodes ?? []}
                graphEdges={graph.data?.edges ?? []}
                onNewNote={() => startNew()}
                onStartNote={(t) => startNew(t)}
                onOpenTag={(t) => {
                  setActiveTag(t);
                  setScreen({ kind: 'map' });
                }}
                onExploreGraph={() => setScreen({ kind: 'map' })}
                onOpenList={() => {
                  setScreen({ kind: 'map' });
                  setListOpen(true);
                }}
                onOpenNote={(id) => setScreen({ kind: 'note', id })}
              />

              {/* The floating quick-capture orb that used to sit here is gone.
                  The design puts "+" inside the sky card, so the orb was a
                  second control for the same action — and it landed on top of
                  the "So'nggi yozuvlar" heading, half-covering it. */}
            </View>
          ) : editingNote ? (
            <ScrollView contentContainerStyle={{ padding: 24, gap: 14, paddingBottom: navClearance + 24 }}>
              {preview ? (
                <>
                  <View style={[styles.card, { backgroundColor: cardBg }]}>
                    {body.trim() ? (
                      <MarkdownNote
                        body={body}
                        existing={existing}
                        embeds={embeds}
                        onToggleCheck={(i) => toggleCheck.mutate(i)}
                        onLinkPress={openByTitle}
                        onLinkHold={setPeek}
                        onTagPress={(t) => {
                          setActiveTag(t);
                          setQuery(t);
                          setScreen({ kind: 'map' });
                        }}
                      />
                    ) : (
                      <Text style={[styles.bodyText, mutedText]}>
                        Bu qayd hali bo'sh. Yozish uchun qalam tugmasini bos.
                      </Text>
                    )}
                  </View>

                  {!!backlinks.data?.length && (
                    <View style={[styles.card, { backgroundColor: cardBg }]}>
                      <Text style={[styles.cardTitle, inkText]}>
                        Bu qaydga bog'langanlar ({backlinks.data.length})
                      </Text>
                      {backlinks.data.map((b) => (
                        <Pressable
                          key={b.id}
                          onPress={() => open.mutate(b.id)}
                          accessibilityRole="button"
                          accessibilityLabel={b.title}
                          style={({ pressed }) => [
                            styles.backlinkRow,
                            pressed && styles.pressed70,
                          ]}
                        >
                          <Text style={styles.linkText}>← {b.title}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {/* Obsidian's "unlinked mentions": notes that name this one
                      without linking it. The button does the typing. */}
                  {!!mentions.data?.length && (
                    <View style={[styles.card, { backgroundColor: cardBg }]}>
                      <Text style={[styles.cardTitle, styles.cardTitleTight, inkText]}>
                        Nomi tilga olingan ({mentions.data.length})
                      </Text>
                      <Text style={[styles.caption, styles.cardNote, mutedText]}>
                        Bu qaydlar seni eslatgan, lekin hali bog'lanmagan.
                      </Text>
                      {mentions.data.map((m) => (
                        <View key={m.id} style={styles.mentionRow}>
                          <Pressable
                            onPress={() => open.mutate(m.id)}
                            accessibilityRole="button"
                            accessibilityLabel={m.title}
                            style={({ pressed }) => [
                              styles.mentionBody,
                              pressed && styles.pressed70,
                            ]}
                          >
                            <Text style={[styles.bodyText, inkText]}>
                              {m.title}
                            </Text>
                            {m.excerpt !== '' && (
                              <Text
                                style={[styles.caption, mutedText]}
                                numberOfLines={1}
                              >
                                {m.excerpt}
                              </Text>
                            )}
                          </Pressable>
                          <Pressable
                            onPress={() => link.mutate(m.id)}
                            disabled={link.isPending}
                            accessibilityRole="button"
                            accessibilityLabel={`${m.title} ni bog'lash`}
                            style={({ pressed }) => [
                              styles.smallButton,
                              styles.accentFillStrong,
                              pressed && styles.pressed70,
                            ]}
                          >
                            <Text style={styles.smallLinkText}>Bog'lash</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Sarlavha"
                    placeholderTextColor={PLACEHOLDER}
                    maxLength={120}
                    accessibilityLabel="Qayd sarlavhasi"
                    style={[styles.titleInput, inkText, { backgroundColor: cardBg }]}
                  />
                  <TextInput
                    value={body}
                    onChangeText={setBody}
                    placeholder={"Yozishni boshla…\n\n# Sarlavha\n- ro'yxat\n**qalin**  *qiya*\n[[boshqa qayd]]  #teg"}
                    placeholderTextColor={PLACEHOLDER}
                    multiline
                    textAlignVertical="top"
                    maxLength={20000}
                    accessibilityLabel="Qayd matni"
                    style={[styles.bodyInput, inkText, { backgroundColor: cardBg }]}
                  />

                  <View style={styles.countRow}>
                    <Text style={[styles.caption, mutedText]}>
                      {words} so'z · {body.length} belgi
                    </Text>
                  </View>

                  {/* A child will not discover "[[" on their own, and a note
                      that links to nothing leaves the map a field of loose
                      dots. These two buttons are how the graph gets built. */}
                  <View style={styles.actionRow}>
                    <Pressable
                      onPress={() => setBody((p) => `${p}[[`)}
                      accessibilityRole="button"
                      accessibilityLabel="Boshqa qaydga bog'lash"
                      style={({ pressed }) => [
                        styles.wideButton,
                        styles.accentFill,
                        pressed && styles.pressed70,
                      ]}
                    >
                      <Text style={styles.buttonLinkText}>🔗 Qaydga bog'lash</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setBody((p) => `${p}${p.endsWith(' ') || p === '' ? '' : ' '}#`)}
                      accessibilityRole="button"
                      accessibilityLabel="Teg qo'shish"
                      style={({ pressed }) => [
                        styles.wideButton,
                        styles.tagFill,
                        pressed && styles.pressed70,
                      ]}
                    >
                      <Text style={styles.buttonTagText}>
                        # Teg qo'shish
                      </Text>
                    </Pressable>
                  </View>

                  {/* Colour. Offered ONLY while the note carries no #tag: a
                      tagged note takes its tag's colour on the map (see
                      lib/galaxy-layout.ts), so a picker here would let the
                      child choose something they then never see. When a tag
                      is present we say so instead of hiding the row silently
                      — otherwise adding a tag looks like it broke the
                      feature. */}
                  {hasTag ? (
                    <View style={styles.tagNotice}>
                      <Text style={styles.tagNoticeText}>
                        Rangni #teg belgilaydi — bir xil tegli qaydlar xaritada
                        bir rangda turadi.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.colourBlock}>
                      <Text style={[styles.caption, mutedText]}>
                        Xaritadagi rangi
                      </Text>
                      <View style={styles.swatchRow}>
                        <Pressable
                          onPress={() => setColour(null)}
                          accessibilityRole="button"
                          accessibilityLabel="Rang: avtomatik"
                          accessibilityState={{ selected: colour === null }}
                          style={({ pressed }) => [
                            styles.swatch,
                            styles.focusable,
                            {
                              borderWidth: colour === null ? 2 : 1,
                              borderColor: colour === null ? '#E0E7FF' : 'rgba(150,180,255,0.35)',
                              backgroundColor: UNTAGGED,
                            },
                            pressed && styles.pressed70,
                          ]}
                        >
                          <Text style={styles.swatchAutoText}>A</Text>
                        </Pressable>
                        {PALETTE.map((c) => (
                          <Pressable
                            key={c}
                            onPress={() => setColour(c)}
                            accessibilityRole="button"
                            accessibilityLabel={`Rang ${c}`}
                            accessibilityState={{ selected: colour === c }}
                            style={({ pressed }) => [
                              styles.swatch,
                              styles.focusable,
                              {
                                backgroundColor: c,
                                borderWidth: colour === c ? 3 : 0,
                                borderColor: '#FFFFFF',
                              },
                              pressed && styles.pressed70,
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Tags the child already uses — tapping one is faster than
                      retyping it, and keeps #kosmos from becoming #kosmoss. */}
                  {!!tags.data?.length && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.chipRow}>
                        {tags.data.slice(0, 12).map((t) => (
                          <Pressable
                            key={t}
                            onPress={() =>
                              setBody((p) =>
                                `${p}${p.endsWith(' ') || p === '' ? '' : ' '}#${t} `,
                              )
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`#${t} tegini qo'shish`}
                            style={({ pressed }) => [
                              styles.tagChip,
                              styles.focusable,
                              pressed && styles.pressed70,
                            ]}
                          >
                            <Text style={styles.tagChipText}>
                              #{t}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                  )}

                  {suggestions.length > 0 && (
                    <View style={[styles.suggestions, { backgroundColor: cardBg }]}>
                      {suggestions.map((s) => (
                        <Pressable
                          key={s.id}
                          onPress={() => completeLink(s.title)}
                          accessibilityRole="button"
                          accessibilityLabel={`${s.title} ga bog'lash`}
                          style={({ pressed }) => [
                            styles.suggestionRow,
                            pressed && styles.pressed70,
                          ]}
                        >
                          <Text style={styles.linkText}>[[{s.title}]]</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  <Pressable
                    onPress={() => title.trim() && save.mutate()}
                    disabled={!title.trim() || save.isPending}
                    accessibilityRole="button"
                    accessibilityLabel="Saqlash"
                    style={[styles.save, title.trim() ? styles.saveOn : styles.saveOff]}
                  >
                    <Text style={styles.saveText}>
                      {save.isPending ? 'Saqlanmoqda…' : 'Saqlash'}
                    </Text>
                  </Pressable>
                  {save.isError && (
                    <Text style={styles.error}>
                      Saqlab bo'lmadi — bu nomli qayd allaqachon bormi?
                    </Text>
                  )}
                </>
              )}
            </ScrollView>
          ) : (
            /* The map owns the screen, the way Obsidian's graph view does.
               Search, tags and the note list float over it or slide up from
               the bottom, so the graph is never a thumbnail in a card with
               the real content underneath it. */
            <View style={styles.fill}>
              {graph.isLoading ? (
                <View style={styles.center}>
                  <ActivityIndicator color={ACCENT} />
                </View>
              ) : (
                <NoteGraph
                  nodes={graph.data?.nodes ?? []}
                  edges={graph.data?.edges ?? []}
                  onSelect={onSelectNode}
                />
              )}

              {/* Floating chrome, pinned to the top of the map. */}
              <View style={styles.mapChrome}>
                {searchOpen && (
                  <View style={[styles.mapSearch, { backgroundColor: cardBg }]}>
                    <Search size={17} color={PLACEHOLDER} />
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder="Qaydlardan qidirish…"
                      placeholderTextColor={PLACEHOLDER}
                      accessibilityLabel="Qaydlardan qidirish"
                      autoFocus
                      style={[styles.mapSearchInput, inkText]}
                    />
                  </View>
                )}

                {/* Every #tag, as one scrolling strip.
                    This replaced six cards pinned over the canvas. They were
                    placed at the edges on the theory that gravity keeps notes
                    in the middle, but with real notes they landed on top of
                    planets and on top of the map's own tag labels — the
                    landmark was hiding the thing it marked. A strip costs one
                    line, covers nothing, and has no six-item cap. */}
                {!!clusters.length && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.clusterStrip}
                  >
                    {/* Each chip wears its tag's own colour — the same one that
                        tag's star and everything filed under it carries on the
                        map. The filter row is therefore also the legend, and a
                        child reads the colours by using them. */}
                    {clusters.map((c) => (
                      <BrainClusterCard
                        key={c.tag}
                        cluster={c}
                        active={activeTag === c.tag}
                        onPress={() =>
                          setActiveTag(activeTag === c.tag ? null : c.tag)
                        }
                        onLongPress={() => {
                          setRenaming(c.tag);
                          setRenameTo(c.tag);
                        }}
                      />
                    ))}
                  </ScrollView>
                )}

                {renaming !== null && (
                  <View style={[styles.renameBar, { backgroundColor: cardBg }]}>
                    <Text style={[styles.caption, mutedText]}>
                      #{renaming} →
                    </Text>
                    <TextInput
                      value={renameTo}
                      onChangeText={setRenameTo}
                      autoFocus
                      maxLength={40}
                      accessibilityLabel="Tegning yangi nomi"
                      style={[styles.renameInput, inkText]}
                    />
                    <Pressable
                      onPress={() => renameTo.trim() && rename.mutate()}
                      disabled={!renameTo.trim() || rename.isPending}
                      accessibilityRole="button"
                      accessibilityLabel="Tegni qayta nomlash"
                      style={({ pressed }) => [
                        styles.smallButton,
                        styles.yellowFillStrong,
                        pressed && styles.pressed70,
                      ]}
                    >
                      <Text style={styles.smallTagText}>Saqlash</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setRenaming(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Bekor qilish"
                      style={({ pressed }) => [
                        styles.glyphButton,
                        pressed && styles.pressed70,
                      ]}
                    >
                      <Text style={[styles.caption, mutedText]}>✕</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Searching replaces the map: you are looking for one note, not
                  reading the shape of everything. */}
              {query.trim() !== '' && (
                <View
                  style={[
                    styles.resultsSheet,
                    {
                      bottom: navClearance,
                      backgroundColor: isDark ? '#070B1A' : '#F4F8FF',
                    },
                  ]}
                >
                  <ScrollView contentContainerStyle={styles.resultsContent}>
                    <Text style={[styles.sheetTitle, inkText]}>
                      Topildi ({results.data?.length ?? 0})
                    </Text>
                    {results.data?.map((r) => (
                      <Pressable
                        key={r.id}
                        onPress={() => {
                          setQuery('');
                          open.mutate(r.id);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={r.title}
                        style={({ pressed }) => [
                          styles.resultRow,
                          { backgroundColor: cardBg },
                          pressed && styles.pressed80,
                        ]}
                      >
                        <Text style={[styles.resultTitle, inkText]}>{r.title}</Text>
                        {r.excerpt !== '' && (
                          <Text style={[styles.caption, styles.resultExcerpt, mutedText]} numberOfLines={2}>
                            {r.excerpt}
                          </Text>
                        )}
                      </Pressable>
                    ))}
                    {results.data?.length === 0 && (
                      <Text style={[styles.bodyText, mutedText]}>
                        Hech narsa topilmadi.
                      </Text>
                    )}
                  </ScrollView>
                </View>
              )}

              {/* The list still exists — it just no longer takes the map's place. */}
              {query.trim() === '' && !!notes.data?.length && !listOpen && (
                <Pressable
                  onPress={() => setListOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Qaydlar ro'yxati"
                  style={({ pressed }) => [
                    styles.listFab,
                    styles.focusable,
                    { bottom: navClearance + 8 },
                    pressed && styles.pressed80,
                  ]}
                >
                  <List size={16} color={ON_ACCENT} />
                  <Text style={styles.listFabText}>
                    {notes.data.length}
                  </Text>
                </Pressable>
              )}

              {listOpen && query.trim() === '' && (
                <View
                  style={[
                    styles.listSheet,
                    { bottom: navClearance, backgroundColor: cardBg },
                  ]}
                >
                  <View style={styles.listHeader}>
                    <Text style={[styles.sheetTitle, inkText]}>
                      {activeTag ? `#${activeTag}` : 'Qaydlar'} ({notes.data?.length ?? 0})
                    </Text>
                    <View style={styles.listHeaderActions}>
                      <Pressable
                        onPress={() =>
                          setSort((prev) =>
                            prev === 'updated' ? 'created' : prev === 'created' ? 'title' : 'updated',
                          )
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Tartib: ${SORT_LABEL[sort]}`}
                        style={({ pressed }) => [
                          styles.smallButton,
                          styles.accentFillSoft,
                          pressed && styles.pressed70,
                        ]}
                      >
                        <Text style={styles.smallLinkText}>⇅ {SORT_LABEL[sort]}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setListOpen(false)}
                        accessibilityRole="button"
                        accessibilityLabel="Ro'yxatni yopish"
                        style={({ pressed }) => [
                          styles.glyphButton,
                          pressed && styles.pressed70,
                        ]}
                      >
                        <Text style={[styles.bodyText, mutedText]}>✕</Text>
                      </Pressable>
                    </View>
                  </View>
                  <ScrollView contentContainerStyle={styles.listContent}>
                    {notes.data?.map((n) => (
                      <Pressable
                        key={n.id}
                        onPress={() => {
                          setListOpen(false);
                          open.mutate(n.id);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={n.title}
                        style={({ pressed }) => [
                          styles.listRow,
                          pressed && styles.pressed80,
                        ]}
                      >
                        <Text style={[styles.resultTitle, inkText]}>
                          {n.title}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Press-and-hold preview. Obsidian shows this on Ctrl+hover; a phone
          has no hover, so a long press opens it and a tap anywhere closes. */}
      {peek !== null && (
        <Pressable
          onPress={() => setPeek(null)}
          accessibilityRole="button"
          accessibilityLabel="Ko'rinishni yopish"
          style={[StyleSheet.absoluteFill, styles.peekBackdrop]}
        >
          <View style={[styles.peekCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.peekTitle, inkText]}>
              {peek}
            </Text>
            {peeked.isLoading ? (
              <ActivityIndicator color={ACCENT} />
            ) : peeked.data ? (
              <ScrollView>
                <MarkdownNote body={peeked.data.body} existing={existing} />
              </ScrollView>
            ) : (
              <Text style={[styles.bodyText, mutedText]}>
                Bu qayd hali yozilmagan.
              </Text>
            )}
            <Pressable
              onPress={() => {
                const t = peek;
                setPeek(null);
                openByTitle(t);
              }}
              accessibilityRole="button"
              accessibilityLabel="Qaydni ochish"
              style={({ pressed }) => [styles.peekOpen, pressed && styles.pressed70]}
            >
              <Text style={styles.linkText}>Ochish</Text>
            </Pressable>
          </View>
        </Pressable>
      )}
    </View>
  );
}

/**
 * A control in the map's header: an outlined square, lit when its mode is on.
 * The map has no surface of its own to sit a plain icon on — the sky runs
 * edge to edge — so each control brings its own border to stay legible over
 * whatever drifts behind it.
 */
function MapButton({
  Icon,
  label,
  onPress,
  on = false,
}: {
  Icon: LucideIcon;
  label: string;
  onPress: () => void;
  on?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [
        styles.mapButton,
        styles.focusable,
        {
          borderColor: on ? ACCENT : 'rgba(150, 180, 255, 0.22)',
          backgroundColor: on ? 'rgba(96, 165, 250, 0.18)' : 'rgba(11, 16, 32, 0.55)',
        },
        pressed && styles.pressed70,
      ]}
    >
      <Icon size={18} color={on ? ACCENT : SKY_INK_SOFT} />
    </Pressable>
  );
}

// Depth comes from `raised()` — lib/glass.ts's ladder — never from a shadow
// written here. Over the sky it is applied to the screen's own dark surfaces
// rather than through `glass()`, whose white fill is built for the light page
// and would fog the stars a floating pane is supposed to sit in front of.
const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // The browser's default focus ring is a black rectangle around a round
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
  pressed70: { opacity: 0.7 },
  pressed80: { opacity: 0.8 },

  // ── Headers ────────────────────────────────────────────────────────────
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mapWordmark: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: SKY_INK,
    letterSpacing: 4,
  },
  homeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  homeWordmark: {
    flex: 1,
    textAlign: 'center',
    fontSize: 25,
    fontWeight: '700',
    color: GLASS.blue,
    letterSpacing: 7,
  },
  bellDot: {
    position: 'absolute',
    top: 12,
    right: 13,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: GLASS.blue,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  noteHeaderTitle: { flex: 1, fontSize: 20, lineHeight: 28, fontWeight: '700' },
  noteHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewToggle: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: ACCENT_WASH,
  },

  // ── Type ───────────────────────────────────────────────────────────────
  bodyText: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
  cardTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', marginBottom: 8 },
  cardTitleTight: { marginBottom: 4 },
  cardNote: { marginBottom: 12 },
  linkText: { fontSize: 14, lineHeight: 20, color: ACCENT },
  smallLinkText: { fontSize: 12, lineHeight: 16, color: ACCENT },
  smallTagText: { fontSize: 12, lineHeight: 16, color: YELLOW },

  // ── The note, read ─────────────────────────────────────────────────────
  card: { borderRadius: 20, padding: 16, ...raised('md') },
  backlinkRow: { paddingVertical: 8 },
  mentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  mentionBody: { flex: 1 },
  // A labelled button, so the 32pt floor comes from minHeight rather than
  // from the 6pt padding the class used to give it.
  smallButton: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentFill: { backgroundColor: ACCENT_WASH },
  accentFillSoft: { backgroundColor: 'rgba(96,165,250,0.12)' },
  accentFillStrong: { backgroundColor: ACCENT_WASH_STRONG },
  tagFill: { backgroundColor: 'rgba(253,199,0,0.15)' },
  yellowFillStrong: { backgroundColor: 'rgba(253,199,0,0.20)' },

  // ── The note, written ──────────────────────────────────────────────────
  titleInput: {
    fontSize: 18,
    fontWeight: '700',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bodyInput: {
    fontSize: 16,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 220,
  },
  countRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  actionRow: { flexDirection: 'row', gap: 8 },
  wideButton: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLinkText: { fontSize: 14, lineHeight: 20, color: ACCENT },
  buttonTagText: { fontSize: 14, lineHeight: 20, color: YELLOW },

  tagNotice: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(253,199,0,0.10)',
  },
  tagNoticeText: { fontSize: 12, lineHeight: 16, color: YELLOW },

  colourBlock: { gap: 8 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchAutoText: { fontSize: 11, color: '#0B1020' },

  chipRow: { flexDirection: 'row', gap: 8 },
  tagChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(253,199,0,0.12)',
  },
  tagChipText: { fontSize: 12, lineHeight: 16, color: YELLOW },

  suggestions: { borderRadius: 14, padding: 6, ...raised('sm') },
  suggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },

  save: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Only the live button is lifted; a button that cannot be pressed has no
  // business floating off the page.
  saveOn: { backgroundColor: ACCENT, ...raised('md') },
  saveOff: { backgroundColor: 'rgba(96,165,250,0.40)' },
  saveText: { fontSize: 16, lineHeight: 24, fontWeight: '500', color: ON_ACCENT },
  error: { fontSize: 14, lineHeight: 20, color: PINK, textAlign: 'center' },

  // ── Chrome floating over the map ───────────────────────────────────────
  mapChrome: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 8,
    pointerEvents: 'box-none',
  },
  mapSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ACCENT_LINE,
    ...raised('md'),
  },
  // paddingVertical 0: a web <input> brings its own and would push the bar
  // past the 42pt the map's chrome is measured on.
  mapSearchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  clusterStrip: { gap: 8, paddingRight: 16 },
  renameBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(253,199,0,0.40)',
    ...raised('md'),
  },
  renameInput: {
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  // A glyph is not an icon component, so it carries no size of its own —
  // without this the ✕ was a 19pt target.
  glyphButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Search results, over the map ───────────────────────────────────────
  resultsSheet: { position: 'absolute', left: 0, right: 0, top: 58 },
  resultsContent: { padding: 16, paddingTop: 8, gap: 8 },
  sheetTitle: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  // Rows drawn ON another surface: edges only, no drop. A pane that casts a
  // shadow onto the pane it belongs to is what makes glass look stacked.
  resultRow: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ACCENT_LINE,
    ...raised('flush'),
  },
  resultTitle: { fontSize: 16, lineHeight: 24 },
  resultExcerpt: { marginTop: 4 },

  // ── The note list ──────────────────────────────────────────────────────
  listFab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: 'rgba(96,165,250,0.92)',
    ...raised('xl'),
  },
  listFabText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: ON_ACCENT },
  listSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    maxHeight: '62%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: ACCENT_LINE,
    ...raised('xl'),
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  listHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listContent: { padding: 16, paddingTop: 4, gap: 8 },
  listRow: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ACCENT_LINE,
    ...raised('flush'),
  },

  // ── The press-and-hold preview ─────────────────────────────────────────
  peekBackdrop: {
    backgroundColor: 'rgba(4,10,22,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  peekCard: {
    padding: 18,
    maxHeight: 380,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.25)',
    ...raised('xl'),
  },
  peekTitle: { fontSize: 16, lineHeight: 24, fontWeight: '700', marginBottom: 8 },
  peekOpen: {
    height: 42,
    marginTop: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_WASH_STRONG,
  },

  // ── The map's own header controls ──────────────────────────────────────
  // radius 20 on a 40pt box is a circle, which is why it takes `focusable`.
  mapButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
  },
});
