import { Image } from 'expo-image';
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
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DuyoAvatar, type DuyoState } from '@/components/duyo-avatar';
import { useMicRecorder } from '@/hooks/use-mic-recorder';
import { usePcmPlayer } from '@/hooks/use-pcm-player';
import { useVoiceSession } from '@/hooks/use-voice-session';
import { useChatStore } from '@/store/chat';
import { useChildStore } from '@/store/child';

type Phase = 'idle' | 'recording' | 'processing' | 'responding' | 'error';

const TEAL = '#006687';

const STATUS_TEXT: Record<Phase, string> = {
  idle: 'Boshlash uchun tugmani bosing',
  recording: 'Eshitayapman...',
  processing: "O'ylanyapti...",
  responding: 'DUYO gapiryapti',
  error: 'Xatolik yuz berdi',
};

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
      dbg(`stt: ${text.slice(-30)}`);
    },
    onCrisis: (level) => {
      setCrisisLevel(level);
      pendingCrisisRef.current = level;
    },
    onTurnComplete: () => {
      setPhase('idle');
      const pending = pendingCrisisRef.current;
      if (pending) {
        pendingCrisisRef.current = null;
        router.push({
          pathname: '/(main)/crisis',
          params: { level: pending },
        });
      }
    },
    onError: (message) => {
      setErrorMessage(message);
      setPhase('error');
    },
    onClose: (code) => {
      if (phaseRef.current === 'recording' || phaseRef.current === 'processing') {
        // Server closed mid-turn — surface as error unless we already finished.
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

      {/* Center — avatar with soft glow */}
      <View className="flex-1 items-center justify-center gap-6 px-6">
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
            <Image
              source={require('@/assets/images/duyo-puzzled.png')}
              style={{ width: 256, height: 256 }}
              contentFit="contain"
              accessibilityLabel="DUYO hayron"
            />
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

      {/* Transcripts — preserved */}
      {(inputTranscript || outputTranscript) && (
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
