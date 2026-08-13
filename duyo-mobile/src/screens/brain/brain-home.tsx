import { useRouter } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { Mic, Plus, ScanLine, Sparkles, Target } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  listNotes,
  type GraphEdge,
  type GraphNode,
  type NoteListItem,
} from '@/api/endpoints/notes';
import {
  BrainClusterCard,
  type ClusterStats,
} from '@/components/brain-cluster-card';
import { FocusTimerCard } from '@/components/brain/focus-timer-card';
import { InsightsCard } from '@/components/brain/insights-card';
import {
  KnowledgePulseCard,
  type PulseDay,
} from '@/components/brain/knowledge-pulse-card';
import { NoteGraph } from '@/components/note-graph';
import { summarizeGraph } from '@/lib/brain-insights';
import { colourForTag } from '@/lib/galaxy-layout';
import { WEEK_DAY_LABELS } from '@/lib/weekly-activity';

interface BrainHomeProps {
  childId: string;
  notes: NoteListItem[];
  tags: string[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  /** Computed once in brain-screen — the map's edge cards use the same list. */
  clusters: ClusterStats[];
  cardBg: string;
  onNewNote: () => void;
  /** Prefills the title so the child lands straight in the editor for it. */
  onStartNote: (title: string) => void;
  onOpenTag: (tag: string) => void;
  onExploreGraph: () => void;
}

const HERO_HEIGHT = 330;

/** Where cluster cards sit over the hero — corners, because gravity keeps the
 *  drifting stars gathered in the middle. */
const HERO_SLOTS = [
  { top: 10, left: 10 },
  { top: 10, right: 10 },
  { bottom: 10, left: 10 },
  { bottom: 10, right: 10 },
] as const;

/** Monday-based index for the weekly strip: Monday → 0 … Sunday → 6. */
function weekIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export default function BrainHome({
  childId,
  notes,
  tags,
  graphNodes,
  graphEdges,
  clusters,
  cardBg,
  onNewNote,
  onStartNote,
  onOpenTag,
  onExploreGraph,
}: BrainHomeProps) {
  const router = useRouter();

  // "Connectivity" — a real, honest number: how many of the child's actual
  // notes have at least one link, out of all their actual notes. Not an
  // invented "AI score" — every input is data the child produced.
  const pulse = useMemo(() => {
    const written = graphNodes.filter((n) => n.kind === 'note' && n.exists);
    if (written.length === 0) return null;
    const linked = written.filter((n) => n.links > 0).length;
    return Math.round((linked / written.length) * 100);
  }, [graphNodes]);

  // This week's activity, bucketed by weekday from when each note was last
  // touched. `updated_at` is the only date the list endpoint carries, so the
  // strip honestly shows "days you worked on notes", not "notes created".
  const week = useMemo(() => {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - weekIndex(now));
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const n of notes) {
      const d = new Date(n.updated_at);
      if (d >= monday && d <= now) counts[weekIndex(d)]++;
    }
    const today = weekIndex(now);
    const days: PulseDay[] = WEEK_DAY_LABELS.map((label, i) => ({
      label,
      count: counts[i],
      isToday: i === today,
      isFuture: i > today,
    }));
    return { days, total: counts.reduce((a, b) => a + b, 0) };
  }, [notes]);

  const summary = useMemo(
    () => summarizeGraph(graphNodes, graphEdges, tags),
    [graphNodes, graphEdges, tags],
  );

  const hasSky = graphNodes.some((n) => n.kind !== 'tag');

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
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14, paddingBottom: 150 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── The sky itself, live. The same simulation as the full map — the
          stars drift here too — behind a tap-through into the real thing.
          The overlay Pressable deliberately swallows the map's own gestures:
          a preview that pans and zooms would fight the page scroll. */}
      {hasSky ? (
        <View
          className="rounded-2xl overflow-hidden"
          style={{
            height: HERO_HEIGHT,
            borderWidth: 1,
            borderColor: 'rgba(150, 180, 255, 0.18)',
            backgroundColor: '#070B1A',
          }}
        >
          <NoteGraph
            nodes={graphNodes}
            edges={graphEdges}
            onSelect={() => onExploreGraph()}
            height={HERO_HEIGHT}
          />
          <Pressable
            onPress={onExploreGraph}
            accessibilityRole="button"
            accessibilityLabel="Bilim xaritasini ochish"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          {clusters.slice(0, HERO_SLOTS.length).map((c, i) => (
            <BrainClusterCard
              key={c.tag}
              cluster={c}
              active={false}
              onPress={() => onOpenTag(c.tag)}
              onLongPress={() => onOpenTag(c.tag)}
              position={HERO_SLOTS[i]}
            />
          ))}
          <View
            className="absolute self-center rounded-full px-3 py-1.5"
            style={{ bottom: 10, backgroundColor: 'rgba(11, 16, 32, 0.72)' }}
          >
            <Text className="text-[11px]" style={{ color: '#8FA3C8' }}>
              Xaritani ochish →
            </Text>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={onNewNote}
          accessibilityRole="button"
          accessibilityLabel="Birinchi qaydni yozish"
          className="rounded-2xl items-center justify-center active:opacity-80"
          style={{
            height: 180,
            borderWidth: 1,
            borderColor: 'rgba(150, 180, 255, 0.18)',
            backgroundColor: 'rgba(11, 16, 32, 0.72)',
          }}
        >
          <Sparkles size={22} color="#C27AFF" />
          <Text className="text-sm mt-2" style={{ color: '#E8EEFF' }}>
            Osmoningiz hali bo'sh
          </Text>
          <Text className="text-xs mt-1" style={{ color: '#8FA3C8' }}>
            Birinchi qaydni yozing — birinchi yulduz yonadi
          </Text>
        </Pressable>
      )}

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

      <InsightsCard
        summary={summary}
        onExplore={onExploreGraph}
        onStartNote={onStartNote}
        onNewNote={onNewNote}
      />

      <View className="flex-row" style={{ gap: 12 }}>
        <View style={{ flex: 1 }}>
          <FocusTimerCard />
        </View>
        <View style={{ flex: 1 }}>
          <KnowledgePulseCard pulse={pulse} days={week.days} weekTotal={week.total} />
        </View>
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
