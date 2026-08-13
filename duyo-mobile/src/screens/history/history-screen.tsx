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
  Text,
  TextInput,
  View,
} from 'react-native';
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
import { groupConversations } from '@/lib/history-groups';
import { useChatStore } from '@/store/chat';
import { useChildStore } from '@/store/child';
import { useIsDark } from '@/store/theme';

/**
 * "Suhbatlar" — every conversation this child has had, newest first.
 *
 * Grouped by recency rather than listed flat: a child looking for "the one
 * about the volcano" navigates by when it happened, not by scanning
 * timestamps.
 */
export default function HistoryScreen() {
  const isDark = useIsDark();
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
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' },
        ]}
      />
      <LinearGradient
        colors={['rgba(96, 165, 250, 0.20)', 'rgba(252, 211, 77, 0.15)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.97, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View className="flex-row items-center gap-3 px-5 py-3">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            className="w-10 h-10 items-center justify-center"
          >
            <ArrowLeft size={20} color={isDark ? '#E0E7FF' : '#102033'} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground dark:text-dark-text flex-1">
            Suhbatlar
          </Text>
          <Pressable
            onPress={() => router.push('/(main)/projects')}
            accessibilityRole="button"
            accessibilityLabel="Loyihalar"
            className="w-10 h-10 items-center justify-center rounded-md"
            style={{ backgroundColor: 'rgba(96,165,250,0.15)' }}
          >
            <FolderPlus size={18} color="#60A5FA" />
          </Pressable>
        </View>

        {/* Search only. "Yangi suhbat" lives in the chat drawer now — at the
            top of this list it competed with the list itself, and the child
            arrives here to FIND a conversation, not to leave for a new one. */}
        <View className="px-5 pb-2">
          <View
            className="flex-row items-center gap-2 rounded-xl border border-neon-blue/20 px-3"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
            }}
          >
            <Search size={16} color="#94A3B8" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Suhbatlardan qidirish..."
              placeholderTextColor="#94A3B8"
              accessibilityLabel="Suhbatlardan qidirish"
              className="flex-1 py-3 text-base text-foreground dark:text-dark-text"
            />
          </View>
        </View>

        {conversations.isLoading ? (
          <View className="items-center" style={{ padding: 32 }}>
            <ActivityIndicator color="#60A5FA" />
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 8 }}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (
              <Text className="text-xs font-bold uppercase text-muted-foreground dark:text-dark-muted mt-3 mb-1">
                {section.title}
              </Text>
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
              <View className="items-center" style={{ paddingVertical: 48 }}>
                <Text className="text-4xl">💬</Text>
                <Text className="text-base font-bold text-foreground dark:text-dark-text mt-3 text-center">
                  {query ? 'Hech narsa topilmadi' : 'Hali suhbat yo‘q'}
                </Text>
                <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1 text-center">
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
      className="rounded-xl border border-neon-blue/20 bg-card dark:bg-dark-surface active:opacity-80"
      style={{ padding: 14 }}
    >
      <View className="flex-row items-start gap-3">
        <View
          className="rounded-md items-center justify-center"
          style={{
            width: 34,
            height: 34,
            backgroundColor: 'rgba(96,165,250,0.12)',
          }}
        >
          <MessageSquare size={16} color="#60A5FA" />
        </View>

        <View className="flex-1">
          <Text
            className="text-base font-medium text-foreground dark:text-dark-text"
            numberOfLines={1}
          >
            {conversation.title}
          </Text>
          {!!conversation.preview && (
            <Text
              className="text-sm text-muted-foreground dark:text-dark-muted mt-0.5"
              numberOfLines={1}
            >
              {conversation.preview}
            </Text>
          )}
          {!!projectName && (
            <View className="flex-row items-center gap-1.5 mt-1.5">
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: projectColour ?? '#60A5FA',
                }}
              />
              <Text className="text-xs text-muted-foreground dark:text-dark-muted">
                {projectName}
              </Text>
            </View>
          )}
        </View>

        <Pressable
          onPress={onActions}
          accessibilityRole="button"
          accessibilityLabel="Amallar"
          hitSlop={10}
          className="w-8 h-8 items-center justify-center"
        >
          <MoreVertical size={16} color="#94A3B8" />
        </Pressable>
      </View>
    </Pressable>
  );
}
