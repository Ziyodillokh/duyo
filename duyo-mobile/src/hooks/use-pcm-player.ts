import {
  type AudioPlayer,
  type AudioStatus,
  createAudioPlayer,
} from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';

import { buildWavBuffer } from '@/lib/wav';

// Backend emits raw 24kHz mono PCM-16. We wrap each chunk in a WAV header,
// write it to the cache directory, and play files sequentially through a
// single AudioPlayer that we drive with replace() + play() on each
// playbackStatusUpdate. The 200–500ms gap between Gemini chunks is small
// enough that the queue stays drained.

const DEFAULT_SAMPLE_RATE = 24_000;
const TEMP_FILE_PREFIX = 'duyo-tts-';

interface UsePcmPlayerOptions {
  sampleRate?: number;
}

export interface UsePcmPlayerResult {
  enqueueChunk: (pcm: ArrayBuffer) => void;
  stop: () => void;
  isPlaying: boolean;
}

export function usePcmPlayer(
  options: UsePcmPlayerOptions = {},
): UsePcmPlayerResult {
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const [isPlaying, setIsPlaying] = useState(false);

  const playerRef = useRef<AudioPlayer | null>(null);
  const queueRef = useRef<string[]>([]);
  const playingFlagRef = useRef(false);
  const counterRef = useRef(0);
  const tempFilesRef = useRef<Set<File>>(new Set());

  const kick = useCallback(() => {
    const player = playerRef.current;
    if (!player || playingFlagRef.current) return;
    const next = queueRef.current.shift();
    if (!next) {
      setIsPlaying(false);
      return;
    }
    playingFlagRef.current = true;
    setIsPlaying(true);
    try {
      player.replace({ uri: next });
      player.play();
    } catch {
      playingFlagRef.current = false;
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    const player = createAudioPlayer(null);
    playerRef.current = player;

    const subscription = player.addListener(
      'playbackStatusUpdate',
      (status: AudioStatus) => {
        if (status.didJustFinish) {
          playingFlagRef.current = false;
          kick();
        }
      },
    );

    return () => {
      subscription.remove();
      try {
        player.release();
      } catch {
        // ignore release errors at unmount
      }
      playerRef.current = null;

      const files = Array.from(tempFilesRef.current);
      tempFilesRef.current.clear();
      for (const file of files) {
        try {
          file.delete();
        } catch {
          // best effort
        }
      }
    };
  }, [kick]);

  const enqueueChunk = useCallback(
    (pcm: ArrayBuffer): void => {
      try {
        const wav = buildWavBuffer(pcm, { sampleRate });
        const file = new File(
          Paths.cache,
          `${TEMP_FILE_PREFIX}${counterRef.current++}.wav`,
        );
        file.create();
        file.write(new Uint8Array(wav));
        tempFilesRef.current.add(file);
        queueRef.current.push(file.uri);
        kick();
      } catch {
        // Drop the chunk; next one will resume the stream.
      }
    },
    [kick, sampleRate],
  );

  const stop = useCallback((): void => {
    const player = playerRef.current;
    if (player) {
      try {
        player.pause();
      } catch {
        // ignore
      }
    }
    queueRef.current = [];
    playingFlagRef.current = false;
    setIsPlaying(false);

    const files = Array.from(tempFilesRef.current);
    tempFilesRef.current.clear();
    for (const file of files) {
      try {
        file.delete();
      } catch {
        // best effort
      }
    }
  }, []);

  return { enqueueChunk, stop, isPlaying };
}
