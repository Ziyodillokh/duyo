import { useRouter } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import {
  Mic,
  Network,
  Plus,
  ScanLine,
  Sparkles,
  Target,
} from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { listNotes, type GraphNode, type NoteListItem } from '@/api/endpoints/notes';
import { colourForTag } from '@/lib/galaxy-layout';

interface BrainHomeProps {
  childId: string;
  notes: NoteListItem[];
  tags: string[];
  graphNodes: GraphNode[];
  graphEdges: { source: string; target: string }[];
  cardBg: string;
  onNewNote: () => void;
  /** Prefills the title so the child lands straight in the editor for it. */
  onStartNote: (title: string) => void;
  onOpenTag: (tag: string) => void;
  onExploreGraph: () => void;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function BrainHome({
  childId,
  notes,
  tags,
  graphNodes,
  graphEdges,
  cardBg,
  onNewNote,
  onStartNote,
  onOpenTag,
  onExploreGraph,
}: BrainHomeProps) {
  const router = useRouter();

  const updatedToday = useMemo(
    () => notes.filter((n) => isToday(n.updated_at)).length,
    [notes],
  );

  // "Connectivity" — a real, honest number: how many of the child's actual
  // notes have at least one link, out of all their actual notes. Not an
  // invented "AI score" — every input is data the child produced.
  const pulse = useMemo(() => {
    const written = graphNodes.filter((n) => n.kind === 'note' && n.exists);
    if (written.length === 0) return null;
    const linked = written.filter((n) => n.links > 0).length;
    return Math.round((linked / written.length) * 100);
  }, [graphNodes]);

  // A note the child has [[linked]] to from somewhere but never written —
  // the graph already knows this; nothing here is guessed or generated.
  const unwritten = useMemo(
    () => graphNodes.find((n) => n.kind === 'note' && !n.exists) ?? null,
    [graphNodes],
  );

  // Real per-tag counts. Small, bounded list (children don't accumulate
  // hundreds of tags), same parallel-query shape brain-screen.tsx already
  // uses for embed lookups.
  const tagCounts = useQueries({
    queries: tags.map((tag) => ({
      queryKey: ['notes', childId, tag, 'count'],
      queryFn: () => listNotes(childId, tag),
      enabled: !!childId,
    })),
  });

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 14, paddingBottom: 48 }}>
      {/* Today */}
      <View
        className="rounded-2xl border border-neon-purple/25 flex-row items-center"
        style={{ backgroundColor: cardBg, padding: 18 }}
      >
        <View className="flex-1 pr-3">
          <Text className="text-xs font-bold tracking-wide text-dark-heading dark:text-dark-heading">
            BUGUNGI FOKUS
          </Text>
          <Text className="text-lg font-bold text-foreground dark:text-dark-text mt-1">
            G'oyalarni bog'la.{'\n'}Bilim qur.
          </Text>
          <Text className="text-xs text-muted-foreground dark:text-dark-muted mt-2">
            {notes.length} ta qayd · {updatedToday} ta bugun yangilandi
          </Text>
        </View>
        <View className="items-center justify-center">
          <View
            className="items-center justify-center rounded-full border-2 border-neon-blue"
            style={{ width: 74, height: 74 }}
          >
            <Text className="text-xl font-bold text-neon-blue">
              {pulse === null ? '—' : pulse}
            </Text>
            <Text className="text-[9px] text-dark-muted">{pulse === null ? '' : '%'}</Text>
          </View>
          <Text className="text-[10px] text-muted-foreground dark:text-dark-muted mt-1 text-center">
            bog'langan{'\n'}qaydlar
          </Text>
        </View>
      </View>

      {/* Quick actions */}
      <View className="flex-row justify-between">
        <QuickAction icon={Plus} label="Yangi qayd" onPress={onNewNote} colour="#60A5FA" />
        <QuickAction
          icon={Mic}
          label="Ovozli qayd"
          onPress={() => router.push('/(main)/voice')}
          colour="#FB64B6"
        />
        <QuickAction icon={ScanLine} label="Skanerlash" colour="#94A3B8" disabled note="tez orada" />
        <QuickAction
          icon={Target}
          label="Yangi maqsad"
          onPress={() => router.push('/(main)/(tabs)/goals')}
          colour="#FDC700"
        />
      </View>

      {/* Graph card */}
      <View
        className="rounded-2xl border border-neon-blue/20"
        style={{ backgroundColor: cardBg, padding: 18 }}
      >
        <Text className="text-xs font-bold tracking-wide text-dark-heading dark:text-dark-heading mb-1">
          BILIM GRAFIGI
        </Text>
        <View className="flex-row items-center gap-4 mt-1">
          <View
            className="items-center justify-center rounded-full"
            style={{ width: 54, height: 54, backgroundColor: 'rgba(96,165,250,0.14)' }}
          >
            <Network size={26} color="#60A5FA" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-foreground dark:text-dark-text">
              Bilimingiz o'sib bormoqda
            </Text>
            <Text className="text-xs text-muted-foreground dark:text-dark-muted mt-0.5">
              {graphNodes.filter((n) => n.kind !== 'tag').length} tugun · {graphEdges.length} bog'lanish
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onExploreGraph}
          accessibilityRole="button"
          accessibilityLabel="Bilim grafigini ochish"
          className="rounded-md items-center justify-center mt-4 active:opacity-70"
          style={{ height: 42, backgroundColor: 'rgba(96,165,250,0.15)' }}
        >
          <Text className="text-sm text-neon-blue">Xaritani ochish →</Text>
        </Pressable>
      </View>

      {/* Collections */}
      <View>
        <View className="flex-row items-center justify-between mb-2 px-1">
          <Text className="text-xs font-bold tracking-wide text-dark-heading dark:text-dark-heading">
            TO'PLAMLARINGIZ
          </Text>
        </View>
        <View
          className="rounded-2xl border border-neon-blue/15 overflow-hidden"
          style={{ backgroundColor: cardBg }}
        >
          <Pressable
            onPress={onExploreGraph}
            accessibilityRole="button"
            accessibilityLabel="Barcha qaydlar"
            className="flex-row items-center justify-between px-4 active:opacity-70"
            style={{ paddingVertical: 14 }}
          >
            <View className="flex-row items-center gap-3">
              <Sparkles size={18} color="#60A5FA" />
              <Text className="text-sm text-foreground dark:text-dark-text">Barcha qaydlar</Text>
            </View>
            <Text className="text-sm text-muted-foreground dark:text-dark-muted">{notes.length}</Text>
          </Pressable>
          {tags.map((tag, i) => {
            const colour = colourForTag(tag);
            const count = tagCounts[i]?.data?.length;
            return (
              <Pressable
                key={tag}
                onPress={() => onOpenTag(tag)}
                accessibilityRole="button"
                accessibilityLabel={`#${tag} to'plami`}
                className="flex-row items-center justify-between px-4 active:opacity-70 border-t border-neon-blue/10"
                style={{ paddingVertical: 14 }}
              >
                <View className="flex-row items-center gap-3">
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colour }} />
                  <Text className="text-sm text-foreground dark:text-dark-text">#{tag}</Text>
                </View>
                <Text className="text-sm text-muted-foreground dark:text-dark-muted">
                  {count ?? '…'}
                </Text>
              </Pressable>
            );
          })}
          {tags.length === 0 && (
            <View className="px-4" style={{ paddingVertical: 14 }}>
              <Text className="text-xs text-muted-foreground dark:text-dark-muted">
                Hali teg yo'q — qaydga #teg qo'shsangiz, shu yerda to'plam bo'lib chiqadi.
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Real, graph-derived suggestion — never a fabricated "AI insight". */}
      {unwritten && (
        <View
          className="rounded-2xl border border-neon-yellow/25"
          style={{ backgroundColor: cardBg, padding: 16 }}
        >
          <View className="flex-row items-center gap-2 mb-1">
            <Sparkles size={14} color="#FDC700" />
            <Text className="text-xs font-bold tracking-wide" style={{ color: '#FDC700' }}>
              TAVSIYA
            </Text>
          </View>
          <Text className="text-sm text-foreground dark:text-dark-text">
            "{unwritten.title}" ga boshqa qaydlardan bog'langansiz, lekin u hali yozilmagan.
          </Text>
          <Pressable
            onPress={() => onStartNote(unwritten.title)}
            accessibilityRole="button"
            accessibilityLabel={`${unwritten.title} qaydini yozishni boshlash`}
            className="rounded-md self-start px-3 py-2 mt-3 active:opacity-70"
            style={{ backgroundColor: 'rgba(253,199,0,0.16)' }}
          >
            <Text className="text-xs" style={{ color: '#FDC700' }}>Yozishni boshlash</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onPress,
  colour,
  disabled,
  note,
}: {
  icon: typeof Plus;
  label: string;
  onPress?: () => void;
  colour: string;
  disabled?: boolean;
  note?: string;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={disabled ? { disabled: true } : undefined}
      className="items-center active:opacity-70"
      style={{ width: 72, opacity: disabled ? 0.45 : 1 }}
    >
      <View
        className="items-center justify-center rounded-full"
        style={{ width: 50, height: 50, backgroundColor: `${colour}26` }}
      >
        <Icon size={22} color={colour} />
      </View>
      <Text className="text-[11px] text-center text-foreground dark:text-dark-text mt-1.5">
        {label}
      </Text>
      {note && (
        <Text className="text-[9px] text-muted-foreground dark:text-dark-muted">{note}</Text>
      )}
    </Pressable>
  );
}
