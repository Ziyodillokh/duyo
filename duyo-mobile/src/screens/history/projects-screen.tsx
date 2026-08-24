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
  View,
  type ViewStyle,
} from 'react-native';
import { Text } from '@/components/text';
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
import { glass } from '@/lib/glass';
import { useChildStore } from '@/store/child';

// ── The glass sky, shared with "Suhbatlar" so the pair reads as one place ────
const PRIMARY = '#2F6FE4';
const TITLE = '#2A63DC';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

/**
 * "Loyihalar" — folders a child groups related conversations into.
 *
 * A project is more than a folder because of its instructions: notes written
 * once ("menga 6-sinf darajasida tushuntir") that apply to every chat inside
 * it, so they need not be repeated at the top of each one.
 */
export default function ProjectsScreen() {
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
          <Text style={styles.title}>Loyihalar</Text>
          <Pressable
            onPress={() => setCreating(true)}
            accessibilityRole="button"
            accessibilityLabel="Yangi loyiha"
            style={[glass(24, 'sm'), styles.headerButton, styles.focusable]}
          >
            <Plus size={22} color={PRIMARY} strokeWidth={2.2} />
          </Pressable>
        </View>

        {projects.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={PRIMARY} />
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
              <View style={styles.empty}>
                <Text style={styles.emptyGlyph}>📁</Text>
                <Text style={styles.emptyTitle}>Hali loyiha yo‘q</Text>
                <Text style={styles.emptyBody}>
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
  // The project's own colour is data, not theme — it is what tells two folders
  // apart in the history list, so the tile keeps tinting with it.
  const colour = project.colour ?? PRIMARY;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={project.name}
      style={({ pressed }) => [
        glass(20, 'md'),
        styles.row,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.rowInner}>
        {/* 38 / radius 12 / 12%-tint — the icon tile shared with the history
            rows and the chat drawer, so the three read as one surface. */}
        <View style={[styles.iconTile, { backgroundColor: `${colour}22` }]}>
          <Folder size={17} color={colour} strokeWidth={2} />
        </View>

        <View style={styles.rowBody}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {project.name}
          </Text>
          <Text style={styles.rowMeta}>
            {project.conversation_count} ta suhbat
            {project.instructions ? ' · ko‘rsatmali' : ''}
          </Text>
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

  loading: { alignItems: 'center', padding: 32 },

  // ── Project rows ───────────────────────────────────────────────────────
  row: { padding: 14 },
  rowPressed: { opacity: 0.8 },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: INK,
  },
  rowMeta: {
    marginTop: 2,
    fontSize: 14,
    color: MUTED,
  },
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
    paddingHorizontal: 24,
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    textAlign: 'center',
  },
});
