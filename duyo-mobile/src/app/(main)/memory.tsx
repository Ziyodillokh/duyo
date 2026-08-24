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
  View,
  type ViewStyle,
} from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { glass } from '@/lib/glass';
import {
  MEMORY_CATEGORY_COLOURS,
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

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
// Same family as settings and notifications: frosted panes on pale blue. The
// screen commits to the light look the way its siblings do.
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const DANGER = '#E0455E';
const GREEN = '#22B573';
const PLACEHOLDER = '#7693C2';
const HAIRLINE = 'rgba(47,111,228,0.10)';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

/* The category accents (lib/memory-categories.ts) were picked to glow on a
   navy page: on white glass, #05DF72 label text sits under 2:1 contrast. The
   colour coding therefore moves onto the shapes — the card's left rail, the
   icon, the chip's dot and tint — and every LABEL is read in ink. The list
   stays scannable by colour and stays readable. */

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
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* ── Header: the inner-screen glass pattern ─────────────────── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            style={[glass(22, 'sm'), styles.headerButton, styles.focusable]}
          >
            <ArrowLeft size={22} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>Mening Xotiram</Text>
          <Pressable
            onPress={() => setShowAdd((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Qo'lda xotira qo'shish"
            style={[
              glass(22, 'sm'),
              styles.headerButton,
              showAdd && styles.headerButtonOn,
              styles.focusable,
            ]}
          >
            {showAdd ? (
              <X size={20} color={PRIMARY} strokeWidth={2.2} />
            ) : (
              <Plus size={20} color={PRIMARY} strokeWidth={2.2} />
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.note}>
            Bu ma'lumotlar faqat shu qurilmada, shifrlangan holda saqlanadi.
            Ular hech qachon serverga doimiy saqlash uchun yuborilmaydi.
          </Text>

          {undecryptable > 0 ? (
            <View style={[glass(20, 'md'), styles.warning]}>
              <Text style={styles.warningText}>
                {undecryptable} ta yozuvni ochib bo'lmadi. Ular shu qurilmada
                boshqa kalit bilan shifrlangan bo'lishi mumkin (masalan ilova
                qayta o'rnatilgandan keyin). Ularni tiklab bo'lmaydi —
                "Barcha xotiralarni o'chirish" orqali tozalash mumkin.
              </Text>
            </View>
          ) : null}

          {showAdd && child ? (
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
          ) : null}

          <View style={[glass(20, 'sm'), styles.search]}>
            <Search size={20} color={PRIMARY} strokeWidth={2.1} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Qidirish..."
              placeholderTextColor={PLACEHOLDER}
              accessibilityLabel="Xotiradan qidirish"
              style={styles.searchInput}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
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
                  accent={MEMORY_CATEGORY_COLOURS[c]}
                  onPress={() => setFilter(c)}
                />
              ))}
            </View>
          </ScrollView>

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {totalCount === 0
                  ? "Hali hech narsa eslab qolinmagan.\nSuhbat davomida DUYO nimadir eslab qolishni taklif qilsa, shu yerda ko'rasiz."
                  : 'Hech narsa topilmadi.'}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
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

          <View style={styles.actions}>
            <Pressable
              onPress={handleExport}
              accessibilityRole="button"
              accessibilityLabel="Xotirani eksport qilish"
              style={({ pressed }) => [
                glass(20, 'md'),
                styles.action,
                pressed && styles.pressed,
              ]}
            >
              <Download size={18} color={PRIMARY} strokeWidth={2.2} />
              <Text style={styles.actionText}>
                Xotirani eksport qilish (JSON)
              </Text>
            </Pressable>
            <Pressable
              onPress={handleDeleteAll}
              accessibilityRole="button"
              accessibilityLabel="Barcha xotiralarni o'chirish"
              style={({ pressed }) => [
                glass(20, 'md'),
                styles.action,
                styles.actionDanger,
                pressed && styles.pressed,
              ]}
            >
              <Trash2 size={18} color={DANGER} strokeWidth={2.2} />
              <Text style={[styles.actionText, styles.actionTextDanger]}>
                Barcha xotiralarni o'chirish
              </Text>
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
  accent = PRIMARY,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  /** The category's own colour, so the filter row matches the cards below. */
  accent?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        glass(16, 'sm'),
        styles.chip,
        active && {
          backgroundColor: `${accent}26`,
          borderColor: accent,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.chipDot, { backgroundColor: accent }]} />
      <Text style={[styles.chipLabel, active && styles.chipLabelOn]}>
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

  // One accent per category, so a long list is scannable by colour before it
  // is read — see lib/memory-categories.ts. Here it is the left rail and the
  // icon; the label itself is ink (see the note at the top of this file).
  const accent = MEMORY_CATEGORY_COLOURS[memory.category] ?? PRIMARY;

  return (
    <View style={[glass(22, 'md'), styles.card, { borderLeftColor: accent }]}>
      <View style={styles.cardHead}>
        <Icon size={15} color={accent} />
        <Text style={styles.cardCategory}>
          {MEMORY_CATEGORY_LABELS[memory.category]}
        </Text>
        <View style={styles.spacer} />
        {/* These two used to be bare 16px icons relying on hitSlop, which does
            nothing to the clickable box on web — a child aiming for the pencil
            could delete the memory instead. They are real 34pt targets now,
            and the hitSlop stays for native's benefit. */}
        {!editing ? (
          <Pressable
            onPress={() => {
              setDraft(memory.content);
              setEditing(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Tahrirlash"
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconButton,
              styles.focusable,
              pressed && styles.pressedHard,
            ]}
          >
            <Pencil size={16} color={MUTED} strokeWidth={2.2} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel="O'chirish"
          hitSlop={8}
          style={({ pressed }) => [
            styles.iconButton,
            styles.focusable,
            pressed && styles.pressedHard,
          ]}
        >
          <Trash2 size={16} color={MUTED} strokeWidth={2.2} />
        </Pressable>
      </View>

      {editing ? (
        <View style={styles.editWrap}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={200}
            autoFocus
            style={styles.input}
          />
          <View style={styles.editActions}>
            <Pressable
              onPress={() => setEditing(false)}
              accessibilityRole="button"
              style={[styles.iconButton, styles.focusable]}
            >
              <X size={20} color={MUTED} strokeWidth={2.2} />
            </Pressable>
            <Pressable
              onPress={handleSave}
              accessibilityRole="button"
              style={[styles.iconButton, styles.focusable]}
            >
              <Check size={20} color={GREEN} strokeWidth={2.4} />
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.cardContent}>{memory.content}</Text>
      )}

      {related.length > 0 ? (
        <View style={styles.relatedRow}>
          {related.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => Alert.alert(MEMORY_CATEGORY_LABELS[r.category], r.content)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.relatedChip,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.relatedText} numberOfLines={1}>
                🔗 {r.content.slice(0, 24)}
                {r.content.length > 24 ? '…' : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
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
    <View style={[glass(24, 'lg'), styles.form]}>
      <Text style={styles.formTitle}>Qo'lda xotira qo'shish</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipRow}>
          {MEMORY_CATEGORIES.map((c) => (
            <CategoryChip
              key={c}
              label={MEMORY_CATEGORY_LABELS[c]}
              active={category === c}
              accent={MEMORY_CATEGORY_COLOURS[c]}
              onPress={() => setCategory(c)}
            />
          ))}
        </View>
      </ScrollView>
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="Nimani eslab qolish kerak?"
        placeholderTextColor={PLACEHOLDER}
        multiline
        maxLength={200}
        style={styles.input}
      />
      <View style={styles.formActions}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          style={({ pressed }) => [styles.formButton, pressed && styles.pressed]}
        >
          <Text style={styles.formCancel}>Bekor qilish</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          accessibilityRole="button"
          style={({ pressed }) => [styles.formButton, pressed && styles.pressed]}
        >
          <Text style={styles.formSave}>Saqlash</Text>
        </Pressable>
      </View>
    </View>
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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonOn: { backgroundColor: 'rgba(47,111,228,0.16)' },
  // The browser's default focus ring is a black rectangle around a round
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
  pressed: { opacity: 0.8 },
  pressedHard: { opacity: 0.6 },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: INK },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 48,
    gap: 14,
  },
  note: { fontSize: 13, lineHeight: 19, color: MUTED },

  warning: {
    padding: 14,
    backgroundColor: 'rgba(224,69,94,0.08)',
    borderColor: 'rgba(224,69,94,0.35)',
  },
  warningText: { fontSize: 13, lineHeight: 19, color: DANGER },

  search: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: INK, paddingVertical: 0 },

  chipRow: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipLabel: { fontSize: 13, fontWeight: '600', color: INK },
  chipLabelOn: { fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: 15, lineHeight: 22, textAlign: 'center', color: MUTED },

  list: { gap: 12 },
  card: { padding: 16, borderLeftWidth: 3 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardCategory: { fontSize: 12, fontWeight: '700', color: INK },
  spacer: { flex: 1 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { marginTop: 8, fontSize: 15, lineHeight: 22, color: INK },

  editWrap: { marginTop: 8, gap: 8 },
  input: {
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIRLINE,
    backgroundColor: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    lineHeight: 21,
    color: INK,
  },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },

  relatedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  relatedChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIRLINE,
    backgroundColor: 'rgba(47,111,228,0.08)',
  },
  relatedText: { fontSize: 12, color: PRIMARY },

  actions: { gap: 12, paddingTop: 4 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  actionDanger: { borderColor: 'rgba(224,69,94,0.30)' },
  actionText: { flex: 1, fontSize: 15, fontWeight: '600', color: INK },
  actionTextDanger: { color: DANGER },

  form: { padding: 16, gap: 12 },
  formTitle: { fontSize: 14, fontWeight: '700', color: INK },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  formButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  formCancel: { fontSize: 14, fontWeight: '600', color: MUTED },
  formSave: { fontSize: 14, fontWeight: '700', color: PRIMARY },
});
