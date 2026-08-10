import { useIsDark } from '@/store/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Check,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  MEMORY_CATEGORY_ICONS,
  MEMORY_CATEGORY_LABELS,
} from '@/lib/memory-categories';
import {
  listRelations,
  MEMORY_CATEGORIES,
  type MemoryCategory,
  type MemoryRecord,
} from '@/lib/memory-db';
import { memoryExportToJson } from '@/lib/memory-export';
import { buildMemoryGraph } from '@/lib/memory-graph';
import { describeGuardReasons, screenMemoryContent } from '@/lib/memory-guard';
import { useChildStore } from '@/store/child';
import { MemoryGuardError, useMemoryStore } from '@/store/memory';

type CategoryFilter = 'all' | MemoryCategory;

/** Shared Uzbek explanation for a Guard rejection, from either write path. */
function alertGuardBlocked(reasons: readonly string[]) {
  Alert.alert(
    "Bu ma'lumot saqlanmaydi",
    `Bu matn ${describeGuardReasons(reasons)} ma'lumotga o'xshaydi. ` +
      "Xavfsizlik uchun bunday ma'lumotlar xotiraga saqlanmaydi.",
  );
}

export default function MemoryScreen() {
  const isDark = useIsDark();
  const child = useChildStore((s) => s.child);
  const items = useMemoryStore((s) => s.items);
  const counts = useMemoryStore((s) => s.counts);
  const undecryptable = useMemoryStore((s) => s.undecryptable);
  const loadedChildId = useMemoryStore((s) => s.childId);
  const loaded = useMemoryStore((s) => s.loaded);
  const load = useMemoryStore((s) => s.load);
  const addMemory = useMemoryStore((s) => s.addMemory);
  const updateMemory = useMemoryStore((s) => s.updateMemory);
  const removeMemory = useMemoryStore((s) => s.removeMemory);
  const removeAll = useMemoryStore((s) => s.removeAll);

  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (!child) return;
    // `loaded` alone is not enough: it stays true across a child switch, so
    // opening this screen as a second sibling would keep showing the first
    // sibling's memories. The loaded-for id must match the active child too.
    if (!loaded || loadedChildId !== child.id) {
      load(child.id).catch(() => {});
    }
  }, [child, loaded, loadedChildId, load]);

  const totalCount = items.length;

  // Relations power the "🔗 Bog'liq xotiralar" chips on each card — reloaded
  // whenever the memory list itself changes (memory-graph.ts's auto-linking
  // runs on every add, so a fresh list means possibly-fresh edges too).
  const [relationsByMemory, setRelationsByMemory] = useState<
    Record<string, MemoryRecord[]>
  >({});

  useEffect(() => {
    if (!child) return;
    let cancelled = false;
    listRelations(child.id).then((rels) => {
      if (cancelled) return;
      const { edges } = buildMemoryGraph(items, rels);
      const byId = new Map(items.map((m) => [m.id, m]));
      const grouped: Record<string, MemoryRecord[]> = {};
      for (const edge of edges) {
        const a = byId.get(edge.source);
        const b = byId.get(edge.target);
        if (!a || !b) continue;
        (grouped[a.id] ??= []).push(b);
        (grouped[b.id] ??= []).push(a);
      }
      setRelationsByMemory(grouped);
    });
    return () => {
      cancelled = true;
    };
  }, [child, items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((m) => {
      if (filter !== 'all' && m.category !== filter) return false;
      if (q && !m.content.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, filter, query]);

  const handleDelete = (memory: MemoryRecord) => {
    Alert.alert(
      "Xotirani o'chirish",
      `"${memory.content}" o'chirilsinmi? Bu amalni ortga qaytarib bo'lmaydi.`,
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: "O'chirish",
          style: 'destructive',
          onPress: () => removeMemory(memory.id).catch(() => {}),
        },
      ],
    );
  };

  const handleDeleteAll = () => {
    if (!child || totalCount === 0) return;
    Alert.alert(
      "Barcha xotiralarni o'chirish",
      `Jami ${totalCount} ta xotira o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.`,
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: "Barchasini o'chirish",
          style: 'destructive',
          onPress: () => removeAll().catch(() => {}),
        },
      ],
    );
  };

  const handleExport = async () => {
    if (totalCount === 0) {
      Alert.alert("Xotira bo'sh", "Eksport qiladigan hali hech narsa yo'q.");
      return;
    }
    try {
      const json = memoryExportToJson(items);
      // Device share sheet — the child/parent decides where it goes (Files,
      // email, etc). No automatic upload anywhere: this IS the manual
      // backup the local-first architecture relies on instead of cloud sync.
      await Share.share({ message: json, title: 'DUYO — Mening Xotiram' });
    } catch {
      Alert.alert('Xatolik', "Eksport qilishning iloji bo'lmadi.");
    }
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' }]} />
      <LinearGradient
        colors={['rgba(96, 165, 250, 0.20)', 'rgba(252, 211, 77, 0.15)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.97, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View className="flex-row items-center gap-3 px-6 py-4">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            className="w-10 h-10 items-center justify-center"
          >
            <ArrowLeft size={20} color={isDark ? '#E0E7FF' : '#102033'} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground dark:text-dark-text flex-1">
            Mening Xotiram
          </Text>
          <Pressable
            onPress={() => setShowAdd((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Qo'lda xotira qo'shish"
            className="w-10 h-10 items-center justify-center rounded-md bg-neon-blue/15"
          >
            {showAdd ? (
              <X size={18} color="#60A5FA" />
            ) : (
              <Plus size={18} color="#60A5FA" />
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-sm text-muted-foreground dark:text-dark-muted -mt-2">
            Bu ma'lumotlar faqat shu qurilmada, shifrlangan holda saqlanadi.
            Ular hech qachon serverga doimiy saqlash uchun yuborilmaydi.
          </Text>

          {undecryptable > 0 && (
            <View
              className="rounded-xl border"
              style={{
                padding: 14,
                borderColor: 'rgba(251, 100, 182, 0.4)',
                backgroundColor: 'rgba(251, 100, 182, 0.08)',
              }}
            >
              <Text className="text-sm" style={{ color: '#FB64B6' }}>
                {undecryptable} ta yozuvni ochib bo'lmadi. Ular shu qurilmada
                boshqa kalit bilan shifrlangan bo'lishi mumkin (masalan ilova
                qayta o'rnatilgandan keyin). Ularni tiklab bo'lmaydi —
                "Barcha xotiralarni o'chirish" orqali tozalash mumkin.
              </Text>
            </View>
          )}

          {showAdd && child && (
            <AddMemoryForm
              onCancel={() => setShowAdd(false)}
              onSave={async (category, content) => {
                try {
                  await addMemory(category, content, 'manual');
                  setShowAdd(false);
                } catch (err) {
                  // The form pre-screens for a friendlier message, but the
                  // store is the authoritative gate — honour its verdict too.
                  if (err instanceof MemoryGuardError) alertGuardBlocked(err.reasons);
                  else Alert.alert('Xatolik', "Saqlab bo'lmadi.");
                }
              }}
            />
          )}

          <View
            className="flex-row items-center gap-2 rounded-xl border border-neon-blue/20 px-3"
            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF' }}
          >
            <Search size={16} color="#94A3B8" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Qidirish..."
              placeholderTextColor="#94A3B8"
              accessibilityLabel="Xotiradan qidirish"
              className="flex-1 py-3 text-base text-foreground dark:text-dark-text"
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              <CategoryChip
                label={`Barchasi (${totalCount})`}
                active={filter === 'all'}
                onPress={() => setFilter('all')}
              />
              {MEMORY_CATEGORIES.map((c) => (
                <CategoryChip
                  key={c}
                  label={`${MEMORY_CATEGORY_LABELS[c]} (${counts[c]})`}
                  active={filter === c}
                  onPress={() => setFilter(c)}
                />
              ))}
            </View>
          </ScrollView>

          {filtered.length === 0 ? (
            <View className="items-center py-12 gap-2">
              <Text className="text-base text-muted-foreground dark:text-dark-muted text-center">
                {totalCount === 0
                  ? "Hali hech narsa eslab qolinmagan.\nSuhbat davomida DUYO nimadir eslab qolishni taklif qilsa, shu yerda ko'rasiz."
                  : 'Hech narsa topilmadi.'}
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {filtered.map((memory) => (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  related={relationsByMemory[memory.id] ?? []}
                  onDelete={() => handleDelete(memory)}
                  onSave={(content) => updateMemory(memory.id, content)}
                  onBlocked={alertGuardBlocked}
                />
              ))}
            </View>
          )}

          <View className="gap-3 pt-4">
            <Pressable
              onPress={handleExport}
              accessibilityRole="button"
              accessibilityLabel="Xotirani eksport qilish"
              className="rounded-xl border border-neon-blue/20 bg-card dark:bg-dark-surface active:opacity-80"
              style={{ padding: 16 }}
            >
              <View className="flex-row items-center gap-3">
                <Download size={18} color="#60A5FA" />
                <Text className="text-base font-medium text-foreground dark:text-dark-text">
                  Xotirani eksport qilish (JSON)
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={handleDeleteAll}
              accessibilityRole="button"
              accessibilityLabel="Barcha xotiralarni o'chirish"
              className="rounded-xl border border-destructive/30 bg-card dark:bg-dark-surface active:opacity-80"
              style={{ padding: 16 }}
            >
              <View className="flex-row items-center gap-3">
                <Trash2 size={18} color="#FB64B6" />
                <Text className="text-base font-medium" style={{ color: '#FB64B6' }}>
                  Barcha xotiralarni o'chirish
                </Text>
              </View>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function CategoryChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`px-3 py-1.5 rounded-2xl border mr-2 ${
        active ? 'bg-neon-blue border-neon-blue' : 'border-neon-blue/30'
      }`}
    >
      <Text
        className={`text-sm font-medium ${active ? 'text-white' : 'text-foreground dark:text-dark-text'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MemoryCard({
  memory,
  related,
  onDelete,
  onSave,
  onBlocked,
}: {
  memory: MemoryRecord;
  related: MemoryRecord[];
  onDelete: () => void;
  onSave: (content: string) => Promise<void>;
  onBlocked: (reasons: readonly string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory.content);
  const Icon = MEMORY_CATEGORY_ICONS[memory.category];

  // Editing gets the SAME Memory Guard as creating. An earlier revision
  // screened only on create, so a memory could be saved clean and then
  // rewritten to hold a phone number — which would later be eligible to ride
  // along to the LLM as memory_context. Screened here for the message, and
  // again in the store, which is the gate that cannot be bypassed.
  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const guard = screenMemoryContent(trimmed);
    if (guard.verdict !== 'safe') {
      onBlocked(guard.reasons);
      return; // stay in edit mode so the child can correct the text
    }
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch (err) {
      if (err instanceof MemoryGuardError) onBlocked(err.reasons);
      else Alert.alert('Xatolik', "Saqlab bo'lmadi.");
    }
  };

  return (
    <View
      className="rounded-xl border border-neon-blue/20 bg-card dark:bg-dark-surface"
      style={{ padding: 16 }}
    >
      <View className="flex-row items-center gap-2 mb-2">
        <Icon size={16} color="#60A5FA" />
        <Text className="text-xs font-medium text-neon-blue">
          {MEMORY_CATEGORY_LABELS[memory.category]}
        </Text>
        <View className="flex-1" />
        {!editing && (
          <Pressable
            onPress={() => {
              setDraft(memory.content);
              setEditing(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Tahrirlash"
            hitSlop={8}
          >
            <Pencil size={16} color="#94A3B8" />
          </Pressable>
        )}
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel="O'chirish"
          hitSlop={8}
        >
          <Trash2 size={16} color="#94A3B8" />
        </Pressable>
      </View>

      {editing ? (
        <View className="gap-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={200}
            autoFocus
            className="text-base text-foreground dark:text-dark-text border border-neon-blue/20 rounded-lg px-3 py-2"
          />
          <View className="flex-row justify-end gap-3">
            <Pressable onPress={() => setEditing(false)} accessibilityRole="button">
              <X size={20} color="#94A3B8" />
            </Pressable>
            <Pressable onPress={handleSave} accessibilityRole="button">
              <Check size={20} color="#05DF72" />
            </Pressable>
          </View>
        </View>
      ) : (
        <Text className="text-base text-foreground dark:text-dark-text leading-6">
          {memory.content}
        </Text>
      )}

      {related.length > 0 && (
        <View className="flex-row flex-wrap gap-2 mt-3">
          {related.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => Alert.alert(MEMORY_CATEGORY_LABELS[r.category], r.content)}
              accessibilityRole="button"
              className="px-2.5 py-1 rounded-2xl bg-neon-blue/10 border border-neon-blue/20"
            >
              <Text className="text-xs text-neon-blue" numberOfLines={1}>
                🔗 {r.content.slice(0, 24)}
                {r.content.length > 24 ? '…' : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function AddMemoryForm({
  onSave,
  onCancel,
}: {
  onSave: (category: MemoryCategory, content: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<MemoryCategory>('notes');
  const [content, setContent] = useState('');

  const handleSave = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    // Same Memory Guard as the chat consent flow — manual entry gets no
    // special trust. See memory-guard.ts's module docstring. Screened here
    // so the child gets the specific reason; the store screens again as the
    // gate that no screen can skip.
    const guard = screenMemoryContent(trimmed);
    if (guard.verdict !== 'safe') {
      alertGuardBlocked(guard.reasons);
      return;
    }
    await onSave(category, trimmed);
    setContent('');
  };

  return (
    <View
      className="rounded-xl border border-neon-blue/20 bg-card dark:bg-dark-surface gap-3"
      style={{ padding: 16 }}
    >
      <Text className="text-sm font-medium text-foreground dark:text-dark-text">
        Qo'lda xotira qo'shish
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {MEMORY_CATEGORIES.map((c) => (
            <CategoryChip
              key={c}
              label={MEMORY_CATEGORY_LABELS[c]}
              active={category === c}
              onPress={() => setCategory(c)}
            />
          ))}
        </View>
      </ScrollView>
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="Nimani eslab qolish kerak?"
        placeholderTextColor="#94A3B8"
        multiline
        maxLength={200}
        className="text-base text-foreground dark:text-dark-text border border-neon-blue/20 rounded-lg px-3 py-2"
      />
      <View className="flex-row justify-end gap-4">
        <Pressable onPress={onCancel} accessibilityRole="button">
          <Text className="text-sm text-muted-foreground dark:text-dark-muted">
            Bekor qilish
          </Text>
        </Pressable>
        <Pressable onPress={handleSave} accessibilityRole="button">
          <Text className="text-sm font-semibold text-neon-blue">Saqlash</Text>
        </Pressable>
      </View>
    </View>
  );
}
