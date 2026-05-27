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
// Buffer ~1.5s of audio per WAV file to minimise inter-file gaps.
// At 24kHz mono PCM-16, 1.5s = 24000 × 1.5 × 2 = 72_000 bytes.
const FLUSH_BYTES = 72_000;
// Force-flush after this idle gap so the tail of a turn doesn't sit in the
// buffer waiting for more bytes that never come.
const FLUSH_IDLE_MS = 250;

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

  // Accumulator — incoming Gemini chunks pile up here until we've gathered
  // enough audio (or idle long enough) to be worth a single WAV write.
  const bufferRef = useRef<Uint8Array[]>([]);
  const bufferBytesRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ensurePlayer is defined below via useCallback after kick is created.

  // Lazy player creation — defer createAudioPlayer (which on Android grabs
  // audio focus and can prevent AudioRecord from capturing on Samsung One UI)
  // until the first response chunk actually needs to play.
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);

  const ensurePlayer = useCallback((): AudioPlayer | null => {
    if (playerRef.current) return playerRef.current;
    const player = createAudioPlayer(null);
    playerRef.current = player;
    subscriptionRef.current = player.addListener(
      'playbackStatusUpdate',
      (status: AudioStatus) => {
        if (status.didJustFinish) {
          playingFlagRef.current = false;
          kick();
        }
      },
    );
    return player;
  }, [kick]);

  useEffect(() => {
    return () => {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      const player = playerRef.current;
      if (player) {
        try {
          player.release();
        } catch {
          // ignore release errors at unmount
        }
        playerRef.current = null;
      }

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
  }, []);

  const writeBufferedWav = useCallback((): void => {
    if (bufferBytesRef.current === 0) return;
    try {
      const merged = new Uint8Array(bufferBytesRef.current);
      let offset = 0;
      for (const chunk of bufferRef.current) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      bufferRef.current = [];
      bufferBytesRef.current = 0;

      const wav = buildWavBuffer(merged.buffer, { sampleRate });
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
      // Drop the buffered audio; next chunks will resume the stream.
      bufferRef.current = [];
      bufferBytesRef.current = 0;
    }
  }, [kick, sampleRate]);

  const enqueueChunk = useCallback(
    (pcm: ArrayBuffer): void => {
      ensurePlayer();
      bufferRef.current.push(new Uint8Array(pcm));
      bufferBytesRef.current += pcm.byteLength;

      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }

      if (bufferBytesRef.current >= FLUSH_BYTES) {
        writeBufferedWav();
      } else {
        idleTimerRef.current = setTimeout(() => {
          idleTimerRef.current = null;
          writeBufferedWav();
        }, FLUSH_IDLE_MS);
      }
    },
    [ensurePlayer, writeBufferedWav],
  );

  const stop = useCallback((): void => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    bufferRef.current = [];
    bufferBytesRef.current = 0;

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
