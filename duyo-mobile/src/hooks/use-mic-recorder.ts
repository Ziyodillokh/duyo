import AudioRecord from '@fugood/react-native-audio-pcm-stream';
import { useCallback, useEffect, useRef } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

interface UseMicRecorderOptions {
  onChunk: (pcm: ArrayBuffer) => void;
  onError?: (error: Error) => void;
}

interface UseMicRecorderResult {
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
const ANDROID_AUDIO_SOURCE_VOICE_RECOGNITION = 6;

export function useMicRecorder({
  onChunk,
  onError,
}: UseMicRecorderOptions): UseMicRecorderResult {
  const onChunkRef = useRef(onChunk);
  onChunkRef.current = onChunk;
  const isRecordingRef = useRef(false);

  // Subscribe once on mount; AudioRecord.on internally replaces the listener
  // so re-binding with stale refs is unnecessary.
  useEffect(() => {
    AudioRecord.on('data', (base64) => {
      const buffer = base64ToArrayBuffer(base64);
      if (buffer) onChunkRef.current(buffer);
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

  const start = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) return false;
      }

      // init internally constructs the native AudioRecord. Must be awaited
      // — without await the JS wrapper resolves immediately while `recorder`
      // is still null, and start() bails out without recording anything.
      await AudioRecord.init({
        sampleRate: SAMPLE_RATE,
        channels: CHANNELS,
        bitsPerSample: BITS_PER_SAMPLE,
        audioSource: ANDROID_AUDIO_SOURCE_VOICE_RECOGNITION,
        bufferSize: BUFFER_SIZE,
        wavFile: '', // streaming only — no file output
      });
      AudioRecord.start();
      isRecordingRef.current = true;
      return true;
    } catch (err) {
      onError?.(err as Error);
      return false;
    }
  }, [onError]);

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
