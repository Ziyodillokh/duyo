import { useIsDark } from '@/store/theme';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, RefreshCw, Search } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type ContentListItem, type ContentType } from '@/api/endpoints/content';
import { useContentLibrary } from '@/hooks/use-content';
import { useChildStore } from '@/store/child';

// ── Categories ───────────────────────────────────────────────────────────────
// Presentation only: the backend's ContentType is the real taxonomy, this map
// just gives each type an Uzbek label and a colour. `lesson` and `audio` share
// the "Darslar" shelf because a narrated lesson is still a lesson to a child.

type LibraryCategory =
  | 'poems'
  | 'stories'
  | 'lessons'
  | 'language'
  | 'dtm'
  | 'documents'
  | 'photos';

const TYPE_TO_CATEGORY: Record<ContentType, LibraryCategory> = {
  poem: 'poems',
  story: 'stories',
  lesson: 'lessons',
  audio: 'lessons',
  language: 'language',
  dtm: 'dtm',
  pdf: 'documents',
  photo: 'photos',
};

interface CategoryMeta {
  key: LibraryCategory;
  label: string;
  emoji: string;
  color: string;
}

const CATEGORIES: readonly CategoryMeta[] = [
  { key: 'poems', label: "She'rlar", emoji: '📖', color: '#FDC700' },
  { key: 'stories', label: 'Ertaklar', emoji: '📚', color: '#FB64B6' },
  { key: 'lessons', label: 'Darslar', emoji: '🎓', color: '#60A5FA' },
  { key: 'language', label: 'Til', emoji: '🌍', color: '#05DF72' },
  { key: 'dtm', label: 'DTM/IELTS', emoji: '🎯', color: '#FF8904' },
  { key: 'documents', label: 'Hujjatlar', emoji: '📄', color: '#A78BFA' },
  { key: 'photos', label: 'Rasmlar', emoji: '🖼️', color: '#22D3EE' },
];

const CATEGORY_BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]));

const LANGUAGE_LABEL: Record<string, string> = { uz: "O'zbekcha", ru: 'Ruscha', en: 'Inglizcha' };

// ── Card ─────────────────────────────────────────────────────────────────────

function LibraryCard({
  item,
  onPress,
}: {
  item: ContentListItem;
  onPress: () => void;
}) {
  const meta = CATEGORY_BY_KEY.get(TYPE_TO_CATEGORY[item.type]);
  const author = item.author ?? '';
  // Only surfaced when it is not the app's own language — an English reading
  // is worth flagging, "O'zbekcha" on every card would just be noise.
  const foreignLanguage =
    item.language !== 'uz' ? (LANGUAGE_LABEL[item.language] ?? item.language.toUpperCase()) : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      className="bg-card dark:bg-dark-surface rounded-xl border border-neon-blue/20 active:opacity-80"
      style={{ padding: 16 }}
    >
      <View className="flex-row items-start gap-3">
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={{ width: 56, height: 56, borderRadius: 6 }}
            contentFit="cover"
            accessibilityLabel={item.title}
          />
        ) : (
          <View
            className="rounded-md items-center justify-center"
            style={{
              width: 56,
              height: 56,
              backgroundColor: 'rgba(96, 165, 250, 0.10)',
            }}
          >
            <Text className="text-3xl">{meta?.emoji ?? '📖'}</Text>
          </View>
        )}
        <View className="flex-1 gap-1">
          <Text
            className="text-base font-medium text-foreground dark:text-dark-text"
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {author !== '' && (
            <Text
              className="text-sm text-muted-foreground dark:text-dark-muted"
              numberOfLines={1}
            >
              {author}
            </Text>
          )}
          <View className="flex-row items-center gap-2 mt-1 flex-wrap">
            {meta && (
              <View
                className="rounded-md"
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  backgroundColor: `${meta.color}26`,
                }}
              >
                <Text className="text-xs font-medium" style={{ color: meta.color }}>
                  {meta.label}
                </Text>
              </View>
            )}
            {foreignLanguage && (
              <View
                className="rounded-md"
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  backgroundColor: 'rgba(148, 163, 184, 0.18)',
                }}
              >
                <Text className="text-xs font-medium text-muted-foreground dark:text-dark-muted">
                  {foreignLanguage}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

/**
 * Kutubxona — the published content library, straight from GET /v1/content.
 *
 * Two queries, one cache: the "catalogue" call (no search term) decides which
 * category chips exist, the "results" call adds the debounced search term.
 * When the box is empty both share a key, so react-query fetches once; the
 * split only matters while typing, and it keeps the chip row from flickering
 * as the result set narrows.
 *
 * Nothing here is padded. If the library has no content for this child's age
 * segment, the screen says so instead of inventing shelves.
 */
export default function LibraryScreen() {
  const isDark = useIsDark();
  const ageSegment = useChildStore((s) => s.child?.age_segment);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<LibraryCategory | null>(null);

  // One request per pause in typing, not per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const catalogue = useContentLibrary(ageSegment);
  const results = useContentLibrary(ageSegment, debounced);

  /** Chips for the categories the library actually has — a "Rasmlar" shelf
   *  with nothing behind it is a promise the library cannot keep. */
  const availableCategories = useMemo(() => {
    const present = new Set(
      (catalogue.data ?? []).map((i) => TYPE_TO_CATEGORY[i.type]),
    );
    return CATEGORIES.filter((c) => present.has(c.key));
  }, [catalogue.data]);

  // A chip can outlive its shelf (search narrows, then the library reloads);
  // drop the selection rather than leaving an invisible filter switched on.
  useEffect(() => {
    if (
      selectedCategory &&
      catalogue.data &&
      !availableCategories.some((c) => c.key === selectedCategory)
    ) {
      setSelectedCategory(null);
    }
  }, [availableCategories, catalogue.data, selectedCategory]);

  const filtered = useMemo(() => {
    const list = results.data ?? [];
    if (!selectedCategory) return list;
    return list.filter((i) => TYPE_TO_CATEGORY[i.type] === selectedCategory);
  }, [results.data, selectedCategory]);

  const searching = debounced !== '';
  const narrowed = searching || selectedCategory !== null;
  const libraryEmpty = (catalogue.data?.length ?? 0) === 0;

  return (
    <View style={StyleSheet.absoluteFill}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' },
        ]}
      />
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
          keyboardShouldPersistTaps="handled"
        >
          {/* Back row — this is a pushed screen now (it left the tab bar when
              Maqsadlar took its slot), so it needs its own way out. */}
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Orqaga"
              hitSlop={10}
              className="p-1 -ml-1"
            >
              <ArrowLeft size={24} color={isDark ? '#E0E7FF' : '#102033'} />
            </Pressable>
            <Text className="text-[24px] leading-8 font-bold text-foreground dark:text-dark-text tracking-tight">
              Kutubxona
            </Text>
          </View>

          <View
            className="flex-row items-center rounded-lg gap-2 border border-neon-blue/20"
            style={{
              backgroundColor: isDark ? '#1E3A5F' : '#FFFFFF',
              paddingHorizontal: 16,
              height: 44,
            }}
          >
            <Search size={18} color="#94A3B8" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Nomi yoki muallifi bo'yicha qidiring..."
              placeholderTextColor="#94A3B8"
              className="flex-1 text-base text-foreground dark:text-dark-text"
              accessibilityLabel="Kutubxonadan qidirish"
              returnKeyType="search"
            />
          </View>

          {availableCategories.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-bold text-foreground dark:text-dark-text tracking-tight">
                {/* Only claim age-matching when we actually know the age. */}
                {ageSegment ? 'Yoshingizga mos' : "Bo'limlar"}
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
                  accessibilityState={{ selected: selectedCategory === null }}
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
                      color:
                        selectedCategory === null
                          ? '#0A1628'
                          : isDark
                            ? '#E0E7FF'
                            : '#102033',
                    }}
                  >
                    Barchasi
                  </Text>
                </Pressable>
                {availableCategories.map((c) => {
                  const sel = selectedCategory === c.key;
                  return (
                    <Pressable
                      key={c.key}
                      onPress={() => setSelectedCategory(sel ? null : c.key)}
                      accessibilityRole="button"
                      accessibilityLabel={c.label}
                      accessibilityState={{ selected: sel }}
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
                        style={{
                          color: sel ? '#FFFFFF' : isDark ? '#E0E7FF' : '#102033',
                        }}
                      >
                        {c.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {selectedCategory === 'language' && (
            <Pressable
              onPress={() => router.push('/(main)/language-practice')}
              accessibilityRole="button"
              accessibilityLabel="Til mashqini boshlash"
              className="rounded-xl border border-neon-blue/20 active:opacity-80"
              style={{
                padding: 16,
                backgroundColor: 'rgba(96, 165, 250, 0.12)',
              }}
            >
              <View className="flex-row items-center gap-3">
                <Text className="text-3xl">✍️</Text>
                <View className="flex-1">
                  <Text className="text-base font-medium text-foreground dark:text-dark-text">
                    Til mashqi
                  </Text>
                  <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1">
                    Ingliz yoki rus tilida savol-javob mashqi
                  </Text>
                </View>
              </View>
            </Pressable>
          )}

          <View className="gap-3">
            {results.isPending ? (
              // Skeletons rather than a count — we do not know one yet.
              [0, 1, 2].map((i) => (
                <View
                  key={i}
                  className="rounded-xl border border-neon-blue/20 bg-card dark:bg-dark-surface"
                  style={{ height: 88, opacity: 0.5 }}
                />
              ))
            ) : results.isError ? (
              <View
                className="rounded-xl border border-neon-blue/20 items-center bg-card dark:bg-dark-surface"
                style={{ padding: 24 }}
              >
                <Text className="text-4xl">⚠️</Text>
                <Text className="text-base font-medium text-foreground dark:text-dark-text mt-2">
                  Kutubxonani yuklab bo'lmadi
                </Text>
                <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1 text-center">
                  Internetni tekshirib, qaytadan urinib ko'ring
                </Text>
                <Pressable
                  onPress={() => void results.refetch()}
                  disabled={results.isFetching}
                  accessibilityRole="button"
                  accessibilityLabel="Qaytadan urinish"
                  className="flex-row items-center gap-2 rounded-md bg-neon-blue mt-4 active:opacity-80"
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    opacity: results.isFetching ? 0.6 : 1,
                  }}
                >
                  <RefreshCw size={16} color="#0A1628" />
                  <Text className="text-sm font-medium" style={{ color: '#0A1628' }}>
                    {results.isFetching ? 'Urinilmoqda…' : 'Qaytadan urinish'}
                  </Text>
                </Pressable>
              </View>
            ) : filtered.length === 0 ? (
              <View
                className="rounded-xl border border-neon-blue/20 items-center bg-card dark:bg-dark-surface"
                style={{ padding: 24 }}
              >
                <Text className="text-4xl">{narrowed ? '🔍' : '📚'}</Text>
                <Text className="text-base font-medium text-foreground dark:text-dark-text mt-2 text-center">
                  {narrowed ? 'Hech narsa topilmadi' : "Kutubxona hozircha bo'sh"}
                </Text>
                <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1 text-center">
                  {/* Not narrowed and still empty means the library really has
                      nothing for this child — say that, do not blame search. */}
                  {narrowed
                    ? "Boshqa kalit so'z bilan yoki boshqa bo'limdan qidirib ko'ring"
                    : "Yangi she'r, ertak va darslar qo'shilgach shu yerda paydo bo'ladi"}
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

          {ageSegment && !libraryEmpty && (
            <Text className="text-xs text-muted-foreground dark:text-dark-muted text-center">
              Barcha kontentlar yoshingizga mos ravishda tanlanadi
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
