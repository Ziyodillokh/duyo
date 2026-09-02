import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MessageSquare, Plus, Sparkles } from 'lucide-react-native';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useConversations, useProjects } from '@/hooks/use-history';
import { useT } from '@/i18n';
import { glass, lift } from '@/lib/glass';
import { useChatStore } from '@/store/chat';
import { useChildStore } from '@/store/child';

// ── The glass sky, shared with "Suhbatlar" and "Loyihalar" ──────────────────
const PRIMARY = '#2F6FE4';
const TITLE = '#2A63DC';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

/** One project: its standing instructions, and the chats filed inside it. */
export default function ProjectDetailScreen() {
  const t = useT();
  const child = useChildStore((s) => s.child);
  const childId = child?.id;
  const { projectId, name } = useLocalSearchParams<{
    projectId: string;
    name?: string;
  }>();

  const conversations = useConversations(childId, { projectId });
  const projects = useProjects(childId);
  const project = (projects.data ?? []).find((p) => p.id === projectId);
  const rows = conversations.data ?? [];

  const startChatHere = () => {
    // Starting from inside a project files the new conversation into it from
    // its very first message, so the project's instructions apply straight
    // away rather than after a manual move.
    useChatStore.getState().startNewConversation(projectId);
    router.push('/(main)/(tabs)/chat');
  };

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
            style={[glass(24, 'sm'), styles.headerButton, styles.focusable]}
          >
            <ArrowLeft size={23} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>
              {project?.name ?? name ?? t('projects.fallbackName')}
            </Text>
            <Text style={styles.subtitle}>
              {t('projects.chatCount', { count: rows.length })}
            </Text>
          </View>
        </View>

        <View style={styles.top}>
          {!!project?.instructions && (
            // A tinted pane rather than a plain one: the standing instructions
            // are the project's defining property, not another row of content.
            <View style={[glass(20, 'md'), styles.instructions]}>
              <View style={styles.instructionsHead}>
                <Sparkles size={14} color={PRIMARY} strokeWidth={2.2} />
                <Text style={styles.instructionsLabel}>
                  {t('projects.instructions')}
                </Text>
              </View>
              <Text style={styles.instructionsBody}>{project.instructions}</Text>
              <Text style={styles.instructionsNote}>
                {t('projects.instructionsNote')}
              </Text>
            </View>
          )}

          <Pressable
            onPress={startChatHere}
            accessibilityRole="button"
            accessibilityLabel={t('projects.detail.newChat')}
            style={({ pressed }) => [
              styles.cta,
              styles.focusable,
              pressed && styles.ctaPressed,
            ]}
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.ctaText}>{t('projects.detail.newChat')}</Text>
          </Pressable>
        </View>

        {conversations.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={PRIMARY} />
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ padding: 20, gap: 8, paddingBottom: 48 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  useChatStore.getState().openConversation(item.id);
                  router.push('/(main)/(tabs)/chat');
                }}
                accessibilityRole="button"
                accessibilityLabel={[item.title, item.preview]
                  .filter(Boolean)
                  .join(', ')}
                style={({ pressed }) => [
                  glass(20, 'md'),
                  styles.row,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={styles.rowInner}>
                  {/* 38 / radius 12 / 12%-tint — the icon tile shared with the
                      history and projects rows, so the three read as one
                      surface rather than three screens built separately. */}
                  <View style={styles.iconTile}>
                    <MessageSquare size={17} color={PRIMARY} strokeWidth={2} />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {!!item.preview && (
                      <Text style={styles.rowPreview} numberOfLines={1}>
                        {item.preview}
                      </Text>
                    )}
                  </View>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyGlyph}>💬</Text>
                <Text style={styles.emptyTitle}>
                  {t('projects.detail.emptyTitle')}
                </Text>
                <Text style={styles.emptyBody}>
                  {t('projects.detail.emptyBody')}
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
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
  headerText: { flex: 1 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: TITLE,
  },
  subtitle: {
    marginTop: 1,
    fontSize: 12,
    color: MUTED,
  },

  top: { paddingHorizontal: 20, paddingBottom: 8, gap: 12 },

  // ── Standing instructions ──────────────────────────────────────────────
  instructions: {
    padding: 14,
    backgroundColor: 'rgba(47,111,228,0.10)',
  },
  instructionsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  instructionsLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: PRIMARY,
  },
  instructionsBody: {
    fontSize: 14,
    lineHeight: 20,
    color: INK,
  },
  instructionsNote: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: MUTED,
  },

  // ── The one standalone action, so it carries a shadow of its own ───────
  cta: {
    height: 50,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    boxShadow: lift('md'),
  },
  ctaPressed: { opacity: 0.8 },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  loading: { alignItems: 'center', padding: 32 },

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
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: INK,
  },
  rowPreview: {
    marginTop: 2,
    fontSize: 14,
    color: MUTED,
  },

  // ── Empty state ────────────────────────────────────────────────────────
  empty: { alignItems: 'center', paddingVertical: 40 },
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
