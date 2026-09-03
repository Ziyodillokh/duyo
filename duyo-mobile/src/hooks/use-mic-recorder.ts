import AudioRecord from '@fugood/react-native-audio-pcm-stream';
import { useCallback, useEffect, useRef } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

import { useT } from '@/i18n';

interface UseMicRecorderOptions {
  onChunk: (pcm: ArrayBuffer) => void;
  onError?: (error: Error) => void;
}

/**
 * The three answers Android can give, kept apart.
 *
 * The old code collapsed them into a boolean and the screen reported "the
 * microphone didn't start" for all of them — a hardware sentence for what is
 * usually a choice. `blocked` in particular has no dialog left to show: every
 * later request returns instantly, so the only way forward is Settings, and a
 * caller that cannot tell it from `denied` has no way to offer that.
 */
export type MicPermission = 'granted' | 'denied' | 'blocked';

interface UseMicRecorderResult {
  requestPermission: () => Promise<MicPermission>;
  start: () => Promise<boolean>;
  stop: () => Promise<void>;
  isRecording: boolean;
  durationMs: number;
}

// Backend voice protocol requires 16kHz mono PCM-16
// (duyo-backend/src/duyo/api/v1/voice.py). bufferSize must be ≥
// AudioRecord.getMinBufferSize() on Android — 1600 silently failed the
// native AudioRecord constructor on Samsung devices and crashed the
// recording thread. 4096 samples × 2 bytes = 8KB ≈ 256ms chunks, well
// above min on every modern device while still fast enough for live STT.
const SAMPLE_RATE = 16_000;
const CHANNELS = 1 as const;
const BITS_PER_SAMPLE = 16 as const;
const BUFFER_SIZE = 4096;
// MediaRecorder.AudioSource.MIC = 1 — most universally supported.
// VOICE_RECOGNITION (6) silently failed on Samsung One UI 7.
const ANDROID_AUDIO_SOURCE_MIC = 1;

// @fugood/react-native-audio-pcm-stream is iOS/Android only: on web its
// NativeEventEmitter is built from an undefined native module, so the very
// first AudioRecord.on() throws "Cannot read properties of undefined (reading
// 'removeAllListeners')" — which crashed VoiceScreen on mount and took the
// whole route down. Voice is a native-only feature; on web the hook degrades
// to a no-op and start() reports failure so the screen shows its error state.
const SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

export function useMicRecorder({
  onChunk,
  onError,
}: UseMicRecorderOptions): UseMicRecorderResult {
  const t = useT();
  const onChunkRef = useRef(onChunk);
  onChunkRef.current = onChunk;
  const isRecordingRef = useRef(false);

  const chunkCounterRef = useRef(0);

  // Subscribe once on mount; AudioRecord.on internally replaces the listener
  // so re-binding with stale refs is unnecessary.
  useEffect(() => {
    if (!SUPPORTED) return;
    AudioRecord.on('data', (base64) => {
      const buffer = base64ToArrayBuffer(base64);
      if (!buffer) return;
      chunkCounterRef.current += 1;
      if (chunkCounterRef.current % 10 === 1) {
        console.warn(
          `[mic] data #${chunkCounterRef.current} ${buffer.byteLength}b`,
        );
      }
      onChunkRef.current(buffer);
    });
    return () => {
      if (isRecordingRef.current) {
        void AudioRecord.stop().catch(() => {
          // Module may already be torn down on unmount.
        });
        isRecordingRef.current = false;
      }
    };
  }, []);

  /**
   * Ask for the microphone, separately from opening it.
   *
   * Split out of `start` so the voice screen can settle the permission BEFORE
   * it opens a backend session — a denied prompt used to leave a server-side
   * voice session running for a child who never spoke a word into it.
   *
   * The rationale strings are Android's second-chance explanation, shown when
   * the child has refused once already. They are not the disclosure Play asks
   * for — that is components/voice/mic-disclosure.tsx, which runs ahead of
   * this call — but the OS dialog is the wrong place to say nothing.
   */
  const requestPermission = useCallback(async (): Promise<MicPermission> => {
    // iOS asks its own question when AudioRecord opens the input, and there is
    // nothing to request here; web has no microphone path at all and is turned
    // away by start().
    if (Platform.OS !== 'android') return 'granted';
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: t('voice.mic.rationaleTitle'),
          message: t('voice.mic.rationaleBody'),
          buttonPositive: t('common.continue'),
          buttonNegative: t('common.cancel'),
        },
      );
      console.warn('[mic] permission', result);
      if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        return 'blocked';
      }
      return 'denied';
    } catch (err) {
      // A throwing PermissionsAndroid is not a refusal, but the child has no
      // microphone either way — report the outcome that offers a retry.
      console.warn('[mic] permission failed', err);
      return 'denied';
    }
  }, [t]);

  const start = useCallback(async (): Promise<boolean> => {
    if (!SUPPORTED) {
      onError?.(new Error('Ovozli suhbat faqat mobil ilovada ishlaydi'));
      return false;
    }
    try {
      // Kept here as well as at the call site: barge-in re-enters start()
      // directly, and a permission revoked from the notification shade while
      // the screen was open would otherwise reach AudioRecord as a crash.
      if ((await requestPermission()) !== 'granted') return false;

      console.warn('[mic] init begin');
      // init internally constructs the native AudioRecord. Must be awaited
      // — without await the JS wrapper resolves immediately while `recorder`
      // is still null, and start() bails out without recording anything.
      await AudioRecord.init({
        sampleRate: SAMPLE_RATE,
        channels: CHANNELS,
        bitsPerSample: BITS_PER_SAMPLE,
        audioSource: ANDROID_AUDIO_SOURCE_MIC,
        bufferSize: BUFFER_SIZE,
        wavFile: '', // streaming only — no file output
      });
      console.warn('[mic] init ok, calling start');
      AudioRecord.start();
      isRecordingRef.current = true;
      console.warn('[mic] start returned, isRecording=true');
      return true;
    } catch (err) {
      console.warn('[mic] start failed', err);
      onError?.(err as Error);
      return false;
    }
  }, [onError, requestPermission]);

  const stop = useCallback(async (): Promise<void> => {
    if (!isRecordingRef.current) return;
    try {
      await AudioRecord.stop();
    } catch (err) {
      onError?.(err as Error);
    } finally {
      isRecordingRef.current = false;
    }
  }, [onError]);

  return {
    requestPermission,
    start,
    stop,
    isRecording: isRecordingRef.current,
    durationMs: 0, // not provided by the underlying module
  };
}

function base64ToArrayBuffer(base64: string): ArrayBuffer | null {
  try {
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
    return buffer;
  } catch {
    return null;
  }
}
