import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Recording a chat voice/video note.
 *
 * This is NOT the same job as `use-mic-recorder`, and the two must not be
 * merged: that hook streams raw 16 kHz PCM chunks to the live AI session and
 * never produces a file, and it is native-only by design. A chat note is the
 * opposite shape — one finished FILE, recorded on whatever platform the child
 * is using, uploaded once.
 *
 * Web is the platform that matters most here: the app is developed and
 * reviewed in a desktop browser, and children reach it over the LAN from a
 * phone browser. So the web path is the primary implementation, via
 * MediaRecorder, and native uses Expo's own recorders.
 */

export type NoteKind = 'audio' | 'video';

export interface MediaNote {
  /** Something playable right now: `blob:` on web, `file://` on native. */
  uri: string;
  /** Present on web only — what actually gets uploaded. */
  blob?: Blob;
  mimeType: string;
  durationMs: number;
}

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'error';

export interface MediaNoteRecorder {
  state: RecorderState;
  kind: NoteKind | null;
  durationMs: number;
  error: string | null;
  /** The live camera feed, so a video note can show a viewfinder (web only). */
  stream: MediaStream | null;
  start: (kind: NoteKind) => Promise<boolean>;
  /** Stops and returns the finished note, or null if nothing was captured. */
  stop: () => Promise<MediaNote | null>;
  /** Throws the recording away — the child changed their mind. */
  cancel: () => void;
}

/** Telegram caps a voice note far longer than this; a child's room does not
 *  need to carry five-minute monologues, and a short cap keeps uploads small
 *  and moderation cheap. */
export const MAX_AUDIO_MS = 60_000;
export const MAX_VIDEO_MS = 30_000;

const IS_WEB = Platform.OS === 'web';

/**
 * Chrome and Firefox disagree about containers, and Safari supports almost
 * none of this. Ask for the first type the browser admits to knowing rather
 * than hard-coding one and getting silent empty blobs.
 */
function pickMimeType(kind: NoteKind): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates =
    kind === 'audio'
      ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
      : ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

/** The browser hands out no camera or microphone outside a secure context.
 *  `localhost` counts as secure; `http://10.x.x.x:8083` on a phone does NOT,
 *  which is exactly how this app is opened on a phone over the LAN. Saying so
 *  plainly beats a bare "permission denied" the child cannot act on. */
function webBlocker(): string | null {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      return "Brauzer mikrofonni faqat himoyalangan ulanishda (https yoki localhost) beradi. Telefonda ochish uchun tunnel kerak.";
    }
    return 'Bu brauzer ovoz yozishni qo\'llab-quvvatlamaydi.';
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return "Brauzer mikrofonni faqat himoyalangan ulanishda (https yoki localhost) beradi. Telefonda ochish uchun tunnel kerak.";
  }
  return null;
}

export function useMediaNote(): MediaNoteRecorder {
  const [state, setState] = useState<RecorderState>('idle');
  const [kind, setKind] = useState<NoteKind | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  // A recording still holding the camera when the screen goes away would keep
  // the phone's privacy light on. Tear everything down on unmount.
  useEffect(
    () => () => {
      clearTick();
      try {
        recorderRef.current?.state === 'recording' && recorderRef.current.stop();
      } catch {
        // Already torn down.
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [clearTick],
  );

  const start = useCallback(
    async (nextKind: NoteKind): Promise<boolean> => {
      setError(null);
      cancelledRef.current = false;

      if (!IS_WEB) {
        setError("Ovozli xabar hozircha brauzerda ishlaydi — mobil ilovada tez orada.");
        setState('error');
        return false;
      }

      const blocker = webBlocker();
      if (blocker) {
        setError(blocker);
        setState('error');
        return false;
      }

      setState('requesting');
      setKind(nextKind);
      try {
        const media = await navigator.mediaDevices.getUserMedia(
          nextKind === 'audio'
            ? { audio: true }
            : {
                audio: true,
                // Square and small: the bubble shows it as a circle, and a
                // 480×480 clip keeps a 30-second note within a few megabytes.
                video: { facingMode: 'user', width: 480, height: 480 },
              },
        );
        streamRef.current = media;
        setStream(media);

        const mimeType = pickMimeType(nextKind);
        const rec = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
        chunksRef.current = [];
        rec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorderRef.current = rec;
        rec.start();

        startedAtRef.current = Date.now();
        setDurationMs(0);
        setState('recording');
        clearTick();
        tickRef.current = setInterval(() => {
          setDurationMs(Date.now() - startedAtRef.current);
        }, 100);
        return true;
      } catch (err) {
        releaseStream();
        const name = (err as { name?: string })?.name;
        setError(
          name === 'NotAllowedError'
            ? "Mikrofonga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering."
            : name === 'NotFoundError'
              ? "Mikrofon yoki kamera topilmadi."
              : "Yozib bo'lmadi. Qaytadan urinib ko'ring.",
        );
        setState('error');
        return false;
      }
    },
    [clearTick, releaseStream],
  );

  const stop = useCallback(async (): Promise<MediaNote | null> => {
    clearTick();
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') {
      setState('idle');
      releaseStream();
      return null;
    }

    const elapsed = Date.now() - startedAtRef.current;
    const mimeType = rec.mimeType || pickMimeType(kind ?? 'audio') || 'audio/webm';

    const blob = await new Promise<Blob | null>((resolve) => {
      rec.onstop = () => {
        if (cancelledRef.current || chunksRef.current.length === 0) {
          resolve(null);
          return;
        }
        resolve(new Blob(chunksRef.current, { type: mimeType }));
      };
      try {
        rec.stop();
      } catch {
        resolve(null);
      }
    });

    recorderRef.current = null;
    chunksRef.current = [];
    releaseStream();
    setState('idle');
    setDurationMs(0);

    if (!blob || blob.size === 0) return null;
    return {
      uri: URL.createObjectURL(blob),
      blob,
      mimeType,
      durationMs: elapsed,
    };
  }, [clearTick, kind, releaseStream]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    clearTick();
    try {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    } catch {
      // Nothing to stop.
    }
    recorderRef.current = null;
    chunksRef.current = [];
    releaseStream();
    setState('idle');
    setKind(null);
    setDurationMs(0);
  }, [clearTick, releaseStream]);

  return { state, kind, durationMs, error, stream, start, stop, cancel };
}
