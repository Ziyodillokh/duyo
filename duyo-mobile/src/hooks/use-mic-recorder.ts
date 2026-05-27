import {
  ExpoAudioStreamModule,
  useAudioRecorder,
} from '@siteed/expo-audio-studio';
import { useCallback, useEffect, useRef } from 'react';

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

// Backend voice protocol requires 16kHz mono PCM 16-bit
// (duyo-backend/src/duyo/api/v1/voice.py). Buffer 50ms — iOS
// silently enforces a 100ms floor which is still acceptable.
const RECORDING_CONFIG = {
  sampleRate: 16_000 as const,
  channels: 1 as const,
  encoding: 'pcm_16bit' as const,
  bufferDurationSeconds: 0.05,
  output: { primary: { enabled: false } },
} as const;

export function useMicRecorder({
  onChunk,
  onError,
}: UseMicRecorderOptions): UseMicRecorderResult {
  const recorder = useAudioRecorder();

  // Keep the callback fresh without restarting the recorder.
  const onChunkRef = useRef(onChunk);
  onChunkRef.current = onChunk;

  const start = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await ExpoAudioStreamModule.requestPermissionsAsync();
      if (status !== 'granted') return false;

      await recorder.startRecording({
        ...RECORDING_CONFIG,
        onAudioStream: async (event) => {
          const buffer = normalizeChunk(event.data);
          if (buffer) onChunkRef.current(buffer);
        },
      });
      return true;
    } catch (err) {
      onError?.(err as Error);
      return false;
    }
  }, [recorder, onError]);

  const stop = useCallback(async (): Promise<void> => {
    try {
      await recorder.stopRecording();
    } catch (err) {
      onError?.(err as Error);
    }
  }, [recorder, onError]);

  // Best-effort cleanup so a forgotten recorder never keeps the mic hot
  // after the screen unmounts.
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;
  useEffect(() => {
    return () => {
      if (recorderRef.current.isRecording) {
        void recorderRef.current.stopRecording().catch(() => {
          // Ignore — module already torn down.
        });
      }
    };
  }, []);

  return {
    start,
    stop,
    isRecording: recorder.isRecording,
    durationMs: recorder.durationMs,
  };
}

function normalizeChunk(data: unknown): ArrayBuffer | null {
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data) && data.buffer instanceof ArrayBuffer) {
    return data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    );
  }
  if (typeof data === 'string') {
    return base64ToArrayBuffer(data);
  }
  return null;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer | null {
  try {
    // RN provides atob() globally (Hermes).
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
    return buffer;
  } catch {
    return null;
  }
}
