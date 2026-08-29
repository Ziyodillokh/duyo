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
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type ContentListItem, type ContentType } from '@/api/endpoints/content';
import { useContentLibrary } from '@/hooks/use-content';
import { glass, lift } from '@/lib/glass';
import { useChildStore } from '@/store/child';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
// Same family as settings, dtm and goal-mates: frosted panes on pale blue.
const PRIMARY = '#2F6FE4';
const TITLE = '#2A63DC';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';
const PLACEHOLDER = '#7693C2';

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
      style={({ pressed }) => [
        glass(22, 'md', 0.62),
        styles.card,
        pressed && styles.pressed,
        styles.focusable,
      ]}
    >
      <View style={styles.cardRow}>
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={styles.thumb}
            contentFit="cover"
            accessibilityLabel={item.title}
          />
        ) : (
          <View style={styles.thumbWell}>
            <Text style={styles.thumbEmoji}>{meta?.emoji ?? '📖'}</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {author !== '' && (
            <Text style={styles.cardAuthor} numberOfLines={1}>
              {author}
            </Text>
          )}
          <View style={styles.tagRow}>
            {/* The shelf's accent survives the restyle as the chip's tint —
                it is what tells seven identical chips apart — but the label
                stays INK: none of these neon colours is readable as text on
                a pale ground. */}
            {meta ? (
              <View style={[styles.tag, { backgroundColor: `${meta.color}33` }]}>
                <Text style={styles.tagText}>{meta.label}</Text>
              </View>
            ) : null}
            {/* `? :`, not `&&`: a language code that came back empty would
                reach React as a text node, a hard error on the web build. */}
            {foreignLanguage ? (
              <View style={[styles.tag, styles.tagNeutral]}>
                <Text style={[styles.tagText, styles.tagNeutralText]}>
                  {foreignLanguage}
                </Text>
              </View>
            ) : null}
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
    <View style={styles.root}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.root} edges={['top']}>
        {/* Header — this is a pushed screen now (it left the tab bar when
            Maqsadlar took its slot), so it needs its own way out. It sits
            outside the ScrollView so the way out never scrolls away. */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            style={[glass(24, 'sm'), styles.headerButton, styles.focusable]}
          >
            <ArrowLeft size={23} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>Kutubxona</Text>
          {/* Keeps the title centred. */}
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.page}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[glass(20, 'md', 0.62), styles.search]}>
            <Search size={20} color={PRIMARY} strokeWidth={2.1} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Nomi yoki muallifi bo'yicha qidiring..."
              placeholderTextColor={PLACEHOLDER}
              style={styles.searchInput}
              accessibilityLabel="Kutubxonadan qidirish"
              returnKeyType="search"
            />
          </View>

          {availableCategories.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {/* Only claim age-matching when we actually know the age. */}
                {ageSegment ? 'Yoshingizga mos' : "Bo'limlar"}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                <Pressable
                  onPress={() => setSelectedCategory(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Barchasi"
                  accessibilityState={{ selected: selectedCategory === null }}
                  style={({ pressed }) => [
                    glass(16, 'sm', 0.86),
                    styles.chip,
                    selectedCategory === null && styles.chipOn,
                    pressed && styles.pressed,
                    styles.focusable,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedCategory === null && styles.chipTextOn,
                    ]}
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
                      style={({ pressed }) => [
                        glass(16, 'sm', 0.86),
                        styles.chip,
                        sel && styles.chipOn,
                        pressed && styles.pressed,
                        styles.focusable,
                      ]}
                    >
                      <Text style={styles.chipEmoji}>{c.emoji}</Text>
                      <Text style={[styles.chipText, sel && styles.chipTextOn]}>
                        {c.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={styles.results}>
            {results.isPending ? (
              // Skeletons rather than a count — we do not know one yet.
              [0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[glass(22, 'md', 0.55), styles.skeleton]}
                />
              ))
            ) : results.isError ? (
              <View style={[glass(28, 'lg', 0.6), styles.statusCard]}>
                <Text style={styles.statusEmoji}>⚠️</Text>
                <Text style={styles.statusTitle}>
                  Kutubxonani yuklab bo'lmadi
                </Text>
                <Text style={styles.statusBody}>
                  Internetni tekshirib, qaytadan urinib ko'ring
                </Text>
                <Pressable
                  onPress={() => void results.refetch()}
                  disabled={results.isFetching}
                  accessibilityRole="button"
                  accessibilityLabel="Qaytadan urinish"
                  style={({ pressed }) => [
                    styles.retry,
                    results.isFetching && styles.busy,
                    pressed && !results.isFetching && styles.pressed,
                    styles.focusable,
                  ]}
                >
                  <RefreshCw size={16} color="#FFFFFF" />
                  <Text style={styles.retryText}>
                    {results.isFetching ? 'Urinilmoqda…' : 'Qaytadan urinish'}
                  </Text>
                </Pressable>
              </View>
            ) : filtered.length === 0 ? (
              <View style={[glass(28, 'lg', 0.6), styles.statusCard]}>
                <Text style={styles.statusEmoji}>{narrowed ? '🔍' : '📚'}</Text>
                <Text style={styles.statusTitle}>
                  {narrowed ? 'Hech narsa topilmadi' : "Kutubxona hozircha bo'sh"}
                </Text>
                <Text style={styles.statusBody}>
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

          {/* `? :`, not `&&`: an age segment that came back as an empty string
              would reach React as a text node, a hard error on the web build. */}
          {ageSegment && !libraryEmpty ? (
            <Text style={styles.footnote}>
              Barcha kontentlar yoshingizga mos ravishda tanlanadi
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // The browser's default focus ring is a square drawn around a rounded
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
  pressed: { opacity: 0.85 },
  busy: { opacity: 0.6 },

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
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: TITLE,
  },

  page: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 96,
    gap: 20,
  },

  search: {
    height: 56,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: INK,
    paddingVertical: 0,
    // The browser's own focus ring is a square drawn outside the pane's
    // radius; the pane itself is what shows the field here.
    outlineStyle: 'none',
    outlineWidth: 0,
  } as unknown as TextStyle,

  section: { gap: 12 },
  sectionTitle: {
    marginLeft: 2,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: INK,
  },
  chipRow: { gap: 10, paddingRight: 4 },
  chip: {
    height: 44,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  // The selected chip is the same object lit from inside, not a taller one:
  // picking a shelf does not raise it off the page.
  chipOn: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipEmoji: { fontSize: 16 },
  chipText: { fontSize: 14, fontWeight: '600', color: INK },
  chipTextOn: { color: '#FFFFFF' },

  results: { gap: 12 },
  skeleton: { height: 88, opacity: 0.5 },

  card: { padding: 16 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  thumb: { width: 56, height: 56, borderRadius: 14 },
  thumbWell: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47,111,228,0.10)',
  },
  thumbEmoji: { fontSize: 28 },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: '600', lineHeight: 21, color: INK },
  cardAuthor: { fontSize: 13.5, color: MUTED },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  tag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  tagText: { fontSize: 12, fontWeight: '600', color: INK },
  tagNeutral: { backgroundColor: 'rgba(140,163,203,0.22)' },
  tagNeutralText: { color: MUTED },

  statusCard: { alignItems: 'center', padding: 26 },
  statusEmoji: { fontSize: 38 },
  statusTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
  },
  statusBody: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    textAlign: 'center',
  },
  // A raised button on the glass page: the same shadow ladder as every other
  // object, so the eye can tell how high it sits above the card beneath it.
  retry: {
    marginTop: 18,
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    boxShadow: lift('md'),
  },
  retryText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  footnote: { fontSize: 12, color: MUTED, textAlign: 'center' },
});
