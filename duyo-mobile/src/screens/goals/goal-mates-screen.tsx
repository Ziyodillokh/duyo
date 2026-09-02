import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useNavigation } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  Check,
  Clock,
  MessageCircle,
  Plus,
  Search,
  SlidersHorizontal,
  UserPlus,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Badge, BADGE_FOR } from '@/components/badges/badge';
import { Text, TextInput } from '@/components/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Portrait, type PortraitSpec, type Scene } from '@/components/goals/portrait';
import { useNavClearance } from '@/components/v2/dark/bottom-nav';
import { fetchGoalCatalog, listGoals } from '@/api/endpoints/goals';
import {
  friendRequestErrorMessage,
  type Friendship,
  type GoalMate,
} from '@/api/endpoints/social';
import { useUnreadNotificationCount } from '@/hooks/use-notifications';
import {
  useAcceptFriend,
  useDeclineFriend,
  useFriends,
  useGoalMates,
  useGroups,
  useSendFriendRequest,
  useSocialSettings,
  useUpdateSocialSettings,
} from '@/hooks/use-social';
import { useT, type TranslationKey } from '@/i18n';
import { categoryOf } from '@/lib/goal-categories';
import { useChildStore } from '@/store/child';

// ── The glass sky, a shade bluer than home — the mock's cooler morning ───────
const PRIMARY = '#2F6FE4';
const TITLE = '#2A63DC';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const GREEN = '#22B573';
const DANGER = '#E0455E';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';
/** The spec's placeholder grey-blue. */
const PLACEHOLDER = '#7693C2';
/** Marks the search as narrowed — on the sliders icon, the bar and the tick,
 *  so the state is visible without opening the panel. */
const ACTIVE_FILTER = '#1D4ED8';
/** Active tab gradient. */
const TAB_A = '#246BEB';
const TAB_B = '#3D7FFF';

const glass = (radius: number): ViewStyle => ({
  backgroundColor: 'rgba(255,255,255,0.55)',
  borderRadius: radius,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.9)',
  boxShadow:
    '0 16px 34px rgba(111,155,221,0.32), inset 0 1.5px 0 rgba(255,255,255,0.95)',
});

// ── Illustrated people ───────────────────────────────────────────────────────
// Peers are pseudonymous by design (PeerCard: display name and age segment,
// nothing else), so the mock's photographs become drawn people: the same
// warm circles, deterministic per peer, no real child's face anywhere.

/** The first word or two of a goal, which the mock sets in bold before the
 *  rest of the sentence goes quiet. Two words when the first is tiny ("O'z",
 *  "10 ta"), so the emphasis always carries meaning. */
function leadOf(goal: string): string {
  const words = goal.split(' ');
  const lead = words[0] ?? '';
  if (lead.length <= 4 && words.length > 2) return `${lead} ${words[1]}`;
  return lead;
}

/** A stable portrait for a real peer. Deterministic from the id, so the same
 *  child looks the same on every device and every launch. */
const PORTRAIT_SCENES: readonly Scene[] = ['studio', 'street', 'city', 'mountains', 'library'];
const PORTRAIT_SKIN = ['#F0C6A2', '#E8BC92', '#DDAA80', '#CE9469', '#B97D55'];
const PORTRAIT_HAIR = ['#1E1815', '#2B211B', '#4A3423', '#5A3520', '#1F2436'];
const PORTRAIT_TOP = ['#33507F', '#2F6E7F', '#4E6B58', '#8E97A6', '#D9924E', '#7A55C9'];

function portraitFor(id: string): PortraitSpec {
  const h = seedOf(id);
  const at = (n: number, salt: number) =>
    (Math.imul(h ^ Math.imul(salt + 1, 0x9e3779b9), 0x85ebca6b) >>> 16) % n;
  return {
    scene: PORTRAIT_SCENES[at(PORTRAIT_SCENES.length, 1)],
    skin: PORTRAIT_SKIN[at(PORTRAIT_SKIN.length, 3)],
    hair: PORTRAIT_HAIR[at(PORTRAIT_HAIR.length, 5)],
    hairStyle: at(5, 7) as PortraitSpec['hairStyle'],
    top: PORTRAIT_TOP[at(PORTRAIT_TOP.length, 9)],
    lightFromLeft: at(2, 11) === 0,
    turn: at(9, 13) - 4,
  };
}

function seedOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h | 1;
}

// ── Categories and the mock's communities ────────────────────────────────────

/** The mock's community circles, wired to the categories that exist. */
const STORIES: readonly { label: TranslationKey; cat: string; spec: PortraitSpec }[] = [
  {
    label: 'mates.circle.students',
    cat: 'talim',
    spec: {
      scene: 'street', skin: '#E3B183', hair: '#241C18', hairStyle: 0,
      top: '#4A5566', lightFromLeft: true, turn: -4,
    },
  },
  {
    label: 'mates.circle.itCode',
    cat: 'it',
    spec: {
      scene: 'city', skin: '#EFC6A0', hair: '#3A2A1E', hairStyle: 3,
      top: '#8A7F76', lightFromLeft: false, turn: 5,
    },
  },
  {
    label: 'mates.circle.travellers',
    cat: 'sayohat',
    spec: {
      scene: 'mountains', skin: '#DFAE84', hair: '#1F1815', hairStyle: 0,
      top: '#2F6E7F', lightFromLeft: true, turn: 3,
    },
  },
  {
    label: 'mates.circle.athletes',
    cat: 'sport',
    spec: {
      scene: 'gym', skin: '#D9A278', hair: '#1B1512', hairStyle: 0,
      top: '#171B21', lightFromLeft: false, turn: -3,
    },
  },
  {
    label: 'mates.circle.readers',
    cat: 'kitoblar',
    spec: {
      scene: 'library', skin: '#EFC6A0', hair: '#2A1F18', hairStyle: 4,
      top: '#8E97A6', lightFromLeft: true, turn: -4,
    },
  },
];

/** The mock's filter chips. "Yaqin atrofimda" is honest by construction:
 *  the server only ever suggests the same age segment within a year, so the
 *  whole list already IS nearby — the chip simply says so. */
type ChipKey = 'all' | 'nearby' | 'active' | 'fresh' | 'top';
const CHIPS: readonly { key: ChipKey; label: TranslationKey }[] = [
  { key: 'all', label: 'common.all' },
  { key: 'nearby', label: 'mates.chip.nearby' },
  { key: 'active', label: 'mates.chip.active' },
  { key: 'fresh', label: 'mates.chip.fresh' },
  { key: 'top', label: 'mates.chip.topMentors' },
];

// ── Rows ─────────────────────────────────────────────────────────────────────

type MateState =
  | { kind: 'friend'; friendship: Friendship }
  | { kind: 'incoming'; friendship: Friendship }
  | { kind: 'outgoing' }
  | { kind: 'new'; mate: GoalMate };

interface MateRow {
  peerId: string;
  name: string;
  /** Achievement key, or null. Carried on the row rather than read
   *  from the peer object at render time because a row is built from
   *  either a friendship or a goal-mate and both supply it. */
  badge: string | null;
  goal: string;
  matchKey: string | null;
  state: MateState;
}

function statusOf(state: MateState): { dot: string; text: TranslationKey } {
  switch (state.kind) {
    case 'friend':
      return { dot: GREEN, text: 'mates.status.friend' };
    case 'incoming':
      return { dot: GREEN, text: 'mates.status.incoming' };
    case 'outgoing':
      return { dot: MUTED, text: 'mates.status.outgoing' };
    case 'new':
      return { dot: MUTED, text: 'mates.status.sharedGoal' };
  }
}

function MateCard({
  row,
  busy,
  onChat,
  onConnect,
  onAccept,
  onDecline,
}: {
  row: MateRow;
  busy: boolean;
  onChat: (f: Friendship) => void;
  onConnect: (m: GoalMate) => void;
  onAccept: (f: Friendship) => void;
  onDecline: (f: Friendship) => void;
}) {
  const t = useT();
  const status = statusOf(row.state);
  const category = categoryOf(row.matchKey);
  // An unknown key (a badge this build has no art for) draws nothing
  // rather than a placeholder — a client one release behind should
  // show the name it always showed, not a broken mark.
  const badgeArt = row.badge ? BADGE_FOR[row.badge] : undefined;
  const state = row.state;

  return (
    <View style={[glass(22), rowStyles.card]}>
      <Portrait spec={portraitFor(row.peerId)} size={64} seed={seedOf(row.peerId)} />
      <View style={rowStyles.body}>
        {/* The badge stands BEFORE the name, the way a mark of rank
            reads: you see what someone is, then who. After the name it
            would collide with the truncation ellipsis on a long
            nickname and disappear on exactly the rows most likely to
            have one. */}
        <View style={rowStyles.nameRow}>
          {badgeArt && (
            <Badge kind={badgeArt.kind} tier={badgeArt.tier} size={17} />
          )}
          <Text style={rowStyles.name} numberOfLines={1}>
            {row.name}
          </Text>
        </View>
        <Text style={rowStyles.goal} numberOfLines={1}>
          <Text style={rowStyles.goalLead}>{leadOf(row.goal)}</Text>
          {row.goal.slice(leadOf(row.goal).length)}
        </Text>
        <View style={rowStyles.statusRow}>
          <View style={[rowStyles.dot, { backgroundColor: status.dot }]} />
          <Text style={rowStyles.statusText}>{t(status.text)}</Text>
        </View>
        {category && (
          <View style={rowStyles.tagRow}>
            <View style={rowStyles.tag}>
              <Text style={rowStyles.tagText}>{category.label}</Text>
            </View>
          </View>
        )}
      </View>

      {state.kind === 'friend' && (
        <Pressable
          onPress={() => onChat(state.friendship)}
          accessibilityRole="button"
          accessibilityLabel={t('mates.a11y.chatWith', { name: row.name })}
          style={[glass(24), rowStyles.action]}
        >
          <MessageCircle size={24} color={PRIMARY} strokeWidth={1.9} />
        </Pressable>
      )}
      {state.kind === 'outgoing' && (
        <View style={[glass(24), rowStyles.action, { opacity: 0.55 }]}>
          <Clock size={24} color={PRIMARY} strokeWidth={1.9} />
        </View>
      )}
      {state.kind === 'new' && (
        <Pressable
          onPress={() => !busy && onConnect(state.mate)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t('mates.a11y.sendRequest', { name: row.name })}
          style={[glass(24), rowStyles.action, busy && { opacity: 0.55 }]}
        >
          <UserPlus size={24} color={PRIMARY} strokeWidth={1.9} />
        </Pressable>
      )}
      {state.kind === 'incoming' && (
        <View style={rowStyles.pairActions}>
          <Pressable
            onPress={() => !busy && onAccept(state.friendship)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('mates.a11y.accept', { name: row.name })}
            style={[glass(20), rowStyles.smallAction, busy && { opacity: 0.55 }]}
          >
            <Check size={21} color={GREEN} strokeWidth={2.2} />
          </Pressable>
          <Pressable
            onPress={() => !busy && onDecline(state.friendship)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('mates.a11y.decline', { name: row.name })}
            style={[glass(20), rowStyles.smallAction, busy && { opacity: 0.55 }]}
          >
            <X size={21} color={DANGER} strokeWidth={2.2} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── The screen ───────────────────────────────────────────────────────────────

/**
 * Maqsaddoshlar — the mock, one to one: community circles with drawn people
 * (peers are pseudonymous, so illustration stands where photography cannot),
 * the search pill, the mock's five filter chips, and a glass card per peer
 * with the action the relationship truthfully supports right now.
 *
 * Friends and incoming requests render even while discovery is off — the
 * consent gate guards DISCOVERY, never the friendships a child already has.
 * Every confirm and every error is inline UI: Alert does not exist on web.
 */
export default function GoalMatesScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const navClearance = useNavClearance();
  const childId = useChildStore((s) => s.child?.id ?? undefined);
  const childAge = useChildStore((s) => s.child?.age ?? undefined);
  const navigation = useNavigation();

  const settingsQuery = useSocialSettings(childId);
  const updateSettings = useUpdateSocialSettings(childId);
  const discoverable = settingsQuery.data?.discoverable ?? false;

  /** Which of my goals the search is narrowed to; null searches all of them. */
  const [goalKey, setGoalKey] = useState<string | null>(null);

  const matesQuery = useGoalMates(childId, discoverable, goalKey);
  const friendsQuery = useFriends(childId);
  const sendRequest = useSendFriendRequest(childId);
  const acceptRequest = useAcceptFriend(childId);
  const declineRequest = useDeclineFriend(childId);
  const unread = useUnreadNotificationCount();
  // The circles are real rooms now (see screens/goals/group-screen.tsx);
  // the server decides which exist and who is in them.
  const groups = useGroups(childId);

  // Friend rows carry no shared_goal (a connected peer never reappears in
  // goal-mates), so their goal line is named from the catalogue.
  const catalogQuery = useQuery({
    queryKey: ['goal-catalog', childAge ?? 0],
    queryFn: () => fetchGoalCatalog(undefined, childAge),
    staleTime: 60 * 60 * 1000,
  });
  const catalogTitles = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of catalogQuery.data ?? []) m.set(e.match_key, e.title);
    return m;
  }, [catalogQuery.data]);

  /**
   * MY goals — what the filter offers to narrow the search to.
   *
   * Taken from my own goal list rather than from the mates already on screen:
   * a goal nobody else has yet still belongs in the picker, and answering
   * "nobody on this one yet" is more use than hiding the goal entirely.
   * Only confirmed, matchable goals can introduce anyone, so only those are
   * offered — the same rule the server matches on.
   */
  const myGoalsQuery = useQuery({
    queryKey: ['my-goals', childId],
    queryFn: () => listGoals(childId!, 'active'),
    enabled: !!childId,
    staleTime: 60_000,
  });
  const filterGoals = useMemo(() => {
    const seen = new Set<string>();
    const out: { key: string; label: string }[] = [];
    for (const g of myGoalsQuery.data ?? []) {
      if (!g.match_key || !g.confirmed_at || seen.has(g.match_key)) continue;
      seen.add(g.match_key);
      // The catalogue title is how a human wrote the goal; the child's own
      // title is the fallback when the catalogue has not loaded.
      out.push({ key: g.match_key, label: catalogTitles.get(g.match_key) ?? g.title });
    }
    return out;
  }, [myGoalsQuery.data, catalogTitles]);

  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<ChipKey>('all');
  const [showSettings, setShowSettings] = useState(false);
  /** Optimistic "already asked" — flips the row before the refetch lands,
   *  so a double-tap cannot fire a duplicate request and earn a false error. */
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  const say = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  };

  const booting = settingsQuery.isPending || friendsQuery.isPending;

  const rows = useMemo<MateRow[]>(() => {
    const friends = friendsQuery.data ?? [];
    const mates = matesQuery.data ?? [];
    const byPeer = new Map<string, MateRow>();

    for (const f of friends) {
      const goalTitle =
        (f.match_key && catalogTitles.get(f.match_key)) || t('mates.goalFallback');
      if (f.status === 'accepted') {
        byPeer.set(f.peer.child_id, {
          peerId: f.peer.child_id,
          name: f.peer.display_name,
          badge: f.peer.badge ?? null,
          goal: goalTitle,
          matchKey: f.match_key,
          state: { kind: 'friend', friendship: f },
        });
      } else if (f.status === 'pending') {
        byPeer.set(f.peer.child_id, {
          peerId: f.peer.child_id,
          name: f.peer.display_name,
          badge: f.peer.badge ?? null,
          goal: goalTitle,
          matchKey: f.match_key,
          state: f.incoming ? { kind: 'incoming', friendship: f } : { kind: 'outgoing' },
        });
      }
    }
    for (const m of mates) {
      if (byPeer.has(m.peer.child_id)) continue;
      byPeer.set(m.peer.child_id, {
        peerId: m.peer.child_id,
        name: m.peer.display_name,
        badge: m.peer.badge ?? null,
        goal: m.shared_goal,
        matchKey: m.match_key,
        state: requested.has(m.peer.child_id)
          ? { kind: 'outgoing' }
          : { kind: 'new', mate: m },
      });
    }

    const order: Record<MateState['kind'], number> = {
      incoming: 0,
      friend: 1,
      new: 2,
      outgoing: 3,
    };
    let list = [...byPeer.values()].sort(
      (a, b) => order[a.state.kind] - order[b.state.kind] || a.name.localeCompare(b.name),
    );

    if (chip === 'active') {
      list = list.filter((r) => r.state.kind === 'friend' || r.state.kind === 'incoming');
    }
    if (chip === 'fresh') list = list.filter((r) => r.state.kind === 'new');
    if (chip === 'top') {
      const freq = new Map<string, number>();
      for (const r of list) {
        const c = categoryOf(r.matchKey);
        if (c) freq.set(c.key, (freq.get(c.key) ?? 0) + 1);
      }
      list = [...list].sort(
        (a, b) =>
          (freq.get(categoryOf(b.matchKey)?.key ?? '') ?? 0) -
          (freq.get(categoryOf(a.matchKey)?.key ?? '') ?? 0),
      );
    }
    // The old category filter is gone: the story circles became real rooms
    // (they navigate to /group), so nothing ever set it.
    //
    // `goalKey` already narrowed the SEARCH server-side, but existing
    // connections come from friendsQuery, which knows nothing about it — so
    // choosing "maths" and still seeing an English-goal friend read as a
    // filter that had not worked. One goal chosen means one goal shown.
    if (goalKey) list = list.filter((r) => r.matchKey === goalKey);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) => r.name.toLowerCase().includes(q) || r.goal.toLowerCase().includes(q),
      );
    }
    return list;
  }, [friendsQuery.data, matesQuery.data, catalogTitles, chip, goalKey, query, requested, t]);

  const hasConnections = rows.some((r) => r.state.kind !== 'new');


  const openChat = (f: Friendship) =>
    router.push({
      pathname: '/(main)/peer-chat',
      params: { friendshipId: f.id, peerName: f.peer.display_name },
    });

  const connect = (m: GoalMate) => {
    if (sendRequest.isPending || requested.has(m.peer.child_id)) return;
    setRequested((s) => new Set(s).add(m.peer.child_id));
    sendRequest.mutate(m.peer.child_id, {
      onError: (err) => {
        setRequested((s) => {
          const next = new Set(s);
          next.delete(m.peer.child_id);
          return next;
        });
        say(friendRequestErrorMessage(err));
      },
    });
  };

  const accept = (f: Friendship) => {
    if (acceptRequest.isPending) return;
    acceptRequest.mutate(f.id, {
      onError: () => say(t('mates.acceptFailed')),
    });
  };
  const decline = (f: Friendship) => {
    if (declineRequest.isPending) return;
    declineRequest.mutate(f.id, {
      onError: () => say(t('mates.declineFailed')),
    });
  };

  const hasUnread = (unread.data?.count ?? 0) > 0;
  const toHome = () => (navigation as { navigate(name: string): void }).navigate('index');
  const busy = sendRequest.isPending || acceptRequest.isPending || declineRequest.isPending;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 44),
          paddingBottom: navClearance + 12,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable
            onPress={toHome}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={[glass(24), styles.headerButton]}
          >
            <ArrowLeft size={23} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>{t('mates.title')}</Text>
          <Pressable
            onPress={() => router.push('/(main)/notifications')}
            accessibilityRole="button"
            accessibilityLabel={t('notificationsScreen.title')}
            style={[glass(24), styles.headerButton]}
          >
            <Bell size={23} color={PRIMARY} strokeWidth={1.9} />
            {hasUnread && <View style={styles.bellDot} />}
          </Pressable>
        </View>

        {/* ── Community circles ──────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stories}
        >
          {(groups.data ?? []).map((g) => {
            const story = STORIES.find((x) => x.cat === g.category);
            return (
              <Pressable
                key={g.key}
                onPress={() =>
                  router.push({
                    pathname: '/(main)/group',
                    params: { key: g.key, label: g.label },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={t('mates.a11y.group', {
                  label: g.label,
                  count: g.members,
                })}
                style={[styles.story, styles.focusable]}
              >
                <View style={[styles.storyRing, g.joined && styles.storyRingActive]}>
                  <View style={styles.storyInner}>
                    <Portrait
                      spec={story?.spec ?? portraitFor(g.key)}
                      size={56}
                      seed={seedOf(g.key)}
                    />
                  </View>
                </View>
                <Text style={styles.storyLabel} numberOfLines={1}>
                  {g.label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => router.push('/(main)/my-goals')}
            accessibilityRole="button"
            accessibilityLabel={t('mates.a11y.addGoals')}
            style={[styles.story, styles.focusable]}
          >
            <View style={[glass(32), styles.storyPlus]}>
              <Plus size={28} color={PRIMARY} strokeWidth={1.9} />
            </View>
            <Text style={styles.storyLabel}>{t('common.add')}</Text>
          </Pressable>
        </ScrollView>

        {/* ── Search ─────────────────────────────────────────────────── */}
        <View style={[glass(20), styles.search]}>
          <Search size={22} color={PRIMARY} strokeWidth={2.1} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('mates.searchPlaceholder')}
            placeholderTextColor={PLACEHOLDER}
            style={styles.searchInput}
            accessibilityLabel={t('mates.a11y.search')}
          />
          <Pressable
            onPress={() => setShowSettings((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={t('mates.a11y.filters')}
            hitSlop={10}
          >
            <SlidersHorizontal
              size={24}
              color={goalKey ? ACTIVE_FILTER : PRIMARY}
              strokeWidth={2}
            />
          </Pressable>
        </View>

        {/* A narrowed search is easy to forget you turned on, so it says so
            outside the panel — and one tap puts it back. */}
        {goalKey && !showSettings && (
          <Pressable
            onPress={() => setGoalKey(null)}
            accessibilityRole="button"
            accessibilityLabel={t('mates.a11y.clearFilter')}
            style={styles.activeFilterBar}
          >
            <Text style={styles.activeFilterText} numberOfLines={1}>
              {catalogTitles.get(goalKey) ?? goalKey}
            </Text>
            <X size={15} color={ACTIVE_FILTER} strokeWidth={2.4} />
          </Pressable>
        )}

        {/* ── Filter + visibility panel (inline — Alert has no web build) ── */}
        {showSettings && (
          <View style={[glass(20), styles.settingsCard]}>
            {/* Which goal to look on. "Barchasi" is the default and searches
                every goal at once, the way the screen always has. */}
            <Text style={styles.filterHeading}>{t('mates.filter.heading')}</Text>
            <View style={styles.filterList}>
              <Pressable
                onPress={() => setGoalKey(null)}
                accessibilityRole="radio"
                accessibilityState={{ selected: goalKey === null }}
                style={[styles.filterRow, goalKey === null && styles.filterRowOn]}
              >
                <Text
                  style={[styles.filterLabel, goalKey === null && styles.filterLabelOn]}
                >
                  {t('mates.filter.allGoals')}
                </Text>
                {goalKey === null && (
                  <Check size={16} color={ACTIVE_FILTER} strokeWidth={2.6} />
                )}
              </Pressable>

              {filterGoals.map((g) => (
                <Pressable
                  key={g.key}
                  onPress={() => setGoalKey(g.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: goalKey === g.key }}
                  style={[styles.filterRow, goalKey === g.key && styles.filterRowOn]}
                >
                  <Text
                    style={[
                      styles.filterLabel,
                      goalKey === g.key && styles.filterLabelOn,
                    ]}
                    numberOfLines={1}
                  >
                    {g.label}
                  </Text>
                  {goalKey === g.key && (
                    <Check size={16} color={ACTIVE_FILTER} strokeWidth={2.6} />
                  )}
                </Pressable>
              ))}

              {filterGoals.length === 0 && (
                <Text style={styles.filterEmpty}>
                  {myGoalsQuery.isPending
                    ? t('mates.filter.loading')
                    : t('mates.filter.empty')}
                </Text>
              )}
            </View>

            <View style={styles.settingsDivider} />

            <View style={styles.settingsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingsTitle}>{t('mates.visibility.title')}</Text>
                <Text style={styles.settingsBody}>
                  {discoverable
                    ? t('mates.visibility.onBody', {
                        name: settingsQuery.data?.display_name ?? '',
                      })
                    : t('mates.visibility.offBody')}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  !updateSettings.isPending &&
                  updateSettings.mutate(
                    { discoverable: !discoverable },
                    { onError: () => say(t('common.saveFailedRetry')) },
                  )
                }
                accessibilityRole="switch"
                accessibilityState={{ checked: discoverable }}
                accessibilityLabel={t('mates.a11y.toggleVisibility')}
                style={[styles.switch, discoverable && styles.switchOn]}
              >
                <View style={[styles.knob, discoverable && styles.knobOn]} />
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Chips ──────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {CHIPS.map((c) => (
            <Pressable
              key={c.key}
              onPress={() => setChip(c.key)}
              accessibilityRole="button"
              style={[styles.chip, chip === c.key && styles.chipActive]}
            >
              {chip === c.key && (
                <LinearGradient
                  colors={[TAB_A, TAB_B]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.chipFill}
                />
              )}
              <Text style={[styles.chipText, chip === c.key && styles.chipTextActive]}>
                {t(c.label)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {toast && (
          <View style={[glass(16), styles.toast]}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}

        {/* ── Body ───────────────────────────────────────────────────── */}
        {booting ? (
          <>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[glass(22), styles.skeleton]} />
            ))}
          </>
        ) : (
          <>
            {rows
              .filter((r) => r.state.kind !== 'new')
              .map((row) => (
                <MateCard
                  key={row.peerId}
                  row={row}
                  busy={busy}
                  onChat={openChat}
                  onConnect={connect}
                  onAccept={accept}
                  onDecline={decline}
                />
              ))}

            {!discoverable ? (
              <View style={[glass(22), styles.consentCard]}>
                <Text style={styles.consentTitle}>{t('mates.consent.title')}</Text>
                <Text style={styles.consentBody}>
                  {t('mates.consent.body')}
                  {hasConnections ? ` ${t('mates.consent.keepsFriends')}` : ''}
                </Text>
                <Pressable
                  onPress={() =>
                    !updateSettings.isPending &&
                    updateSettings.mutate(
                      { discoverable: true },
                      { onError: () => say(t('common.saveFailedRetry')) },
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t('mates.consent.enable')}
                  style={styles.consentButton}
                >
                  <Text style={styles.consentButtonText}>
                    {t('mates.consent.enable')}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
                {rows
                  .filter((r) => r.state.kind === 'new')
                  .map((row) => (
                    <MateCard
                      key={row.peerId}
                      row={row}
                      busy={busy}
                      onChat={openChat}
                      onConnect={connect}
                      onAccept={accept}
                      onDecline={decline}
                    />
                  ))}
                {rows.length === 0 && (
                  <View style={[glass(22), styles.consentCard]}>
                    <Text style={styles.consentTitle}>
                      {query || goalKey
                        ? t('common.nothingFound')
                        : t('mates.empty.title')}
                    </Text>
                    <Text style={styles.consentBody}>
                      {query || goalKey
                        ? t('mates.empty.searchBody')
                        : t('mates.empty.body')}
                    </Text>
                    {!query && !goalKey && (
                      <Pressable
                        onPress={() => router.push('/(main)/my-goals')}
                        accessibilityRole="button"
                        accessibilityLabel={t('goals.add')}
                        style={styles.consentButton}
                      >
                        <Text style={styles.consentButtonText}>{t('goals.add')}</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// Every number below comes from the design spec for a 390x844 screen:
// 20pt gutters, a 350pt content column, and the 4/8/12/16/20/24/32 spacing
// ladder. Sizes are fixed rather than scaled — this screen scrolls, so it
// does not need the home dashboard's fit-to-height trick.
const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Header: 68pt tall, 48pt round buttons ──────────────────────────────
  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 23, fontWeight: '700', color: TITLE },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#F04438',
  },

  // ── Stories: 112pt band, 64pt circles, 13pt apart ──────────────────────
  stories: { paddingLeft: 20, paddingRight: 8, paddingTop: 8, gap: 13 },
  story: { alignItems: 'center', width: 64 },
  storyRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: 'rgba(79,134,238,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  storyRingActive: { borderColor: PRIMARY },
  // The browser's default focus ring is a black rectangle around a round
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
  storyInner: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden' },
  storyPlus: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyLabel: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: INK,
    textAlign: 'center',
  },

  // ── Search: 350x56, radius 20, 18pt side padding ───────────────────────
  search: {
    marginTop: 8,
    marginHorizontal: 20,
    paddingHorizontal: 18,
    height: 56,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchInput: { flexGrow: 1, flexShrink: 1, fontSize: 16, color: INK, paddingVertical: 0 },

  settingsCard: { marginTop: 12, marginHorizontal: 20, padding: 16 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingsDivider: {
    height: 1,
    marginVertical: 14,
    backgroundColor: 'rgba(140,163,203,0.28)',
  },

  filterHeading: { fontSize: 13, fontWeight: '700', color: MUTED },
  filterList: { marginTop: 8, gap: 4 },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  filterRowOn: { backgroundColor: 'rgba(47,111,228,0.10)' },
  filterLabel: { flexGrow: 1, flexShrink: 1, fontSize: 14.5, color: INK },
  filterLabelOn: { fontWeight: '700', color: ACTIVE_FILTER },
  filterEmpty: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
  },

  activeFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginTop: 10,
    marginHorizontal: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(47,111,228,0.12)',
  },
  activeFilterText: {
    maxWidth: 240,
    fontSize: 13,
    fontWeight: '700',
    color: ACTIVE_FILTER,
  },
  settingsTitle: { fontSize: 16, fontWeight: '700', color: INK },
  settingsBody: { marginTop: 4, fontSize: 13, lineHeight: 18, color: MUTED },
  switch: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(140,163,203,0.4)',
    padding: 3,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: PRIMARY },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' },
  knobOn: { alignSelf: 'flex-end' },

  // ── Tabs: 40pt tall, radius 20, 18pt padding ───────────────────────────
  chips: { paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  chip: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  chipActive: { borderColor: 'transparent', backgroundColor: 'transparent' },
  chipFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
  },
  chipText: { fontSize: 15, fontWeight: '600', color: INK },
  chipTextActive: { color: '#FFFFFF' },

  toast: { marginTop: 12, marginHorizontal: 20, padding: 12, borderRadius: 16 },
  toastText: { fontSize: 14, color: DANGER, fontWeight: '600' },

  skeleton: {
    marginTop: 12,
    marginHorizontal: 20,
    height: 90,
    borderRadius: 22,
    opacity: 0.55,
  },


  consentCard: { marginTop: 12, marginHorizontal: 20, padding: 20, borderRadius: 22 },
  consentTitle: { fontSize: 17, fontWeight: '700', color: INK },
  consentBody: { marginTop: 8, fontSize: 14, lineHeight: 21, color: MUTED },
  consentButton: {
    marginTop: 16,
    backgroundColor: PRIMARY,
    borderRadius: 16,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consentButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

const rowStyles = StyleSheet.create({
  // 350x90 with 18pt side padding; the avatar is 64 so the vertical padding
  // is what is left over, and the text column runs tight to fit four rows.
  card: {
    marginTop: 12,
    marginHorizontal: 20,
    minHeight: 90,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  body: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // flexShrink so the NAME gives way to truncation, never the badge.
  name: {
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 21,
    fontWeight: '700',
    color: PRIMARY,
  },
  goal: { marginTop: 1, fontSize: 14.5, lineHeight: 17, fontWeight: '500', color: MUTED },
  goalLead: { fontWeight: '700', color: INK } as TextStyle,
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, lineHeight: 15, color: MUTED },
  tagRow: { flexDirection: 'row', gap: 8, marginTop: 3, flexWrap: 'wrap' },
  tag: {
    height: 24,
    justifyContent: 'center',
    backgroundColor: 'rgba(79,134,238,0.14)',
    borderRadius: 11,
    paddingHorizontal: 12,
  },
  tagText: { fontSize: 13, fontWeight: '600', color: PRIMARY },
  action: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairActions: { gap: 6 },
  smallAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
