import { router } from 'expo-router';
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
    onReady: (conversationId) => {
      setStoreConversationId(conversationId);
    },
    onInputTranscript: (text) =>
      setInputTranscript((prev) => prev + text),
    onOutputTranscript: (text) =>
      setOutputTranscript((prev) => prev + text),
    onAudioChunk: (pcm) => {
      if (phaseRef.current !== 'responding') setPhase('responding');
      playerRef.current.enqueueChunk(pcm);
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

  const mic = useMicRecorder({
    onChunk: voice.sendAudio,
    onError: (err) => {
      setErrorMessage(err.message);
      setPhase('error');
    },
  });

  const handleTap = useCallback(async () => {
    if (!child) return;
    if (phase === 'idle' || phase === 'error') {
      setInputTranscript('');
      setOutputTranscript('');
      setCrisisLevel(null);
      setErrorMessage(null);
      voice.connect({
        childId: child.id,
        conversationId: storeConversationId,
      });
      const started = await mic.start();
      if (!started) {
        voice.close();
        setErrorMessage("Mikrofonga ruxsat yo'q");
        setPhase('error');
        return;
      }
      setPhase('recording');
      return;
    }
    if (phase === 'recording') {
      await mic.stop();
      voice.endTurn();
      setPhase('processing');
    }
  }, [child, mic, voice, phase, storeConversationId]);

  const buttonDisabled =
    phase === 'processing' || phase === 'responding' || !child;
  const isRecording = phase === 'recording';

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 py-3 flex-row items-center">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Orqaga"
          className="p-2"
        >
          <Text className="text-2xl text-foreground">←</Text>
        </Pressable>
        <Text className="text-lg font-bold flex-1 text-center text-foreground">
          Ovozli suhbat
        </Text>
        <View className="w-10" />
      </View>

      {/* Avatar + status */}
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <DuyoAvatar size="xl" state={avatarStateFor(phase, crisisLevel)} />
        <Text className="text-base text-foreground text-center">
          {phase === 'error' && errorMessage
            ? errorMessage
            : STATUS_TEXT[phase]}
        </Text>
        {crisisLevel && (
          <View className="bg-destructive/10 border border-destructive rounded-xl px-4 py-2">
            <Text className="text-sm font-semibold text-destructive">
              Yordam kerakmi? 1142 raqamiga qo'ng'iroq qiling
            </Text>
          </View>
        )}
      </View>

      {/* Transcripts */}
      {(inputTranscript || outputTranscript) && (
        <ScrollView
          className="max-h-48 px-6 mb-4"
          contentContainerStyle={{ gap: 8 }}
        >
          {inputTranscript && (
            <View className="bg-primary/10 rounded-xl p-3">
              <Text className="text-xs text-muted-foreground mb-1">
                Siz:
              </Text>
              <Text className="text-base text-foreground">
                {inputTranscript}
              </Text>
            </View>
          )}
          {outputTranscript && (
            <View className="bg-card border border-border rounded-xl p-3">
              <Text className="text-xs text-muted-foreground mb-1">
                DUYO:
              </Text>
              <Text className="text-base text-foreground">
                {outputTranscript}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Push-to-talk button */}
      <View className="items-center pb-10">
        <Pressable
          onPress={handleTap}
          disabled={buttonDisabled}
          accessibilityRole="button"
          accessibilityLabel={
            isRecording ? "Yozishni to'xtatish" : 'Yozishni boshlash'
          }
          className={`w-24 h-24 rounded-full items-center justify-center ${
            buttonDisabled
              ? 'bg-muted'
              : isRecording
                ? 'bg-destructive'
                : 'bg-primary'
          }`}
        >
          <Text className="text-4xl">{isRecording ? '■' : '●'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
