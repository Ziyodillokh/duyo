import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Folder,
  MoreVertical,
  Plus,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  type Project,
  PROJECT_COLOURS,
  projectErrorMessage,
} from '@/api/endpoints/conversations';
import { TextPrompt } from '@/components/history/text-prompt';
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useUpdateProject,
} from '@/hooks/use-history';
import { useChildStore } from '@/store/child';
import { useIsDark } from '@/store/theme';

/**
 * "Loyihalar" — folders a child groups related conversations into.
 *
 * A project is more than a folder because of its instructions: notes written
 * once ("menga 6-sinf darajasida tushuntir") that apply to every chat inside
 * it, so they need not be repeated at the top of each one.
 */
export default function ProjectsScreen() {
  const isDark = useIsDark();
  const child = useChildStore((s) => s.child);
  const childId = child?.id;

  const projects = useProjects(childId);
  const create = useCreateProject(childId);
  const update = useUpdateProject(childId);
  const remove = useDeleteProject(childId);

  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Project | null>(null);
  const [editingInstructions, setEditingInstructions] = useState<Project | null>(
    null,
  );

  const failed = (err: unknown) =>
    Alert.alert('Saqlanmadi', projectErrorMessage(err));

  const confirmDelete = (project: Project) =>
    Alert.alert(
      'Loyihani o‘chirish',
      `"${project.name}" o‘chirilsinmi? Ichidagi suhbatlar o‘chmaydi — ular loyihasiz ro‘yxatga qaytadi.`,
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: 'O‘chirish',
          style: 'destructive',
          onPress: () => remove.mutate(project.id, { onError: failed }),
        },
      ],
    );

  const openActions = (project: Project) =>
    Alert.alert(project.name, undefined, [
      {
        text: 'Suhbatlarini ko‘rish',
        onPress: () =>
          router.push({
            pathname: '/(main)/project-detail',
            params: { projectId: project.id, name: project.name },
          }),
      },
      { text: 'Nomini o‘zgartirish', onPress: () => setRenaming(project) },
      {
        text: 'Ko‘rsatmalarni tahrirlash',
        onPress: () => setEditingInstructions(project),
      },
      {
        text: 'O‘chirish',
        style: 'destructive',
        onPress: () => confirmDelete(project),
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
            Loyihalar
          </Text>
          <Pressable
            onPress={() => setCreating(true)}
            accessibilityRole="button"
            accessibilityLabel="Yangi loyiha"
            className="w-10 h-10 items-center justify-center rounded-md"
            style={{ backgroundColor: 'rgba(96,165,250,0.15)' }}
          >
            <Plus size={18} color="#60A5FA" />
          </Pressable>
        </View>

        {projects.isLoading ? (
          <View className="items-center" style={{ padding: 32 }}>
            <ActivityIndicator color="#60A5FA" />
          </View>
        ) : (
          <FlatList
            data={projects.data ?? []}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 48 }}
            renderItem={({ item }) => (
              <ProjectRow
                project={item}
                onOpen={() =>
                  router.push({
                    pathname: '/(main)/project-detail',
                    params: { projectId: item.id, name: item.name },
                  })
                }
                onActions={() => openActions(item)}
              />
            )}
            ListEmptyComponent={
              <View className="items-center" style={{ paddingVertical: 48 }}>
                <Text className="text-4xl">📁</Text>
                <Text className="text-base font-bold text-foreground dark:text-dark-text mt-3 text-center">
                  Hali loyiha yo‘q
                </Text>
                <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1 text-center px-6">
                  Loyiha — bir mavzudagi suhbatlarni bir joyga yig‘ish uchun.
                  Masalan "Matematika" yoki "Ilmiy ishim".
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>

      <TextPrompt
        key={creating ? 'create-open' : 'create-closed'}
        visible={creating}
        title="Yangi loyiha"
        placeholder="Masalan: Matematika"
        maxLength={60}
        confirmLabel="Yaratish"
        onCancel={() => setCreating(false)}
        onSubmit={(name) => {
          setCreating(false);
          create.mutate(
            {
              name,
              // A colour per project so the history list can tell them apart
              // at a glance; cycled rather than asked for, because naming the
              // thing is already one decision and that is enough.
              colour:
                PROJECT_COLOURS[
                  (projects.data?.length ?? 0) % PROJECT_COLOURS.length
                ],
            },
            { onError: failed },
          );
        }}
      />

      <TextPrompt
        key={renaming?.id ?? 'rename-none'}
        visible={renaming !== null}
        title="Nomini o‘zgartirish"
        maxLength={60}
        initialValue={renaming?.name ?? ''}
        onCancel={() => setRenaming(null)}
        onSubmit={(name) => {
          if (renaming) update.mutate({ id: renaming.id, name }, { onError: failed });
          setRenaming(null);
        }}
      />

      <TextPrompt
        key={editingInstructions?.id ?? 'instructions-none'}
        visible={editingInstructions !== null}
        title="Loyiha ko‘rsatmalari"
        placeholder="Masalan: menga 6-sinf darajasida tushuntir"
        maxLength={1000}
        multiline
        initialValue={editingInstructions?.instructions ?? ''}
        onCancel={() => setEditingInstructions(null)}
        onSubmit={(instructions) => {
          if (editingInstructions) {
            update.mutate(
              { id: editingInstructions.id, instructions },
              { onError: failed },
            );
          }
          setEditingInstructions(null);
        }}
      />
    </View>
  );
}

function ProjectRow({
  project,
  onOpen,
  onActions,
}: {
  project: Project;
  onOpen: () => void;
  onActions: () => void;
}) {
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={project.name}
      className="rounded-xl border border-neon-blue/20 bg-card dark:bg-dark-surface active:opacity-80"
      style={{ padding: 14 }}
    >
      <View className="flex-row items-center gap-3">
        <View
          className="items-center justify-center"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: `${project.colour ?? '#60A5FA'}22`,
          }}
        >
          <Folder size={17} color={project.colour ?? '#60A5FA'} />
        </View>

        <View className="flex-1">
          <Text
            className="text-base font-medium text-foreground dark:text-dark-text"
            numberOfLines={1}
          >
            {project.name}
          </Text>
          <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-0.5">
            {project.conversation_count} ta suhbat
            {project.instructions ? ' · ko‘rsatmali' : ''}
          </Text>
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
