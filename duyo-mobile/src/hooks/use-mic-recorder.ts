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
// (duyo-backend/src/duyo/api/v1/voice.py). bufferSize 1600 → 100ms chunks at
// 16kHz/16-bit/mono (1600 samples × 2 bytes = 3200 bytes/event).
const SAMPLE_RATE = 16_000;
const CHANNELS = 1 as const;
const BITS_PER_SAMPLE = 16 as const;
const BUFFER_SIZE = 1600;
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

      AudioRecord.init({
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
