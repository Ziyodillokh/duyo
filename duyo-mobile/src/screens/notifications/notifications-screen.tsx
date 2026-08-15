import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Bell } from 'lucide-react-native';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type NotificationWire } from '@/api/endpoints/notifications';
import { useT } from '@/i18n';
import {
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/use-notifications';
import { shortWhen } from '@/lib/history-groups';
import { useIsDark } from '@/store/theme';

/**
 * "Bildirishnomalar" — sent campaigns targeted at this child's age segment,
 * newest first. Read state is per-child (see backend NotificationRead), so
 * tapping a card marks it read without affecting any sibling's view of it.
 */
export default function NotificationsScreen() {
  const t = useT();
  const isDark = useIsDark();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();

  const items = notifications.data ?? [];

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
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View className="flex-row items-center gap-3 px-6 py-4">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            className="w-10 h-10 items-center justify-center"
          >
            <ArrowLeft size={20} color={isDark ? '#E0E7FF' : '#102033'} />
          </Pressable>
          <Text className="text-2xl font-bold text-foreground dark:text-dark-text">
            {t('notificationsScreen.title')}
          </Text>
        </View>

        {notifications.isLoading ? (
          <View className="items-center" style={{ padding: 32 }}>
            <ActivityIndicator color="#60A5FA" />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 24, paddingTop: 8, gap: 12, paddingBottom: 48 }}
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
              <View className="items-center" style={{ paddingVertical: 64 }}>
                <Bell size={40} color="#64748B" />
                <Text className="text-base font-bold text-foreground dark:text-dark-text mt-3 text-center">
                  {t('notificationsScreen.emptyTitle')}
                </Text>
                <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1 text-center">
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
      className={`rounded-xl border bg-card dark:bg-dark-surface active:opacity-80 ${
        unread ? 'border-neon-blue/50' : 'border-neon-blue/20'
      }`}
      style={{ padding: 14 }}
    >
      <View className="flex-row items-start gap-3">
        <View
          className="items-center justify-center"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: 'rgba(96,165,250,0.12)',
          }}
        >
          <Bell size={17} color="#60A5FA" />
        </View>

        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text
              className="text-base font-medium text-foreground dark:text-dark-text flex-1"
              numberOfLines={1}
            >
              {notification.title}
            </Text>
            {!!notification.sent_at && (
              <Text
                className="text-xs text-muted-foreground dark:text-dark-muted"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {shortWhen(notification.sent_at)}
              </Text>
            )}
          </View>
          <Text
            className="text-sm text-muted-foreground dark:text-dark-muted mt-0.5"
            numberOfLines={2}
          >
            {notification.body}
          </Text>
        </View>

        {unread && (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#60A5FA',
              marginTop: 6,
            }}
          />
        )}
      </View>
    </Pressable>
  );
}
