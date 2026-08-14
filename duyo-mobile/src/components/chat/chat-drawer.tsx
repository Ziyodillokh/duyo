import { router } from 'expo-router';
import {
  ChevronRight,
  Folder,
  MessageSquare,
  MessagesSquare,
  SquarePen,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useConversations, useProjects } from '@/hooks/use-history';
import { shortWhen } from '@/lib/history-groups';
import { useChatStore } from '@/store/chat';
import { useChildStore } from '@/store/child';
import { useIsDark } from '@/store/theme';

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

const ACCENT = '#60A5FA';
const MUTED = '#94A3B8';

export function ChatDrawer({
  visible,
  onClose,
  onNewChat,
}: {
  visible: boolean;
  onClose: () => void;
  onNewChat: () => void;
}) {
  const isDark = useIsDark();
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

  const go = (fn: () => void) => {
    onClose();
    fn();
  };

  const openConversation = (id: string) =>
    go(() => useChatStore.getState().openConversation(id));

  const hairline = isDark ? 'rgba(96,165,250,0.16)' : 'rgba(16,32,51,0.08)';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={{ flex: 1, opacity: fade }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Yopish"
          style={{ flex: 1, backgroundColor: 'rgba(4,10,22,0.55)' }}
        />
      </Animated.View>

      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: WIDTH,
          transform: [{ translateX: slide }],
          backgroundColor: isDark ? '#0E1626' : '#FFFFFF',
          borderRightWidth: 1,
          borderRightColor: hairline,
        }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          {/* Brand row. The child's own name sits under it — this drawer is
              the one place the app says whose memories and chats these are,
              which matters on a phone siblings share. */}
          <View
            className="flex-row items-center gap-3"
            style={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 14 }}
          >
            <View
              className="items-center justify-center"
              style={{
                width: 34,
                height: 34,
                borderRadius: 11,
                backgroundColor: `${ACCENT}1F`,
              }}
            >
              <Text
                className="font-bold"
                style={{ color: ACCENT, fontSize: 15 }}
              >
                D
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-foreground dark:text-dark-text">
                DUYO
              </Text>
              {!!child?.name && (
                <Text
                  className="text-xs text-muted-foreground dark:text-dark-muted"
                  numberOfLines={1}
                >
                  {child.name}
                </Text>
              )}
            </View>
          </View>

          {/* The primary action, and the only filled control in the drawer —
              everything below it is navigation, so it should not compete. */}
          <View style={{ paddingHorizontal: 12 }}>
            <Pressable
              onPress={() => go(onNewChat)}
              accessibilityRole="button"
              accessibilityLabel="Yangi suhbat"
              className="flex-row items-center gap-3 active:opacity-80"
              style={{
                paddingHorizontal: 12,
                paddingVertical: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: `${ACCENT}59`,
                backgroundColor: `${ACCENT}14`,
              }}
            >
              <SquarePen size={18} color={ACCENT} />
              <Text
                className="text-base font-bold flex-1"
                style={{ color: ACCENT }}
              >
                Yangi suhbat
              </Text>
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 12, paddingTop: 6 }}>
            <DrawerLink
              icon={MessagesSquare}
              label="Suhbatlar"
              count={all.length}
              onPress={() => go(() => router.push('/(main)/history'))}
            />
            <DrawerLink
              icon={Folder}
              label="Loyihalar"
              count={projectCount}
              onPress={() => go(() => router.push('/(main)/projects'))}
            />
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: hairline,
              marginHorizontal: 18,
              marginVertical: 12,
            }}
          />

          <Text
            className="text-xs font-bold uppercase text-muted-foreground dark:text-dark-muted"
            style={{ paddingHorizontal: 18, letterSpacing: 0.6, marginBottom: 4 }}
          >
            So‘nggi suhbatlar
          </Text>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}
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
                  className="flex-row items-center gap-2.5 active:opacity-70"
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 10,
                    borderRadius: 11,
                    backgroundColor: active ? `${ACCENT}14` : 'transparent',
                  }}
                >
                  <MessageSquare
                    size={15}
                    color={active ? ACCENT : MUTED}
                  />
                  <Text
                    className="text-sm flex-1"
                    numberOfLines={1}
                    style={{
                      // Set outright rather than nesting a className'd Text
                      // inside a styled one: a nested Text inherits the
                      // parent's colour on Android and the child's on iOS,
                      // so the two platforms disagreed about the title.
                      color: active ? ACCENT : isDark ? '#E0E7FF' : '#102033',
                      fontWeight: active ? '600' : '400',
                    }}
                  >
                    {conv.title}
                  </Text>
                  <Text
                    className="text-xs text-muted-foreground dark:text-dark-muted"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {shortWhen(conv.updated_at)}
                  </Text>
                </Pressable>
              );
            })}

            {recents.length === 0 && (
              <Text
                className="text-sm text-muted-foreground dark:text-dark-muted"
                style={{ paddingHorizontal: 10, paddingVertical: 8 }}
              >
                Hali suhbat yo‘q
              </Text>
            )}

            {all.length > RECENTS && (
              <Pressable
                onPress={() => go(() => router.push('/(main)/history'))}
                accessibilityRole="button"
                accessibilityLabel="Barcha suhbatlarni ko'rish"
                className="flex-row items-center gap-1 active:opacity-70"
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 11,
                  marginTop: 2,
                }}
              >
                <Text className="text-sm font-medium" style={{ color: ACCENT }}>
                  Barchasini ko‘rish
                </Text>
                <ChevronRight size={14} color={ACCENT} />
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
  onPress,
}: {
  // Matches the `typeof Download`-style icon typing used elsewhere —
  // lucide-react-native exports no public `LucideIcon` type.
  icon: typeof Folder;
  label: string;
  count: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `${label}, ${count} ta` : label}
      className="flex-row items-center gap-3 active:opacity-70"
      style={{ paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12 }}
    >
      <Icon size={18} color={MUTED} />
      <Text className="text-base font-medium text-foreground dark:text-dark-text flex-1">
        {label}
      </Text>
      {count > 0 && (
        <View
          className="items-center justify-center"
          style={{
            minWidth: 22,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 9,
            backgroundColor: `${MUTED}24`,
          }}
        >
          <Text
            className="text-xs font-semibold text-muted-foreground dark:text-dark-muted"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
