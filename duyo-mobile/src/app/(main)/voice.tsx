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
import { Pressable, ScrollView, View } from 'react-native';
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
import { useChatStore } from '@/store/chat';
import { useChildStore } from '@/store/child';
import { useMemoryStore } from '@/store/memory';

type Phase = 'idle' | 'recording' | 'processing' | 'responding' | 'error';

const TEAL = '#006687';

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
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      {/* Header — frosted bar */}
      <View
        className="h-16 px-4 flex-row items-center justify-between border-b border-white/50 bg-white/70"
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            className="p-1"
          >
            <ArrowLeft size={28} color={TEAL} />
          </Pressable>
          <Text className="text-2xl font-bold text-[#006687]">AI Tutor</Text>
        </View>
        <View className="w-10 h-10 rounded-full border-2 border-white bg-[#e6e8ea]" />
      </View>

      {/* Center — avatar with soft glow, or the chalkboard when one is up */}
      <View className="flex-1 items-center justify-center gap-6 px-6">
        {!board && puzzle ? (
          /* Same slate, asking instead of explaining. */
          <View className="w-full" style={{ paddingBottom: 40 }}>
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
          <View className="w-full" style={{ paddingBottom: 40 }}>
            <Chalkboard
              solution={board}
              onClose={() => setBoard(null)}
              compact
            />
            <View
              style={{ position: 'absolute', right: -8, bottom: -14, zIndex: 10 }}
              pointerEvents="none"
            >
              <DuyoAvatar
                size="md"
                state={avatarStateFor(phase, crisisLevel)}
              />
            </View>
          </View>
        ) : (
        <View className="items-center justify-center">
          {/* Soft glow behind avatar */}
          <View
            className="absolute w-72 h-72 rounded-full bg-[#006687]/5"
            style={{
              shadowColor: TEAL,
              shadowOpacity: 0.15,
              shadowRadius: 40,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
          {isError ? (
            <DuyoAvatar size="xl" state="puzzled" />
          ) : (
            <DuyoAvatar size="xl" state={avatarStateFor(phase, crisisLevel)} />
          )}

          {/* Offline signal-error badge */}
          {isError && (
            <View
              className="absolute top-2 right-2 w-12 h-12 rounded-full items-center justify-center border-2 border-white bg-[#ba1a1a]"
              style={{
                shadowColor: '#000',
                shadowOpacity: 0.2,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4,
              }}
            >
              <CloudOff size={24} color="#FFFFFF" />
            </View>
          )}
        </View>
        )}

        {/* Non-error status text */}
        {!isError && (
          <Text className="text-base text-foreground text-center">
            {STATUS_TEXT[phase]}
          </Text>
        )}

        {/* Crisis banner — preserved */}
        {crisisLevel && (
          <View className="bg-destructive/10 border border-destructive rounded-xl px-4 py-2">
            <Text className="text-sm font-semibold text-destructive">
              Yordam kerakmi? 1142 raqamiga qo'ng'iroq qiling
            </Text>
          </View>
        )}

        {/* Offline / error card */}
        {isError && (
          <View className="w-full items-center gap-3">
            <View
              className="w-full items-center gap-4 rounded-[32px] border border-white/50 bg-white/70 p-8"
              style={{
                shadowColor: '#000',
                shadowOpacity: 0.08,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
              }}
            >
              <View className="w-16 h-16 rounded-full items-center justify-center bg-[#e6e8ea]">
                <CloudOff size={32} color="#3f484e" />
              </View>
              <Text className="text-[28px] font-bold text-[#191c1e] text-center">
                {errorMessage ?? "Internet aloqasi yo'q"}
              </Text>
              <Text className="text-base text-[#3f484e] text-center">
                DUYO hozircha biroz dam olyapti. Aloqa tiklanganda suhbatni
                davom ettiramiz.
              </Text>
              <Pressable
                onPress={handleTap}
                accessibilityRole="button"
                accessibilityLabel="Keyinroq urinib ko'ramiz"
                className="w-full h-14 rounded-full flex-row items-center justify-center gap-2 bg-[#006687]"
              >
                <RefreshCw size={18} color="#FFFFFF" />
                <Text className="text-sm font-semibold text-white">
                  Keyinroq urinib ko'ramiz
                </Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => router.push('/(main)/settings-voice')}
              accessibilityRole="button"
              accessibilityLabel="Sozlamalarni tekshirish"
            >
              <Text className="text-sm text-[#006687]">
                Sozlamalarni tekshirish
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Transcripts — hidden while the board is up; it already shows the
          working, and both together overflow shorter screens. */}
      {!board && (inputTranscript || outputTranscript) && (
        <ScrollView
          className="max-h-48 px-6 mb-4"
          contentContainerStyle={{ gap: 8 }}
        >
          {inputTranscript && (
            <View className="bg-primary/10 rounded-xl p-3">
              <Text className="text-xs text-muted-foreground mb-1">Siz:</Text>
              <Text className="text-base text-foreground">
                {inputTranscript}
              </Text>
            </View>
          )}
          {outputTranscript && (
            <View className="bg-card border border-border rounded-xl p-3">
              <Text className="text-xs text-muted-foreground mb-1">DUYO:</Text>
              <Text className="text-base text-foreground">
                {outputTranscript}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Bottom nav — frosted bar with elevated mic */}
      <View
        className="h-20 flex-row items-center justify-between px-10 rounded-t-xl border-t border-white/50 bg-white/70"
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -2 },
          elevation: 6,
        }}
      >
        {/* Left — translate (visual placeholder) */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tarjima"
          className="w-12 h-12 rounded-full items-center justify-center"
          onPress={() => {
            // TODO: wire translate control
          }}
        >
          <Languages size={28} color={TEAL} />
        </Pressable>

        {/* Center — elevated push-to-talk mic */}
        <Pressable
          onPress={handleTap}
          disabled={buttonDisabled}
          accessibilityRole="button"
          accessibilityLabel={
            isRecording ? "Yozishni to'xtatish" : 'Yozishni boshlash'
          }
          className={`w-20 h-20 rounded-full items-center justify-center bg-[#006687] -mt-10 ${
            buttonDisabled ? 'opacity-50' : ''
          }`}
          style={{
            shadowColor: TEAL,
            shadowOpacity: 0.4,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          }}
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
          className="w-12 h-12 rounded-full items-center justify-center"
          onPress={() => {
            // TODO: wire hint control
          }}
        >
          <Lightbulb size={28} color={TEAL} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
