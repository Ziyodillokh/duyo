import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react-native';
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
  listNotes,
  listTags,
  searchNotes,
  updateNote,
  type GraphNode,
} from '@/api/endpoints/notes';
import { KeyboardAvoidingView } from '@/components/keyboard-avoiding-view';
import { MarkdownNote } from '@/components/markdown-note';
import { NoteGraph } from '@/components/note-graph';
import { useChildStore } from '@/store/child';
import { useIsDark } from '@/store/theme';

type Screen =
  | { kind: 'map' }
  | { kind: 'note'; id: string }
  | { kind: 'new' };

// An unclosed [[ before the caret means the child is picking a link target.
const OPEN_LINK = /\[\[([^\[\]]*)$/;

export default function BrainScreen() {
  const isDark = useIsDark();
  const child = useChildStore((s) => s.child);
  const childId = child?.id ?? '';
  const qc = useQueryClient();

  const [screen, setScreen] = useState<Screen>({ kind: 'map' });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(false);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const graph = useQuery({
    queryKey: ['note-graph', childId],
    queryFn: () => getNoteGraph(childId),
    enabled: !!childId,
  });
  const notes = useQuery({
    queryKey: ['notes', childId],
    queryFn: () => listNotes(childId),
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
      setPreview(true);
      setScreen({ kind: 'note', id: note.id });
    },
  });

  const save = useMutation({
    mutationFn: async () =>
      screen.kind === 'note'
        ? updateNote(screen.id, { title: title.trim(), body })
        : createNote(childId, title.trim(), body),
    onSuccess: (note) => {
      refresh();
      void qc.invalidateQueries({ queryKey: ['backlinks', note.id] });
      setScreen({ kind: 'note', id: note.id });
      setPreview(true);
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

  const completeLink = (linkTitle: string) => {
    setBody((prev) => prev.replace(OPEN_LINK, `[[${linkTitle}]]`));
  };

  const cardBg = isDark ? '#132340' : '#FFFFFF';
  const editing = screen.kind !== 'map';

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' }]} />
      <LinearGradient
        colors={['rgba(96, 165, 250, 0.18)', 'rgba(96, 165, 250, 0.04)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView className="flex-1">
          {/* Header */}
          <View className="flex-row items-center gap-2 px-6 py-4">
            {editing && (
              <Pressable
                onPress={() => setScreen({ kind: 'map' })}
                accessibilityRole="button"
                accessibilityLabel="Xaritaga qaytish"
                className="w-10 h-10 items-center justify-center"
              >
                <ArrowLeft size={20} color={isDark ? '#E0E7FF' : '#102033'} />
              </Pressable>
            )}
            <Text className="text-xl font-bold text-foreground dark:text-dark-text flex-1">
              {editing ? (preview ? title || 'Qayd' : 'Tahrir') : 'Miya'}
            </Text>

            {editing ? (
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

          {editing ? (
            <ScrollView contentContainerStyle={{ padding: 24, gap: 14, paddingBottom: 140 }}>
              {preview ? (
                <>
                  <View className="rounded-xl" style={{ padding: 16, backgroundColor: cardBg }}>
                    {body.trim() ? (
                      <MarkdownNote
                        body={body}
                        onLinkPress={openByTitle}
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
            <ScrollView contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 120 }}>
              {/* Search */}
              <View
                className="flex-row items-center rounded-md gap-2 border border-neon-blue/20"
                style={{ backgroundColor: cardBg, paddingHorizontal: 14, height: 44 }}
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

              {/* Tags */}
              {!!tags.data?.length && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {tags.data.map((t) => {
                    const on = activeTag === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => setActiveTag(on ? null : t)}
                        accessibilityRole="button"
                        accessibilityLabel={`#${t}`}
                        className={`rounded-md border ${on ? 'border-neon-yellow' : 'border-neon-blue/20'}`}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          backgroundColor: on ? 'rgba(253,199,0,0.15)' : cardBg,
                        }}
                      >
                        <Text className={`text-xs ${on ? 'text-neon-yellow' : 'text-foreground dark:text-dark-text'}`}>
                          #{t}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              {query.trim() ? (
                <View className="gap-2">
                  <Text className="text-base font-bold text-foreground dark:text-dark-text">
                    Topildi ({results.data?.length ?? 0})
                  </Text>
                  {results.data?.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() => open.mutate(r.id)}
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
                </View>
              ) : (
                <>
                  <View className="rounded-xl border border-neon-blue/20" style={{ backgroundColor: cardBg }}>
                    {graph.isLoading ? (
                      <View className="items-center justify-center" style={{ height: 340 }}>
                        <ActivityIndicator color="#60A5FA" />
                      </View>
                    ) : (
                      <NoteGraph
                        nodes={graph.data?.nodes ?? []}
                        edges={graph.data?.edges ?? []}
                        onSelect={onSelectNode}
                      />
                    )}
                  </View>

                  {!!notes.data?.length && (
                    <View className="gap-2">
                      <Text className="text-base font-bold text-foreground dark:text-dark-text">
                        Qaydlar ({notes.data.length})
                      </Text>
                      {notes.data.map((n) => (
                        <Pressable
                          key={n.id}
                          onPress={() => open.mutate(n.id)}
                          accessibilityRole="button"
                          accessibilityLabel={n.title}
                          className="rounded-md border border-neon-blue/20 active:opacity-80"
                          style={{ padding: 14, backgroundColor: cardBg }}
                        >
                          <Text className="text-base text-foreground dark:text-dark-text">
                            {n.title}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
