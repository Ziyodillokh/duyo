import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Flag, Send, ShieldAlert } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PeerMessage } from '@/api/endpoints/social';
import { KeyboardAvoidingView } from '@/components/keyboard-avoiding-view';
import {
  useBlockFriend,
  usePeerMessages,
  useReportFriend,
  useSendPeerMessage,
} from '@/hooks/use-social';
import { useT } from '@/i18n';
import { glass, lift } from '@/lib/glass';
import { useChildStore } from '@/store/child';

// ── The glass sky, the same one goal-mates hands this screen off from ───────
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const DANGER = '#E0455E';
const PLACEHOLDER = '#7693C2';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';
/** The safety notice: warm enough to be noticed, dark enough to be read on
 *  a pale page. */
const WARN = '#A76314';
const WARN_FILL = 'rgba(240,161,52,0.16)';
const WARN_EDGE = 'rgba(240,161,52,0.34)';

const MAX_LEN = 500;

function Bubble({ message }: { message: PeerMessage }) {
  const mine = message.mine;
  return (
    <View
      style={
        mine
          ? [styles.bubble, styles.bubbleMine]
          : [glass(20, 'sm', 0.62), styles.bubble, styles.bubbleTheirs]
      }
    >
      <Text
        style={[styles.bubbleText, mine && styles.bubbleTextMine]}
        // Peer text is untrusted; selectable so a child can copy it into a
        // report conversation with an adult if they need to.
        selectable
      >
        {message.body}
      </Text>
    </View>
  );
}

export default function PeerChatScreen() {
  const t = useT();
  const params = useLocalSearchParams<{
    friendshipId: string;
    peerName: string;
  }>();
  const friendshipId = params.friendshipId;
  const peerName = params.peerName ?? t('peerChat.peerFallback');

  const child = useChildStore((s) => s.child);
  const childId = child?.id;

  const messagesQuery = usePeerMessages(childId, friendshipId);
  const sendMutation = useSendPeerMessage(childId, friendshipId);
  const blockMutation = useBlockFriend(childId);
  const reportMutation = useReportFriend(childId);

  const [draft, setDraft] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);

  // Newest last; the list is inverted so it opens at the newest message.
  const data = useMemo(
    () => [...(messagesQuery.data ?? [])].reverse(),
    [messagesQuery.data],
  );

  const canSend = draft.trim().length > 0 && !sendMutation.isPending;

  const handleSend = () => {
    const body = draft.trim();
    if (!body) return;
    setRefusal(null);
    sendMutation.mutate(body, {
      onSuccess: (result) => {
        if (result.rejected) {
          // An expected outcome, not a crash: explain it in place.
          setRefusal(result.rejected);
          return;
        }
        setDraft('');
      },
      onError: () =>
        Alert.alert(t('common.sendFailed'), t('common.checkInternetRetry')),
    });
  };

  const submitReport = (reason: string) =>
    reportMutation.mutate(
      { friendshipId, reason },
      { onSuccess: () => router.back() },
    );

  // Fixed reasons rather than a free-text box, for two reasons: a child in
  // distress should not have to compose a sentence, and a free field on this
  // screen would be one more unscreened channel between two children.
  // Previously no reason was sent at all, so every report reached review as
  // "something happened" with nothing to triage on.
  const confirmReport = () =>
    Alert.alert(t('peerChat.report.title'), t('peerChat.report.body'), [
      {
        text: t('peerChat.report.rude'),
        onPress: () => submitReport('rude_or_upsetting'),
      },
      {
        text: t('peerChat.report.personalInfo'),
        onPress: () => submitReport('asked_for_personal_info'),
      },
      { text: t('peerChat.report.other'), onPress: () => submitReport('other') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);

  const confirmBlock = () =>
    Alert.alert(
      t('peerChat.block.title'),
      t('peerChat.block.body', { name: peerName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('peerChat.block.title'),
          style: 'destructive',
          onPress: () =>
            blockMutation.mutate(friendshipId, {
              onSuccess: () => router.back(),
            }),
        },
      ],
    );

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              hitSlop={10}
              style={[glass(20, 'sm'), styles.headerButton, styles.focusable]}
            >
              <ArrowLeft size={24} color={PRIMARY} />
            </Pressable>
            <Text style={styles.peerName} numberOfLines={1}>
              {peerName}
            </Text>
          </View>
          {/* Block and report are always visible and never buried in a menu. */}
          <View style={styles.headerActions}>
            <Pressable
              onPress={confirmBlock}
              accessibilityRole="button"
              accessibilityLabel={t('peerChat.block.title')}
              hitSlop={8}
              style={[glass(20, 'sm'), styles.headerButton, styles.focusable]}
            >
              <ShieldAlert size={20} color={MUTED} />
            </Pressable>
            <Pressable
              onPress={confirmReport}
              accessibilityRole="button"
              accessibilityLabel={t('peerChat.report.title')}
              hitSlop={8}
              style={[glass(20, 'sm'), styles.headerButton, styles.focusable]}
            >
              <Flag size={20} color={MUTED} />
            </Pressable>
          </View>
        </View>

        {/* Never dismissible — the rule has to be present, not read once. */}
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{t('peerChat.safetyNotice')}</Text>
        </View>

        <KeyboardAvoidingView style={styles.fill}>
          {messagesQuery.isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={PRIMARY} />
            </View>
          ) : (
            <FlatList
              data={data}
              inverted
              keyExtractor={(m) => m.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => <Bubble message={item} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>👋</Text>
                  <Text style={styles.emptyTitle}>
                    {t('peerChat.empty.title')}
                  </Text>
                  <Text style={styles.emptyBody}>
                    {t('peerChat.empty.body')}
                  </Text>
                </View>
              }
            />
          )}

          {/* `? :`, not `&&`: `refusal` is a string, and React renders an empty
              one as a TEXT NODE, which inside a View is "Unexpected text node". */}
          {refusal ? (
            <View style={styles.refusal}>
              <Text style={styles.refusalText}>{refusal}</Text>
            </View>
          ) : null}

          <View style={[glass(28, 'xl', 0.72), styles.composer]}>
            <TextInput
              value={draft}
              onChangeText={(next) => setDraft(next.slice(0, MAX_LEN))}
              placeholder={t('common.messagePlaceholder')}
              placeholderTextColor={PLACEHOLDER}
              multiline
              maxLength={MAX_LEN}
              accessibilityLabel={t('common.message')}
              // See chat.tsx: `glass()` is typed ViewStyle and TextStyle is
              // not a superset of it, though every property used here is valid
              // on both.
              style={[glass(16, 'flush', 0.62) as TextStyle, styles.input]}
            />
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel={t('common.send')}
              style={[
                styles.send,
                canSend ? styles.sendOn : styles.sendOff,
                styles.focusable,
              ]}
            >
              {sendMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Send size={20} color={canSend ? '#FFFFFF' : MUTED} />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  // The browser's default focus ring is a black rectangle around a round
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  // ── Header ─────────────────────────────────────────────────────────────
  header: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerActions: { flexDirection: 'row', gap: 6 },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peerName: { flexShrink: 1, fontSize: 18, fontWeight: '700', color: INK },

  notice: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: WARN_EDGE,
    backgroundColor: WARN_FILL,
  },
  noticeText: { fontSize: 12, lineHeight: 17, color: WARN },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Messages ───────────────────────────────────────────────────────────
  listContent: { padding: 16, gap: 10 },
  bubble: {
    maxWidth: '80%',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  // A filled bubble still belongs to the ladder: the same contact/ambient
  // pair as the glass one opposite, so both sides sit at one height.
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: PRIMARY,
    boxShadow: lift('sm'),
  },
  bubbleTheirs: { alignSelf: 'flex-start' },
  bubbleText: { fontSize: 16, lineHeight: 22, color: INK },
  bubbleTextMine: { color: '#FFFFFF' },

  empty: { alignItems: 'center', paddingTop: 40 },
  emptyEmoji: { fontSize: 36, lineHeight: 42 },
  emptyTitle: { marginTop: 8, fontSize: 16, fontWeight: '700', color: INK },
  emptyBody: {
    marginTop: 4,
    paddingHorizontal: 24,
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    textAlign: 'center',
  },

  refusal: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(224,69,94,0.28)',
    backgroundColor: 'rgba(224,69,94,0.12)',
  },
  refusalText: { fontSize: 12, lineHeight: 17, color: DANGER },

  // ── Composer ───────────────────────────────────────────────────────────
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    // Squared off at the screen edge — only the top of this sheet is seen.
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  input: {
    flex: 1,
    maxHeight: 112,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: INK,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOn: { backgroundColor: PRIMARY },
  sendOff: { backgroundColor: 'rgba(140,163,203,0.25)' },
});
