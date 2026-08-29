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
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

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
 *
 * The palette comes from `components/brain/glass`, not `lib/glass`: this page
 * is the one place in the app with a dark ground, and GLASS carries the tokens
 * that read correctly against it.
 */

/** Minimum sky. Below this the planets crowd into an unreadable knot; the
 *  layout would rather let the page be a hair tall on a tiny phone than show
 *  a sky nobody can read. */
const HERO_MIN = 240;

/** How many notes the "So'nggi yozuvlar" card shows before "Barchasi". */
const RECENT = 3;

const SKY_TEXT = '#E8EEFF';
const SKY_MUTED = '#8FA3C8';
const SKY_SUBTITLE = '#9FB3D4';

export interface BrainHomeProps {
  notes: NoteListItem[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  /** The graph could not be fetched. An empty sky and an unreachable
   *  server are the same shape here, and only one of them should invite
   *  the child to write their first note. */
  loadFailed?: boolean;
  /** Still fetching. Same reasoning: nothing is known yet, so nothing
   *  should be claimed. */
  loading?: boolean;
  onRetry?: () => void;
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
  loadFailed,
  loading,
  onRetry,
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
    <View style={[styles.page, { paddingBottom: navClearance }]}>
      {/* ── The sky, as one dark card on the light page ─────────────────── */}
      <View style={[styles.sky, raised('lg')]}>
        {/* The nebula, inside the card. On the full map this is the page
            ground; here it belongs to the card, so the shrunken sky keeps the
            same backdrop instead of falling back to flat navy. */}
        <BrainBackdrop />

        {hasSky ? (
          <View style={styles.fill}>
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
        ) : loading ? (
          <View style={styles.emptySky}>
            <ActivityIndicator color={SKY_MUTED} />
          </View>
        ) : loadFailed ? (
          /* An empty sky and an unreachable server look identical from
             here, and only one of them should say "write your first
             note". Telling a child their notebook is empty when it is
             merely unreachable is the worst reading of the two. */
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Qaytadan urinish"
            style={({ pressed }) => [
              styles.emptySky,
              pressed && styles.pressed80,
              styles.focusable,
            ]}
          >
            <Text style={styles.emptyTitle}>Xaritani yuklab bo&lsquo;lmadi</Text>
            <Text style={styles.emptyBody}>
              Qaydlaringiz joyida — qaytadan urinish uchun bosing
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onNewNote}
            accessibilityRole="button"
            accessibilityLabel="Birinchi qaydni yozish"
            style={({ pressed }) => [
              styles.emptySky,
              pressed && styles.pressed80,
              styles.focusable,
            ]}
          >
            <Text style={styles.emptyTitle}>Osmoningiz hali bo&lsquo;sh</Text>
            <Text style={styles.emptyBody}>
              Birinchi qaydni yozing — birinchi yulduz paydo bo&lsquo;ladi
            </Text>
          </Pressable>
        )}

        {/* Title block. Absolute over the sky rather than above it, because
            the card must read as ONE object — a header band would split it
            into a label and a picture. */}
        <View style={styles.titleBlock} pointerEvents="box-none">
          <View style={styles.titleRow}>
            <View style={styles.fill}>
              <Text style={styles.skyTitle}>2-Miyya</Text>
              <Text style={styles.skySubtitle}>Bilimlaringiz olami</Text>
            </View>
            <Pressable
              onPress={onExploreGraph}
              accessibilityRole="button"
              accessibilityLabel="Xaritani to&lsquo;liq ochish"
              hitSlop={10}
              style={({ pressed }) => [
                styles.expandButton,
                pressed && styles.pressed70,
                styles.focusable,
              ]}
            >
              {/* An `i` promises an explanation; this button enlarges the map.
                  The glyph now says what happens. */}
              <Maximize2 size={16} color="#FFFFFF" strokeWidth={2.4} />
            </Pressable>
          </View>
        </View>

        {/* The headline number, bottom-left; the new-note button, bottom-right.
            Both sit over the sky's emptiest band. */}
        <View style={styles.footRow} pointerEvents="box-none">
          <Pressable
            onPress={onExploreGraph}
            accessibilityRole="button"
            accessibilityLabel={`${connections} bog'lanish — xaritani ochish`}
            style={({ pressed }) => [
              styles.fill,
              pressed && styles.pressed70,
              styles.focusable,
            ]}
          >
            <Text style={styles.bigNumber}>{connections}</Text>
            <View style={styles.linkRow}>
              <Link2 size={12} color={SKY_MUTED} />
              <Text style={styles.linkLabel}>Bog&lsquo;lanishlar</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={onNewNote}
            accessibilityRole="button"
            accessibilityLabel="Yangi qayd"
            style={({ pressed }) => [
              styles.newNote,
              raised('md'),
              pressed && styles.pressed80,
              styles.focusable,
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
      <GlassCard style={styles.listCard} radius={26}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>So&lsquo;nggi yozuvlar</Text>
          {/* "Barchasi", beside a list of notes, means the rest of the LIST.
              It used to open the bare graph — the one screen that does not
              show a note's name until you tap a planet. */}
          <Pressable
            onPress={onOpenList}
            accessibilityRole="button"
            accessibilityLabel="Barcha qaydlar"
            hitSlop={8}
            style={({ pressed }) => [
              styles.allButton,
              pressed && styles.pressed70,
              styles.focusable,
            ]}
          >
            <Text style={styles.allLabel}>Barchasi</Text>
            <ChevronRight size={15} color={GLASS.blue} strokeWidth={2.5} />
          </Pressable>
        </View>

        {recent.length === 0 ? (
          <View style={styles.emptyList}>
            <Text style={styles.emptyListText}>Hali qayd yo&lsquo;q</Text>
          </View>
        ) : (
          <View style={styles.rows}>
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
                  style={({ pressed }) => [
                    styles.row,
                    raised('sm'),
                    pressed && styles.pressed70,
                    styles.focusable,
                  ]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: `${tint}22` }]}>
                    <Icon size={18} color={tint} strokeWidth={2.2} />
                  </View>

                  <Text numberOfLines={1} style={styles.rowTitle}>
                    {n.title}
                  </Text>

                  <Text style={styles.rowTime}>{noteTimeLabel(n.updated_at)}</Text>
                  <View style={[styles.rowDot, { backgroundColor: dot }]} />
                </Pressable>
              );
            })}
          </View>
        )}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  // The browser draws a square focus ring on whatever was last pressed; every
  // control here is rounded, so the default ring is simply wrong.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
  // `active:opacity-*` had no meaning once the classes went; these carry it.
  pressed70: { opacity: 0.7 },
  pressed80: { opacity: 0.8 },
  fill: { flex: 1 },

  page: { flex: 1, paddingHorizontal: 16, paddingTop: 4, gap: 12 },

  sky: {
    flex: 1,
    minHeight: HERO_MIN,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: GLASS.sky,
  },

  emptySky: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: SKY_TEXT },
  emptyBody: { fontSize: 13, marginTop: 6, color: SKY_MUTED },

  titleBlock: { position: 'absolute', top: 22, left: 22, right: 22 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  skyTitle: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  skySubtitle: { fontSize: 13, marginTop: 4, color: SKY_SUBTITLE },
  expandButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  footRow: {
    position: 'absolute',
    left: 22,
    right: 18,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  bigNumber: {
    color: GLASS.blueSoft,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  linkLabel: { fontSize: 13, color: SKY_MUTED },
  newNote: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  listCard: { padding: 12 },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  listTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: GLASS.ink,
    letterSpacing: -0.2,
  },
  allButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  allLabel: { fontSize: 14, fontWeight: '600', color: GLASS.blue },

  emptyList: { paddingVertical: 18, alignItems: 'center' },
  emptyListText: { fontSize: 13, color: GLASS.muted },

  rows: { gap: 7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 17,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: GLASS.surfaceSoft,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { flexGrow: 1, flexShrink: 1, fontSize: 15, fontWeight: '600', color: GLASS.ink },
  rowTime: { fontSize: 12.5, color: GLASS.muted },
  rowDot: { width: 9, height: 9, borderRadius: 5 },
});
