import { useIsDark } from '@/store/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, BookOpen, Clock, Heart, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DIFFICULTY_COLORS,
  DIFFICULTY_LABEL,
  LIBRARY_ITEMS,
} from '@/mocks/library';

const MOCK_CONTENT: Record<string, string> = {
  'p-vatan':
    "Vatan — bu yer, bu osmon, bu bahor.\nVatan — bu ona quchog'idek iliq, asror.\nUning daryolari mening ko'zlarim,\nUning tog'lari mening yelkalarim.\n\nVatanim — qadrim, vatanim — sharafim,\nUnga xizmat qilish — eng buyuk maqsadim.",
  'p-ona':
    "Onajonim, sizga necha bir bor,\nMening rahmatim aytay qilayin.\nSiz tunlari uxlamadingiz,\nMen yotgan beshigim tebratdingiz.",
  'p-bahor':
    "Bahor keldi, dunyo ko'kardi,\nQushlar qaytdi, gullar ochildi.\nDarslarda hammamiz xursandmiz,\nQuyosh nuri yuzimizga tushdi.",
  's-zumrad':
    "Bir bor ekan, bir yo'q ekan, qadim zamonlarda kambag'al chol bir o'g'li bilan yashar ekan. O'g'lining ismi Yodgor ekan...\n\n[Mock content — to'liq ertak Faza 1 RAG'dan keladi]",
};

export default function LibraryItemScreen() {
  const isDark = useIsDark();
  const params = useLocalSearchParams<{ id: string }>();
  const item = LIBRARY_ITEMS.find((i) => i.id === params.id);
  const [liked, setLiked] = useState(false);

  if (!item) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' }]}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View className="flex-1 items-center justify-center px-6 gap-3">
            <Text className="text-5xl">🔍</Text>
            <Text className="text-lg font-medium text-foreground dark:text-dark-text">
              Kontent topilmadi
            </Text>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Orqaga"
              className="mt-4 px-6 py-3 rounded-md bg-neon-blue"
            >
              <Text className="text-sm font-medium text-dark-bg-to">
                Orqaga
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const d = DIFFICULTY_COLORS[item.difficulty];
  const content = MOCK_CONTENT[item.id] ?? 'Kontent tez orada qo\'shiladi.';

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' }]} />
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
              accessibilityLabel={liked ? "Sevimlilardan olib tashlash" : "Sevimlilarga"}
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
            <Text className="text-7xl mb-3">{item.emoji}</Text>
            <Text className="text-[24px] leading-8 font-bold text-foreground dark:text-dark-text text-center tracking-tight">
              {item.title}
            </Text>
            {item.author && (
              <Text className="text-base text-muted-foreground dark:text-dark-muted mt-1">
                {item.author}
              </Text>
            )}
            <View className="flex-row items-center gap-3 mt-3">
              <View className="flex-row items-center gap-1">
                <Clock size={14} color="#94A3B8" />
                <Text className="text-sm text-muted-foreground dark:text-dark-muted">
                  {item.duration}
                </Text>
              </View>
              <View
                className="rounded-md"
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  backgroundColor: d.bg,
                  borderWidth: 1,
                  borderColor: d.border,
                }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: d.text }}
                >
                  {DIFFICULTY_LABEL[item.difficulty]}
                </Text>
              </View>
            </View>
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
            <Text className="text-base text-foreground dark:text-dark-text leading-7">
              {content}
            </Text>
          </View>

          <Pressable
            onPress={() => router.push('/(main)/(tabs)/chat')}
            accessibilityRole="button"
            accessibilityLabel="DUYO bilan muhokama"
            className="rounded-md bg-neon-blue items-center justify-center active:opacity-80"
            style={{ height: 56 }}
          >
            <Text
              className="text-base font-medium"
              style={{ color: '#0A1628' }}
            >
              DUYO bilan muhokama
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
