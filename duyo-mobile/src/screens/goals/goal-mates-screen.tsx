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
import { Text, TextInput } from '@/components/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Portrait, type PortraitSpec, type Scene } from '@/components/goals/portrait';
import { useNavClearance } from '@/components/v2/dark/bottom-nav';
import { fetchGoalCatalog } from '@/api/endpoints/goals';
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
const STORIES: readonly { label: string; cat: string; spec: PortraitSpec }[] = [
  {
    label: 'Talabalar',
    cat: 'talim',
    spec: {
      scene: 'street', skin: '#E3B183', hair: '#241C18', hairStyle: 0,
      top: '#4A5566', lightFromLeft: true, turn: -4,
    },
  },
  {
    label: 'IT & Code',
    cat: 'it',
    spec: {
      scene: 'city', skin: '#EFC6A0', hair: '#3A2A1E', hairStyle: 3,
      top: '#8A7F76', lightFromLeft: false, turn: 5,
    },
  },
  {
    label: 'Sayohatchilar',
    cat: 'sayohat',
    spec: {
      scene: 'mountains', skin: '#DFAE84', hair: '#1F1815', hairStyle: 0,
      top: '#2F6E7F', lightFromLeft: true, turn: 3,
    },
  },
  {
    label: 'Sportchilar',
    cat: 'sport',
    spec: {
      scene: 'gym', skin: '#D9A278', hair: '#1B1512', hairStyle: 0,
      top: '#171B21', lightFromLeft: false, turn: -3,
    },
  },
  {
    label: 'Kitobxonlar',
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
const CHIPS: readonly { key: ChipKey; label: string }[] = [
  { key: 'all', label: 'Barchasi' },
  { key: 'nearby', label: 'Yaqin atrofimda' },
  { key: 'active', label: 'Faol' },
  { key: 'fresh', label: 'Yangi' },
  { key: 'top', label: 'Top mentorlar' },
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
  goal: string;
  matchKey: string | null;
  state: MateState;
}

function statusOf(state: MateState): { dot: string; text: string } {
  switch (state.kind) {
    case 'friend':
      return { dot: GREEN, text: "Do'stingiz" };
    case 'incoming':
      return { dot: GREEN, text: "Sizga so'rov yubordi" };
    case 'outgoing':
      return { dot: MUTED, text: "So'rov yuborilgan" };
    case 'new':
      return { dot: MUTED, text: 'Umumiy maqsad' };
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
  const status = statusOf(row.state);
  const category = categoryOf(row.matchKey);
  const state = row.state;

  return (
    <View style={[glass(22), rowStyles.card]}>
      <Portrait spec={portraitFor(row.peerId)} size={64} seed={seedOf(row.peerId)} />
      <View style={rowStyles.body}>
        <Text style={rowStyles.name} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={rowStyles.goal} numberOfLines={1}>
          <Text style={rowStyles.goalLead}>{leadOf(row.goal)}</Text>
          {row.goal.slice(leadOf(row.goal).length)}
        </Text>
        <View style={rowStyles.statusRow}>
          <View style={[rowStyles.dot, { backgroundColor: status.dot }]} />
          <Text style={rowStyles.statusText}>{status.text}</Text>
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
          accessibilityLabel={`${row.name} bilan suhbat`}
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
          accessibilityLabel={`${row.name} — so'rov yuborish`}
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
            accessibilityLabel={`${row.name} — qabul qilish`}
            style={[glass(20), rowStyles.smallAction, busy && { opacity: 0.55 }]}
          >
            <Check size={21} color={GREEN} strokeWidth={2.2} />
          </Pressable>
          <Pressable
            onPress={() => !busy && onDecline(state.friendship)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`${row.name} — rad etish`}
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
  const insets = useSafeAreaInsets();
  const navClearance = useNavClearance();
  const childId = useChildStore((s) => s.child?.id ?? undefined);
  const childAge = useChildStore((s) => s.child?.age ?? undefined);
  const navigation = useNavigation();

  const settingsQuery = useSocialSettings(childId);
  const updateSettings = useUpdateSocialSettings(childId);
  const discoverable = settingsQuery.data?.discoverable ?? false;

  const matesQuery = useGoalMates(childId, discoverable);
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

  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<ChipKey>('all');
  const [category, setCategory] = useState<string | null>(null);
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
        (f.match_key && catalogTitles.get(f.match_key)) || 'Birga maqsad sari';
      if (f.status === 'accepted') {
        byPeer.set(f.peer.child_id, {
          peerId: f.peer.child_id,
          name: f.peer.display_name,
          goal: goalTitle,
          matchKey: f.match_key,
          state: { kind: 'friend', friendship: f },
        });
      } else if (f.status === 'pending') {
        byPeer.set(f.peer.child_id, {
          peerId: f.peer.child_id,
          name: f.peer.display_name,
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
    if (category) list = list.filter((r) => categoryOf(r.matchKey)?.key === category);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) => r.name.toLowerCase().includes(q) || r.goal.toLowerCase().includes(q),
      );
    }
    return list;
  }, [friendsQuery.data, matesQuery.data, catalogTitles, chip, category, query, requested]);

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
      onError: () => say("Qabul qilinmadi — birozdan so'ng qayta urinib ko'r."),
    });
  };
  const decline = (f: Friendship) => {
    if (declineRequest.isPending) return;
    declineRequest.mutate(f.id, {
      onError: () => say("Rad etilmadi — birozdan so'ng qayta urinib ko'r."),
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
            accessibilityLabel="Orqaga"
            style={[glass(24), styles.headerButton]}
          >
            <ArrowLeft size={23} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>Maqsaddoshlar</Text>
          <Pressable
            onPress={() => router.push('/(main)/notifications')}
            accessibilityRole="button"
            accessibilityLabel="Bildirishnomalar"
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
                accessibilityLabel={`${g.label} guruhi — ${g.members} a'zo`}
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
            accessibilityLabel="Qo'shish — maqsadlarim"
            style={[styles.story, styles.focusable]}
          >
            <View style={[glass(32), styles.storyPlus]}>
              <Plus size={28} color={PRIMARY} strokeWidth={1.9} />
            </View>
            <Text style={styles.storyLabel}>Qo'shish</Text>
          </Pressable>
        </ScrollView>

        {/* ── Search ─────────────────────────────────────────────────── */}
        <View style={[glass(20), styles.search]}>
          <Search size={22} color={PRIMARY} strokeWidth={2.1} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Maqsaddoshlarni qidirish..."
            placeholderTextColor={PLACEHOLDER}
            style={styles.searchInput}
            accessibilityLabel="Maqsaddoshlarni qidirish"
          />
          <Pressable
            onPress={() => setShowSettings((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Ko'rinish sozlamalari"
            hitSlop={10}
          >
            <SlidersHorizontal size={24} color={PRIMARY} strokeWidth={2} />
          </Pressable>
        </View>

        {/* ── Visibility panel (inline — Alert does not exist on web) ── */}
        {showSettings && (
          <View style={[glass(20), styles.settingsCard]}>
            <View style={styles.settingsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingsTitle}>Ko'rinish</Text>
                <Text style={styles.settingsBody}>
                  {discoverable
                    ? `Maqsaddoshlar seni "${settingsQuery.data?.display_name ?? ''}" nomi bilan ko'radi.`
                    : "Hozir hech kim seni ko'rmaydi."}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  !updateSettings.isPending &&
                  updateSettings.mutate(
                    { discoverable: !discoverable },
                    { onError: () => say("Saqlanmadi — qayta urinib ko'r.") },
                  )
                }
                accessibilityRole="switch"
                accessibilityState={{ checked: discoverable }}
                accessibilityLabel="Ko'rinishni almashtirish"
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
                {c.label}
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
                <Text style={styles.consentTitle}>
                  Yangi maqsaddoshlarni ko'rish uchun ko'rinishni yoq
                </Text>
                <Text style={styles.consentBody}>
                  Sen faqat taxallusing bilan ko'rinasan — ismingni, raqamingni
                  va rasmingni hech kim ko'rmaydi. Istalgan payt o'chirib
                  qo'yishing mumkin.
                  {hasConnections
                    ? " Do'stlaring va suhbatlaring bunga bog'liq emas."
                    : ''}
                </Text>
                <Pressable
                  onPress={() =>
                    !updateSettings.isPending &&
                    updateSettings.mutate(
                      { discoverable: true },
                      { onError: () => say("Saqlanmadi — qayta urinib ko'r.") },
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Ko'rinishni yoqish"
                  style={styles.consentButton}
                >
                  <Text style={styles.consentButtonText}>Ko'rinishni yoqish</Text>
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
                      {query || category
                        ? 'Hech kim topilmadi'
                        : "Hozircha maqsaddosh yo'q"}
                    </Text>
                    <Text style={styles.consentBody}>
                      {query || category
                        ? "Qidiruvni o'zgartirib ko'r."
                        : "Maqsad qo'shsang, xuddi shu maqsaddagi bolalar shu yerda chiqadi."}
                    </Text>
                    {!query && !category && (
                      <Pressable
                        onPress={() => router.push('/(main)/my-goals')}
                        accessibilityRole="button"
                        accessibilityLabel="Maqsad qo'shish"
                        style={styles.consentButton}
                      >
                        <Text style={styles.consentButtonText}>Maqsad qo'shish</Text>
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
  searchInput: { flex: 1, fontSize: 16, color: INK, paddingVertical: 0 },

  settingsCard: { marginTop: 12, marginHorizontal: 20, padding: 16 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  name: { fontSize: 18, lineHeight: 21, fontWeight: '700', color: PRIMARY },
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
