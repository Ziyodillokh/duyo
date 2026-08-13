import { router } from 'expo-router';
import {
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

  const recents = (conversations.data ?? []).slice(0, RECENTS);

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
          borderRightColor: 'rgba(96,165,250,0.20)',
        }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <Text className="text-2xl font-bold text-foreground dark:text-dark-text px-5 pt-2 pb-4">
            DUYO
          </Text>

          <View className="px-2">
            <DrawerAction
              icon={<SquarePen size={18} color="#60A5FA" />}
              label="Yangi suhbat"
              highlight
              onPress={() => go(onNewChat)}
            />
            <DrawerAction
              icon={<MessagesSquare size={18} color="#94A3B8" />}
              label="Suhbatlar"
              onPress={() => go(() => router.push('/(main)/history'))}
            />
            <DrawerAction
              icon={<Folder size={18} color="#94A3B8" />}
              label="Loyihalar"
              badge={projects.data?.length || undefined}
              onPress={() => go(() => router.push('/(main)/projects'))}
            />
          </View>

          <View
            className="mx-5 my-3"
            style={{ height: 1, backgroundColor: 'rgba(96,165,250,0.18)' }}
          />

          <Text className="text-xs font-bold uppercase text-muted-foreground dark:text-dark-muted px-5 mb-1">
            So‘nggi suhbatlar
          </Text>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 20 }}>
            {recents.map((conv) => (
              <Pressable
                key={conv.id}
                onPress={() => openConversation(conv.id)}
                accessibilityRole="button"
                accessibilityLabel={conv.title}
                className="flex-row items-center gap-3 rounded-lg px-3 active:opacity-70"
                style={{ paddingVertical: 11 }}
              >
                <MessageSquare size={15} color="#94A3B8" />
                <Text
                  className="text-sm text-foreground dark:text-dark-text flex-1"
                  numberOfLines={1}
                >
                  {conv.title}
                </Text>
              </Pressable>
            ))}

            {recents.length === 0 && (
              <Text className="text-sm text-muted-foreground dark:text-dark-muted px-3 py-2">
                Hali suhbat yo‘q
              </Text>
            )}

            {(conversations.data?.length ?? 0) > RECENTS && (
              <Pressable
                onPress={() => go(() => router.push('/(main)/history'))}
                accessibilityRole="button"
                className="px-3 py-3 active:opacity-70"
              >
                <Text className="text-sm font-medium" style={{ color: '#60A5FA' }}>
                  Barchasini ko‘rish
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

function DrawerAction({
  icon,
  label,
  onPress,
  highlight = false,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  highlight?: boolean;
  badge?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center gap-3 rounded-lg px-3 active:opacity-70"
      style={{ paddingVertical: 13 }}
    >
      {icon}
      <Text
        className="text-base flex-1"
        style={{
          color: highlight ? '#60A5FA' : undefined,
          fontWeight: highlight ? '700' : '500',
        }}
      >
        <Text className={highlight ? '' : 'text-foreground dark:text-dark-text'}>
          {label}
        </Text>
      </Text>
      {badge !== undefined && (
        <Text className="text-xs text-muted-foreground dark:text-dark-muted">
          {badge}
        </Text>
      )}
    </Pressable>
  );
}
