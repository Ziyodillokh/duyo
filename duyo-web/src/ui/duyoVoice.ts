/**
 * DUYO's voice: the owner's recording of DUYO introducing itself.
 *
 * One store, two readers. The page's listen button subscribes to its status;
 * the 3D runtime reads its loudness every frame to move DUYO's mouth, and
 * toggles it when DUYO itself is clicked. Nothing here renders.
 *
 * The file may not exist yet (the owner uploads it). A dev server and most
 * static hosts answer a missing file with the site's index.html and a 200,
 * so "is it there" means "does it answer with an audio type" — until then
 * the status is 'unavailable' and no control is shown.
 *
 * Sound can only start from a gesture, so the AudioContext that measures
 * the loudness is created inside the first toggle, never before.
 */

import { DUYO_VOICE } from '../content';

export type VoiceStatus = 'checking' | 'unavailable' | 'ready' | 'playing';

export interface DuyoVoice {
  status: () => VoiceStatus;
  subscribe: (listener: () => void) => () => void;
  /** Play from the start, or stop if playing. Call from a user gesture. */
  toggle: () => void;
  /** Loudness now, 0..1, for the mouth. 0 when not playing. */
  level: () => number;
  /** performance.now() when the current playback began; 0 when idle. */
  startedAt: () => number;
}

/**
 * RMS of a speaking voice sits around 0.05–0.3. A soft knee maps it onto
 * 0..1 — 0.05 → 0.26, 0.15 → 0.59, 0.3 → 0.83 — so syllables still read
 * as syllables instead of the mouth sitting wide open.
 */
const LEVEL_KNEE = 6;

function createDuyoVoice(src: string): DuyoVoice {
  let status: VoiceStatus = 'checking';
  let started = 0;
  const listeners = new Set<() => void>();
  const set = (next: VoiceStatus) => {
    if (next === status) return;
    status = next;
    listeners.forEach((l) => l());
  };

  let audio: HTMLAudioElement | null = null;
  let analyser: AnalyserNode | null = null;
  let samples: Uint8Array<ArrayBuffer> | null = null;
  let probed = false;

  const probe = () => {
    if (probed) return;
    probed = true;
    fetch(src, { method: 'HEAD', cache: 'no-cache' })
      .then((r) => set(r.ok && (r.headers.get('content-type') ?? '').startsWith('audio/') ? 'ready' : 'unavailable'))
      .catch(() => set('unavailable'));
  };

  const connect = (el: HTMLAudioElement) => {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    try {
      const ctx = new Ctx();
      const node = ctx.createAnalyser();
      node.fftSize = 512;
      ctx.createMediaElementSource(el).connect(node);
      node.connect(ctx.destination);
      analyser = node;
      samples = new Uint8Array(new ArrayBuffer(node.fftSize));
    } catch {
      // Without analysis the voice still plays; the mouth just stays still.
      analyser = null;
    }
  };

  const stop = () => {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    started = 0;
    set('ready');
  };

  const toggle = () => {
    if (status === 'playing') return stop();
    if (status !== 'ready') return;
    if (!audio) {
      audio = new Audio(src);
      audio.preload = 'auto';
      audio.addEventListener('ended', stop);
      audio.addEventListener('error', () => {
        started = 0;
        set('unavailable');
      });
      connect(audio);
    }
    const ctx = analyser?.context;
    if (ctx && ctx.state === 'suspended') void (ctx as AudioContext).resume();
    audio.currentTime = 0;
    started = performance.now();
    set('playing');
    audio.play().catch(() => {
      started = 0;
      set('ready');
    });
  };

  const level = () => {
    if (status !== 'playing' || !analyser || !samples) return 0;
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (let i = 0; i < samples.length; i += 1) {
      const v = (samples[i] - 128) / 128;
      sum += v * v;
    }
    return 1 - Math.exp(-Math.sqrt(sum / samples.length) * LEVEL_KNEE);
  };

  return {
    status: () => status,
    subscribe: (listener) => {
      probe();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    toggle,
    level,
    startedAt: () => started,
  };
}

export const duyoVoice = createDuyoVoice(DUYO_VOICE.src);
