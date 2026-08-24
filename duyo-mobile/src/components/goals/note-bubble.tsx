import { Check, Pause, Play, Volume2, VolumeX } from 'lucide-react-native';
import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Text } from '@/components/text';
import { apiClient } from '@/api/client';

/**
 * Playing a voice or video note, with Telegram's anatomy.
 *
 * The two are NOT the same object and must not be dressed the same way:
 *
 * - A voice note lives in a bubble: play button, waveform, duration.
 * - A round video note has NO bubble at all. It is a bare circle on the
 *   wallpaper with the clock and tick laid over its lower edge. Wrapping it
 *   in a bubble — which is what this did first — is the single thing that
 *   makes a chat stop looking like Telegram.
 *
 * The clip is not handed to the player as a URL. Its route is authenticated
 * and membership-checked — deliberately, because it serves a child's voice or
 * face — and no media element can attach a bearer token. So the bytes are
 * fetched through the API client, which does, and played from a local object
 * URL. That costs streaming, which the note caps make affordable: 4 MB for a
 * voice note, 12 MB for a video one.
 *
 * The media element is held in STATE rather than a ref: a ref read during
 * render is what the React Compiler forbids, and the element arriving is a
 * real state change here — the effects that start playback depend on it.
 */

const PRIMARY = '#2F6FE4';
const MUTED = '#8CA3CB';

/** Telegram's round video is about half the screen wide. */
const ROUND = 196;

/**
 * Take the server's absolute media URL back down to a path.
 *
 * The server builds it from its own `public_base_url`, which in development is
 * not the host the app is talking to — the phone reaches the API over the LAN
 * while the backend still calls itself localhost. Going through apiClient's
 * baseURL keeps the token, the origin and the request on the host the app
 * actually reached, whatever the server thinks it is called.
 */
function toApiPath(url: string): string {
  const at = url.indexOf('/v1/');
  return at === -1 ? url : url.slice(at + 3);
}

function useAuthedMedia(url: string | null | undefined) {
  const [local, setLocal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!url || local || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await apiClient.get<Blob>(toApiPath(url), { responseType: 'blob' });
      setLocal(URL.createObjectURL(res.data));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [url, local, loading]);

  // An object URL is a document-lifetime reference; without this every played
  // note would sit in memory until the tab closed.
  useEffect(
    () => () => {
      if (local) URL.revokeObjectURL(local);
    },
    [local],
  );

  return { local, loading, failed, load };
}

function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

interface NoteProps {
  url: string | null | undefined;
  durationMs: number | null | undefined;
  mine: boolean;
  /** Stable per message, so a note's waveform never reshuffles on re-render. */
  seed?: string;
  /** "20:45" — drawn inside the note, because a round video has no bubble to
   *  put it in. */
  time?: string;
}

/* ── Voice ─────────────────────────────────────────────────────────────── */

const BARS = 34;

/**
 * A waveform, not a progress bar.
 *
 * The heights are derived from the message id rather than decoded from the
 * audio: decoding every clip to draw thirty-four bars costs far more than the
 * accuracy is worth, and a shape that is stable per message reads as "this
 * particular note" — which is the only job the waveform actually does.
 */
function useBars(seed: string): number[] {
  return useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const out: number[] = [];
    for (let i = 0; i < BARS; i++) {
      h = (Math.imul(h ^ (i + 1), 0x9e3779b1) >>> 0) || 1;
      // 0.25..1 — never a flat line, never a full-height wall.
      out.push(0.25 + ((h >>> 8) % 76) / 100);
    }
    return out;
  }, [seed]);
}

export function AudioNote({ url, durationMs, mine, seed = 'x' }: NoteProps) {
  const { local, loading, failed, load } = useAuthedMedia(url);
  const [el, setEl] = useState<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const bars = useBars(seed);

  const total = durationMs ?? 0;
  const ink = mine ? '#FFFFFF' : PRIMARY;
  const dim = mine ? 'rgba(255,255,255,0.42)' : 'rgba(47,111,228,0.28)';

  useEffect(() => {
    if (!el || !local) return;
    void el.play().catch(() => {
      // A browser that refuses autoplay leaves the button working.
    });
  }, [el, local]);

  const toggle = async () => {
    if (!local) {
      await load();
      return;
    }
    if (!el) return;
    if (playing) el.pause();
    else void el.play().catch(() => setPlaying(false));
  };

  const done = total > 0 ? Math.min(1, elapsed / total) : 0;

  return (
    <View style={styles.voiceRow}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={playing ? "To'xtatish" : 'Tinglash'}
        style={[
          styles.playBtn,
          { backgroundColor: mine ? 'rgba(255,255,255,0.22)' : 'rgba(47,111,228,0.12)' },
          styles.focusable,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={ink} />
        ) : playing ? (
          <Pause size={17} color={ink} strokeWidth={2.4} />
        ) : (
          <Play size={17} color={ink} strokeWidth={2.4} />
        )}
      </Pressable>

      <View style={styles.voiceBody}>
        <View style={styles.wave}>
          {bars.map((v, i) => (
            <View
              key={i}
              style={{
                width: 2.5,
                height: Math.round(20 * v),
                borderRadius: 1.5,
                // Bars behind the playhead are lit; the rest stay dim.
                backgroundColor: i / BARS <= done ? ink : dim,
              }}
            />
          ))}
        </View>
        <Text style={[styles.voiceTime, { color: mine ? 'rgba(255,255,255,0.85)' : MUTED }]}>
          {failed ? 'Ochilmadi' : clock(elapsed > 0 ? elapsed : total)}
        </Text>
      </View>

      {Platform.OS === 'web' &&
        local &&
        createElement('audio', {
          ref: setEl,
          src: local,
          preload: 'auto',
          onPlay: () => setPlaying(true),
          onPause: () => setPlaying(false),
          onEnded: () => {
            setPlaying(false);
            setElapsed(0);
          },
          onTimeUpdate: (e: { currentTarget: HTMLAudioElement }) =>
            setElapsed(e.currentTarget.currentTime * 1000),
          style: { display: 'none' },
        })}
    </View>
  );
}

/* ── Round video ───────────────────────────────────────────────────────── */

/**
 * Telegram's round video message: a bare circle, no bubble.
 *
 * Muted on first play, like Telegram — a clip that starts talking on its own
 * in a quiet room is the reason that default exists. The ring around the rim
 * is the progress, and the clock sits on the lower edge because there is no
 * bubble to carry it.
 */
export function VideoNote({ url, durationMs, mine, time }: NoteProps) {
  const { local, loading, failed, load } = useAuthedMedia(url);
  const [el, setEl] = useState<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  const total = durationMs ?? 0;

  useEffect(() => {
    if (!el || !local) return;
    void el.play().catch(() => {
      // Autoplay refused; the overlay play button still works.
    });
  }, [el, local]);

  const toggle = async () => {
    if (!local) {
      await load();
      return;
    }
    if (!el) return;
    if (playing) el.pause();
    else void el.play().catch(() => setPlaying(false));
  };

  const r = ROUND / 2 - 2;
  const circumference = 2 * Math.PI * r;
  const done = total > 0 ? Math.min(1, elapsed / total) : 0;
  const left = total > 0 ? total - elapsed : 0;

  return (
    <View style={styles.roundWrap}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel="Video xabar"
        style={[styles.round, styles.focusable]}
      >
        {Platform.OS === 'web' && local
          ? createElement('video', {
              ref: setEl,
              src: local,
              playsInline: true,
              muted,
              onPlay: () => setPlaying(true),
              onPause: () => setPlaying(false),
              onEnded: () => {
                setPlaying(false);
                setElapsed(0);
              },
              onTimeUpdate: (e: { currentTarget: HTMLVideoElement }) =>
                setElapsed(e.currentTarget.currentTime * 1000),
              style: { width: '100%', height: '100%', objectFit: 'cover' },
            })
          : null}

        {!playing && (
          <View style={styles.roundVeil}>
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Play size={26} color="#FFFFFF" strokeWidth={2.4} />
            )}
          </View>
        )}
      </Pressable>

      {/* The progress ring, outside the Pressable so it never eats a tap. */}
      {playing && (
        <View style={styles.ring} pointerEvents="none">
          <Svg width={ROUND} height={ROUND}>
            <Circle
              cx={ROUND / 2}
              cy={ROUND / 2}
              r={r}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={3}
              fill="none"
            />
            <Circle
              cx={ROUND / 2}
              cy={ROUND / 2}
              r={r}
              stroke="#FFFFFF"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={circumference * (1 - done)}
              // Start the sweep at twelve o'clock rather than three.
              transform={`rotate(-90 ${ROUND / 2} ${ROUND / 2})`}
            />
          </Svg>
        </View>
      )}

      {/* Mute toggle, the way Telegram puts it on the rim. */}
      {playing && (
        <Pressable
          // State only — the `muted` prop below is what actually mutes the
          // element, so touching el.muted here would be a second source of
          // truth (and a write to a value React owns).
          onPress={() => setMuted((m) => !m)}
          accessibilityRole="button"
          accessibilityLabel={muted ? 'Ovozni yoqish' : "Ovozni o'chirish"}
          style={[styles.mute, styles.focusable]}
        >
          {muted ? (
            <VolumeX size={14} color="#FFFFFF" strokeWidth={2.2} />
          ) : (
            <Volume2 size={14} color="#FFFFFF" strokeWidth={2.2} />
          )}
        </Pressable>
      )}

      {/* Clock + tick on the lower edge — a round video has no bubble. */}
      <View style={styles.roundMeta} pointerEvents="none">
        <Text style={styles.roundMetaText}>
          {failed ? 'Ochilmadi' : playing ? clock(left) : clock(total)}
        </Text>
        {time ? <Text style={styles.roundMetaText}>{time}</Text> : null}
        {mine && <Check size={12} color="rgba(255,255,255,0.9)" strokeWidth={3} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 190 },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceBody: { flex: 1, gap: 3 },
  wave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 20,
  },
  voiceTime: { fontSize: 11.5, fontVariant: ['tabular-nums'] },

  roundWrap: { width: ROUND, height: ROUND },
  round: {
    width: ROUND,
    height: ROUND,
    borderRadius: ROUND / 2,
    overflow: 'hidden',
    backgroundColor: '#0B1B36',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundVeil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,27,54,0.32)',
  },
  ring: { position: 'absolute', top: 0, left: 0 },
  mute: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,27,54,0.55)',
  },
  roundMeta: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 11,
    backgroundColor: 'rgba(11,27,54,0.55)',
  },
  roundMetaText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
