import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Brain,
  CloudOff,
  Languages,
  Mic,
  MicOff,
  RefreshCw,
  Settings2,
  Square,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type BoardSolution, solveOnBoard } from '@/api/endpoints/board';
import { getNextPuzzle, type Puzzle } from '@/api/endpoints/puzzles';
import { Chalkboard } from '@/components/chalkboard';
import { PuzzleChalkboard } from '@/components/puzzle-chalkboard';
import { DuyoAvatar, type DuyoState } from '@/components/duyo-avatar';
import { useMemoryConsent } from '@/hooks/use-memory-consent';
import { useT, type TranslationKey } from '@/i18n';
import {
  MicDisclosure,
  useMicDisclosureStore,
} from '@/components/voice/mic-disclosure';
import { VoiceOrb } from '@/components/voice/voice-orb';
import { useMicRecorder, type MicPermission } from '@/hooks/use-mic-recorder';
import { usePcmPlayer } from '@/hooks/use-pcm-player';
import { useVoiceSession } from '@/hooks/use-voice-session';
import { glass, lift } from '@/lib/glass';
import { useChatStore } from '@/store/chat';
import { useChildStore } from '@/store/child';
import { useLanguageStore, type Language } from '@/store/language';
import { useVoiceSettingsStore } from '@/store/voice-settings';
import { useMemoryStore } from '@/store/memory';

type Phase = 'idle' | 'recording' | 'processing' | 'responding' | 'error';

/** A refused microphone, kept apart from a broken one. */
type MicIssue = Exclude<MicPermission, 'granted'>;

/** What the error card says for each refusal, and what its button then does. */
const MIC_ISSUE_TEXT: Record<
  MicIssue,
  { title: TranslationKey; body: TranslationKey; action: TranslationKey }
> = {
  denied: {
    title: 'voice.mic.deniedTitle',
    body: 'voice.mic.deniedBody',
    action: 'common.retry',
  },
  blocked: {
    title: 'voice.mic.blockedTitle',
    body: 'voice.mic.blockedBody',
    action: 'voice.mic.openSettings',
  },
};

/** The three the app speaks, in the order the button walks through them. */
const LANGUAGES: readonly Language[] = ['uz', 'ru', 'en'];
/** Named in the reader's own language, not in its own — this is the app
 *  telling a child WHICH language the orb will answer in, so it has to be a
 *  key rather than a word frozen at module load. */
const LANGUAGE_NAME: Record<Language, TranslationKey> = {
  uz: 'lang.uz',
  ru: 'lang.ru',
  en: 'lang.en',
};
/** Two letters fit on the button; a name does not. */
const LANGUAGE_SHORT: Record<Language, string> = { uz: 'UZ', ru: 'RU', en: 'EN' };


/**
 * Loudness of one PCM chunk, 0..1.
 *
 * Both directions of this session are 16-bit signed mono, so one routine
 * measures the child's microphone and DUYO's reply alike. It samples rather
 * than sums every frame: a 4096-frame chunk arrives four times a second and
 * the orb cannot show a difference finer than 256 samples can find, so the
 * other 94% of the work would buy nothing.
 *
 * The square root is what makes it look right — RMS is energy, and energy
 * scales with the square of amplitude, so plotting it raw makes normal speech
 * look like silence next to a shout.
 */
function levelOf(pcm: ArrayBuffer): number {
  const frames = new Int16Array(pcm);
  if (frames.length === 0) return 0;
  const step = Math.max(1, Math.floor(frames.length / 256));
  let sum = 0;
  let n = 0;
  for (let i = 0; i < frames.length; i += step) {
    const v = frames[i] / 32768;
    sum += v * v;
    n += 1;
  }
  // Speech sits well below full scale, so the useful range is compressed into
  // the bottom third; x4 spends it on the part of the curve the eye reads.
  return Math.min(1, Math.sqrt(sum / n) * 4);
}


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

// Keys, not words: the table is built once when the module loads, so a
// resolved sentence here would stay in whatever language the app started in.
const STATUS_TEXT: Record<Phase, TranslationKey> = {
  idle: 'voice.status.idle',
  recording: 'voice.status.recording',
  processing: 'voice.status.processing',
  responding: 'voice.status.responding',
  error: 'common.errorGeneric',
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
  const t = useT();
  const child = useChildStore((s) => s.child);
  const storeConversationId = useChatStore((s) => s.conversationId);
  const setStoreConversationId = useChatStore((s) => s.setConversationId);

  const [phase, setPhase] = useState<Phase>('idle');

  const language = useLanguageStore((st) => st.language);
  const voiceName = useVoiceSettingsStore((st) => st.voice);
  const setLanguage = useLanguageStore((st) => st.setLanguage);
  /**
   * Walk to the next language.
   *
   * A cycle rather than a picker: there are three, the button shows which
   * one is live, and a sheet for three items is a sheet too many. The choice
   * is the app-wide one, so changing it here changes it everywhere — which is
   * what a child means by "speak Russian to me".
   *
   * It reaches the model on the NEXT connection: the system prompt is built
   * when the socket opens, so a mid-session switch would have to tear the
   * session down. Pressed between turns, which is when it is pressed, it
   * applies immediately.
   */
  const cycleLanguage = useCallback(() => {
    const next = LANGUAGES[(LANGUAGES.indexOf(language) + 1) % LANGUAGES.length];
    setLanguage(next);
  }, [language, setLanguage]);

  const { width } = useWindowDimensions();

  // A share of the width, so the orb is the same object on every phone
  // rather than a different fraction of each screen.
  const orbSize = Math.round(Math.min(width * 0.74, 300));

  /**
   * What the orb breathes with. A shared value, not state: audio arrives
   * about four times a second and this component draws an animated mascot —
   * putting the level in React state would re-render that whole tree on every
   * chunk, for a number only the UI thread ever reads.
   */
  const level = useSharedValue(0);
  const pushLevel = useCallback(
    (pcm: ArrayBuffer) => {
      // Eased into place: chunk boundaries are 256ms apart, and stepping
      // between them makes the orb stutter rather than breathe.
      level.set(withTiming(levelOf(pcm), { duration: 160 }));
    },
    [level],
  );
  const [crisisLevel, setCrisisLevel] = useState<'orange' | 'red' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [micIssue, setMicIssue] = useState<MicIssue | null>(null);

  // The disclosure is shown once per install, before the microphone is ever
  // asked for — see components/voice/mic-disclosure.tsx for why it exists.
  const micDisclosureSeen = useMicDisclosureStore((st) => st.accepted);
  const micDisclosureHydrated = useMicDisclosureStore((st) => st.hydrated);
  const acceptMicDisclosure = useMicDisclosureStore((st) => st.accept);
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const [board, setBoard] = useState<BoardSolution | null>(null);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  // Spoken turns so far — drives how often a puzzle interrupts the talking.
  const spokenTurnsRef = useRef(0);
  /**
   * Last mic/ws/audio event, for diagnosing the pipeline without logcat.
   *
   * A ref, not state. It was state, and nothing ever rendered it — so every
   * STT token and every fifth microphone chunk re-rendered a screen carrying
   * an animated mascot, to store a string no one read. Kept because the value
   * is genuinely useful in a debugger; it just must not cost a frame.
   */
  const debugRef = useRef('idle');
  const dbg = (line: string) => {
    debugRef.current = line;
  };

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
    onOutputTranscript: () => {},
    onAudioChunk: (pcm) => {
      // The child barged in and is talking again. The server does not know
      // yet and keeps streaming the answer it had started; playing it would
      // put DUYO's voice on top of theirs, which is the one thing an
      // interruption must not do. Drop it on the floor instead.
      if (phaseRef.current === 'recording') return;
      if (phaseRef.current !== 'responding') setPhase('responding');
      pushLevel(pcm);
      playerRef.current.enqueueChunk(pcm);
    },
    onReady: (conversationId) => {
      setStoreConversationId(conversationId);
      dbg(`ws ready conv=${conversationId.slice(0, 8)}`);
    },
    onInputTranscript: (text) => {
      utteranceRef.current += text;
    },
    onCrisis: (level) => {
      setCrisisLevel(level);
      pendingCrisisRef.current = level;
    },
    onTurnComplete: (info) => {
      setPhase('idle');
      level.set(withTiming(0, { duration: 260 }));
      // The server has just written this turn into the conversation. Tell the
      // chat its local copy is behind, so it re-reads when the child returns.
      useChatStore.getState().markVoiceTurn();
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
        setErrorMessage(t('voice.disconnected', { code }));
        setPhase('error');
      }
    },
  });

  const chunkCountRef = useRef(0);
  const mic = useMicRecorder({
    onChunk: (pcm) => {
      voice.sendAudio(pcm);
      // The same chunk the server hears is what the orb breathes with, so the
      // animation cannot drift out of step with the session.
      pushLevel(pcm);
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

  /**
   * Open the session, once the child has read the disclosure.
   *
   * The permission is settled FIRST and the socket opens only after it comes
   * back granted. It used to be the other way round, which meant a child who
   * tapped "Don't allow" still had a backend voice session — and whatever
   * server-side record it implies — created for a turn they never spoke.
   */
  const beginSession = useCallback(async () => {
    if (!child) return;
    // The orb settles back to rest; the words from the last turn are
    // already in the conversation and are not this screen's to clear.
    level.set(withTiming(0, { duration: 200 }));
    setCrisisLevel(null);
    setErrorMessage(null);
    setMicIssue(null);
    setBoard(null);
    setPuzzle(null);
    utteranceRef.current = '';
    turnSeqRef.current += 1;
    chunkCountRef.current = 0;

    const permission = await mic.requestPermission();
    dbg(`mic permission ${permission}`);
    if (permission !== 'granted') {
      setMicIssue(permission);
      setPhase('error');
      return;
    }

    dbg('connect+mic.start');
    voice.connect({
      childId: child.id,
      conversationId: storeConversationId,
      // Both are read when the socket opens: the voice pins the timbre
      // for the session, the language becomes a line in the system prompt.
      voiceName,
      lang: language,
    });
    const started = await mic.start();
    dbg(`mic.start returned ${started}`);
    if (!started) {
      voice.close();
      setErrorMessage(t('voice.micFailed'));
      setPhase('error');
      return;
    }
    setPhase('recording');
  }, [child, mic, voice, storeConversationId, level, voiceName, language, t]);

  const handleTap = useCallback(async () => {
    if (!child) {
      dbg('no child profile');
      return;
    }
    if (phase === 'idle' || phase === 'error') {
      // Nothing may reach the OS prompt before the disclosure has been read,
      // so a tap made in the moment between mount and the flag coming back
      // from storage waits rather than guessing — it is a single frame at
      // cold start, and guessing wrong means showing the sheet twice.
      if (!micDisclosureHydrated) {
        dbg('mic disclosure not hydrated');
        return;
      }
      if (!micDisclosureSeen) {
        setDisclosureOpen(true);
        return;
      }
      await beginSession();
      return;
    }
    if (phase === 'recording') {
      dbg('stop + endTurn');
      await mic.stop();
      voice.endTurn();
      setPhase('processing');
      return;
    }

    // Barge-in: DUYO is answering and the child has something to say now.
    //
    // The socket stays open — this is the same turn taken back, not a new
    // session — so all that is needed is to silence what is queued and open
    // the microphone again. Whatever the server sends for the abandoned turn
    // is dropped by onAudioChunk while the phase is 'recording'.
    dbg('barge-in');
    playerRef.current.stop();
    level.set(withTiming(0, { duration: 120 }));
    utteranceRef.current = '';
    turnSeqRef.current += 1;
    const resumed = await mic.start();
    if (!resumed) {
      setErrorMessage(t('voice.micFailed'));
      setPhase('error');
      return;
    }
    setPhase('recording');
  }, [
    child,
    mic,
    voice,
    phase,
    level,
    t,
    beginSession,
    micDisclosureHydrated,
    micDisclosureSeen,
  ]);

  // Accepting the sheet flows straight into the OS prompt: the child has just
  // read what the microphone does, and making them tap the mic a second time
  // would put a screen between the explanation and the question it answers.
  const handleDisclosureAccept = useCallback(() => {
    acceptMicDisclosure();
    setDisclosureOpen(false);
    void beginSession();
  }, [acceptMicDisclosure, beginSession]);

  const micIssueText = micIssue ? MIC_ISSUE_TEXT[micIssue] : null;
  // 'blocked' has no dialog left to raise — Android answers every further
  // request instantly — so Settings is the only door.
  const handleErrorAction = useCallback(() => {
    if (micIssue === 'blocked') {
      void Linking.openSettings();
      return;
    }
    void handleTap();
  }, [micIssue, handleTap]);

  // Only a missing profile stops the mic. It used to be disabled while DUYO
  // was thinking or speaking, which meant a child who had thought of the
  // next thing had to sit and wait for a sentence to finish before saying
  // it — the opposite of a conversation.
  const buttonDisabled = !child;
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
              accessibilityLabel={t('common.back')}
              style={[glass(22, 'sm'), styles.headerButton, styles.focusable]}
            >
              <ArrowLeft size={26} color={PRIMARY} />
            </Pressable>
            <Text style={styles.title}>{t('voice.title')}</Text>
          </View>
          {/* This used to be an empty pane, here only to balance the title
              against the back chip. It looked exactly like a button and did
              nothing, which is the one thing a control-shaped object must
              never do — so it became the control this screen was missing:
              voice settings, which nothing else on the page reaches. */}
          <Pressable
            onPress={() => router.push('/(main)/settings-voice')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.voice')}
            style={[glass(20, 'sm'), styles.headerBalance, styles.focusable]}
          >
            <Settings2 size={21} color={PRIMARY} />
          </Pressable>
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
            <VoiceOrb size={orbSize} level={level} phase={phase} />

            {/* Error badge — a refused microphone is not a lost connection,
                and the icon is the first thing that says which. */}
            {isError && (
              <View style={styles.errorBadge}>
                {micIssue ? (
                  <MicOff size={24} color="#FFFFFF" />
                ) : (
                  <CloudOff size={24} color="#FFFFFF" />
                )}
              </View>
            )}
          </View>
          )}

          {/* Non-error status text */}
          {!isError && (
            <Text style={styles.status}>{t(STATUS_TEXT[phase])}</Text>
          )}

          {/* Crisis banner — preserved */}
          {crisisLevel ? (
            <View style={styles.crisis}>
              <Text style={styles.crisisText}>{t('voice.crisisBanner')}</Text>
            </View>
          ) : null}

          {/* Error card — the offline story, or the microphone one. A refused
              permission used to land here as "the microphone didn't start",
              which told a child their phone was broken when in fact they had
              just answered a question. */}
          {isError && (
            <View style={styles.errorBlock}>
              <View style={[glass(32, 'lg', 0.7), styles.errorCard]}>
                <View style={styles.errorWell}>
                  {micIssue ? (
                    <MicOff size={32} color={PRIMARY} />
                  ) : (
                    <CloudOff size={32} color={PRIMARY} />
                  )}
                </View>
                <Text style={styles.errorTitle}>
                  {micIssueText
                    ? t(micIssueText.title)
                    : (errorMessage ?? t('common.noInternet.title'))}
                </Text>
                <Text style={styles.errorBody}>
                  {t(micIssueText ? micIssueText.body : 'voice.offlineBody')}
                </Text>
                <Pressable
                  onPress={handleErrorAction}
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    micIssueText ? micIssueText.action : 'voice.retryLater',
                  )}
                  style={[styles.retry, styles.focusable]}
                >
                  {micIssue === 'blocked' ? (
                    <Settings2 size={18} color="#FFFFFF" />
                  ) : (
                    <RefreshCw size={18} color="#FFFFFF" />
                  )}
                  <Text style={styles.retryText}>
                    {t(micIssueText ? micIssueText.action : 'voice.retryLater')}
                  </Text>
                </Pressable>
              </View>
              {/* The voice settings are no help when the microphone itself is
                  the thing that was refused. */}
              {!micIssue && (
                <Pressable
                  onPress={() => router.push('/(main)/settings-voice')}
                  accessibilityRole="button"
                  accessibilityLabel={t('voice.checkSettings')}
                  style={styles.errorLink}
                >
                  <Text style={styles.errorLinkText}>
                    {t('voice.checkSettings')}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Transcripts — hidden while the board is up; it already shows the
            working, and both together overflow shorter screens. */}
        {/* No transcript panel here on purpose.

            Everything said in this session is already written into the
            conversation this screen was opened from — the server persists both
            sides as it goes (api/v1/voice.py) — so a second copy on top of the
            orb would be the same words in a worse place: unscrollable, gone on
            exit, and competing with the one thing this screen is for. Leave, and
            the whole exchange is waiting in the chat as text. */}

        {/* Bottom nav — a glass sheet with the mic raised out of it */}
        <View style={[glass(28, 'xl', 0.72), styles.dock]}>
          {/* Left — translate (visual placeholder) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('voice.a11y.language', {
              name: t(LANGUAGE_NAME[language]),
            })}
            style={[glass(24, 'flush', 0.5), styles.dockButton, styles.focusable]}
            onPress={cycleLanguage}
          >
            <Languages size={26} color={PRIMARY} />
            {/* The current language, on the button. A globe alone says
                "language" and not WHICH — and which is the only thing a
                child needs to see before pressing it. */}
            <Text style={styles.dockBadge}>{LANGUAGE_SHORT[language]}</Text>
          </Pressable>

          {/* Center — elevated push-to-talk mic */}
          <Pressable
            onPress={handleTap}
            disabled={buttonDisabled}
            accessibilityRole="button"
            accessibilityLabel={
              isRecording ? t('voice.a11y.stopRec') : t('voice.a11y.startRec')
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
            accessibilityLabel="Neo Miyya"
            style={[glass(24, 'flush', 0.5), styles.dockButton, styles.focusable]}
            onPress={() => router.push('/(main)/(tabs)/brain')}
          >
            <Brain size={28} color={PRIMARY} />
          </Pressable>
        </View>
      </SafeAreaView>

      <MicDisclosure
        visible={disclosureOpen}
        onAccept={handleDisclosureAccept}
        onDismiss={() => setDisclosureOpen(false)}
      />
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
  headerBalance: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  dockBadge: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: PRIMARY,
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
