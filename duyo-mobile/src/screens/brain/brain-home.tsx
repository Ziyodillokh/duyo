import {
  ChevronRight,
  ClipboardList,
  Lightbulb,
  Link2,
  Maximize2,
  Plus,
  StickyNote,
  Target,
} from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/text';

import {
  type GraphEdge,
  type GraphNode,
  type NoteListItem,
} from '@/api/endpoints/notes';
import { BrainBackdrop } from '@/components/brain-backdrop';
import { GLASS, GlassCard, raised } from '@/components/brain/glass';
import { NoteGraph } from '@/components/note-graph';
import { useNavClearance } from '@/components/v2/dark/bottom-nav';
import { noteTimeLabel } from '@/lib/note-time';

/**
 * "2-Miyya" — the Miya landing page.
 *
 * One dark sky card on a light glass page, then the recent notes. Everything
 * on it is real: the sky is the child's actual note graph, the connection
 * count is their actual edges, and the list is their actual last-touched
 * notes. There is no placeholder content anywhere on this screen, because a
 * dashboard that shows invented numbers teaches children to ignore numbers.
 */

/** Minimum sky. Below this the planets crowd into an unreadable knot; the
 *  layout would rather let the page be a hair tall on a tiny phone than show
 *  a sky nobody can read. */
const HERO_MIN = 240;

/** How many notes the "So'nggi yozuvlar" card shows before "Barchasi". */
const RECENT = 3;

export interface BrainHomeProps {
  notes: NoteListItem[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  onNewNote: () => void;
  /** Start writing a note that is only a [[link]] so far. */
  onStartNote: (title: string) => void;
  /** Open the map filtered to one #tag. */
  onOpenTag: (tag: string) => void;
  onExploreGraph: () => void;
  /** Open the map with the full note list showing. */
  onOpenList: () => void;
  onOpenNote?: (id: string) => void;
}

/** Icons cycle by position so a list of three is never three identical rows.
 *  Keyed off the note's own id, so a note keeps its icon between visits —
 *  a row that changes shape on every refresh reads as broken. */
const ROW_ICONS = [ClipboardList, Lightbulb, Target, StickyNote] as const;
const ROW_TINTS = ['#7C6CF5', '#F5B92B', '#F2568F', '#28BFA0'] as const;

export default function BrainHome({
  notes,
  graphNodes,
  graphEdges,
  onNewNote,
  onStartNote,
  onOpenTag,
  onExploreGraph,
  onOpenList,
  onOpenNote,
}: BrainHomeProps) {
  // The dock floats over this page rather than taking a strip of layout,
  // so the space it covers has to be reserved here or the last note row
  // sits under a live bar: unreadable, and tappable only by the bar.
  const navClearance = useNavClearance();
  // The headline number. Edges between two written notes — a link to a note
  // that does not exist yet is a promise, not a connection, so counting it
  // would inflate the one number this page leads with.
  const connections = useMemo(() => {
    const written = new Set(
      graphNodes.filter((n) => n.kind === 'note' && n.exists).map((n) => n.title),
    );
    return graphEdges.filter(
      (e) => written.has(e.source) && written.has(e.target),
    ).length;
  }, [graphNodes, graphEdges]);

  // Colour per note, taken from the map so the dot beside a title is the same
  // colour as that note's planet. The list is therefore a legend for the sky.
  const colourOf = useMemo(() => {
    const m = new Map<string, string>();
    // `colour` is null for unwritten [[links]] and #tag nodes — they have no
    // note behind them to have chosen one. Skip rather than store null so the
    // caller's `?? blueSoft` fallback is the single place the default lives.
    for (const n of graphNodes) {
      if (n.colour) m.set(n.title.toLowerCase(), n.colour);
    }
    return m;
  }, [graphNodes]);

  const recent = useMemo(
    () =>
      [...notes]
        .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
        .slice(0, RECENT),
    [notes],
  );

  const hasSky = graphNodes.some((n) => n.kind !== 'tag');

  // No scroll. The whole page is exactly one screen on every phone, which is
  // why the sky is `flex: 1` and everything else is its natural height: the
  // sky absorbs whatever is left after the list and the dock's reserved
  // strip, instead of the page being taller than the display and scrolling.
  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: navClearance,
        gap: 12,
      }}
    >
      {/* ── The sky, as one dark card on the light page ─────────────────── */}
      <View
        style={[
          {
            flex: 1,
            minHeight: HERO_MIN,
            borderRadius: 30,
            overflow: 'hidden',
            backgroundColor: GLASS.sky,
          },
          raised('lg'),
        ]}
      >
        {/* The nebula, inside the card. On the full map this is the page
            ground; here it belongs to the card, so the shrunken sky keeps the
            same backdrop instead of falling back to flat navy. */}
        <BrainBackdrop />

        {hasSky ? (
          <View style={{ flex: 1 }}>
            <NoteGraph
              nodes={graphNodes}
              edges={graphEdges}
              onSelect={(n) => {
                // Each kind of body goes where it points. Everything without
                // an id used to dump the child on the bare map, which threw
                // away the thing they had just aimed at: a #tag star is a
                // cluster to open, and an unwritten [[link]] is a note asking
                // to be written.
                if (n.kind === 'tag') onOpenTag(n.title.replace(/^#/, ''));
                else if (n.id) onOpenNote?.(n.id);
                else onStartNote(n.title);
              }}
            />
          </View>
        ) : (
          <Pressable
            onPress={onNewNote}
            accessibilityRole="button"
            accessibilityLabel="Birinchi qaydni yozish"
            className="flex-1 items-center justify-center active:opacity-80"
          >
            <Text className="text-base font-semibold" style={{ color: '#E8EEFF' }}>
              Osmoningiz hali bo&lsquo;sh
            </Text>
            <Text className="text-[13px] mt-1.5" style={{ color: '#8FA3C8' }}>
              Birinchi qaydni yozing — birinchi yulduz paydo bo&lsquo;ladi
            </Text>
          </Pressable>
        )}

        {/* Title block. Absolute over the sky rather than above it, because
            the card must read as ONE object — a header band would split it
            into a label and a picture. */}
        <View
          style={{ position: 'absolute', top: 22, left: 22, right: 22 }}
          pointerEvents="box-none"
        >
          <View className="flex-row items-start">
            <View className="flex-1">
              <Text
                className="font-bold"
                style={{ color: '#FFFFFF', fontSize: 27, letterSpacing: -0.5 }}
              >
                2-Miyya
              </Text>
              <Text className="text-[13px] mt-1" style={{ color: '#9FB3D4' }}>
                Bilimlaringiz olami
              </Text>
            </View>
            <Pressable
              onPress={onExploreGraph}
              accessibilityRole="button"
              accessibilityLabel="Xaritani to&lsquo;liq ochish"
              hitSlop={10}
              className="items-center justify-center active:opacity-70"
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                borderWidth: 1.5,
                borderColor: 'rgba(255,255,255,0.55)',
              }}
            >
              {/* An `i` promises an explanation; this button enlarges the map.
                  The glyph now says what happens. */}
              <Maximize2 size={16} color="#FFFFFF" strokeWidth={2.4} />
            </Pressable>
          </View>
        </View>

        {/* The headline number, bottom-left; the new-note button, bottom-right.
            Both sit over the sky's emptiest band. */}
        <View
          style={{
            position: 'absolute',
            left: 22,
            right: 18,
            bottom: 18,
            flexDirection: 'row',
            alignItems: 'flex-end',
          }}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={onExploreGraph}
            accessibilityRole="button"
            accessibilityLabel={`${connections} bog'lanish — xaritani ochish`}
            className="flex-1 active:opacity-70"
          >
            <Text
              className="font-bold"
              style={{
                color: GLASS.blueSoft,
                fontSize: 38,
                lineHeight: 42,
                letterSpacing: -1,
                fontVariant: ['tabular-nums'],
              }}
            >
              {connections}
            </Text>
            <View className="flex-row items-center gap-1.5 mt-0.5">
              <Link2 size={12} color="#8FA3C8" />
              <Text className="text-[13px]" style={{ color: '#8FA3C8' }}>
                Bog&lsquo;lanishlar
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={onNewNote}
            accessibilityRole="button"
            accessibilityLabel="Yangi qayd"
            className="items-center justify-center active:opacity-80"
            style={[
              {
                width: 62,
                height: 62,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.94)',
              },
              raised('md'),
            ]}
          >
            <Plus size={27} color={GLASS.blue} strokeWidth={2.6} />
          </Pressable>
        </View>
      </View>

      {/* ── Recent notes ────────────────────────────────────────────────── */}
      {/* Natural height, so the sky above gets everything that is left. Every
          size here is therefore load-bearing for "one screen, no scroll":
          growing a row by 6px takes 18px off the sky. */}
      <GlassCard style={{ padding: 12 }} radius={26}>
        <View className="flex-row items-center justify-between px-1 mb-2.5">
          <Text
            className="text-[17px] font-bold"
            style={{ color: GLASS.ink, letterSpacing: -0.2 }}
          >
            So&lsquo;nggi yozuvlar
          </Text>
          {/* "Barchasi", beside a list of notes, means the rest of the LIST.
              It used to open the bare graph — the one screen that does not
              show a note's name until you tap a planet. */}
          <Pressable
            onPress={onOpenList}
            accessibilityRole="button"
            accessibilityLabel="Barcha qaydlar"
            hitSlop={8}
            className="flex-row items-center gap-1 active:opacity-70"
          >
            <Text className="text-[14px] font-semibold" style={{ color: GLASS.blue }}>
              Barchasi
            </Text>
            <ChevronRight size={15} color={GLASS.blue} strokeWidth={2.5} />
          </Pressable>
        </View>

        {recent.length === 0 ? (
          <View style={{ paddingVertical: 18, alignItems: 'center' }}>
            <Text className="text-[13px]" style={{ color: GLASS.muted }}>
              Hali qayd yo&lsquo;q
            </Text>
          </View>
        ) : (
          <View style={{ gap: 7 }}>
            {recent.map((n, i) => {
              const Icon = ROW_ICONS[i % ROW_ICONS.length];
              const tint = ROW_TINTS[i % ROW_TINTS.length];
              const dot = colourOf.get(n.title.toLowerCase()) ?? GLASS.blueSoft;
              return (
                <Pressable
                  key={n.id}
                  onPress={() => onOpenNote?.(n.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${n.title} — ${noteTimeLabel(n.updated_at)}`}
                  className="flex-row items-center gap-3 active:opacity-70"
                  style={[
                    {
                      borderRadius: 17,
                      paddingHorizontal: 11,
                      paddingVertical: 8,
                      backgroundColor: GLASS.surfaceSoft,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.8)',
                    },
                    raised('sm'),
                  ]}
                >
                  <View
                    className="items-center justify-center"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      backgroundColor: `${tint}22`,
                    }}
                  >
                    <Icon size={18} color={tint} strokeWidth={2.2} />
                  </View>

                  <Text
                    numberOfLines={1}
                    className="flex-1 text-[15px] font-semibold"
                    style={{ color: GLASS.ink }}
                  >
                    {n.title}
                  </Text>

                  <Text className="text-[12.5px]" style={{ color: GLASS.muted }}>
                    {noteTimeLabel(n.updated_at)}
                  </Text>
                  <View
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 5,
                      backgroundColor: dot,
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
        )}
      </GlassCard>
    </View>
  );
}
