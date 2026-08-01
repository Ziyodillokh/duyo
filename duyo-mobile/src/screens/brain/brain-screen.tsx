import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
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
  getNote,
  getNoteGraph,
  listNotes,
  updateNote,
  type GraphNode,
} from '@/api/endpoints/notes';
import { KeyboardAvoidingView } from '@/components/keyboard-avoiding-view';
import { NoteGraph } from '@/components/note-graph';
import { useChildStore } from '@/store/child';
import { useIsDark } from '@/store/theme';

type View_ = { kind: 'map' } | { kind: 'note'; id: string } | { kind: 'new'; title: string };

/**
 * Miya — the child's own linked notes, drawn as a graph.
 *
 * Writing [[Kosmos]] inside a note creates a link. If that note doesn't exist
 * yet it still appears on the map as a hollow dot, and tapping it starts
 * writing — the map runs slightly ahead of what's been written, which is what
 * makes it pull the child forward.
 */
export default function BrainScreen() {
  const isDark = useIsDark();
  const child = useChildStore((s) => s.child);
  const childId = child?.id ?? '';
  const qc = useQueryClient();

  const [view, setView] = useState<View_>({ kind: 'map' });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

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

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['note-graph', childId] });
    void qc.invalidateQueries({ queryKey: ['notes', childId] });
  };

  const open = useMutation({
    mutationFn: (id: string) => getNote(id),
    onSuccess: (note) => {
      setTitle(note.title);
      setBody(note.body);
      setView({ kind: 'note', id: note.id });
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (view.kind === 'note') {
        return updateNote(view.id, { title: title.trim(), body });
      }
      return createNote(childId, title.trim(), body);
    },
    onSuccess: (note) => {
      refresh();
      setView({ kind: 'note', id: note.id });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => {
      refresh();
      setView({ kind: 'map' });
    },
  });

  const startNew = (preset = '') => {
    setTitle(preset);
    setBody('');
    setView({ kind: 'new', title: preset });
  };

  const onSelectNode = (node: GraphNode) => {
    // A written note opens; an unwritten one starts itself, pre-titled.
    if (node.id) open.mutate(node.id);
    else startNew(node.title);
  };

  const cardBg = isDark ? '#132340' : '#FFFFFF';
  const editing = view.kind !== 'map';

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
          <View className="flex-row items-center gap-3 px-6 py-4">
            {editing && (
              <Pressable
                onPress={() => setView({ kind: 'map' })}
                accessibilityRole="button"
                accessibilityLabel="Xaritaga qaytish"
                className="w-10 h-10 items-center justify-center"
              >
                <ArrowLeft size={20} color={isDark ? '#E0E7FF' : '#102033'} />
              </Pressable>
            )}
            <Text className="text-xl font-bold text-foreground dark:text-dark-text">
              {editing ? 'Qayd' : 'Miya'}
            </Text>
            {!editing && (
              <Pressable
                onPress={() => startNew()}
                accessibilityRole="button"
                accessibilityLabel="Yangi qayd"
                className="ml-auto w-10 h-10 items-center justify-center rounded-md"
                style={{ backgroundColor: 'rgba(96,165,250,0.15)' }}
              >
                <Plus size={20} color="#60A5FA" />
              </Pressable>
            )}
            {view.kind === 'note' && (
              <Pressable
                onPress={() => remove.mutate(view.id)}
                accessibilityRole="button"
                accessibilityLabel="Qaydni o'chirish"
                className="ml-auto w-10 h-10 items-center justify-center"
              >
                <Trash2 size={18} color="#FB64B6" />
              </Pressable>
            )}
          </View>

          {editing ? (
            <ScrollView contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 120 }}>
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
                placeholder="Yozishni boshla... Boshqa qaydga bog'lash uchun [[nom]] yoz."
                placeholderTextColor="#94A3B8"
                multiline
                textAlignVertical="top"
                maxLength={20000}
                accessibilityLabel="Qayd matni"
                className="text-base text-foreground dark:text-dark-text rounded-md px-4 py-3"
                style={{ backgroundColor: cardBg, minHeight: 240 }}
              />
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
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 120 }}>
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
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
