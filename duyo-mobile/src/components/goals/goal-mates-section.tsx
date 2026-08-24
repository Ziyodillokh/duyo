import { router } from 'expo-router';
import {
  Check,
  Clock,
  MessageSquare,
  Pencil,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { Text } from '@/components/text';

import {
  friendRequestErrorMessage,
  type Friendship,
  type GoalMate,
} from '@/api/endpoints/social';
import { HandleEditor } from '@/components/goals/handle-editor';
import { glass, lift } from '@/lib/glass';
import {
  useAcceptFriend,
  useDeclineFriend,
  useFriends,
  useGoalMates,
  useSendFriendRequest,
  useSocialSettings,
  useUpdateSocialSettings,
} from '@/hooks/use-social';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
// This section used to draw DarkCard islands — navy panes with a neon border —
// into a page that is now pale blue glass. A dark card on a light page does not
// read as "a different card", it reads as a different app, so the peers list
// joins the same material as settings and notifications.
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
/** The washes the tinted wells and quiet buttons are painted with. */
const PRIMARY_WASH = 'rgba(47,111,228,0.10)';
const MUTED_WASH = 'rgba(140,163,203,0.16)';

/** Avatar stand-in — peers are pseudonymous, so there is no photo to show. */
function PeerAvatar({ name }: { name: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarLetter}>{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

function Row({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <PeerAvatar name={title} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {children}
    </View>
  );
}

export function GoalMatesSection({ childId }: { childId: string | undefined }) {
  const settingsQuery = useSocialSettings(childId);
  const updateSettings = useUpdateSocialSettings(childId);
  const discoverable = settingsQuery.data?.discoverable ?? false;
  const [editingHandle, setEditingHandle] = useState(false);

  const matesQuery = useGoalMates(childId, discoverable);
  const friendsQuery = useFriends(childId);
  const sendRequest = useSendFriendRequest(childId);
  const acceptRequest = useAcceptFriend(childId);
  const declineRequest = useDeclineFriend(childId);

  const friends = friendsQuery.data ?? [];
  const incoming = friends.filter((f) => f.status === 'pending' && f.incoming);
  const outgoing = friends.filter((f) => f.status === 'pending' && !f.incoming);
  const accepted = friends.filter((f) => f.status === 'accepted');
  const mates = matesQuery.data ?? [];

  const openThread = (friendship: Friendship) =>
    router.push({
      pathname: '/(main)/peer-chat',
      params: {
        friendshipId: friendship.id,
        peerName: friendship.peer.display_name,
      },
    });

  const handleConnect = (mate: GoalMate) =>
    sendRequest.mutate(mate.peer.child_id, {
      // The server distinguishes a connection cap, a pending-request cap, a
      // suspension and a stale suggestion; collapsing all four into "try
      // again later" told a child to keep retrying something that cannot
      // succeed. See friendRequestErrorMessage.
      onError: (err) => Alert.alert('Yuborilmadi', friendRequestErrorMessage(err)),
    });

  const handleStopBeingDiscoverable = () =>
    Alert.alert(
      "Ko'rinishni o'chirish",
      "Yangi maqsaddoshlar seni topa olmaydi. Hozirgi do'stlaring va suhbatlaring saqlanib qoladi.",
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: "O'chirish",
          style: 'destructive',
          onPress: () => updateSettings.mutate({ discoverable: false }),
        },
      ],
    );

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Maqsaddoshlar</Text>
        {discoverable && !!settingsQuery.data && (
          <Pressable
            onPress={() => setEditingHandle(true)}
            accessibilityRole="button"
            accessibilityLabel="Taxallusni o'zgartirish"
            hitSlop={8}
            style={[styles.handleLink, styles.focusable]}
          >
            <Text style={styles.handleLinkText}>
              {settingsQuery.data.display_name}
            </Text>
            <Pencil size={13} color={PRIMARY} />
          </Pressable>
        )}
      </View>

      <HandleEditor
        visible={editingHandle}
        childId={childId}
        current={settingsQuery.data?.display_name ?? ''}
        onClose={() => setEditingHandle(false)}
      />

      {/* Opt-in. Off by default: a child is never discoverable by accident. */}
      {!discoverable && (
        // The one thing the section leads with while it is switched off, so it
        // is the only pane here that sits at 'lg'.
        <View style={styles.optInCard}>
          <View style={{ alignItems: 'center' }}>
            <View style={styles.optInWell}>
              <Users size={26} color={PRIMARY} />
            </View>
            <Text style={styles.optInTitle}>
              Bir maqsaddagi bolalar bilan tanish
            </Text>
            <Text style={styles.optInBody}>
              Ular sening ismingni ko'rmaydi — faqat taxallusing. Xohlagan
              paytda o'chirib qo'yasan.
            </Text>
            {!!settingsQuery.data && (
              <Pressable
                onPress={() => setEditingHandle(true)}
                accessibilityRole="button"
                accessibilityLabel="Taxallusni o'zgartirish"
                style={[styles.handlePill, styles.focusable]}
              >
                <Text style={styles.handlePillText}>
                  {settingsQuery.data.display_name}
                </Text>
                <Pencil size={14} color={PRIMARY} />
              </Pressable>
            )}
            <Pressable
              onPress={() => updateSettings.mutate({ discoverable: true })}
              disabled={updateSettings.isPending}
              accessibilityRole="button"
              accessibilityLabel="Maqsaddoshlarni yoqish"
              style={[styles.enableButton, styles.focusable]}
            >
              {updateSettings.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.enableLabel}>Yoqish</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* Incoming requests first — this is the one thing needing a decision. */}
      {incoming.map((f) => (
        // The old build said "answer me" with a neon-pink glow border. Here it
        // is said with height and a primary edge instead: the pane a child has
        // to act on sits nearer than the ones that are only news.
        <View key={f.id} style={styles.decideCard}>
          <Row
            title={f.peer.display_name}
            subtitle="Sen bilan do'stlashmoqchi"
          >
            <View style={styles.actions}>
              <Pressable
                onPress={() => acceptRequest.mutate(f.id)}
                accessibilityRole="button"
                accessibilityLabel="Qabul qilish"
                style={[styles.iconButton, styles.solid, styles.focusable]}
              >
                <Check size={20} color="#FFFFFF" />
              </Pressable>
              <Pressable
                onPress={() => declineRequest.mutate(f.id)}
                accessibilityRole="button"
                accessibilityLabel="Rad etish"
                style={[styles.iconButton, styles.quiet, styles.focusable]}
              >
                <X size={20} color={MUTED} />
              </Pressable>
            </View>
          </Row>
        </View>
      ))}

      {/* Friends */}
      {accepted.map((f) => (
        <View key={f.id} style={styles.card}>
          <Row title={f.peer.display_name} subtitle="Do'stingiz">
            <Pressable
              onPress={() => openThread(f)}
              accessibilityRole="button"
              accessibilityLabel={`${f.peer.display_name} bilan suhbat`}
              style={[styles.pillButton, styles.solid, styles.focusable]}
            >
              <MessageSquare size={16} color="#FFFFFF" />
              <Text style={styles.solidLabel}>Yozish</Text>
            </Pressable>
          </Row>
        </View>
      ))}

      {/* Requests this child has SENT and is waiting on.
          Without this the child taps "Do'stlashish", the suggestion card
          vanishes — the backend drops anyone with an edge from the
          suggestions — and nothing anywhere says a request went out. The
          "Yuborildi" pill on the suggestion card could never be reached for
          the same reason. */}
      {outgoing.map((f) => (
        <View key={f.id} style={styles.card}>
          <Row title={f.peer.display_name} subtitle="Javobini kutyapmiz">
            <View style={[styles.pillButton, styles.quiet]}>
              <Clock size={15} color={MUTED} />
              <Text style={styles.quietLabel}>Yuborildi</Text>
            </View>
          </Row>
        </View>
      ))}

      {/* Suggestions */}
      {discoverable && matesQuery.isLoading && (
        <View style={{ alignItems: 'center', padding: 20 }}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      )}

      {discoverable &&
        mates.map((mate) => {
          const pending = outgoing.some(
            (f) => f.peer.child_id === mate.peer.child_id,
          );
          return (
            <View key={mate.peer.child_id} style={styles.card}>
              <Row
                title={mate.peer.display_name}
                subtitle={`Umumiy maqsad: ${mate.shared_goal}`}
              >
                <Pressable
                  onPress={() => handleConnect(mate)}
                  disabled={pending || sendRequest.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Do'stlashish"
                  style={[
                    styles.pillButton,
                    pending ? styles.quiet : styles.tinted,
                    styles.focusable,
                  ]}
                >
                  {!pending && <UserPlus size={16} color={PRIMARY} />}
                  <Text
                    style={pending ? styles.quietLabel : styles.tintedLabel}
                  >
                    {pending ? 'Yuborildi' : "Do'stlashish"}
                  </Text>
                </Pressable>
              </Row>
            </View>
          );
        })}

      {discoverable &&
        !matesQuery.isLoading &&
        mates.length === 0 &&
        !accepted.length &&
        !outgoing.length &&
        !incoming.length && (
          <View style={[styles.emptyCard, styles.centered]}>
            <Text style={styles.emptyGlyph}>🔍</Text>
            <Text style={styles.emptyTitle}>Hozircha maqsaddosh topilmadi</Text>
            <Text style={styles.emptyBody}>
              Maqsad qo'shsang, xuddi shu maqsaddagi tengdoshlaring bu yerda
              paydo bo'ladi
            </Text>
          </View>
        )}

      {/* The opt-in card promises "Xohlagan paytda o'chirib qo'yasan", and
          that card disappears the moment the child opts in — so until now the
          app made a promise it gave no way to keep. */}
      {discoverable && (
        <Pressable
          onPress={handleStopBeingDiscoverable}
          disabled={updateSettings.isPending}
          accessibilityRole="button"
          accessibilityLabel="Maqsaddoshlarga ko'rinishni o'chirish"
          style={[styles.optOut, styles.focusable]}
        >
          <Text style={styles.optOutLabel}>
            Maqsaddoshlarga ko'rinishni o'chirish
          </Text>
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // The browser draws a square focus ring around whatever was last clicked,
  // which is the wrong shape on every rounded control below.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  centered: { alignItems: 'center' },

  header: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },
  handleLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    // hitSlop does not grow the clickable box on web, so the padding does.
    paddingVertical: 6,
    paddingLeft: 6,
  },
  handleLinkText: { fontSize: 13.5, fontWeight: '600', color: PRIMARY },

  // ── Panes ─────────────────────────────────────────────────────────────────
  card: { ...glass(22, 'md', 0.6), padding: 18 },
  decideCard: {
    ...glass(22, 'lg', 0.8),
    padding: 18,
    borderWidth: 2,
    borderColor: PRIMARY,
  },
  emptyCard: { ...glass(22, 'md', 0.5), padding: 24 },
  optInCard: { ...glass(28, 'lg', 0.65), padding: 24 },

  // ── Peer row ──────────────────────────────────────────────────────────────
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_WASH,
  },
  avatarLetter: { fontSize: 16, fontWeight: '700', color: PRIMARY },
  rowTitle: { fontSize: 15, fontWeight: '700', color: INK },
  rowSubtitle: { fontSize: 13, color: MUTED },

  // ── Controls ──────────────────────────────────────────────────────────────
  actions: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillButton: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  // A filled control resting on the card it belongs to: 'sm', never more.
  solid: { backgroundColor: PRIMARY, boxShadow: lift('sm') },
  solidLabel: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  quiet: { backgroundColor: MUTED_WASH },
  quietLabel: { fontSize: 13, fontWeight: '600', color: MUTED },
  tinted: { backgroundColor: PRIMARY_WASH },
  tintedLabel: { fontSize: 13, fontWeight: '600', color: PRIMARY },

  // ── Opt-in card ───────────────────────────────────────────────────────────
  optInWell: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_WASH,
  },
  optInTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
  },
  optInBody: {
    marginTop: 4,
    fontSize: 13.5,
    lineHeight: 19,
    color: MUTED,
    textAlign: 'center',
  },
  handlePill: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: PRIMARY_WASH,
  },
  handlePillText: { fontSize: 13.5, fontWeight: '700', color: PRIMARY },
  enableButton: {
    marginTop: 16,
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    boxShadow: lift('sm'),
  },
  enableLabel: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyGlyph: { fontSize: 36, lineHeight: 44 },
  emptyTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
  },
  emptyBody: {
    marginTop: 4,
    fontSize: 13.5,
    lineHeight: 19,
    color: MUTED,
    textAlign: 'center',
  },

  optOut: { alignItems: 'center', paddingVertical: 12 },
  optOutLabel: { fontSize: 13, color: MUTED },
});
