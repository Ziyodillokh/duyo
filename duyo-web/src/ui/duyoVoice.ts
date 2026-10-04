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
 * the loudness is created inside the first toggle, never before. The
 * element itself is made as soon as the file is known to exist, so the
 * recording is already loading when the visitor asks for it.
 */

import { DUYO_VOICE } from '../content';
import { siteRoot } from '../film';

export type VoiceStatus = 'checking' | 'unavailable' | 'ready' | 'playing';

export interface DuyoVoice {
  status: () => VoiceStatus;
  subscribe: (listener: () => void) => () => void;
  /** Play from the start, or stop if playing. Call from a user gesture. */
  toggle: () => void;
  stop: () => void;
  /** Loudness now, 0..1, for the mouth. 0 when not playing. */
  level: () => number;
  /** performance.now() when sound actually began; 0 while silent or still loading. */
  startedAt: () => number;
}

/**
 * RMS of a speaking voice sits around 0.05–0.3. A soft knee maps it onto
 * 0..1 — 0.05 → 0.26, 0.15 → 0.59, 0.3 → 0.83 — so syllables still read
 * as syllables instead of the mouth sitting wide open.
 */
const LEVEL_KNEE = 6;

/** Safari 16.4+: routed through Web Audio, sound would obey the silent switch. */
type WithAudioSession = Navigator & { audioSession?: { type: string } };

const isAudio = (r: Response) => r.ok && (r.headers.get('content-type') ?? '').startsWith('audio/');

/** HEAD first; hosts that refuse HEAD (405, 501) or drop it get a one-byte GET. */
async function exists(src: string): Promise<boolean> {
  try {
    const head = await fetch(src, { method: 'HEAD', cache: 'no-cache' });
    if (isAudio(head)) return true;
    if (head.status !== 405 && head.status !== 501) return false;
  } catch {
    // Fall through to the ranged GET.
  }
  try {
    return isAudio(await fetch(src, { headers: { Range: 'bytes=0-0' }, cache: 'no-cache' }));
  } catch {
    return false;
  }
}

/** `src` is asked for when first needed: by then the page has said where the site's top is (film.ts). */
function createDuyoVoice(src: () => string): DuyoVoice {
  let status: VoiceStatus = 'checking';
  let started = 0;
  /** Bumped on every play and stop, so a stale play() rejection cannot undo a newer state. */
  let attempt = 0;
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

  const stop = () => {
    attempt += 1;
    started = 0;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    if (status === 'playing') set('ready');
  };

  const element = () => {
    if (audio) return audio;
    const el = new Audio(src());
    el.preload = 'auto';
    el.addEventListener('ended', stop);
    // Sound truly started (not merely asked for): the wave and nod go with it.
    el.addEventListener('playing', () => {
      if (status === 'playing') started = performance.now();
    });
    el.addEventListener('error', () => {
      stop();
      set('unavailable');
    });
    audio = el;
    return el;
  };

  const probe = () => {
    if (probed) return;
    probed = true;
    void exists(src()).then((ok) => {
      if (ok) element();
      set(ok ? 'ready' : 'unavailable');
    });
  };

  const connect = (el: HTMLAudioElement) => {
    if (analyser) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const session = (navigator as WithAudioSession).audioSession;
    if (session) session.type = 'playback';
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

  const toggle = () => {
    if (status === 'playing') return stop();
    if (status !== 'ready') return;
    const el = element();
    connect(el);
    // Suspended before the first gesture, 'interrupted' after a call or a
    // trip to the background on iOS: either way, silent until resumed.
    const ctx = analyser?.context as AudioContext | undefined;
    if (ctx && ctx.state !== 'running') void ctx.resume();
    attempt += 1;
    const mine = attempt;
    started = 0;
    el.currentTime = 0;
    set('playing');
    el.play().catch(() => {
      if (mine !== attempt) return;
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
    stop,
    level,
    startedAt: () => started,
  };
}

export const duyoVoice = createDuyoVoice(() => siteRoot() + DUYO_VOICE.src);
