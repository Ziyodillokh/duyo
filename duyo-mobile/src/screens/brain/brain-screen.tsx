import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Eye, List, Pencil, Plus, Search, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
import { KeyboardAvoidingView } from '@/components/keyboard-avoiding-view';
import {
  extractEmbeds,
  MarkdownNote,
  toggleCheckbox,
} from '@/components/markdown-note';
import { NoteGraph } from '@/components/note-graph';
import { colourForTag } from '@/lib/galaxy-layout';
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

export default function BrainScreen() {
  const isDark = useIsDark();
  const child = useChildStore((s) => s.child);
  const childId = child?.id ?? '';
  const qc = useQueryClient();

  const [screen, setScreen] = useState<Screen>({ kind: 'home' });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(false);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sort, setSort] = useState<NoteSort>('updated');
  const [peek, setPeek] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState('');
  const [listOpen, setListOpen] = useState(false);
  // null = auto. Only ever reaches the map for a note with no #tag; see
  // lib/galaxy-layout.ts colourOf for why a tag outranks it.
  const [colour, setColour] = useState<string | null>(null);

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

  const cardBg = isDark ? '#132340' : '#FFFFFF';
  // The note editor/preview is its own header mode; 'home' and 'map' share
  // the plain "Miya" header with a "+" instead of the back/preview/trash row.
  const editingNote = screen.kind === 'note' || screen.kind === 'new';

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Deep space, in both themes. The map draws white stars and coloured
          nebulae straight onto this backdrop, so a light background would not
          just look wrong — it would make half the sky invisible. The chrome
          above it (search, chips, cards) still follows the theme. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#070B1A' }]} />
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

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView className="flex-1">
          {/* Header */}
          <View className="flex-row items-center gap-2 px-6 py-4">
            {screen.kind !== 'home' && (
              <Pressable
                onPress={() => setScreen(editingNote ? { kind: 'map' } : { kind: 'home' })}
                accessibilityRole="button"
                accessibilityLabel={editingNote ? 'Xaritaga qaytish' : 'Bosh sahifaga qaytish'}
                className="w-10 h-10 items-center justify-center"
              >
                <ArrowLeft size={20} color={isDark ? '#E0E7FF' : '#102033'} />
              </Pressable>
            )}
            <Text className="text-xl font-bold text-foreground dark:text-dark-text flex-1">
              {editingNote ? (preview ? title || 'Qayd' : 'Tahrir') : 'Miya'}
            </Text>

            {editingNote ? (
              <View className="flex-row items-center gap-1">
                <Pressable
                  onPress={() => setPreview((p) => !p)}
                  accessibilityRole="button"
                  accessibilityLabel={preview ? 'Tahrirlash' : "Ko'rish"}
                  className="w-10 h-10 items-center justify-center rounded-md"
                  style={{ backgroundColor: 'rgba(96,165,250,0.15)' }}
                >
                  {preview ? (
                    <Pencil size={18} color="#60A5FA" />
                  ) : (
                    <Eye size={18} color="#60A5FA" />
                  )}
                </Pressable>
                {screen.kind === 'note' && (
                  <Pressable
                    onPress={() => remove.mutate(screen.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Qaydni o'chirish"
                    className="w-10 h-10 items-center justify-center"
                  >
                    <Trash2 size={18} color="#FB64B6" />
                  </Pressable>
                )}
              </View>
            ) : (
              <Pressable
                onPress={() => startNew()}
                accessibilityRole="button"
                accessibilityLabel="Yangi qayd"
                className="w-10 h-10 items-center justify-center rounded-md"
                style={{ backgroundColor: 'rgba(96,165,250,0.15)' }}
              >
                <Plus size={20} color="#60A5FA" />
              </Pressable>
            )}
          </View>

          {screen.kind === 'home' ? (
            <BrainHome
              childId={childId}
              notes={notes.data ?? []}
              tags={tags.data ?? []}
              graphNodes={graph.data?.nodes ?? []}
              graphEdges={graph.data?.edges ?? []}
              cardBg={cardBg}
              onNewNote={() => startNew()}
              onStartNote={(t) => startNew(t)}
              onOpenTag={(t) => {
                setActiveTag(t);
                setScreen({ kind: 'map' });
              }}
              onExploreGraph={() => setScreen({ kind: 'map' })}
            />
          ) : editingNote ? (
            <ScrollView contentContainerStyle={{ padding: 24, gap: 14, paddingBottom: 140 }}>
              {preview ? (
                <>
                  <View className="rounded-xl" style={{ padding: 16, backgroundColor: cardBg }}>
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
                      <Text className="text-sm text-muted-foreground dark:text-dark-muted">
                        Bu qayd hali bo'sh. Yozish uchun qalam tugmasini bos.
                      </Text>
                    )}
                  </View>

                  {!!backlinks.data?.length && (
                    <View className="rounded-xl" style={{ padding: 16, backgroundColor: cardBg }}>
                      <Text className="text-sm font-bold text-foreground dark:text-dark-text mb-2">
                        Bu qaydga bog'langanlar ({backlinks.data.length})
                      </Text>
                      {backlinks.data.map((b) => (
                        <Pressable
                          key={b.id}
                          onPress={() => open.mutate(b.id)}
                          accessibilityRole="button"
                          accessibilityLabel={b.title}
                          className="py-2 active:opacity-70"
                        >
                          <Text className="text-sm text-neon-blue">← {b.title}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {/* Obsidian's "unlinked mentions": notes that name this one
                      without linking it. The button does the typing. */}
                  {!!mentions.data?.length && (
                    <View className="rounded-xl" style={{ padding: 16, backgroundColor: cardBg }}>
                      <Text className="text-sm font-bold text-foreground dark:text-dark-text mb-1">
                        Nomi tilga olingan ({mentions.data.length})
                      </Text>
                      <Text className="text-xs text-muted-foreground dark:text-dark-muted mb-3">
                        Bu qaydlar seni eslatgan, lekin hali bog'lanmagan.
                      </Text>
                      {mentions.data.map((m) => (
                        <View key={m.id} className="flex-row items-center gap-3 py-2">
                          <Pressable
                            onPress={() => open.mutate(m.id)}
                            accessibilityRole="button"
                            accessibilityLabel={m.title}
                            className="flex-1 active:opacity-70"
                          >
                            <Text className="text-sm text-foreground dark:text-dark-text">
                              {m.title}
                            </Text>
                            {m.excerpt !== '' && (
                              <Text
                                className="text-xs text-muted-foreground dark:text-dark-muted"
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
                            className="rounded-md px-3 py-1.5 active:opacity-70"
                            style={{ backgroundColor: 'rgba(96,165,250,0.18)' }}
                          >
                            <Text className="text-xs text-neon-blue">Bog'lash</Text>
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
                    placeholderTextColor="#94A3B8"
                    maxLength={120}
                    accessibilityLabel="Qayd sarlavhasi"
                    className="text-lg font-bold text-foreground dark:text-dark-text rounded-md px-4 py-3"
                    style={{ backgroundColor: cardBg }}
                  />
                  <TextInput
                    value={body}
                    onChangeText={setBody}
                    placeholder={"Yozishni boshla…\n\n# Sarlavha\n- ro'yxat\n**qalin**  *qiya*\n[[boshqa qayd]]  #teg"}
                    placeholderTextColor="#94A3B8"
                    multiline
                    textAlignVertical="top"
                    maxLength={20000}
                    accessibilityLabel="Qayd matni"
                    className="text-base text-foreground dark:text-dark-text rounded-md px-4 py-3"
                    style={{ backgroundColor: cardBg, minHeight: 220 }}
                  />

                  <View className="flex-row justify-end">
                    <Text className="text-xs text-muted-foreground dark:text-dark-muted">
                      {words} so'z · {body.length} belgi
                    </Text>
                  </View>

                  {/* A child will not discover "[[" on their own, and a note
                      that links to nothing leaves the map a field of loose
                      dots. These two buttons are how the graph gets built. */}
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => setBody((p) => `${p}[[`)}
                      accessibilityRole="button"
                      accessibilityLabel="Boshqa qaydga bog'lash"
                      className="flex-1 rounded-md items-center justify-center active:opacity-70"
                      style={{ height: 42, backgroundColor: 'rgba(96,165,250,0.15)' }}
                    >
                      <Text className="text-sm text-neon-blue">🔗 Qaydga bog'lash</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setBody((p) => `${p}${p.endsWith(' ') || p === '' ? '' : ' '}#`)}
                      accessibilityRole="button"
                      accessibilityLabel="Teg qo'shish"
                      className="flex-1 rounded-md items-center justify-center active:opacity-70"
                      style={{ height: 42, backgroundColor: 'rgba(253,199,0,0.15)' }}
                    >
                      <Text className="text-sm" style={{ color: '#FDC700' }}>
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
                    <View
                      className="rounded-md px-3 py-2"
                      style={{ backgroundColor: 'rgba(253,199,0,0.10)' }}
                    >
                      <Text className="text-xs" style={{ color: '#FDC700' }}>
                        Rangni #teg belgilaydi — bir xil tegli qaydlar xaritada
                        bir rangda turadi.
                      </Text>
                    </View>
                  ) : (
                    <View className="gap-2">
                      <Text className="text-xs text-muted-foreground dark:text-dark-muted">
                        Xaritadagi rangi
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        <Pressable
                          onPress={() => setColour(null)}
                          accessibilityRole="button"
                          accessibilityLabel="Rang: avtomatik"
                          accessibilityState={{ selected: colour === null }}
                          className="rounded-full items-center justify-center active:opacity-70"
                          style={{
                            width: 34,
                            height: 34,
                            borderWidth: colour === null ? 2 : 1,
                            borderColor: colour === null ? '#E0E7FF' : 'rgba(150,180,255,0.35)',
                            backgroundColor: UNTAGGED,
                          }}
                        >
                          <Text style={{ fontSize: 11, color: '#0B1020' }}>A</Text>
                        </Pressable>
                        {PALETTE.map((c) => (
                          <Pressable
                            key={c}
                            onPress={() => setColour(c)}
                            accessibilityRole="button"
                            accessibilityLabel={`Rang ${c}`}
                            accessibilityState={{ selected: colour === c }}
                            className="rounded-full active:opacity-70"
                            style={{
                              width: 34,
                              height: 34,
                              backgroundColor: c,
                              borderWidth: colour === c ? 3 : 0,
                              borderColor: '#FFFFFF',
                            }}
                          />
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Tags the child already uses — tapping one is faster than
                      retyping it, and keeps #kosmos from becoming #kosmoss. */}
                  {!!tags.data?.length && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View className="flex-row gap-2">
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
                            className="rounded-full px-3 py-1.5 active:opacity-70"
                            style={{ backgroundColor: 'rgba(253,199,0,0.12)' }}
                          >
                            <Text className="text-xs" style={{ color: '#FDC700' }}>
                              #{t}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                  )}

                  {suggestions.length > 0 && (
                    <View className="rounded-md" style={{ backgroundColor: cardBg, padding: 6 }}>
                      {suggestions.map((s) => (
                        <Pressable
                          key={s.id}
                          onPress={() => completeLink(s.title)}
                          accessibilityRole="button"
                          accessibilityLabel={`${s.title} ga bog'lash`}
                          className="px-3 py-2 active:opacity-70"
                        >
                          <Text className="text-sm text-neon-blue">[[{s.title}]]</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  <Pressable
                    onPress={() => title.trim() && save.mutate()}
                    disabled={!title.trim() || save.isPending}
                    accessibilityRole="button"
                    accessibilityLabel="Saqlash"
                    className={`rounded-md items-center justify-center ${
                      title.trim() ? 'bg-neon-blue' : 'bg-neon-blue/40'
                    }`}
                    style={{ height: 52 }}
                  >
                    <Text className="text-base font-medium" style={{ color: '#0A1628' }}>
                      {save.isPending ? 'Saqlanmoqda…' : 'Saqlash'}
                    </Text>
                  </Pressable>
                  {save.isError && (
                    <Text className="text-sm text-neon-pink text-center">
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
            <View className="flex-1">
              {graph.isLoading ? (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator color="#60A5FA" />
                </View>
              ) : (
                <NoteGraph
                  nodes={graph.data?.nodes ?? []}
                  edges={graph.data?.edges ?? []}
                  onSelect={onSelectNode}
                />
              )}

              {/* Floating chrome, pinned to the top of the map. */}
              <View
                className="absolute left-0 right-0 top-0"
                style={{ paddingHorizontal: 16, paddingTop: 4, gap: 8, pointerEvents: 'box-none' }}
              >
                <View
                  className="flex-row items-center rounded-md gap-2 border border-neon-blue/20"
                  style={{ backgroundColor: cardBg, paddingHorizontal: 14, height: 42 }}
                >
                  <Search size={17} color="#94A3B8" />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Qaydlardan qidirish…"
                    placeholderTextColor="#94A3B8"
                    accessibilityLabel="Qaydlardan qidirish"
                    className="flex-1 text-base text-foreground dark:text-dark-text"
                  />
                </View>

                {!!tags.data?.length && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {/* Each chip wears its tag's own colour — the same one that
                        tag's star and everything filed under it carries on the
                        map. The filter row is therefore also the legend, and a
                        child reads the colours by using them. */}
                    {tags.data.map((t) => {
                      const on = activeTag === t;
                      const colour = colourForTag(t);
                      return (
                        <Pressable
                          key={t}
                          onPress={() => setActiveTag(on ? null : t)}
                          onLongPress={() => {
                            setRenaming(t);
                            setRenameTo(t);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`#${t}`}
                          className="rounded-md border flex-row items-center gap-2"
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderColor: on ? colour : 'rgba(150,180,255,0.22)',
                            backgroundColor: on ? `${colour}26` : 'rgba(11,16,32,0.55)',
                          }}
                        >
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: colour,
                            }}
                          />
                          <Text className="text-xs" style={{ color: on ? colour : '#DCE6FA' }}>
                            #{t}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}

                {renaming !== null && (
                  <View
                    className="rounded-md border border-neon-yellow/40 flex-row items-center gap-2"
                    style={{ padding: 8, backgroundColor: cardBg }}
                  >
                    <Text className="text-xs text-muted-foreground dark:text-dark-muted">
                      #{renaming} →
                    </Text>
                    <TextInput
                      value={renameTo}
                      onChangeText={setRenameTo}
                      autoFocus
                      maxLength={40}
                      accessibilityLabel="Tegning yangi nomi"
                      className="flex-1 text-sm text-foreground dark:text-dark-text px-2 py-1"
                    />
                    <Pressable
                      onPress={() => renameTo.trim() && rename.mutate()}
                      disabled={!renameTo.trim() || rename.isPending}
                      accessibilityRole="button"
                      accessibilityLabel="Tegni qayta nomlash"
                      className="rounded-md px-3 py-1.5 active:opacity-70"
                      style={{ backgroundColor: 'rgba(253,199,0,0.2)' }}
                    >
                      <Text className="text-xs" style={{ color: '#FDC700' }}>Saqlash</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setRenaming(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Bekor qilish"
                      className="px-2 py-1.5 active:opacity-70"
                    >
                      <Text className="text-xs text-muted-foreground dark:text-dark-muted">✕</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Searching replaces the map: you are looking for one note, not
                  reading the shape of everything. */}
              {query.trim() !== '' && (
                <View
                  className="absolute left-0 right-0 bottom-0"
                  style={{ top: 58, backgroundColor: isDark ? '#070B1A' : '#F4F8FF' }}
                >
                  <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 8 }}>
                    <Text className="text-base font-bold text-foreground dark:text-dark-text">
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
                        className="rounded-md border border-neon-blue/20 active:opacity-80"
                        style={{ padding: 14, backgroundColor: cardBg }}
                      >
                        <Text className="text-base text-foreground dark:text-dark-text">{r.title}</Text>
                        {r.excerpt !== '' && (
                          <Text className="text-xs text-muted-foreground dark:text-dark-muted mt-1" numberOfLines={2}>
                            {r.excerpt}
                          </Text>
                        )}
                      </Pressable>
                    ))}
                    {results.data?.length === 0 && (
                      <Text className="text-sm text-muted-foreground dark:text-dark-muted">
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
                  className="absolute rounded-full flex-row items-center gap-2 active:opacity-80"
                  style={{
                    right: 16,
                    bottom: 16,
                    paddingHorizontal: 16,
                    paddingVertical: 11,
                    backgroundColor: 'rgba(96,165,250,0.92)',
                  }}
                >
                  <List size={16} color="#0A1628" />
                  <Text className="text-sm font-medium" style={{ color: '#0A1628' }}>
                    {notes.data.length}
                  </Text>
                </Pressable>
              )}

              {listOpen && query.trim() === '' && (
                <View
                  className="absolute left-0 right-0 bottom-0 rounded-t-2xl border-t border-neon-blue/20"
                  style={{ maxHeight: '62%', backgroundColor: cardBg }}
                >
                  <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
                    <Text className="text-base font-bold text-foreground dark:text-dark-text">
                      {activeTag ? `#${activeTag}` : 'Qaydlar'} ({notes.data?.length ?? 0})
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <Pressable
                        onPress={() =>
                          setSort((prev) =>
                            prev === 'updated' ? 'created' : prev === 'created' ? 'title' : 'updated',
                          )
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Tartib: ${SORT_LABEL[sort]}`}
                        className="rounded-md px-3 py-1.5 active:opacity-70"
                        style={{ backgroundColor: 'rgba(96,165,250,0.12)' }}
                      >
                        <Text className="text-xs text-neon-blue">⇅ {SORT_LABEL[sort]}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setListOpen(false)}
                        accessibilityRole="button"
                        accessibilityLabel="Ro'yxatni yopish"
                        className="px-2 py-1.5 active:opacity-70"
                      >
                        <Text className="text-sm text-muted-foreground dark:text-dark-muted">✕</Text>
                      </Pressable>
                    </View>
                  </View>
                  <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 8 }}>
                    {notes.data?.map((n) => (
                      <Pressable
                        key={n.id}
                        onPress={() => {
                          setListOpen(false);
                          open.mutate(n.id);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={n.title}
                        className="rounded-md border border-neon-blue/20 active:opacity-80"
                        style={{ padding: 14 }}
                      >
                        <Text className="text-base text-foreground dark:text-dark-text">
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
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(4,10,22,0.6)', justifyContent: 'center', padding: 24 },
          ]}
        >
          <View
            className="rounded-xl border border-neon-blue/25"
            style={{ padding: 18, backgroundColor: cardBg, maxHeight: 380 }}
          >
            <Text className="text-base font-bold text-foreground dark:text-dark-text mb-2">
              {peek}
            </Text>
            {peeked.isLoading ? (
              <ActivityIndicator color="#60A5FA" />
            ) : peeked.data ? (
              <ScrollView>
                <MarkdownNote body={peeked.data.body} existing={existing} />
              </ScrollView>
            ) : (
              <Text className="text-sm text-muted-foreground dark:text-dark-muted">
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
              className="rounded-md items-center justify-center mt-3 active:opacity-70"
              style={{ height: 42, backgroundColor: 'rgba(96,165,250,0.18)' }}
            >
              <Text className="text-sm text-neon-blue">Ochish</Text>
            </Pressable>
          </View>
        </Pressable>
      )}
    </View>
  );
}
