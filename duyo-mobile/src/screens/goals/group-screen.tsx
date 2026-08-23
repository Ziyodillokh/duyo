import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Send, Users } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchGoalCatalog, type GoalCatalogEntry } from '@/api/endpoints/goals';
import type { GroupMessage } from '@/api/endpoints/social';
import { KeyboardAvoidingView } from '@/components/keyboard-avoiding-view';
import { Portrait, type PortraitSpec, type Scene } from '@/components/goals/portrait';
import {
  useGroupMembers,
  useGroupMessages,
  useGroups,
  useJoinGroup,
  useSendGroupMessage,
} from '@/hooks/use-social';
import { categoryOf } from '@/lib/goal-categories';
import { useChildStore } from '@/store/child';

const PRIMARY = '#2F6FE4';
const TITLE = '#2A63DC';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const DANGER = '#E0455E';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

const glass = (radius: number): ViewStyle => ({
  backgroundColor: 'rgba(255,255,255,0.55)',
  borderRadius: radius,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.9)',
  boxShadow:
    '0 16px 34px rgba(111,155,221,0.32), inset 0 1.5px 0 rgba(255,255,255,0.95)',
});

// Portraits are deterministic per pseudonym — the same peer wears the same
// face in the roster, in a bubble and on the mates list.
const SCENES: readonly Scene[] = ['studio', 'street', 'city', 'mountains', 'library'];
const SKIN = ['#F0C6A2', '#E8BC92', '#DDAA80', '#CE9469', '#B97D55'];
const HAIR = ['#1E1815', '#2B211B', '#4A3423', '#5A3520', '#1F2436'];
const TOP = ['#33507F', '#2F6E7F', '#4E6B58', '#8E97A6', '#D9924E', '#7A55C9'];

function seedOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h | 1;
}

function portraitFor(id: string): PortraitSpec {
  const h = seedOf(id);
  const at = (n: number, salt: number) =>
    (Math.imul(h ^ Math.imul(salt + 1, 0x9e3779b9), 0x85ebca6b) >>> 16) % n;
  return {
    scene: SCENES[at(SCENES.length, 1)],
    skin: SKIN[at(SKIN.length, 3)],
    hair: HAIR[at(HAIR.length, 5)],
    hairStyle: at(5, 7) as PortraitSpec['hairStyle'],
    top: TOP[at(TOP.length, 9)],
    lightFromLeft: at(2, 11) === 0,
    turn: at(9, 13) - 4,
  };
}

function Bubble({ m }: { m: GroupMessage }) {
  const time = useMemo(() => {
    const d = new Date(m.created_at);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }, [m.created_at]);

  if (m.mine) {
    return (
      <View style={styles.rowMine}>
        <View style={[styles.bubble, styles.bubbleMine]}>
          <Text style={styles.bodyMine}>{m.body}</Text>
          <Text style={styles.timeMine}>{time}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.rowTheirs}>
      <Portrait spec={portraitFor(m.sender_name)} size={34} seed={seedOf(m.sender_name)} />
      <View style={[glass(18), styles.bubble, styles.bubbleTheirs]}>
        <Text style={styles.sender}>{m.sender_name}</Text>
        <Text style={styles.body}>{m.body}</Text>
        <Text style={styles.time}>{time}</Text>
      </View>
    </View>
  );
}

/**
 * A goal room — the screen behind a Maqsaddoshlar circle.
 *
 * Reads like a group chat because that is what it is, but there is no join
 * button anywhere: the server decides membership from the child's confirmed
 * goals and age band (services/groups.py), so being here IS holding the goal.
 * A child who is not a member gets the door closed with an explanation of
 * what would open it, rather than an empty room.
 *
 * Every message is screened before delivery by the same pipeline that guards
 * one-to-one peer chat; a refusal comes back as 422 and is shown to the
 * sender alone, never to the room.
 */
export default function GroupScreen() {
  const insets = useSafeAreaInsets();
  const childId = useChildStore((s) => s.child?.id ?? undefined);
  const params = useLocalSearchParams<{ key: string; label?: string }>();
  const key = params.key;
  const label = params.label ?? 'Guruh';

  const groups = useGroups(childId);
  const group = (groups.data ?? []).find((g) => g.key === key);
  const joined = group?.joined ?? false;

  const members = useGroupMembers(childId, joined ? key : undefined);
  const messages = useGroupMessages(childId, joined ? key : undefined);
  const send = useSendGroupMessage(childId, key);
  const join = useJoinGroup(childId);
  const childAge = useChildStore((st) => st.child?.age ?? undefined);

  // Joining means taking on one of the room's goals, so the door shows the
  // actual goals rather than a button that would have to invent one.
  const catalog = useQuery({
    queryKey: ['goal-catalog', childAge ?? 0],
    queryFn: () => fetchGoalCatalog(undefined, childAge),
    staleTime: 60 * 60 * 1000,
    enabled: !joined,
  });
  const joinable = useMemo<GoalCatalogEntry[]>(() => {
    if (!group) return [];
    // categoryOf, not the bare rule: the rules overlap on purpose
    // (textbook_ingliz_6 is both "til" and "talim") and precedence decides.
    // Filtering by the bare rule offered goals that would have put the child
    // in a different room than the one they tapped.
    return (catalog.data ?? []).filter(
      (e) => categoryOf(e.match_key)?.key === group.category,
    );
  }, [catalog.data, group]);

  const [draft, setDraft] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [joinFailed, setJoinFailed] = useState<string | null>(null);
  const listRef = useRef<FlatList<GroupMessage>>(null);

  const submit = () => {
    const body = draft.trim();
    if (!body || send.isPending) return;
    setRefusal(null);
    send.mutate(body, {
      onSuccess: () => {
        setDraft('');
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      },
      onError: (err) => {
        // The server explains a refusal without teaching evasion; show its
        // words rather than inventing our own.
        const detail = (err as { response?: { data?: { detail?: string } } }).response
          ?.data?.detail;
        setRefusal(detail ?? "Yuborilmadi — birozdan so'ng qayta urinib ko'r.");
      },
    });
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView style={{ flex: 1 }}>
        {/* ── Header ───────────────────────────────────────────────────── */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) }]}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(main)/(tabs)/goals'))}
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            style={[glass(24), styles.headerButton]}
          >
            <ArrowLeft size={23} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>
              {group?.label ?? label}
            </Text>
            <View style={styles.subRow}>
              <Users size={13} color={MUTED} strokeWidth={2} />
              <Text style={styles.sub}>
                {group ? `${group.members} a'zo` : '...'}
              </Text>
            </View>
          </View>
          <View style={styles.headerButton} />
        </View>

        {/* ── Roster strip ─────────────────────────────────────────────── */}
        {joined && (members.data?.length ?? 0) > 0 && (
          <View style={styles.roster}>
            {(members.data ?? []).slice(0, 8).map((m) => (
              <View key={m.child_id} style={styles.rosterFace}>
                <Portrait
                  spec={portraitFor(m.display_name)}
                  size={30}
                  seed={seedOf(m.display_name)}
                />
              </View>
            ))}
            {(members.data?.length ?? 0) > 8 && (
              <Text style={styles.rosterMore}>+{(members.data?.length ?? 0) - 8}</Text>
            )}
          </View>
        )}

        {/* ── Body ─────────────────────────────────────────────────────── */}
        {groups.isPending ? (
          <View style={styles.centre}>
            <ActivityIndicator color={PRIMARY} />
          </View>
        ) : !joined ? (
          <FlatList
            data={joinable}
            keyExtractor={(e) => e.match_key}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={[glass(22), styles.gate]}>
                <Text style={styles.gateTitle}>
                  {group?.label ?? label} guruhiga qo'shilish
                </Text>
                <Text style={styles.gateBody}>
                  Qaysi maqsad ustida ishlayotganingni tanla — shu bilan
                  guruhga kirasan va o'sha maqsaddagi bolalarni ko'rasan.
                  Maqsadni keyin olib tashlasang, guruhdan ham chiqasan.
                </Text>
                {joinFailed && <Text style={styles.joinError}>{joinFailed}</Text>}
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  if (join.isPending) return;
                  setJoinFailed(null);
                  join.mutate(
                    { match_key: item.match_key, title: item.title, kind: item.kind },
                    {
                      onError: () =>
                        setJoinFailed("Qo'shilib bo'lmadi — qayta urinib ko'r."),
                    },
                  );
                }}
                disabled={join.isPending}
                accessibilityRole="button"
                accessibilityLabel={`${item.title} — bu maqsad bilan qo'shilish`}
                style={[glass(20), styles.joinRow, join.isPending && { opacity: 0.6 }]}
              >
                <Text style={styles.joinTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.joinAges}>
                  {item.age_min}–{item.age_max} yosh
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              catalog.isPending ? null : (
                <View style={[glass(22), styles.gate]}>
                  <Text style={styles.gateTitle}>
                    Bu guruh uchun sening yoshingga mos maqsad yo'q
                  </Text>
                  <Text style={styles.gateBody}>
                    Boshqa guruhni ko'rib chiq yoki o'zing maqsad yozib qo'y.
                  </Text>
                  <Pressable
                    onPress={() => router.push('/(main)/my-goals')}
                    accessibilityRole="button"
                    accessibilityLabel="Maqsadlarim"
                    style={styles.gateButton}
                  >
                    <Text style={styles.gateButtonText}>Maqsadlarim</Text>
                  </Pressable>
                </View>
              )
            }
          />
        ) : (
          <FlatList
            ref={listRef}
            data={messages.data ?? []}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <Bubble m={item} />}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              messages.isPending ? null : (
                <View style={[glass(22), styles.gate]}>
                  <Text style={styles.gateTitle}>Hali hech kim yozmagan</Text>
                  <Text style={styles.gateBody}>
                    Birinchi bo'lib salom ayt — shu maqsaddagi {group?.members ?? 0}{' '}
                    bola shu yerda.
                  </Text>
                </View>
              )
            }
          />
        )}

        {/* ── Composer ─────────────────────────────────────────────────── */}
        {joined && (
          <View style={{ paddingBottom: insets.bottom + 10 }}>
            {refusal && (
              <View style={[glass(16), styles.refusal]}>
                <Text style={styles.refusalText}>{refusal}</Text>
              </View>
            )}
            <View style={[glass(26), styles.composer]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Guruhga yozing..."
                placeholderTextColor="#7693C2"
                style={styles.input}
                maxLength={500}
                multiline
                accessibilityLabel="Guruh xabari"
              />
              <Pressable
                onPress={submit}
                disabled={!draft.trim() || send.isPending}
                accessibilityRole="button"
                accessibilityLabel="Yuborish"
                style={[
                  styles.sendButton,
                  (!draft.trim() || send.isPending) && { opacity: 0.45 },
                ]}
              >
                <Send size={20} color="#FFFFFF" strokeWidth={2} />
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: TITLE },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  sub: { fontSize: 13, color: MUTED },

  roster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: -8,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  rosterFace: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    marginRight: -8,
  },
  rosterMore: { marginLeft: 16, fontSize: 13, fontWeight: '600', color: MUTED },

  list: { padding: 16, paddingBottom: 8, gap: 10 },
  rowMine: { alignItems: 'flex-end' },
  rowTheirs: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMine: {
    backgroundColor: PRIMARY,
    borderRadius: 18,
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: { borderBottomLeftRadius: 6 },
  sender: { fontSize: 12.5, fontWeight: '700', color: PRIMARY, marginBottom: 2 },
  body: { fontSize: 15, lineHeight: 20, color: INK },
  bodyMine: { fontSize: 15, lineHeight: 20, color: '#FFFFFF' },
  time: { marginTop: 3, fontSize: 11, color: MUTED, alignSelf: 'flex-end' },
  timeMine: {
    marginTop: 3,
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    alignSelf: 'flex-end',
  },

  gate: { margin: 20, padding: 20 },
  gateTitle: { fontSize: 17, fontWeight: '700', color: INK },
  gateBody: { marginTop: 8, fontSize: 14, lineHeight: 21, color: MUTED },
  gateButton: {
    marginTop: 16,
    backgroundColor: PRIMARY,
    borderRadius: 16,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  joinError: { marginTop: 10, fontSize: 13.5, color: DANGER, fontWeight: '600' },
  joinRow: { marginHorizontal: 4, padding: 16 },
  joinTitle: { fontSize: 16, fontWeight: '600', color: INK },
  joinAges: { marginTop: 4, fontSize: 12.5, color: MUTED },

  refusal: { marginHorizontal: 16, marginBottom: 8, padding: 12 },
  refusalText: { fontSize: 13.5, color: DANGER, fontWeight: '600' },
  composer: {
    marginHorizontal: 16,
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: { flex: 1, fontSize: 16, color: INK, maxHeight: 110, paddingVertical: 6 },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
