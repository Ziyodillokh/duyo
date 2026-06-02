import { useIsDark } from '@/store/theme';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, BookOpen, Heart, Music, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getContent } from '@/api/endpoints/content';

function isNotFound(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 404;
}

export default function LibraryItemScreen() {
  const isDark = useIsDark();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id ?? '';
  const [liked, setLiked] = useState(false);

  const {
    data: item,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['content', id],
    queryFn: () => getContent(id),
    enabled: id !== '',
    retry: (count, err) => !isNotFound(err) && count < 2,
  });

  const renderMessage = (emoji: string, message: string) => (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' },
      ]}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View className="flex-1 items-center justify-center px-6 gap-3">
          <Text className="text-5xl">{emoji}</Text>
          <Text className="text-lg font-medium text-foreground dark:text-dark-text text-center">
            {message}
          </Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            className="mt-4 px-6 py-3 rounded-md bg-neon-blue"
          >
            <Text className="text-sm font-medium text-dark-bg-to">Orqaga</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );

  if (isLoading) {
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' },
        ]}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-base font-medium text-foreground dark:text-dark-text">
              Yuklanmoqda…
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (isError) {
    return isNotFound(error)
      ? renderMessage('🔍', 'Kontent topilmadi')
      : renderMessage('⚠️', "Kontentni yuklab bo'lmadi");
  }

  if (!item) {
    return renderMessage('🔍', 'Kontent topilmadi');
  }

  const author = item.author ?? '';
  const body = item.body ?? 'Kontent tez orada qo\'shiladi.';

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
        end={{ x: 0.97, y: 0.4 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View className="flex-row items-center justify-between px-6 py-4">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            className="w-10 h-10 items-center justify-center"
          >
            <ArrowLeft size={20} color={isDark ? '#E0E7FF' : '#102033'} />
          </Pressable>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setLiked((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={
                liked ? 'Sevimlilardan olib tashlash' : 'Sevimlilarga'
              }
              className="w-10 h-10 items-center justify-center rounded-md bg-card dark:bg-dark-surface border border-neon-blue/20"
            >
              <Heart
                size={18}
                color={liked ? '#FB64B6' : '#94A3B8'}
                fill={liked ? '#FB64B6' : 'transparent'}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ulashish"
              className="w-10 h-10 items-center justify-center rounded-md bg-card dark:bg-dark-surface border border-neon-blue/20"
            >
              <Share2 size={18} color="#94A3B8" />
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          <View
            className="bg-card dark:bg-dark-surface rounded-xl border border-neon-blue/20 items-center"
            style={{ padding: 32 }}
          >
            <Text className="text-7xl mb-3">📖</Text>
            <Text className="text-[24px] leading-8 font-bold text-foreground dark:text-dark-text text-center tracking-tight">
              {item.title}
            </Text>
            {author !== '' && (
              <Text className="text-base text-muted-foreground dark:text-dark-muted mt-1">
                {author}
              </Text>
            )}
            {item.audio_url && (
              <View className="flex-row items-center gap-2 mt-3">
                <Music size={14} color="#60A5FA" />
                <Text className="text-sm text-muted-foreground dark:text-dark-muted">
                  Audio mavjud
                </Text>
              </View>
            )}
          </View>

          <View
            className="bg-card dark:bg-dark-surface rounded-xl border border-neon-blue/20"
            style={{ padding: 20 }}
          >
            <View className="flex-row items-center gap-2 mb-4">
              <BookOpen size={18} color="#60A5FA" />
              <Text className="text-base font-bold text-foreground dark:text-dark-text">
                Mazmun
              </Text>
            </View>
            <Text
              className="text-foreground dark:text-dark-text"
              style={{ fontSize: 22, lineHeight: 32 }}
            >
              {body}
            </Text>
          </View>

          <Pressable
            onPress={() => router.push('/(main)/(tabs)/chat')}
            accessibilityRole="button"
            accessibilityLabel="DUYO bilan muhokama"
            className="rounded-md bg-neon-blue items-center justify-center active:opacity-80"
            style={{ height: 56 }}
          >
            <Text className="text-base font-medium" style={{ color: '#0A1628' }}>
              DUYO bilan muhokama
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
