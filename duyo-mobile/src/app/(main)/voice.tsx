import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowLeft,
  CloudOff,
  Languages,
  Lightbulb,
  Mic,
  RefreshCw,
  Square,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type BoardSolution, solveOnBoard } from '@/api/endpoints/board';
import { getNextPuzzle, type Puzzle } from '@/api/endpoints/puzzles';
import { Chalkboard } from '@/components/chalkboard';
import { PuzzleChalkboard } from '@/components/puzzle-chalkboard';
import { DuyoAvatar, type DuyoState } from '@/components/duyo-avatar';
import { useMemoryConsent } from '@/hooks/use-memory-consent';
import { useMicRecorder } from '@/hooks/use-mic-recorder';
import { usePcmPlayer } from '@/hooks/use-pcm-player';
import { useVoiceSession } from '@/hooks/use-voice-session';
import { glass, lift } from '@/lib/glass';
import { useChatStore } from '@/store/chat';
import { useChildStore } from '@/store/child';
import { useMemoryStore } from '@/store/memory';

type Phase = 'idle' | 'recording' | 'processing' | 'responding' | 'error';

// ── The glass sky — the tutor stands on the same pale blue page as the rest ──
// The screen used to carry its own teal; one look now, so the tutor borrows
// the app's blue and keeps only its own layout.
const PRIMARY = '#2F6FE4';
const TITLE = '#2A63DC';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const DANGER = '#E0455E';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';
const HAIRLINE = 'rgba(47,111,228,0.10)';

const STATUS_TEXT: Record<Phase, string> = {
  idle: 'Boshlash uchun tugmani bosing',
  recording: 'Eshitayapman...',
  processing: "O'ylanyapti...",
  responding: 'DUYO gapiryapti',
  error: 'Xatolik yuz berdi',
};

// A puzzle every few spoken turns, so a long voice session isn't only talking.
const PUZZLE_EVERY_N_TURNS = 4;

// Local pre-filter before spending a Gemini call on the board.
//
// This used to be a keyword allow-list, which silently swallowed every problem
// phrased outside it — chemistry ("suvning formulasi nima"), word problems with
// no digits, and so on. It is now an exclude-list: only utterances that are
// plainly small talk are dropped, and everything else goes to the backend,
// which classifies authoritatively and answers is_problem=false for free.
// The bias is deliberate: a missed board is a bug the child sees, an extra
// call costs a fraction of a cent.
// Speech-to-text emits several apostrophe glyphs for o'/g', so match any.
const APOS = "['‘’ʻʼ]?";
const PURE_SMALL_TALK = new RegExp(
  `^(salom|assalomu?\\s*alaykum|qalaysan|rahmat|xayr|ha|yo${APOS}q|xo${APOS}p|` +
    `yaxshi|zo${APOS}r|charchadim|zerikdim|uxlayman)[\\s.!?]*$`,
  'i',
);

function worthAsking(text: string): boolean {
  const t = text.trim();
  // Too short to carry a problem statement.
  if (t.length < 8) return false;
  // The whole utterance is a greeting or an acknowledgement.
  return !PURE_SMALL_TALK.test(t);
}

function avatarStateFor(
  phase: Phase,
  crisis: 'orange' | 'red' | null,
): DuyoState {
  if (crisis) return 'crisis-support';
  switch (phase) {
    case 'recording':
      return 'thinking';
    case 'processing':
      return 'thinking';
    case 'responding':
      return 'talking';
    case 'error':
      return 'sad';
    case 'idle':
    default:
      return 'happy';
  }
}

export default function VoiceScreen() {
  const child = useChildStore((s) => s.child);
  const storeConversationId = useChatStore((s) => s.conversationId);
  const setStoreConversationId = useChatStore((s) => s.setConversationId);

  const [phase, setPhase] = useState<Phase>('idle');
  const [inputTranscript, setInputTranscript] = useState('');
  const [outputTranscript, setOutputTranscript] = useState('');
  const [crisisLevel, setCrisisLevel] = useState<'orange' | 'red' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [board, setBoard] = useState<BoardSolution | null>(null);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  // Spoken turns so far — drives how often a puzzle interrupts the talking.
  const spokenTurnsRef = useRef(0);
  // Bosqich B debug overlay — last mic/ws/audio event, visible on screen
  // so we can diagnose the voice pipeline without USB logcat.
  const [debugLine, setDebugLine] = useState<string>('idle');
  const dbg = (line: string) => setDebugLine(line);

  // Latest phase available to event handlers without re-binding the WS.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const player = usePcmPlayer({ sampleRate: 24_000 });
  const playerRef = useRef(player);
  playerRef.current = player;

  // Crisis level captured during a turn — navigated to on turn_complete so
  // we don't interrupt the assistant mid-reply.
  const pendingCrisisRef = useRef<'orange' | 'red' | null>(null);

  // What the child said this turn. Kept in a ref because onTurnComplete is
  // bound once and would otherwise read a stale transcript.
  const utteranceRef = useRef('');
  // Guards against a slow board reply landing after the child moved on.
  const turnSeqRef = useRef(0);

  // Same "eslab qolaymi?" flow the text chat uses, so speaking a fact and
  // typing it behave identically.
  const offerMemoryConsent = useMemoryConsent();

  // The memory store needs an active child before it will accept a write, and
  // a child can reach voice without ever opening the chat tab — without this
  // the first spoken memory would be rejected with "no active child".
  // Idempotent: load() no-ops the cache clear when the child is unchanged.
  useEffect(() => {
    if (!child) return;
    useMemoryStore.getState().load(child.id).catch(() => {});
  }, [child]);

  const voice = useVoiceSession({
    onOutputTranscript: (text) =>
      setOutputTranscript((prev) => prev + text),
    onAudioChunk: (pcm) => {
      if (phaseRef.current !== 'responding') {
        setPhase('responding');
        dbg(`first audio chunk ${pcm.byteLength}b`);
      }
      playerRef.current.enqueueChunk(pcm);
    },
    onReady: (conversationId) => {
      setStoreConversationId(conversationId);
      dbg(`ws ready conv=${conversationId.slice(0, 8)}`);
    },
    onInputTranscript: (text) => {
      setInputTranscript((prev) => prev + text);
      utteranceRef.current += text;
      dbg(`stt: ${text.slice(-30)}`);
    },
    onCrisis: (level) => {
      setCrisisLevel(level);
      pendingCrisisRef.current = level;
    },
    onTurnComplete: (info) => {
      setPhase('idle');
      const pending = pendingCrisisRef.current;
      if (pending) {
        pendingCrisisRef.current = null;
        router.push({
          pathname: '/(main)/crisis',
          params: { level: pending },
        });
        return; // a crisis outranks any blackboard
      }

      const said = utteranceRef.current;
      if (!child) return;
      spokenTurnsRef.current += 1;

      // Did the child just SAY something worth remembering? Offered before
      // the board/puzzle branches below so a solvable question does not cost
      // the child the prompt — the alert is modal, so it resolves first and
      // the board is still there behind it.
      offerMemoryConsent(info.memoryCandidate);

      // Did the child just ask something worth working through on the board?
      if (worthAsking(said)) {
        const seq = turnSeqRef.current;
        void solveOnBoard(child.id, said).then((solution) => {
          // Ignore a late answer if another turn has started since.
          if (solution && turnSeqRef.current === seq) setBoard(solution);
        });
        return;
      }

      // Otherwise, every few turns, put a puzzle up instead — but never over a
      // solution the child is still reading.
      if (spokenTurnsRef.current % PUZZLE_EVERY_N_TURNS !== 0) return;
      const puzzleSeq = turnSeqRef.current;
      void getNextPuzzle(child.id)
        .then((p) => {
          if (p && turnSeqRef.current === puzzleSeq) setPuzzle(p);
        })
        .catch(() => {});
    },
    onError: (message) => {
      setErrorMessage(message);
      setPhase('error');
    },
    onClose: (code) => {
      // 1000/1001/1005 are orderly closes — the server routinely hangs up
      // right after a turn, sometimes before turn_complete lands, and showing
      // "Aloqa uzildi (1000)" over a finished answer looked like a crash.
      const orderly = code === 1000 || code === 1001 || code === 1005;
      if (orderly) {
        if (phaseRef.current !== 'error') setPhase('idle');
        return;
      }
      if (phaseRef.current === 'recording' || phaseRef.current === 'processing') {
        setErrorMessage(`Aloqa uzildi (${code})`);
        setPhase('error');
      }
    },
  });

  const chunkCountRef = useRef(0);
  const mic = useMicRecorder({
    onChunk: (pcm) => {
      voice.sendAudio(pcm);
      chunkCountRef.current += 1;
      if (chunkCountRef.current % 5 === 1) {
        dbg(`mic chunk #${chunkCountRef.current} ${pcm.byteLength}b`);
      }
    },
    onError: (err) => {
      setErrorMessage(err.message);
      setPhase('error');
      dbg(`mic err: ${err.message}`);
    },
  });

  const handleTap = useCallback(async () => {
    if (!child) {
      dbg('no child profile');
      return;
    }
    if (phase === 'idle' || phase === 'error') {
      setInputTranscript('');
      setOutputTranscript('');
      setCrisisLevel(null);
      setErrorMessage(null);
      setBoard(null);
      setPuzzle(null);
      utteranceRef.current = '';
      turnSeqRef.current += 1;
      chunkCountRef.current = 0;
      dbg('connect+mic.start');
      voice.connect({
        childId: child.id,
        conversationId: storeConversationId,
      });
      const started = await mic.start();
      dbg(`mic.start returned ${started}`);
      if (!started) {
        voice.close();
        setErrorMessage("Mikrofon ishga tushmadi");
        setPhase('error');
        return;
      }
      setPhase('recording');
      return;
    }
    if (phase === 'recording') {
      dbg('stop + endTurn');
      await mic.stop();
      voice.endTurn();
      setPhase('processing');
    }
  }, [child, mic, voice, phase, storeConversationId]);

  const buttonDisabled =
    phase === 'processing' || phase === 'responding' || !child;
  const isRecording = phase === 'recording';
  const isError = phase === 'error';

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        {/* Header — glass chips on the open page */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Orqaga"
              style={[glass(22, 'sm'), styles.headerButton, styles.focusable]}
            >
              <ArrowLeft size={26} color={PRIMARY} />
            </Pressable>
            <Text style={styles.title}>AI Tutor</Text>
          </View>
          {/* Balances the title against the back chip — no control of its own. */}
          <View style={[glass(20, 'sm'), styles.headerBalance]} />
        </View>

        {/* Center — avatar with soft glow, or the chalkboard when one is up */}
        <View style={styles.stage}>
          {!board && puzzle ? (
            /* Same slate, asking instead of explaining. */
            <View style={styles.slate}>
              <PuzzleChalkboard
                puzzle={puzzle}
                childId={child?.id ?? ''}
                onDone={() => setPuzzle(null)}
                compact
              />
            </View>
          ) : board ? (
            /* Board fills the stage; DUYO steps aside and stands in front of its
               lower corner, the way a teacher stands beside a blackboard. */
            <View style={styles.slate}>
              <Chalkboard
                solution={board}
                onClose={() => setBoard(null)}
                compact
              />
              <View style={styles.slateAvatar} pointerEvents="none">
                <DuyoAvatar
                  size="md"
                  state={avatarStateFor(phase, crisisLevel)}
                />
              </View>
            </View>
          ) : (
          <View style={styles.avatarStage}>
            {/* Soft glow behind avatar. Symmetric and unoffset on purpose: it
                is light around DUYO, not a height cue, so it must not read as
                one of the ladder's drop shadows. */}
            <View style={styles.glow} />
            {isError ? (
              <DuyoAvatar size="xl" state="puzzled" />
            ) : (
              <DuyoAvatar size="xl" state={avatarStateFor(phase, crisisLevel)} />
            )}

            {/* Offline signal-error badge */}
            {isError && (
              <View style={styles.errorBadge}>
                <CloudOff size={24} color="#FFFFFF" />
              </View>
            )}
          </View>
          )}

          {/* Non-error status text */}
          {!isError && (
            <Text style={styles.status}>{STATUS_TEXT[phase]}</Text>
          )}

          {/* Crisis banner — preserved */}
          {crisisLevel ? (
            <View style={styles.crisis}>
              <Text style={styles.crisisText}>
                Yordam kerakmi? 1142 raqamiga qo'ng'iroq qiling
              </Text>
            </View>
          ) : null}

          {/* Offline / error card */}
          {isError && (
            <View style={styles.errorBlock}>
              <View style={[glass(32, 'lg', 0.7), styles.errorCard]}>
                <View style={styles.errorWell}>
                  <CloudOff size={32} color={PRIMARY} />
                </View>
                <Text style={styles.errorTitle}>
                  {errorMessage ?? "Internet aloqasi yo'q"}
                </Text>
                <Text style={styles.errorBody}>
                  DUYO hozircha biroz dam olyapti. Aloqa tiklanganda suhbatni
                  davom ettiramiz.
                </Text>
                <Pressable
                  onPress={handleTap}
                  accessibilityRole="button"
                  accessibilityLabel="Keyinroq urinib ko'ramiz"
                  style={[styles.retry, styles.focusable]}
                >
                  <RefreshCw size={18} color="#FFFFFF" />
                  <Text style={styles.retryText}>
                    Keyinroq urinib ko'ramiz
                  </Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => router.push('/(main)/settings-voice')}
                accessibilityRole="button"
                accessibilityLabel="Sozlamalarni tekshirish"
                style={styles.errorLink}
              >
                <Text style={styles.errorLinkText}>
                  Sozlamalarni tekshirish
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Transcripts — hidden while the board is up; it already shows the
            working, and both together overflow shorter screens. */}
        {/* `? :` rather than `&&`. Both transcripts start as '', so the guard
            `(inputTranscript || outputTranscript)` evaluates to '' — and `&&`
            hands that empty STRING to React, which renders it as a text node
            inside a View: "Unexpected text node". A falsy string is not nothing. */}
        {!board && (inputTranscript || outputTranscript) ? (
          <ScrollView
            style={styles.transcripts}
            contentContainerStyle={styles.transcriptsContent}
          >
            {/* `? :`, not `&&`: these start as '' and React renders an empty
                string as a TEXT NODE, which inside a View is the error
                "Unexpected text node". A falsy string is not nothing. */}
            {inputTranscript ? (
              <View style={[glass(18, 'sm'), styles.transcriptMine]}>
                <Text style={styles.transcriptLabel}>Siz:</Text>
                <Text style={styles.transcriptBody}>
                  {inputTranscript}
                </Text>
              </View>
            ) : null}
            {outputTranscript ? (
              <View style={[glass(18, 'sm'), styles.transcript]}>
                <Text style={styles.transcriptLabel}>DUYO:</Text>
                <Text style={styles.transcriptBody}>
                  {outputTranscript}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        ) : null}

        {/* Bottom nav — a glass sheet with the mic raised out of it */}
        <View style={[glass(28, 'xl', 0.72), styles.dock]}>
          {/* Left — translate (visual placeholder) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tarjima"
            style={[glass(24, 'flush', 0.5), styles.dockButton, styles.focusable]}
            onPress={() => {
              // TODO: wire translate control
            }}
          >
            <Languages size={28} color={PRIMARY} />
          </Pressable>

          {/* Center — elevated push-to-talk mic */}
          <Pressable
            onPress={handleTap}
            disabled={buttonDisabled}
            accessibilityRole="button"
            accessibilityLabel={
              isRecording ? "Yozishni to'xtatish" : 'Yozishni boshlash'
            }
            style={[
              styles.micButton,
              styles.focusable,
              buttonDisabled && styles.micDisabled,
            ]}
          >
            {isRecording ? (
              <Square size={28} color="#FFFFFF" fill="#FFFFFF" />
            ) : (
              <Mic size={32} color="#FFFFFF" />
            )}
          </Pressable>

          {/* Right — lightbulb (visual placeholder) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Maslahat"
            style={[glass(24, 'flush', 0.5), styles.dockButton, styles.focusable]}
            onPress={() => {
              // TODO: wire hint control
            }}
          >
            <Lightbulb size={28} color={PRIMARY} />
          </Pressable>
        </View>
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
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBalance: { width: 40, height: 40 },
  title: { fontSize: 24, fontWeight: '700', color: TITLE },

  // ── Stage ──────────────────────────────────────────────────────────────
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 24,
  },
  slate: { width: '100%', paddingBottom: 40 },
  slateAvatar: { position: 'absolute', right: -8, bottom: -14, zIndex: 10 },

  avatarStage: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: 288,
    height: 288,
    borderRadius: 144,
    backgroundColor: 'rgba(47,111,228,0.07)',
    boxShadow: '0 0 64px 24px rgba(70,108,168,0.10)',
  },
  errorBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: DANGER,
    boxShadow: lift('md'),
  },

  status: { fontSize: 16, fontWeight: '600', color: INK, textAlign: 'center' },

  crisis: {
    backgroundColor: 'rgba(224,69,94,0.10)',
    borderWidth: 1,
    borderColor: DANGER,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  crisisText: { fontSize: 14, fontWeight: '600', color: DANGER },

  // ── Offline card: the one hero object this state leads with ────────────
  errorBlock: { width: '100%', alignItems: 'center', gap: 12 },
  errorCard: { width: '100%', alignItems: 'center', gap: 16, padding: 32 },
  errorWell: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47,111,228,0.10)',
  },
  errorTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
  },
  errorBody: { fontSize: 16, lineHeight: 22, color: MUTED, textAlign: 'center' },
  // No shadow: a button sitting ON the card it belongs to should not cast one
  // onto it.
  retry: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
  },
  retryText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  errorLink: { paddingHorizontal: 12, paddingVertical: 8 },
  errorLinkText: { fontSize: 14, fontWeight: '600', color: PRIMARY },

  // ── Transcripts ────────────────────────────────────────────────────────
  transcripts: { maxHeight: 192, paddingHorizontal: 24, marginBottom: 16 },
  transcriptsContent: { gap: 8 },
  transcript: { padding: 12 },
  // The child's own words, tinted the way their chat bubble is.
  transcriptMine: { padding: 12, backgroundColor: 'rgba(47,111,228,0.10)' },
  transcriptLabel: { marginBottom: 4, fontSize: 12, color: MUTED },
  transcriptBody: { fontSize: 16, lineHeight: 22, color: INK },

  // ── Dock ───────────────────────────────────────────────────────────────
  dock: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    // Squared off at the screen edge — only the top of this sheet is seen.
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dockButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    marginTop: -40,
    boxShadow: lift('xl'),
  },
  micDisabled: { opacity: 0.5 },
});
