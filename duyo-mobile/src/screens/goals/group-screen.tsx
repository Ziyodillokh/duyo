import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, Flag, ShieldAlert } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Text } from '@/components/text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiClient } from '@/api/client';
import { fetchGoalCatalog, type GoalCatalogEntry } from '@/api/endpoints/goals';
import type { GroupMessage } from '@/api/endpoints/social';
import { ActionSheet, type SheetAction } from '@/components/action-sheet';
import {
  BUBBLE_THEIRS,
  ChatWallpaper,
  DayPill,
  Tail,
  clockOf,
  dayLabel,
  pill,
} from '@/components/goals/chat-chrome';
import { ChatComposer } from '@/components/goals/chat-composer';
import { emojiOnly } from '@/components/goals/emoji-picker';
import { AudioNote, VideoNote } from '@/components/goals/note-bubble';
import { KeyboardAvoidingView } from '@/components/keyboard-avoiding-view';
import type { MediaNote } from '@/hooks/use-media-note';
import { Portrait, type PortraitSpec, type Scene } from '@/components/goals/portrait';
import {
  useGroupMembers,
  useGroupMessages,
  useGroups,
  useJoinGroup,
  useSendGroupMessage,
  useSendGroupNote,
} from '@/hooks/use-social';
import { useT } from '@/i18n';
import { categoryOf } from '@/lib/goal-categories';
import { useChildStore } from '@/store/child';

const PRIMARY = '#2F6FE4';
const TITLE = '#2A63DC';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const DANGER = '#E0455E';
/** The safety notice, matched to peer-chat's: warm enough to be noticed, dark
 *  enough to be read on a pale page. */
const WARN = '#A76314';
const WARN_FILL = 'rgba(240,161,52,0.16)';
const WARN_EDGE = 'rgba(240,161,52,0.34)';
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

/**
 * A room message, as the server actually sends it.
 *
 * `sender_name` is the pseudonym FROZEN at send time, so history does not
 * rewrite itself when a child renames — which also means it names nobody: after
 * a handle regeneration it matches no one in the roster. Reporting and blocking
 * have to name a child, so social.py sends the sender's id on every row. The
 * shared endpoint type has not caught up with it, so it is widened here rather
 * than the pseudonym being guessed back into an identity.
 */
type RoomMessage = GroupMessage & { sender_child_id?: string | null };

/**
 * Report and block, on every message a peer sent.
 *
 * A visible control rather than a long-press, for the same reason peer-chat
 * keeps its pair in the header and never in a menu: a child who needs this is
 * not in a state to discover a gesture, and a reporting mechanism nobody can
 * find is not one.
 */
function FlagButton({ onPress }: { onPress: () => void }) {
  const t = useT();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('groups.safety.a11yFlag')}
      hitSlop={12}
      style={[styles.flagButton, styles.focusable]}
    >
      <Flag size={13} color={MUTED} strokeWidth={2.2} />
    </Pressable>
  );
}

/**
 * The clip above a note's text, or nothing at all for a plain message.
 *
 * The transcript stays visible underneath rather than being replaced by the
 * player: it is what the safety screen actually read, and it is the only part
 * a child on a silent bus can use.
 */
function NoteMedia({ m, mine }: { m: GroupMessage; mine: boolean }) {
  if (!m.media_url || m.media_kind !== 'audio') return null;
  return (
    <View style={styles.noteWrap}>
      <AudioNote
        url={m.media_url}
        durationMs={m.media_duration_ms ?? 0}
        mine={mine}
        seed={m.id}
      />
    </View>
  );
}

/**
 * What the server writes into `body` when a clip carried no speech.
 *
 * Mirrors the two strings in duyo-backend/src/duyo/api/v1/social.py — change
 * one and change the other. They exist so a note is never an empty row and a
 * screen reader has something to say; they are NOT a caption, and Telegram
 * shows nothing there, so neither does this. A real transcript still renders.
 */
const NOTE_PLACEHOLDERS = new Set(['Ovozli xabar', 'Video xabar']);

function captionOf(m: GroupMessage): string | null {
  if (!m.media_kind) return m.body;
  return NOTE_PLACEHOLDERS.has(m.body.trim()) ? null : m.body;
}

/**
 * A round video message.
 *
 * Rendered OUTSIDE any bubble, because that is what it is in Telegram: a bare
 * circle on the wallpaper carrying its own clock and tick. Putting one in a
 * bubble — as this did first — is the single thing that stops a chat looking
 * like Telegram, so the whole bubble path is skipped for it.
 */
function RoundVideo({
  m,
  grouped,
  last,
  onFlag,
}: {
  m: GroupMessage;
  grouped: boolean;
  last: boolean;
  onFlag?: () => void;
}) {
  const caption = captionOf(m);
  const body = (
    <View style={{ alignItems: m.mine ? 'flex-end' : 'flex-start' }}>
      <VideoNote
        url={m.media_url}
        durationMs={m.media_duration_ms ?? 0}
        mine={m.mine}
        time={clockOf(m.created_at)}
      />
      {caption ? (
        <View style={[styles.bubble, m.mine ? styles.bubbleMine : styles.bubbleTheirs, styles.roundCaption]}>
          <Text style={m.mine ? styles.bodyMine : styles.body}>{caption}</Text>
        </View>
      ) : null}
    </View>
  );

  if (m.mine) {
    return (
      <View style={[styles.rowMine, grouped && styles.rowGrouped]}>{body}</View>
    );
  }
  return (
    <View style={[styles.rowTheirs, grouped && styles.rowGrouped]}>
      <View style={styles.avatarSlot}>
        {last && (
          <Portrait
            spec={portraitFor(m.sender_name)}
            size={30}
            seed={seedOf(m.sender_name)}
          />
        )}
      </View>
      <View>
        {!grouped && <Text style={styles.senderOutside}>{m.sender_name}</Text>}
        {body}
      </View>
      {onFlag ? <FlagButton onPress={onFlag} /> : null}
    </View>
  );
}

/**
 * An emoji-only message, drawn as a sticker: large, no bubble.
 *
 * The clock cannot sit inside a bubble that does not exist, so it gets a
 * small translucent pill of its own — the same thing Telegram does under a
 * sticker.
 */
function Sticker({
  m,
  text,
  count,
  grouped,
  last,
  onFlag,
}: {
  m: GroupMessage;
  text: string;
  count: number;
  grouped: boolean;
  last: boolean;
  onFlag?: () => void;
}) {
  const size = count === 1 ? 56 : count === 2 ? 46 : 38;
  const meta = (
    <View style={styles.stickerMeta}>
      <Text style={styles.stickerTime}>{clockOf(m.created_at)}</Text>
      {m.mine && <Check size={12} color="#5A7BB5" strokeWidth={3} />}
    </View>
  );

  if (m.mine) {
    return (
      <View style={[styles.rowMine, grouped && styles.rowGrouped]}>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: size, lineHeight: size * 1.25 }}>{text}</Text>
          {meta}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.rowTheirs, grouped && styles.rowGrouped]}>
      <View style={styles.avatarSlot}>
        {last && (
          <Portrait
            spec={portraitFor(m.sender_name)}
            size={30}
            seed={seedOf(m.sender_name)}
          />
        )}
      </View>
      <View>
        {!grouped && <Text style={styles.senderOutside}>{m.sender_name}</Text>}
        <Text style={{ fontSize: size, lineHeight: size * 1.25 }}>{text}</Text>
        {meta}
      </View>
      {onFlag ? <FlagButton onPress={onFlag} /> : null}
    </View>
  );
}

function Bubble({
  m,
  grouped,
  last,
  onFlag,
}: {
  m: GroupMessage;
  /** Previous message is the same sender's: drop the repeated name. */
  grouped: boolean;
  /** Last of a run — only this one wears the tail, which is what makes a run
   *  read as one turn rather than three separate ones. */
  last: boolean;
  /** Absent on the child's own messages, and on one whose author has deleted
   *  their profile: there is nobody left to report. */
  onFlag?: () => void;
}) {
  const time = clockOf(m.created_at);

  // A round video is not a bubble at all — it takes the whole other path.
  if (m.media_kind === 'video' && m.media_url) {
    return <RoundVideo m={m} grouped={grouped} last={last} onFlag={onFlag} />;
  }

  const caption = captionOf(m);

  // Nothing but a couple of emoji: drawn big and bare, the way Telegram
  // turns one emoji into a sticker. A bubble around 😀 makes it a very short
  // sentence instead.
  const stickerCount = !m.media_kind && caption ? emojiOnly(caption) : 0;
  if (stickerCount) {
    return (
      <Sticker
        m={m}
        text={caption as string}
        count={stickerCount}
        grouped={grouped}
        last={last}
        onFlag={onFlag}
      />
    );
  }

  if (m.mine) {
    return (
      <View style={[styles.rowMine, grouped && styles.rowGrouped]}>
        <View
          style={[
            styles.bubble,
            styles.bubbleMine,
            grouped && styles.bubbleMineGrouped,
            !last && styles.bubbleMineRun,
          ]}
        >
          {last && <Tail side="right" colour={PRIMARY} />}
          <NoteMedia m={m} mine />
          {/* The time sits at the end of the text and wraps with it —
              Telegram's trick, and why a three-word message is not twice as
              tall as it needs to be. The spacer reserves its room. */}
          {/* `caption` is null for a note that carried no speech — inside a
              <Text> that renders nothing, while the spacer still reserves the
              clock's room. */}
          <Text style={styles.bodyMine}>
            {caption}
            <Text style={styles.metaSpacer}>{'        '}</Text>
          </Text>
          <View style={styles.metaMine}>
            <Text style={styles.timeMine}>{time}</Text>
            {/* One tick, not two. The server has the message; nobody has told
                us it was READ, and a second tick would be a claim we cannot
                make. */}
            <Check size={13} color="rgba(255,255,255,0.85)" strokeWidth={3} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.rowTheirs, grouped && styles.rowGrouped]}>
      {/* The slot is held even when grouped, so a run stays in one column
          instead of stepping left under the name. */}
      <View style={styles.avatarSlot}>
        {last && (
          <Portrait
            spec={portraitFor(m.sender_name)}
            size={30}
            seed={seedOf(m.sender_name)}
          />
        )}
      </View>
      <View
        style={[
          styles.bubble,
          styles.bubbleTheirs,
          grouped && styles.bubbleTheirsGrouped,
          !last && styles.bubbleTheirsRun,
        ]}
      >
        {last && <Tail side="left" colour={BUBBLE_THEIRS} />}
        {!grouped && <Text style={styles.sender}>{m.sender_name}</Text>}
        <NoteMedia m={m} mine={false} />
        <Text style={styles.body}>
          {caption}
          <Text style={styles.metaSpacer}>{'      '}</Text>
        </Text>
        <View style={styles.metaTheirs}>
          <Text style={styles.time}>{time}</Text>
        </View>
      </View>
      {onFlag ? <FlagButton onPress={onFlag} /> : null}
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
  const t = useT();
  const insets = useSafeAreaInsets();
  const childId = useChildStore((s) => s.child?.id ?? undefined);
  const params = useLocalSearchParams<{ key: string; label?: string }>();
  const key = params.key;
  const label = params.label ?? t('groups.fallbackLabel');

  const groups = useGroups(childId);
  const group = (groups.data ?? []).find((g) => g.key === key);
  const joined = group?.joined ?? false;

  const members = useGroupMembers(childId, joined ? key : undefined);
  const messages = useGroupMessages(childId, joined ? key : undefined);
  const send = useSendGroupMessage(childId, key);
  const sendNote = useSendGroupNote(childId, key);
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
  const [rosterOpen, setRosterOpen] = useState(false);
  const listRef = useRef<FlatList<GroupMessage>>(null);

  // ── Report and block ──────────────────────────────────────────────────
  // Written here rather than in hooks/use-social.ts because the room's safety
  // routes are the only callers; if a second screen ever needs them, that is
  // the moment to lift them out.
  const qc = useQueryClient();
  const [safety, setSafety] = useState<{
    step: 'menu' | 'reason' | 'block';
    target: { messageId: string; peerId: string; name: string };
  } | null>(null);
  const [safetyNotice, setSafetyNotice] = useState<string | null>(null);

  const roomPath = `/social/${childId}/groups/${encodeURIComponent(key)}`;

  /** The room, the roster and the mates list all change the moment a peer is
   *  blocked — the server stops returning them from every one of them. */
  const forgetPeer = () => {
    qc.invalidateQueries({ queryKey: ['group-messages', childId, key] });
    qc.invalidateQueries({ queryKey: ['group-members', childId, key] });
    qc.invalidateQueries({ queryKey: ['goal-mates', childId] });
    qc.invalidateQueries({ queryKey: ['friends', childId] });
  };

  const report = useMutation({
    mutationFn: (vars: { messageId: string; reason: string }) =>
      apiClient.post(`${roomPath}/messages/${vars.messageId}/report`, {
        reason: vars.reason,
      }),
    onSuccess: () => {
      setRefusal(null);
      setSafetyNotice(t('groups.safety.reported'));
      forgetPeer();
    },
    onError: () => setRefusal(t('groups.safety.failed')),
  });

  const block = useMutation({
    mutationFn: (vars: { peerId: string; name: string }) =>
      apiClient.post(`${roomPath}/members/${vars.peerId}/block`),
    onSuccess: (_data, vars) => {
      setRefusal(null);
      setSafetyNotice(t('groups.safety.blocked', { name: vars.name }));
      forgetPeer();
    },
    onError: () => setRefusal(t('groups.safety.failed')),
  });

  /**
   * The sheet's contents for whichever step it is on.
   *
   * One sheet across all three steps, not three: ActionSheet closes itself
   * before running an action, and a step that re-opens it in the same tick
   * batches into a content swap rather than a dismiss — where two sheets would
   * fight over presenting at once.
   */
  const safetyActions = (): SheetAction[] => {
    if (!safety) return [];
    const { target } = safety;
    if (safety.step === 'menu') {
      return [
        {
          label: t('peerChat.report.title'),
          icon: Flag,
          onPress: () => setSafety({ step: 'reason', target }),
        },
        {
          label: t('peerChat.block.title'),
          icon: ShieldAlert,
          destructive: true,
          onPress: () => setSafety({ step: 'block', target }),
        },
      ];
    }
    if (safety.step === 'reason') {
      // Fixed reasons, exactly as peer-chat uses: a child in distress should
      // not have to compose a sentence, and a free field here would be one
      // more unscreened channel between two children. Picking one IS the
      // confirmation — nothing is sent by opening the sheet.
      const withReason = (reason: string) => () =>
        report.mutate({ messageId: target.messageId, reason });
      return [
        {
          label: t('peerChat.report.rude'),
          onPress: withReason('rude_or_upsetting'),
        },
        {
          label: t('peerChat.report.personalInfo'),
          onPress: withReason('asked_for_personal_info'),
        },
        { label: t('peerChat.report.other'), onPress: withReason('other') },
      ];
    }
    return [
      {
        label: t('peerChat.block.title'),
        icon: ShieldAlert,
        destructive: true,
        onPress: () => block.mutate({ peerId: target.peerId, name: target.name }),
      },
    ];
  };

  const safetyTitle = () => {
    if (!safety) return undefined;
    if (safety.step === 'reason') return t('groups.safety.reasonTitle');
    if (safety.step === 'block')
      return t('groups.safety.blockTitle', { name: safety.target.name });
    return t('groups.safety.menuTitle', { name: safety.target.name });
  };

  const safetyBody = () => {
    if (!safety) return undefined;
    if (safety.step === 'reason') return t('groups.safety.reasonBody');
    if (safety.step === 'block') return t('groups.safety.blockBody');
    return t('groups.safety.menuBody');
  };

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
        setRefusal(detail ?? t('groups.sendFailed'));
      },
    });
  };

  const submitNote = (note: MediaNote) => {
    setRefusal(null);
    sendNote.mutate(note, {
      onSuccess: () => {
        // The blob URL was only ever for the local preview; the bubble now
        // plays the uploaded copy, so let the browser reclaim it.
        if (note.uri.startsWith('blob:')) URL.revokeObjectURL(note.uri);
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      },
      onError: (err) => {
        const detail = (err as { response?: { data?: { detail?: string } } }).response
          ?.data?.detail;
        setRefusal(detail ?? t('groups.sendFailed'));
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
      <ChatWallpaper />

      <KeyboardAvoidingView style={{ flex: 1 }}>
        {/* ── Header: avatar, then name over member count, left-aligned —
             the order Telegram uses, and the whole strip opens the roster. */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) }]}>
          <Pressable
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/(main)/(tabs)/goals')
            }
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={[pill(22), styles.backButton, styles.focusable]}
          >
            <ArrowLeft size={24} color={PRIMARY} strokeWidth={2.2} />
          </Pressable>

          <Pressable
            onPress={() => setRosterOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={t('groups.a11y.members', {
              label: group?.label ?? label,
            })}
            style={[pill(24), styles.headerIdentity, styles.focusable]}
          >
            <View style={styles.groupAvatar}>
              <Portrait
                spec={portraitFor(key ?? label)}
                size={40}
                seed={seedOf(key ?? label)}
              />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={1}>
                {group?.label ?? label}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {group ? t('groups.memberCount', { count: group.members }) : '...'}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* The roster is a disclosure, not permanent furniture — it used to
            sit under the back button and read as a broken overlap. */}
        {rosterOpen && joined && (
          <View style={[glass(18), styles.rosterSheet]}>
            {(members.data ?? []).length === 0 ? (
              <Text style={styles.rosterEmpty}>{t('groups.rosterAlone')}</Text>
            ) : (
              (members.data ?? []).map((m) => (
                <View key={m.child_id} style={styles.rosterRow}>
                  <Portrait
                    spec={portraitFor(m.display_name)}
                    size={32}
                    seed={seedOf(m.display_name)}
                  />
                  <Text style={styles.rosterName}>{m.display_name}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* Never dismissible, and it names the affordance: a rule read once
            in onboarding is not present when it is needed. */}
        {joined && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{t('groups.safety.notice')}</Text>
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
                  {t('groups.join.title', { label: group?.label ?? label })}
                </Text>
                <Text style={styles.gateBody}>{t('groups.join.body')}</Text>
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
                        setJoinFailed(t('groups.joinFailed')),
                    },
                  );
                }}
                disabled={join.isPending}
                accessibilityRole="button"
                accessibilityLabel={t('groups.a11y.joinWith', { title: item.title })}
                style={[glass(20), styles.joinRow, join.isPending && { opacity: 0.6 }]}
              >
                <Text style={styles.joinTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.joinAges}>
                  {t('groups.ageRange', { min: item.age_min, max: item.age_max })}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              catalog.isPending ? null : (
                <View style={[glass(22), styles.gate]}>
                  <Text style={styles.gateTitle}>{t('groups.noGoalForAge')}</Text>
                  <Text style={styles.gateBody}>{t('groups.noGoalForAgeBody')}</Text>
                  <Pressable
                    onPress={() => router.push('/(main)/my-goals')}
                    accessibilityRole="button"
                    accessibilityLabel={t('goals.title')}
                    style={styles.gateButton}
                  >
                    <Text style={styles.gateButtonText}>{t('goals.title')}</Text>
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
            renderItem={({ item, index }) => {
              const prev = (messages.data ?? [])[index - 1];
              const newDay =
                !prev || dayLabel(prev.created_at) !== dayLabel(item.created_at);
              // Same sender, same day, within five minutes reads as one turn.
              const grouped =
                !newDay &&
                !!prev &&
                prev.sender_name === item.sender_name &&
                prev.mine === item.mine &&
                new Date(item.created_at).getTime() -
                  new Date(prev.created_at).getTime() <
                  5 * 60 * 1000;
              // Only the last bubble of a run wears a tail and an avatar.
              const next = (messages.data ?? [])[index + 1];
              const last =
                !next ||
                next.sender_name !== item.sender_name ||
                next.mine !== item.mine ||
                dayLabel(next.created_at) !== dayLabel(item.created_at) ||
                new Date(next.created_at).getTime() -
                  new Date(item.created_at).getTime() >=
                  5 * 60 * 1000;
              // No flag on the child's own message, and none on one whose
              // author has deleted their profile — the server has nobody left
              // to report, so offering it would be a button that only fails.
              const peerId = (item as RoomMessage).sender_child_id;
              return (
                <>
                  {newDay && <DayPill label={dayLabel(item.created_at)} />}
                  <Bubble
                    m={item}
                    grouped={grouped}
                    last={last}
                    onFlag={
                      item.mine || !peerId
                        ? undefined
                        : () =>
                            setSafety({
                              step: 'menu',
                              target: {
                                messageId: item.id,
                                peerId,
                                name: item.sender_name,
                              },
                            })
                    }
                  />
                </>
              );
            }}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              messages.isPending ? null : (
                // Telegram puts an empty room's note in a small centred pill,
                // not a card the size of a screen.
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyPill}>
                    <Text style={styles.emptyText}>
                      {t('groups.empty', { count: group?.members ?? 0 })}
                    </Text>
                  </View>
                </View>
              )
            }
          />
        )}

        {/* ── Composer ─────────────────────────────────────────────────── */}
        {joined && (
          <View style={{ paddingBottom: insets.bottom + 10 }}>
            {safetyNotice && (
              <Pressable
                onPress={() => setSafetyNotice(null)}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                style={[glass(16), styles.confirmed, styles.focusable]}
              >
                <Text style={styles.confirmedText}>{safetyNotice}</Text>
              </Pressable>
            )}
            {refusal && (
              <View style={[glass(16), styles.refusal]}>
                <Text style={styles.refusalText}>{refusal}</Text>
              </View>
            )}
            <ChatComposer
              draft={draft}
              onChangeDraft={setDraft}
              onSendText={submit}
              sending={send.isPending}
              onSendNote={submitNote}
              uploading={sendNote.isPending}
              onNotice={setRefusal}
            />
          </View>
        )}
      </KeyboardAvoidingView>

      <ActionSheet
        visible={safety !== null}
        title={safetyTitle()}
        message={safetyBody()}
        actions={safetyActions()}
        onClose={() => setSafety(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // The browser draws a black rectangle around a focused control; these are
  // round or pill-shaped, so the default ring is simply wrong.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
  focusableText: { outlineStyle: 'none', outlineWidth: 0 } as unknown as TextStyle,

  // Floating capsules over the wallpaper, the way the reference does it —
  // no full-width bar, so the pattern runs behind them.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 5,
  },
  groupAvatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  headerText: { flex: 1 },
  title: { fontSize: 17, fontWeight: '700', color: TITLE },
  sub: { marginTop: 1, fontSize: 13, color: MUTED },

  rosterSheet: { marginHorizontal: 12, marginTop: 8, padding: 12, gap: 10 },
  rosterRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rosterName: { fontSize: 15, fontWeight: '600', color: INK },
  rosterEmpty: { fontSize: 14, color: MUTED },

  // flexGrow + flex-end anchors a short conversation to the bottom, the way
  // a chat fills upward rather than starting at the top of the screen.
  list: { flexGrow: 1, justifyContent: 'flex-end', padding: 12, gap: 6 },
  emptyWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  emptyPill: {
    maxWidth: 280,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(47,111,228,0.10)',
  },
  emptyText: { fontSize: 13.5, lineHeight: 19, color: INK, textAlign: 'center' },
  dayWrap: { alignItems: 'center', paddingVertical: 8 },
  dayPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(47,111,228,0.10)',
  },
  dayText: { fontSize: 12, fontWeight: '600', color: '#5A7BB0' },

  metaSpacer: { opacity: 0 },
  metaMine: {
    position: 'absolute',
    right: 12,
    bottom: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaTheirs: { position: 'absolute', right: 10, bottom: 7 },
  bubbleMineRun: { borderBottomRightRadius: 16 },
  bubbleTheirsRun: { borderBottomLeftRadius: 16 },

  rowMine: { alignItems: 'flex-end', marginTop: 6 },
  rowTheirs: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginTop: 6 },
  //消 A grouped turn sits tight under the one above it.
  rowGrouped: { marginTop: 2 },
  avatarSlot: { width: 30, height: 30, borderRadius: 15, overflow: 'hidden' },
  bubble: { maxWidth: '76%', paddingHorizontal: 12, paddingVertical: 7 },
  bubbleMine: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    borderBottomRightRadius: 5,
  },
  bubbleMineGrouped: { borderTopRightRadius: 5 },
  bubbleTheirs: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderBottomLeftRadius: 5,
    boxShadow: '0 1px 2px rgba(80,120,190,0.16)',
  },
  bubbleTheirsGrouped: { borderTopLeftRadius: 5 },
  sender: { fontSize: 12.5, fontWeight: '700', color: PRIMARY, marginBottom: 2 },
  body: { fontSize: 15, lineHeight: 20, color: INK },
  bodyMine: { fontSize: 15, lineHeight: 20, color: '#FFFFFF' },
  time: { marginTop: 2, fontSize: 10.5, color: '#9BB0CE', alignSelf: 'flex-end' },
  timeMine: {
    marginTop: 2,
    fontSize: 10.5,
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

  noteWrap: { marginBottom: 6 },
  stickerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginTop: -4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  stickerTime: { fontSize: 11, color: '#5A7BB5', fontVariant: ['tabular-nums'] },
  /** A caption under a round video — the circle carries no bubble, so on the
   *  rare note that HAS a transcript the text gets a small one of its own. */
  roundCaption: { marginTop: 6, maxWidth: 240 },
  /** The sender's name sits above a round video instead of inside it. */
  senderOutside: {
    marginBottom: 4,
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '700',
    color: TITLE,
  },

  refusal: { marginHorizontal: 16, marginBottom: 8, padding: 12 },
  refusalText: { fontSize: 13.5, color: DANGER, fontWeight: '600' },

  // ── Safety ─────────────────────────────────────────────────────────────
  notice: {
    marginHorizontal: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: WARN_EDGE,
    backgroundColor: WARN_FILL,
  },
  noticeText: { fontSize: 12, lineHeight: 17, color: WARN },
  // Small and quiet on purpose: present on every peer message without
  // competing with the message itself, and big enough to hit with the hitSlop.
  flagButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  confirmed: { marginHorizontal: 16, marginBottom: 8, padding: 12 },
  confirmedText: { fontSize: 13.5, lineHeight: 19, color: INK, fontWeight: '600' },
});
