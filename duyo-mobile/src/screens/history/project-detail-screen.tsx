import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MessageSquare, Plus, Sparkles } from 'lucide-react-native';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useConversations, useProjects } from '@/hooks/use-history';
import { useChatStore } from '@/store/chat';
import { useChildStore } from '@/store/child';
import { useIsDark } from '@/store/theme';

/** One project: its standing instructions, and the chats filed inside it. */
export default function ProjectDetailScreen() {
  const isDark = useIsDark();
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
          <View className="flex-1">
            <Text
              className="text-xl font-bold text-foreground dark:text-dark-text"
              numberOfLines={1}
            >
              {project?.name ?? name ?? 'Loyiha'}
            </Text>
            <Text className="text-xs text-muted-foreground dark:text-dark-muted">
              {rows.length} ta suhbat
            </Text>
          </View>
        </View>

        <View className="px-5 pb-2 gap-3">
          {!!project?.instructions && (
            <View
              className="rounded-xl border border-neon-blue/20"
              style={{ padding: 14, backgroundColor: 'rgba(96,165,250,0.08)' }}
            >
              <View className="flex-row items-center gap-2 mb-1">
                <Sparkles size={14} color="#60A5FA" />
                <Text className="text-xs font-bold text-neon-blue">
                  Loyiha ko‘rsatmalari
                </Text>
              </View>
              <Text className="text-sm text-foreground dark:text-dark-text leading-5">
                {project.instructions}
              </Text>
              <Text className="text-xs text-muted-foreground dark:text-dark-muted mt-2">
                Bu ko‘rsatma shu loyihadagi har bir suhbatda hisobga olinadi.
              </Text>
            </View>
          )}

          <Pressable
            onPress={startChatHere}
            accessibilityRole="button"
            accessibilityLabel="Shu loyihada yangi suhbat"
            className="flex-row items-center justify-center gap-2 rounded-xl bg-neon-blue active:opacity-80"
            style={{ height: 46 }}
          >
            <Plus size={18} color="#FFFFFF" />
            <Text className="text-base font-bold text-white">
              Shu loyihada yangi suhbat
            </Text>
          </Pressable>
        </View>

        {conversations.isLoading ? (
          <View className="items-center" style={{ padding: 32 }}>
            <ActivityIndicator color="#60A5FA" />
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
                accessibilityLabel={item.title}
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
                      {item.title}
                    </Text>
                    {!!item.preview && (
                      <Text
                        className="text-sm text-muted-foreground dark:text-dark-muted mt-0.5"
                        numberOfLines={1}
                      >
                        {item.preview}
                      </Text>
                    )}
                  </View>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <View className="items-center" style={{ paddingVertical: 40 }}>
                <Text className="text-4xl">💬</Text>
                <Text className="text-base font-bold text-foreground dark:text-dark-text mt-3 text-center">
                  Bu loyihada hali suhbat yo‘q
                </Text>
                <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1 text-center px-6">
                  Yuqoridagi tugma bilan boshla, yoki tarixdan mavjud suhbatni
                  shu loyihaga sol.
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}
