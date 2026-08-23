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
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  friendRequestErrorMessage,
  type Friendship,
  type GoalMate,
} from '@/api/endpoints/social';
import { useUnreadNotificationCount } from '@/hooks/use-notifications';
import {
  useAcceptFriend,
  useFriends,
  useGoalMates,
  useSendFriendRequest,
  useSocialSettings,
  useUpdateSocialSettings,
} from '@/hooks/use-social';
import { useChildStore } from '@/store/child';

// ── The same glass sky the dashboard lives in ────────────────────────────────
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const GREEN = '#22B573';
const BG_TOP = '#D6E6FA';
const BG_MID = '#E7EEFC';
const BG_BOTTOM = '#EEEFFA';

const glass = (radius: number): ViewStyle => ({
  backgroundColor: 'rgba(255,255,255,0.50)',
  borderRadius: radius,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.85)',
  boxShadow:
    '0 14px 30px rgba(111,155,221,0.30), inset 0 1.5px 0 rgba(255,255,255,0.9)',
});

// ── Categories, derived from the goal-catalog match keys ─────────────────────
// Peers are pseudonymous by design (see PeerCard in api/endpoints/social.ts:
// name, age segment, nothing else), so the mock's photo circles become emoji
// badges and its presence line becomes the honest thing we DO know — where
// the friendship stands.
interface Category {
  key: string;
  label: string;
  emoji: string;
  match: (matchKey: string) => boolean;
}

const CATEGORIES: readonly Category[] = [
  {
    key: 'kitoblar',
    label: 'Kitoblar',
    emoji: '📚',
    match: (k) => k.startsWith('book_'),
  },
  {
    key: 'talim',
    label: "Ta'lim",
    emoji: '📖',
    match: (k) => k.startsWith('textbook_') && !k.includes('ingliz'),
  },
  {
    key: 'til',
    label: "Til o'rganish",
    emoji: '🗣️',
    match: (k) => k.includes('ingliz'),
  },
  {
    key: 'it',
    label: 'IT & Code',
    emoji: '💻',
    match: (k) => k.includes('dasturlash'),
  },
  {
    key: 'ijod',
    label: 'Ijodkorlik',
    emoji: '🎨',
    match: (k) => k.includes('chizish'),
  },
  {
    key: 'rivoj',
    label: "O'zini rivojlantirish",
    emoji: '🌱',
    match: (k) => k.startsWith('skill_'),
  },
];

/** First category whose rule matches — order above is the precedence. */
const categoryOf = (matchKey: string | null): Category | null =>
  matchKey ? (CATEGORIES.find((c) => c.match(matchKey)) ?? null) : null;

// ── One row of the list ──────────────────────────────────────────────────────

/** What the child may do about this peer right now. */
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

function Avatar({ name }: { name: string }) {
  return (
    <View style={rowStyles.avatarRing}>
      <LinearGradient
        colors={['#BFD9FB', '#8FB7F3']}
        style={rowStyles.avatarFill}
      >
        <Text style={rowStyles.avatarLetter}>
          {name.slice(0, 1).toUpperCase()}
        </Text>
      </LinearGradient>
    </View>
  );
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
  onChat,
  onConnect,
  onAccept,
}: {
  row: MateRow;
  onChat: (f: Friendship) => void;
  onConnect: (m: GoalMate) => void;
  onAccept: (f: Friendship) => void;
}) {
  const status = statusOf(row.state);
  const category = categoryOf(row.matchKey);

  const action = (() => {
    switch (row.state.kind) {
      case 'friend': {
        const f = row.state.friendship;
        return { icon: MessageCircle, label: 'Suhbat', onPress: () => onChat(f) };
      }
      case 'incoming': {
        const f = row.state.friendship;
        return { icon: Check, label: 'Qabul qilish', onPress: () => onAccept(f) };
      }
      case 'outgoing':
        return { icon: Clock, label: 'Kutilmoqda', onPress: null };
      case 'new': {
        const m = row.state.mate;
        return { icon: UserPlus, label: "So'rov yuborish", onPress: () => onConnect(m) };
      }
    }
  })();
  const ActionIcon = action.icon;

  return (
    <View style={[glass(24), rowStyles.card]}>
      <Avatar name={row.name} />
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
      <Pressable
        onPress={action.onPress ?? undefined}
        disabled={!action.onPress}
        accessibilityRole="button"
        accessibilityLabel={`${row.name} — ${action.label}`}
        style={[glass(26), rowStyles.action, !action.onPress && { opacity: 0.55 }]}
      >
        <ActionIcon size={22} color={PRIMARY} strokeWidth={1.9} />
      </Pressable>
    </View>
  );
}

// ── The screen ───────────────────────────────────────────────────────────────

/**
 * Maqsaddoshlar — children on the same goal, in the glass-sky style of the
 * home dashboard: category stories, a search pill, filter chips, then one
 * card per peer.
 *
 * Faithful to the mock in layout; honest in content. Peers are pseudonymous
 * (no photos to show, no presence to report — by design, this is a
 * children's product), so the story circles carry category emoji, and the
 * mock's "Onlayn / 5 daqiqa avval" line carries the thing we truthfully
 * know: whether this peer is already a friend, has asked, or is waiting.
 *
 * Discovery is consent-gated: until the child turns visibility on, the
 * screen offers exactly that choice and shows nobody.
 */
export default function GoalMatesScreen() {
  const insets = useSafeAreaInsets();
  const childId = useChildStore((s) => s.child?.id ?? undefined);
  const navigation = useNavigation();

  const settingsQuery = useSocialSettings(childId);
  const updateSettings = useUpdateSocialSettings(childId);
  const discoverable = settingsQuery.data?.discoverable ?? false;

  const matesQuery = useGoalMates(childId, discoverable);
  const friendsQuery = useFriends(childId);
  const sendRequest = useSendFriendRequest(childId);
  const acceptRequest = useAcceptFriend(childId);
  const unread = useUnreadNotificationCount();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const rows = useMemo<MateRow[]>(() => {
    const friends = friendsQuery.data ?? [];
    const mates = matesQuery.data ?? [];
    const byPeer = new Map<string, MateRow>();

    // Friendships first — they carry the stronger truth about a peer.
    for (const f of friends) {
      if (f.status === 'accepted') {
        byPeer.set(f.peer.child_id, {
          peerId: f.peer.child_id,
          name: f.peer.display_name,
          goal: "Birga maqsad sari",
          matchKey: f.match_key,
          state: { kind: 'friend', friendship: f },
        });
      } else if (f.status === 'pending') {
        byPeer.set(f.peer.child_id, {
          peerId: f.peer.child_id,
          name: f.peer.display_name,
          goal: "Birga maqsad sari",
          matchKey: f.match_key,
          state: f.incoming ? { kind: 'incoming', friendship: f } : { kind: 'outgoing' },
        });
      }
    }
    // Goal-mates fill in the goal text, and add peers not connected yet.
    for (const m of mates) {
      const existing = byPeer.get(m.peer.child_id);
      if (existing) {
        existing.goal = m.shared_goal;
        existing.matchKey = existing.matchKey ?? m.match_key;
      } else {
        byPeer.set(m.peer.child_id, {
          peerId: m.peer.child_id,
          name: m.peer.display_name,
          goal: m.shared_goal,
          matchKey: m.match_key,
          state: { kind: 'new', mate: m },
        });
      }
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

    if (category) {
      list = list.filter((r) => categoryOf(r.matchKey)?.key === category);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) => r.name.toLowerCase().includes(q) || r.goal.toLowerCase().includes(q),
      );
    }
    return list;
  }, [friendsQuery.data, matesQuery.data, category, query]);

  const openChat = (f: Friendship) =>
    router.push({
      pathname: '/(main)/peer-chat',
      params: { friendshipId: f.id, peerName: f.peer.display_name },
    });

  const connect = (m: GoalMate) =>
    sendRequest.mutate(m.peer.child_id, {
      onError: (err) => Alert.alert('Yuborilmadi', friendRequestErrorMessage(err)),
    });

  const accept = (f: Friendship) => acceptRequest.mutate(f.id);

  const openVisibilityMenu = () =>
    Alert.alert(
      "Ko'rinish",
      discoverable
        ? "Maqsaddoshlar seni taxallusing orqali ko'radi."
        : "Hozir hech kim seni ko'rmaydi.",
      [
        { text: 'Yopish', style: 'cancel' },
        discoverable
          ? {
              text: "Ko'rinishni o'chirish",
              style: 'destructive' as const,
              onPress: () => updateSettings.mutate({ discoverable: false }),
            }
          : {
              text: "Ko'rinishni yoqish",
              onPress: () => updateSettings.mutate({ discoverable: true }),
            },
      ],
    );

  const hasUnread = (unread.data?.count ?? 0) > 0;
  const toHome = () => (navigation as { navigate(name: string): void }).navigate('index');

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 44) + 10,
          paddingBottom: insets.bottom + 96,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable
            onPress={toHome}
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            style={[glass(28), styles.headerButton]}
          >
            <ArrowLeft size={24} color={PRIMARY} strokeWidth={1.9} />
          </Pressable>
          <Text style={styles.title}>Maqsaddoshlar</Text>
          <Pressable
            onPress={() => router.push('/(main)/notifications')}
            accessibilityRole="button"
            accessibilityLabel="Bildirishnomalar"
            style={[glass(28), styles.headerButton]}
          >
            <Bell size={23} color={PRIMARY} strokeWidth={1.8} />
            {hasUnread && <View style={styles.bellDot} />}
          </Pressable>
        </View>

        {/* ── Category stories ───────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stories}
        >
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => setCategory(active ? null : c.key)}
                accessibilityRole="button"
                accessibilityLabel={c.label}
                style={styles.story}
              >
                <View
                  style={[
                    glass(35),
                    styles.storyCircle,
                    active && styles.storyCircleActive,
                  ]}
                >
                  <Text style={styles.storyEmoji}>{c.emoji}</Text>
                </View>
                <Text style={styles.storyLabel} numberOfLines={1}>
                  {c.label}
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
            <View style={[glass(35), styles.storyCircle]}>
              <Plus size={30} color={PRIMARY} strokeWidth={1.9} />
            </View>
            <Text style={styles.storyLabel}>Qo'shish</Text>
          </Pressable>
        </ScrollView>

        {/* ── Search ─────────────────────────────────────────────────── */}
        <View style={[glass(28), styles.search]}>
          <Search size={22} color={PRIMARY} strokeWidth={2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Maqsaddoshlarni qidirish..."
            placeholderTextColor={MUTED}
            style={styles.searchInput}
            accessibilityLabel="Maqsaddoshlarni qidirish"
          />
          <Pressable
            onPress={openVisibilityMenu}
            accessibilityRole="button"
            accessibilityLabel="Ko'rinish sozlamalari"
            hitSlop={8}
          >
            <SlidersHorizontal size={22} color={PRIMARY} strokeWidth={2} />
          </Pressable>
        </View>

        {/* ── Filter chips ───────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Pressable
            onPress={() => setCategory(null)}
            accessibilityRole="button"
            style={[styles.chip, category === null && styles.chipActive]}
          >
            <Text style={[styles.chipText, category === null && styles.chipTextActive]}>
              Barchasi
            </Text>
          </Pressable>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.key}
              onPress={() => setCategory(category === c.key ? null : c.key)}
              accessibilityRole="button"
              style={[styles.chip, category === c.key && styles.chipActive]}
            >
              <Text
                style={[styles.chipText, category === c.key && styles.chipTextActive]}
              >
                {c.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Consent gate / list ────────────────────────────────────── */}
        {!discoverable ? (
          <View style={[glass(24), styles.consentCard]}>
            <Text style={styles.consentTitle}>
              Maqsaddoshlarni ko'rish uchun ko'rinishni yoq
            </Text>
            <Text style={styles.consentBody}>
              Sen faqat taxallusing bilan ko'rinasan — ismingni, raqamingni va
              rasmingni hech kim ko'rmaydi. Istalgan payt o'chirib qo'yishing
              mumkin.
            </Text>
            <Pressable
              onPress={() => updateSettings.mutate({ discoverable: true })}
              accessibilityRole="button"
              accessibilityLabel="Ko'rinishni yoqish"
              style={styles.consentButton}
            >
              <Text style={styles.consentButtonText}>Ko'rinishni yoqish</Text>
            </Pressable>
          </View>
        ) : rows.length === 0 ? (
          <View style={[glass(24), styles.consentCard]}>
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
        ) : (
          rows.map((row) => (
            <MateCard
              key={row.peerId}
              row={row}
              onChat={openChat}
              onConnect={connect}
              onAccept={accept}
            />
          ))
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
    paddingHorizontal: 22,
  },
  headerButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '700', color: PRIMARY },
  bellDot: {
    position: 'absolute',
    top: 13,
    right: 14,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#F04438',
  },

  stories: { paddingHorizontal: 18, paddingTop: 22, gap: 16 },
  story: { alignItems: 'center', width: 82 },
  storyCircle: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyCircleActive: { borderWidth: 2.5, borderColor: PRIMARY },
  storyEmoji: { fontSize: 30 },
  storyLabel: { marginTop: 8, fontSize: 13, fontWeight: '600', color: INK },

  search: {
    marginTop: 22,
    marginHorizontal: 20,
    paddingHorizontal: 18,
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchInput: { flex: 1, fontSize: 17, color: INK, paddingVertical: 0 },

  chips: { paddingHorizontal: 20, paddingTop: 16, gap: 10 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { fontSize: 15, fontWeight: '600', color: INK },
  chipTextActive: { color: '#FFFFFF' },

  consentCard: { marginTop: 18, marginHorizontal: 20, padding: 22 },
  consentTitle: { fontSize: 17, fontWeight: '700', color: INK },
  consentBody: { marginTop: 8, fontSize: 14, lineHeight: 21, color: MUTED },
  consentButton: {
    marginTop: 14,
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
  },
  consentButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

const rowStyles = StyleSheet.create({
  card: {
    marginTop: 16,
    marginHorizontal: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: 'rgba(79,134,238,0.55)',
    padding: 3,
  },
  avatarFill: {
    flex: 1,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 26, fontWeight: '700', color: '#FFFFFF' },
  body: { flex: 1 },
  name: { fontSize: 19, fontWeight: '700', color: PRIMARY },
  goal: { marginTop: 3, fontSize: 15, fontWeight: '600', color: INK },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, color: MUTED },
  tagRow: { flexDirection: 'row', marginTop: 8 },
  tag: {
    backgroundColor: 'rgba(79,134,238,0.14)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tagText: { fontSize: 12.5, fontWeight: '600', color: PRIMARY },
  action: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
