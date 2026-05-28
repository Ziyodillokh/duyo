import { useIsDark } from '@/store/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Clock, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CATEGORIES,
  CONTINUE_ITEMS,
  DIFFICULTY_COLORS,
  DIFFICULTY_LABEL,
  type LibraryCategory,
  LIBRARY_ITEMS,
  type LibraryItem,
} from '@/mocks/library';

interface LibraryCardProps {
  item: LibraryItem;
  onPress: () => void;
}

function LibraryCard({ item, onPress }: LibraryCardProps) {
  const d = DIFFICULTY_COLORS[item.difficulty];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      className="bg-card dark:bg-dark-surface rounded-xl border border-neon-blue/20 active:opacity-80"
      style={{ padding: 16, gap: 12 }}
    >
      <View className="flex-row items-start gap-3">
        <View
          className="rounded-md items-center justify-center"
          style={{
            width: 56,
            height: 56,
            backgroundColor: 'rgba(96, 165, 250, 0.10)',
          }}
        >
          <Text className="text-3xl">{item.emoji}</Text>
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-base font-medium text-foreground dark:text-dark-text" numberOfLines={1}>
            {item.title}
          </Text>
          {item.author && (
            <Text className="text-sm text-muted-foreground dark:text-dark-muted">{item.author}</Text>
          )}
          <View className="flex-row items-center gap-3 mt-1">
            <View className="flex-row items-center gap-1">
              <Clock size={12} color="#94A3B8" />
              <Text className="text-xs text-muted-foreground dark:text-dark-muted">{item.duration}</Text>
            </View>
            <View
              className="rounded-md"
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
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
      </View>
      {item.progress !== undefined && item.progress > 0 && (
        <View>
          <View
            className="rounded-full overflow-hidden"
            style={{ height: 4, backgroundColor: 'rgba(96, 165, 250, 0.20)' }}
          >
            <View
              className="bg-neon-blue h-full"
              style={{ width: `${item.progress * 100}%` }}
            />
          </View>
          <Text className="text-xs text-neon-cyan mt-1">
            {Math.round(item.progress * 100)}% bajarildi
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default function LibraryScreen() {
  const isDark = useIsDark();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<LibraryCategory | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LIBRARY_ITEMS.filter((item) => {
      if (selectedCategory && item.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        (item.author?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [query, selectedCategory]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' }]} />
      <LinearGradient
        colors={['rgba(96, 165, 250, 0.20)', 'rgba(252, 211, 77, 0.20)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.96, y: 0.25 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-[24px] leading-8 font-bold text-foreground dark:text-dark-text tracking-tight">
            Kutubxona
          </Text>

          <View
            className="flex-row items-center rounded-lg gap-2 border border-neon-blue/20"
            style={{
              backgroundColor: '#1E3A5F',
              paddingHorizontal: 16,
              height: 44,
            }}
          >
            <Search size={18} color="#94A3B8" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Qidiruv..."
              placeholderTextColor="#94A3B8"
              className="flex-1 text-base text-foreground dark:text-dark-text"
              accessibilityLabel="Kutubxonadan qidirish"
            />
          </View>

          {CONTINUE_ITEMS.length > 0 && !selectedCategory && !query && (
            <View className="gap-3">
              <Text className="text-lg font-bold text-foreground dark:text-dark-text tracking-tight">
                O'rganishda davom eting
              </Text>
              <View className="gap-3">
                {CONTINUE_ITEMS.map((item) => (
                  <LibraryCard
                    key={item.id}
                    item={item}
                    onPress={() =>
                      router.push({
                        pathname: '/(main)/library-item',
                        params: { id: item.id },
                      })
                    }
                  />
                ))}
              </View>
            </View>
          )}

          <View className="gap-3">
            <Text className="text-lg font-bold text-foreground dark:text-dark-text tracking-tight">
              Yoshingizga mos
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12 }}
            >
              <Pressable
                onPress={() => setSelectedCategory(null)}
                accessibilityRole="button"
                accessibilityLabel="Barchasi"
                className={`rounded-md border active:opacity-80 ${
                  selectedCategory === null
                    ? 'bg-neon-blue border-neon-blue'
                    : 'bg-card dark:bg-dark-surface border-neon-blue/20'
                }`}
                style={{ paddingHorizontal: 16, paddingVertical: 10 }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{
                    color: selectedCategory === null ? '#0A1628' : '#E0E7FF',
                  }}
                >
                  Barchasi
                </Text>
              </Pressable>
              {CATEGORIES.map((c) => {
                const sel = selectedCategory === c.key;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => setSelectedCategory(c.key)}
                    accessibilityRole="button"
                    accessibilityLabel={c.label}
                    className={`flex-row items-center gap-2 rounded-md border active:opacity-80 ${
                      sel
                        ? 'bg-neon-blue border-neon-blue'
                        : 'bg-card dark:bg-dark-surface border-neon-blue/20'
                    }`}
                    style={{ paddingHorizontal: 16, paddingVertical: 10 }}
                  >
                    <Text className="text-base">{c.emoji}</Text>
                    <Text
                      className="text-sm font-medium"
                      style={{ color: sel ? '#0A1628' : '#E0E7FF' }}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View className="gap-3">
            {filtered.length === 0 ? (
              <View
                className="rounded-xl border border-neon-blue/20 items-center"
                style={{ padding: 24 }}
              >
                <Text className="text-4xl">🔍</Text>
                <Text className="text-base font-medium text-foreground dark:text-dark-text mt-2">
                  Hech narsa topilmadi
                </Text>
                <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1 text-center">
                  Boshqa kalit so'z bilan urinib ko'ring
                </Text>
              </View>
            ) : (
              filtered.map((item) => (
                <LibraryCard
                  key={item.id}
                  item={item}
                  onPress={() =>
                    router.push({
                      pathname: '/(main)/library-item',
                      params: { id: item.id },
                    })
                  }
                />
              ))
            )}
          </View>

          <Text className="text-xs text-muted-foreground dark:text-dark-muted text-center">
            Barcha kontentlar yoshingizga mos ravishda tanlanadi
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
