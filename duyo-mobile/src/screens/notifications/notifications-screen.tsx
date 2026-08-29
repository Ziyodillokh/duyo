import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react-native';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type NotificationWire } from '@/api/endpoints/notifications';
import { Text } from '@/components/text';
import { MascotHead } from '@/components/v2/mascot-image';
import {
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/use-notifications';
import { useT } from '@/i18n';
import { glass } from '@/lib/glass';
import { shortWhen } from '@/lib/history-groups';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
// Same family as goal-mates: panes of frosted glass on a pale blue page.
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

/**
 * "Bildirishnomalar" — sent campaigns targeted at this child's age segment,
 * newest first. Read state is per-child (see backend NotificationRead), so
 * tapping a card marks it read without affecting any sibling's view of it.
 *
 * The screen is a pane of the same morning sky as home and goal-mates: the
 * old navy build predated the glass system and read as a different app
 * bolted onto this one.
 */
export default function NotificationsScreen() {
  const t = useT();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();

  const items = notifications.data ?? [];
  const unread = items.filter((n) => !n.read);

  const markAll = () => {
    // One mutation per campaign — the backend's read-marks are per-campaign
    // rows and the hook invalidates once per settle, so a handful of these
    // is fine for the volumes a child ever has.
    unread.forEach((n) => markRead.mutate(n.id));
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* ── Header: 48pt glass rounds, the inner-screen pattern ────── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={[glass(24, 'sm'), styles.headerButton]}
          >
            <ArrowLeft size={23} color={PRIMARY} strokeWidth={2} />
          </Pressable>

          <View style={styles.titleWrap}>
            <Text style={styles.title}>{t('notificationsScreen.title')}</Text>
            {unread.length > 0 && (
              <Text style={styles.unreadCaption}>
                {t('notificationsScreen.unread', { count: unread.length })}
              </Text>
            )}
          </View>

          {unread.length > 0 ? (
            <Pressable
              onPress={markAll}
              accessibilityRole="button"
              accessibilityLabel={t('notificationsScreen.markAllRead')}
              style={[glass(24, 'sm'), styles.headerButton]}
            >
              <CheckCheck size={22} color={PRIMARY} strokeWidth={2} />
            </Pressable>
          ) : (
            // Keeps the title centred when there is nothing to mark.
            <View style={styles.headerButton} />
          )}
        </View>

        {notifications.isLoading ? (
          <View style={{ alignItems: 'center', padding: 32 }}>
            <ActivityIndicator color={PRIMARY} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 6,
              gap: 12,
              paddingBottom: 48,
            }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <NotificationRow
                notification={item}
                onOpen={() => {
                  if (!item.read) markRead.mutate(item.id);
                }}
              />
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 56 }}>
                {/* The mascot delivers the quiet, not a grey bell — an empty
                    inbox is a friendly fact, not a failure state. */}
                <View style={[glass(999, 'md', 0.65), styles.emptyBadge]}>
                  <MascotHead size={72} />
                </View>
                <Text style={styles.emptyTitle}>
                  {t('notificationsScreen.emptyTitle')}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {t('notificationsScreen.emptySubtitle')}
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: NotificationWire;
  onOpen: () => void;
}) {
  const unread = !notification.read;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={notification.title}
      // An unread pane sits brighter and whiter than a read one — the state
      // is in the light, with the dot as the second witness.
      style={[glass(22, 'md', unread ? 0.78 : 0.45), styles.row]}
    >
      <View style={[styles.iconWell, unread && styles.iconWellUnread]}>
        <Bell size={18} color={unread ? '#FFFFFF' : PRIMARY} strokeWidth={2} />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.rowHead}>
          <Text
            style={[styles.rowTitle, !unread && styles.rowTitleRead]}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          {!!notification.sent_at && (
            <Text style={styles.when}>{shortWhen(notification.sent_at)}</Text>
          )}
        </View>
        <Text style={styles.rowBody} numberOfLines={2}>
          {notification.body}
        </Text>
      </View>

      {unread && <View style={styles.dot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 14,
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: INK,
  },
  unreadCaption: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
  },
  iconWell: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47,111,228,0.10)',
  },
  iconWellUnread: {
    backgroundColor: PRIMARY,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: {
    flexGrow: 1, flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: INK,
  },
  rowTitleRead: {
    fontWeight: '600',
    color: 'rgba(34,64,111,0.72)',
  },
  when: {
    fontSize: 12,
    color: MUTED,
    fontVariant: ['tabular-nums'],
  },
  rowBody: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 19,
    color: MUTED,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: PRIMARY,
    marginTop: 6,
  },

  emptyBadge: {
    width: 116,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 18,
    fontSize: 17,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
  },
});
