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
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

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
  useSendFriendRequest,
  useSocialSettings,
  useUpdateSocialSettings,
} from '@/hooks/use-social';
import { useChildStore } from '@/store/child';

// ── The glass sky, a shade bluer than home — the mock's cooler morning ───────
const PRIMARY = '#2F6FE4';
const TITLE = '#2A63DC';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const GREEN = '#22B573';
const DANGER = '#E0455E';
const BG_TOP = '#D2E2F9';
const BG_MID = '#DDE7FB';
const BG_BOTTOM = '#E6EBFA';

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

const AVATAR_BG: readonly [string, string][] = [
  ['#BFD9FB', '#8FB7F3'],
  ['#F6D9C4', '#E8A87C'],
  ['#CDEBD8', '#8FCFA9'],
  ['#E7D6F7', '#B79BE0'],
  ['#F9E3B5', '#EBC06B'],
];
const SKIN = ['#F4C9A5', '#E8B48C', '#D49B6F', '#B97F55'];
const HAIR = ['#2C2320', '#4A3423', '#7A5230', '#1F2A44'];
const SHIRT = ['#3A6FD8', '#2FA872', '#D8663A', '#7A55C9', '#2B8FA5', '#C94A72'];

function pick<T>(arr: readonly T[], seed: number, salt: number): T {
  // Small seeds die under a bare shift — mix properly so every trait varies.
  const h = Math.imul(seed ^ Math.imul(salt + 1, 0x9e3779b9), 0x85ebca6b) >>> 16;
  return arr[h % arr.length];
}

/** A flat-vector person, head and shoulders, clipped to a circle. */
function PersonAvatar({ seed, size }: { seed: number; size: number }) {
  const bg = pick(AVATAR_BG, seed, 2);
  const skin = pick(SKIN, seed, 5);
  const hair = pick(HAIR, seed, 8);
  const shirt = pick(SHIRT, seed, 11);
  const style = (Math.imul(seed, 0x27d4eb2f) >>> 13) % 4;
  const s = size;
  const cx = s / 2;
  const headY = s * 0.44;
  const headR = s * 0.21;
  const uid = `av${seed}-${size}`;

  return (
    <Svg width={s} height={s}>
      <Defs>
        <RadialGradient id={uid} cx="35%" cy="28%" r="90%">
          <Stop offset="0%" stopColor={bg[0]} />
          <Stop offset="100%" stopColor={bg[1]} />
        </RadialGradient>
        <ClipPath id={`${uid}c`}>
          <Circle cx={cx} cy={s / 2} r={s / 2} />
        </ClipPath>
      </Defs>
      <Circle cx={cx} cy={s / 2} r={s / 2} fill={`url(#${uid})`} />
      <G clipPath={`url(#${uid}c)`}>
        {/* shoulders */}
        <Ellipse cx={cx} cy={s * 1.04} rx={s * 0.4} ry={s * 0.34} fill={shirt} />
        {/* neck */}
        <Path
          d={`M ${cx - s * 0.06} ${headY + headR * 0.7} h ${s * 0.12} v ${s * 0.12} h ${-s * 0.12} Z`}
          fill={skin}
        />
        {/* head */}
        <Circle cx={cx} cy={headY} r={headR} fill={skin} />
        {/* hair */}
        {style === 0 && (
          <Path
            d={`M ${cx - headR} ${headY} a ${headR} ${headR} 0 0 1 ${headR * 2} 0 l 0 ${-headR * 0.28} a ${headR} ${headR} 0 0 0 ${-headR * 2} 0 Z`}
            fill={hair}
          />
        )}
        {style === 1 && (
          <Path
            d={`M ${cx - headR * 1.04} ${headY + headR * 0.1} a ${headR * 1.04} ${headR * 1.04} 0 0 1 ${headR * 2.08} 0 l ${-headR * 0.3} ${-headR * 0.72} l ${-headR * 1.5} ${-headR * 0.05} Z`}
            fill={hair}
          />
        )}
        {style === 2 && (
          <>
            <Circle cx={cx - headR * 0.62} cy={headY - headR * 0.72} r={headR * 0.42} fill={hair} />
            <Circle cx={cx} cy={headY - headR * 0.92} r={headR * 0.46} fill={hair} />
            <Circle cx={cx + headR * 0.62} cy={headY - headR * 0.72} r={headR * 0.42} fill={hair} />
          </>
        )}
        {style === 3 && (
          <>
            <Path
              d={`M ${cx - headR * 1.05} ${headY} a ${headR * 1.05} ${headR * 1.05} 0 0 1 ${headR * 2.1} 0 Z`}
              fill={hair}
            />
            <Path
              d={`M ${cx - headR * 1.02} ${headY - headR * 0.1} q ${-headR * 0.16} ${headR * 1.2} ${headR * 0.24} ${headR * 1.6} l ${headR * 0.34} 0 q ${-headR * 0.3} ${-headR * 0.8} ${-headR * 0.18} ${-headR * 1.5} Z`}
              fill={hair}
            />
            <Path
              d={`M ${cx + headR * 1.02} ${headY - headR * 0.1} q ${headR * 0.16} ${headR * 1.2} ${-headR * 0.24} ${headR * 1.6} l ${-headR * 0.34} 0 q ${headR * 0.3} ${-headR * 0.8} ${headR * 0.18} ${-headR * 1.5} Z`}
              fill={hair}
            />
          </>
        )}
        {/* face hints — enough to read as a person, never as a portrait */}
        <Circle cx={cx - headR * 0.34} cy={headY} r={s * 0.014} fill="#3A2E28" />
        <Circle cx={cx + headR * 0.34} cy={headY} r={s * 0.014} fill="#3A2E28" />
        <Path
          d={`M ${cx - headR * 0.2} ${headY + headR * 0.42} q ${headR * 0.2} ${headR * 0.18} ${headR * 0.4} 0`}
          stroke="#3A2E28"
          strokeWidth={s * 0.012}
          strokeLinecap="round"
          fill="none"
        />
      </G>
    </Svg>
  );
}

function seedOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h | 1;
}

// ── Categories and the mock's communities ────────────────────────────────────

interface Category {
  key: string;
  label: string;
  match: (k: string) => boolean;
}

const CATEGORIES: readonly Category[] = [
  { key: 'it', label: 'IT & Code', match: (k) => k.includes('dasturlash') },
  {
    key: 'til',
    label: "Til o'rganish",
    match: (k) => k.includes('ingliz') || k.includes('ielts'),
  },
  {
    key: 'talim',
    label: "Ta'lim",
    match: (k) => k.startsWith('textbook_') || k.startsWith('exam_'),
  },
  {
    key: 'kitoblar',
    label: 'Kitoblar',
    match: (k) => k.startsWith('book_') || k === 'habit_har_kuni_kitob',
  },
  { key: 'sport', label: 'Sport', match: (k) => k.includes('sport') },
  { key: 'sayohat', label: 'Sayohat', match: (k) => k.includes('sayohat') },
  {
    key: 'ijod',
    label: 'Ijodkorlik',
    match: (k) => k.includes('chizish') || k.includes('gitara'),
  },
  {
    key: 'rivoj',
    label: "O'zini rivojlantirish",
    match: (k) => k.startsWith('habit_') || k.startsWith('skill_'),
  },
];

const categoryOf = (matchKey: string | null): Category | null =>
  matchKey ? (CATEGORIES.find((c) => c.match(matchKey)) ?? null) : null;

/** The mock's community circles, wired to the categories that exist. */
const STORIES: readonly { label: string; cat: string; seed: number }[] = [
  { label: 'Talabalar', cat: 'talim', seed: 137 },
  { label: 'IT & Code', cat: 'it', seed: 452 },
  { label: 'Sayohatchilar', cat: 'sayohat', seed: 863 },
  { label: 'Sportchilar', cat: 'sport', seed: 291 },
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
  { key: 'top', label: 'Top mavzular' },
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
    <View style={[glass(30), rowStyles.card]}>
      <PersonAvatar seed={seedOf(row.peerId)} size={84} />
      <View style={rowStyles.body}>
        <Text style={rowStyles.name} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={rowStyles.goal} numberOfLines={1}>
          {row.goal}
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
          style={[glass(31), rowStyles.action]}
        >
          <MessageCircle size={24} color={PRIMARY} strokeWidth={1.9} />
        </Pressable>
      )}
      {state.kind === 'outgoing' && (
        <View style={[glass(31), rowStyles.action, { opacity: 0.55 }]}>
          <Clock size={24} color={PRIMARY} strokeWidth={1.9} />
        </View>
      )}
      {state.kind === 'new' && (
        <Pressable
          onPress={() => !busy && onConnect(state.mate)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`${row.name} — so'rov yuborish`}
          style={[glass(31), rowStyles.action, busy && { opacity: 0.55 }]}
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
            style={[glass(25), rowStyles.smallAction, busy && { opacity: 0.55 }]}
          >
            <Check size={21} color={GREEN} strokeWidth={2.2} />
          </Pressable>
          <Pressable
            onPress={() => !busy && onDecline(state.friendship)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`${row.name} — rad etish`}
            style={[glass(25), rowStyles.smallAction, busy && { opacity: 0.55 }]}
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
          paddingTop: Math.max(insets.top, 44) + 10,
          paddingBottom: insets.bottom + 100,
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
            style={[glass(30), styles.headerButton]}
          >
            <ArrowLeft size={26} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>Maqsaddoshlar</Text>
          <Pressable
            onPress={() => router.push('/(main)/notifications')}
            accessibilityRole="button"
            accessibilityLabel="Bildirishnomalar"
            style={[glass(30), styles.headerButton]}
          >
            <Bell size={24} color={PRIMARY} strokeWidth={1.9} />
            {hasUnread && <View style={styles.bellDot} />}
          </Pressable>
        </View>

        {/* ── Community circles ──────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stories}
        >
          {STORIES.map((story) => {
            const active = category === story.cat;
            return (
              <Pressable
                key={story.cat}
                onPress={() => setCategory(active ? null : story.cat)}
                accessibilityRole="button"
                accessibilityLabel={story.label}
                style={styles.story}
              >
                <View style={[styles.storyRing, active && styles.storyRingActive]}>
                  <View style={styles.storyInner}>
                    <PersonAvatar seed={story.seed} size={72} />
                  </View>
                </View>
                <Text style={styles.storyLabel} numberOfLines={1}>
                  {story.label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => router.push('/(main)/my-goals')}
            accessibilityRole="button"
            accessibilityLabel="Qo'shish — maqsadlarim"
            style={styles.story}
          >
            <View style={[glass(42), styles.storyPlus]}>
              <Plus size={34} color={PRIMARY} strokeWidth={1.9} />
            </View>
            <Text style={styles.storyLabel}>Qo'shish</Text>
          </Pressable>
        </ScrollView>

        {/* ── Search ─────────────────────────────────────────────────── */}
        <View style={[glass(30), styles.search]}>
          <Search size={24} color={PRIMARY} strokeWidth={2.1} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Maqsaddoshlarni qidirish..."
            placeholderTextColor={MUTED}
            style={styles.searchInput}
            accessibilityLabel="Maqsaddoshlarni qidirish"
          />
          <Pressable
            onPress={() => setShowSettings((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Ko'rinish sozlamalari"
            hitSlop={10}
          >
            <SlidersHorizontal size={24} color={PRIMARY} strokeWidth={2.1} />
          </Pressable>
        </View>

        {/* ── Visibility panel (inline — Alert does not exist on web) ── */}
        {showSettings && (
          <View style={[glass(26), styles.settingsCard]}>
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
              <Text style={[styles.chipText, chip === c.key && styles.chipTextActive]}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {toast && (
          <View style={[glass(20), styles.toast]}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}

        {/* ── Body ───────────────────────────────────────────────────── */}
        {booting ? (
          <>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[glass(30), styles.skeleton]} />
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
              <View style={[glass(28), styles.consentCard]}>
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
                  <View style={[glass(28), styles.consentCard]}>
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

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerButton: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 30, fontWeight: '700', color: TITLE },
  bellDot: {
    position: 'absolute',
    top: 14,
    right: 15,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#F04438',
  },

  stories: { paddingHorizontal: 18, paddingTop: 26, gap: 18 },
  story: { alignItems: 'center', width: 96 },
  storyRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2.5,
    borderColor: 'rgba(79,134,238,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    boxShadow: '0 10px 22px rgba(111,155,221,0.3)',
  },
  storyRingActive: { borderColor: PRIMARY, borderWidth: 3.5 },
  storyInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
  },
  storyPlus: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyLabel: { marginTop: 10, fontSize: 14.5, fontWeight: '600', color: INK },

  search: {
    marginTop: 26,
    marginHorizontal: 20,
    paddingHorizontal: 20,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  searchInput: { flex: 1, fontSize: 18, color: INK, paddingVertical: 0 },

  settingsCard: { marginTop: 14, marginHorizontal: 20, padding: 18 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  settingsTitle: { fontSize: 16, fontWeight: '700', color: INK },
  settingsBody: { marginTop: 4, fontSize: 13.5, lineHeight: 19, color: MUTED },
  switch: {
    width: 56,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(140,163,203,0.4)',
    padding: 3,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: PRIMARY },
  knob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
  },
  knobOn: { alignSelf: 'flex-end' },

  chips: { paddingHorizontal: 20, paddingTop: 18, gap: 11 },
  chip: {
    paddingHorizontal: 21,
    paddingVertical: 13,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { fontSize: 16, fontWeight: '600', color: INK },
  chipTextActive: { color: '#FFFFFF' },

  toast: { marginTop: 14, marginHorizontal: 20, padding: 14 },
  toastText: { fontSize: 14, color: DANGER, fontWeight: '600' },

  skeleton: { marginTop: 18, marginHorizontal: 20, height: 118, opacity: 0.55 },

  consentCard: { marginTop: 18, marginHorizontal: 20, padding: 22 },
  consentTitle: { fontSize: 17.5, fontWeight: '700', color: INK },
  consentBody: { marginTop: 8, fontSize: 14.5, lineHeight: 22, color: MUTED },
  consentButton: {
    marginTop: 15,
    backgroundColor: PRIMARY,
    borderRadius: 17,
    paddingVertical: 14,
    alignItems: 'center',
  },
  consentButtonText: { color: '#FFFFFF', fontSize: 16.5, fontWeight: '700' },
});

const rowStyles = StyleSheet.create({
  card: {
    marginTop: 18,
    marginHorizontal: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  body: { flex: 1 },
  name: { fontSize: 21, fontWeight: '700', color: PRIMARY },
  goal: { marginTop: 4, fontSize: 16, fontWeight: '600', color: INK },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, color: MUTED },
  tagRow: { flexDirection: 'row', marginTop: 9 },
  tag: {
    backgroundColor: 'rgba(79,134,238,0.16)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  tagText: { fontSize: 13.5, fontWeight: '600', color: PRIMARY },
  action: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairActions: { gap: 8 },
  smallAction: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
