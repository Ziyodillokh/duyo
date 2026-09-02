import { router } from 'expo-router';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  MessageSquare,
  MessagesSquare,
  Pin,
  SquarePen,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { useConversations, useProjects } from '@/hooks/use-history';
import { useT } from '@/i18n';
import { lift } from '@/lib/glass';
import { shortWhen } from '@/lib/history-groups';
import { useChatStore } from '@/store/chat';
import { useChildStore } from '@/store/child';

/**
 * The chat side drawer: new chat, the two libraries, and recent conversations.
 *
 * Modelled on Claude's mobile drawer, which is the shape people already know
 * for this: the actions at the top, then the conversations themselves, so
 * resuming yesterday's chat is one tap from inside today's.
 *
 * A drawer rather than more header buttons — the header had grown two icons
 * whose meaning had to be guessed, and "Yangi suhbat" sat at the top of the
 * history list where it competed with the list itself.
 */

const WIDTH = Math.min(320, Dimensions.get('window').width * 0.84);

/** Enough to recognise a conversation, few enough to stay scannable. */
const RECENTS = 8;

const PRIMARY = '#2F6FE4';
const TITLE = '#2A63DC';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const HAIRLINE = 'rgba(47,111,228,0.10)';

export function ChatDrawer({
  visible,
  onClose,
  onNewChat,
}: {
  visible: boolean;
  onClose: () => void;
  onNewChat: () => void;
}) {
  const t = useT();
  const child = useChildStore((s) => s.child);
  // Marks the row the child is already inside, so tapping it is obviously a
  // no-op rather than looking like a fresh conversation they might lose.
  const openId = useChatStore((s) => s.conversationId);
  const conversations = useConversations(child?.id);
  const projects = useProjects(child?.id);

  // Lazy useState, not useRef().current: an Animated.Value must be stable
  // across renders, and reading a ref during render is what the React
  // compiler rules (correctly) reject.
  const [slide] = useState(() => new Animated.Value(-WIDTH));
  const [fade] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: visible ? 0 : -WIDTH,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: visible ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, slide, fade]);

  const all = conversations.data ?? [];
  const recents = all.slice(0, RECENTS);
  const projectCount = projects.data?.length ?? 0;
  /**
   * Projects open IN the drawer rather than replacing it.
   *
   * Tapping the row used to push the projects screen, which closed the drawer
   * to show a list of folders and then needed two taps to get back to the
   * conversation. Somewhere to file things is not somewhere to GO — it belongs
   * beside the chats it organises, which is where it now unfolds.
   */
  const [projectsOpen, setProjectsOpen] = useState(false);


  const go = (fn: () => void) => {
    onClose();
    fn();
  };

  const openConversation = (id: string) =>
    go(() => useChatStore.getState().openConversation(id));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.fill, { opacity: fade }]}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={styles.scrim}
        />
      </Animated.View>

      <Animated.View
        style={[styles.panel, { transform: [{ translateX: slide }] }]}
      >
        <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
          {/* Brand row. The child's own name sits under it — this drawer is
              the one place the app says whose memories and chats these are,
              which matters on a phone siblings share. */}
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>D</Text>
            </View>
            <View style={styles.brandText}>
              <Text style={styles.brandName}>DUYO</Text>
              {!!child?.name && (
                <Text style={styles.childName} numberOfLines={1}>
                  {child.name}
                </Text>
              )}
            </View>
          </View>

          {/* The primary action, and the only filled control in the drawer —
              everything below it is navigation, so it should not compete. */}
          <View style={styles.gutter}>
            <Pressable
              onPress={() => go(onNewChat)}
              accessibilityRole="button"
              accessibilityLabel={t('history.newChat')}
              style={({ pressed }) => [
                styles.newChat,
                pressed && styles.pressedStrong,
                styles.focusable,
              ]}
            >
              <SquarePen size={18} color={PRIMARY} />
              {/* No numberOfLines, deliberately — here and on the two
                  labels below. On the owner’s phone (MIUI, system font
                  weight boosted) every Modal-hosted label combining
                  numberOfLines with a Medium/SemiBold/Bold face rendered
                  as NOTHING: numberOfLines is the one prop with a native
                  side (setMaxLines + setEllipsize(END)), and on that ROM
                  the END-ellipsize single-line layout can resolve to zero
                  glyphs when draw metrics outgrow the measured width — a
                  Modal is its own Fabric surface, which is where the
                  measure/draw split lives (RN #48320). These strings are
                  short and fixed; they cannot wrap in practice, and
                  without maxLines there is no ellipsize path at all. */}
              <Text style={styles.newChatText}>{t('history.newChat')}</Text>
            </Pressable>
          </View>

          <View style={[styles.gutter, styles.links]}>
            <DrawerLink
              icon={MessagesSquare}
              label={t('history.title')}
              count={all.length}
              onPress={() => go(() => router.push('/(main)/history'))}
            />
            <DrawerLink
              icon={Folder}
              label={t('projects.title')}
              count={projectCount}
              expanded={projectsOpen}
              onPress={() => setProjectsOpen((v) => !v)}
            />

            {projectsOpen && (
              <View style={styles.projects}>
                {(projects.data ?? []).map((project) => (
                  <Pressable
                    key={project.id}
                    onPress={() =>
                      go(() =>
                        router.push({
                          pathname: '/(main)/project-detail',
                          params: { projectId: project.id, name: project.name },
                        }),
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={project.name}
                    style={({ pressed }) => [
                      styles.project,
                      pressed && styles.pressed,
                      styles.focusable,
                    ]}
                  >
                    <Folder
                      size={15}
                      color={project.colour ?? PRIMARY}
                      strokeWidth={2}
                    />
                    <Text
                      style={styles.projectName}
                      numberOfLines={1}
                      // clip, not the default tail: END-ellipsize is the
                      // native path that ate bold Modal labels whole on
                      // MIUI. Clip draws the glyphs and cuts at the edge.
                      ellipsizeMode="clip"
                    >
                      {project.name}
                    </Text>
                    {/* Pinned ones already come first — the server orders on
                        pinned_at — so this only has to say WHY they are first. */}
                    {!!project.pinned_at && (
                      <Pin
                        size={12}
                        color={project.colour ?? PRIMARY}
                        strokeWidth={2.4}
                      />
                    )}
                    <Text style={styles.projectCount}>
                      {project.conversation_count}
                    </Text>
                  </Pressable>
                ))}

                {projectCount === 0 && (
                  <Text style={styles.projectsEmpty}>
                    {t('projects.emptyTitle')}
                  </Text>
                )}

                <Pressable
                  onPress={() => go(() => router.push('/(main)/projects'))}
                  accessibilityRole="button"
                  accessibilityLabel={t('projects.a11y.manage')}
                  style={({ pressed }) => [
                    styles.project,
                    pressed && styles.pressed,
                    styles.focusable,
                  ]}
                >
                  <View style={styles.projectIconGap} />
                  {/* No numberOfLines — see the note on "Yangi suhbat". */}
                  <Text style={styles.projectManage}>{t('common.manage')}</Text>
                  <ChevronRight size={13} color={PRIMARY} />
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>{t('history.recent')}</Text>

          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {recents.map((conv) => {
              const active = conv.id === openId;
              return (
                <Pressable
                  key={conv.id}
                  onPress={() => openConversation(conv.id)}
                  accessibilityRole="button"
                  accessibilityLabel={conv.title}
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.recent,
                    active && styles.recentOn,
                    pressed && styles.pressed,
                    styles.focusable,
                  ]}
                >
                  <MessageSquare size={15} color={active ? PRIMARY : MUTED} />
                  <Text
                    numberOfLines={1}
                    // clip, not the default tail: the ACTIVE row swaps in a
                    // SemiBold face, and inside this Modal that plus
                    // END-ellipsize is the exact combination MIUI rendered
                    // as nothing (see the note on "Yangi suhbat").
                    ellipsizeMode="clip"
                    // Set on this Text itself rather than left to inherit: a
                    // nested Text takes the parent's colour on Android and its
                    // own on iOS, so the two platforms disagreed about the
                    // title.
                    style={[styles.recentTitle, active && styles.recentTitleOn]}
                  >
                    {conv.title}
                  </Text>
                  <Text style={styles.when}>{shortWhen(conv.updated_at)}</Text>
                </Pressable>
              );
            })}

            {recents.length === 0 && (
              <Text style={styles.empty}>{t('history.emptyTitle')}</Text>
            )}

            {all.length > RECENTS && (
              <Pressable
                onPress={() => go(() => router.push('/(main)/history'))}
                accessibilityRole="button"
                accessibilityLabel={t('history.a11y.seeAll')}
                style={({ pressed }) => [
                  styles.seeAll,
                  pressed && styles.pressed,
                  styles.focusable,
                ]}
              >
                <Text style={styles.seeAllText}>{t('common.seeAll')}</Text>
                <ChevronRight size={14} color={PRIMARY} />
              </Pressable>
            )}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

/** A navigation row: icon, label, and how many things are behind it. */
function DrawerLink({
  icon: Icon,
  label,
  count,
  expanded,
  onPress,
}: {
  // Matches the `typeof Download`-style icon typing used elsewhere —
  // lucide-react-native exports no public `LucideIcon` type.
  icon: typeof Folder;
  label: string;
  count: number;
  /** Present on a row that unfolds; absent on one that navigates. */
  expanded?: boolean;
  onPress: () => void;
}) {
  const t = useT();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        count > 0 ? t('common.a11y.countOf', { label, count }) : label
      }
      style={({ pressed }) => [
        styles.link,
        pressed && styles.pressed,
        styles.focusable,
      ]}
    >
      <Icon size={18} color={MUTED} />
      {/* No numberOfLines — see the note on "Yangi suhbat". */}
      <Text style={styles.linkLabel}>{label}</Text>
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
      {/* A chevron only where one means something: a row that unfolds says
          so, a row that leaves does not pretend to. */}
      {expanded !== undefined &&
        (expanded ? (
          <ChevronDown size={16} color={MUTED} strokeWidth={2.2} />
        ) : (
          <ChevronRight size={16} color={MUTED} strokeWidth={2.2} />
        ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  fill: { flex: 1 },
  scrim: { flex: 1, backgroundColor: 'rgba(4,10,22,0.55)' },

  // The drawer is chrome sliding over the whole screen, so it sits at the top
  // of the ladder — 'xl'. A bare surface rather than a `glass()` pane: it runs
  // edge to edge with no radius, and a near-opaque fill is what stops the
  // darkened chat behind it from greying the rows.
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: WIDTH,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRightWidth: 1,
    borderRightColor: HAIRLINE,
    boxShadow: lift('xl'),
  },

  gutter: { paddingHorizontal: 12 },
  links: { paddingTop: 6 },

  // Indented under the row that opened them, so the list reads as its
  // contents rather than as more navigation at the same level.
  projects: { paddingLeft: 14, paddingBottom: 4 },
  project: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 11,
  },
  projectIconGap: { width: 15 },
  projectName: { flexGrow: 1, flexShrink: 1, fontSize: 14.5, fontWeight: '600', color: INK },
  projectCount: { fontSize: 12, fontWeight: '700', color: MUTED },
  projectManage: { flexGrow: 1, flexShrink: 1, fontSize: 14, fontWeight: '700', color: PRIMARY },
  projectsEmpty: {
    fontSize: 13,
    color: MUTED,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },


  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 14,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47,111,228,0.12)',
  },
  logoText: { color: PRIMARY, fontSize: 15, fontWeight: '700' },
  brandText: { flex: 1 },
  brandName: { fontSize: 18, fontWeight: '700', color: TITLE },
  childName: { fontSize: 12, color: MUTED },

  // 'sm' — the one control in the drawer that is an object resting on the
  // panel. The navigation rows below stay flat, and that difference is what
  // keeps this row reading as the action.
  newChat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(47,111,228,0.35)',
    backgroundColor: 'rgba(47,111,228,0.10)',
    boxShadow: lift('sm'),
  },
  newChatText: { flexGrow: 1, flexShrink: 1, fontSize: 16, fontWeight: '700', color: PRIMARY },

  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
  },
  linkLabel: { flexGrow: 1, flexShrink: 1, fontSize: 16, fontWeight: '500', color: INK },
  badge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(140,163,203,0.20)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
    fontVariant: ['tabular-nums'],
  },

  divider: {
    height: 1,
    backgroundColor: HAIRLINE,
    marginHorizontal: 18,
    marginVertical: 12,
  },
  sectionLabel: {
    paddingHorizontal: 18,
    marginBottom: 4,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: MUTED,
  },

  listContent: { paddingHorizontal: 12, paddingBottom: 20 },
  recent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: 'transparent',
  },
  recentOn: { backgroundColor: 'rgba(47,111,228,0.10)' },
  recentTitle: { flexGrow: 1, flexShrink: 1, fontSize: 14, fontWeight: '400', color: INK },
  recentTitleOn: { fontWeight: '600', color: PRIMARY },
  when: { fontSize: 12, color: MUTED, fontVariant: ['tabular-nums'] },
  empty: {
    fontSize: 14,
    color: MUTED,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 11,
    marginTop: 2,
  },
  seeAllText: { fontSize: 14, fontWeight: '500', color: PRIMARY },

  pressed: { opacity: 0.7 },
  pressedStrong: { opacity: 0.8 },
});
