import { Pause, Play } from 'lucide-react-native';
import { createElement, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { apiClient } from '@/api/client';

/**
 * Playing a voice or video note.
 *
 * The clip is NOT handed to the player as a URL. Its route is authenticated
 * and membership-checked — deliberately, because it serves a child's voice or
 * face — and neither an <audio src> nor a video player can attach a bearer
 * token. So the bytes are fetched through the API client, which does attach
 * one, and played from a local object URL instead.
 *
 * That costs streaming, which the note sizes make affordable: the server caps
 * a voice note at 4 MB and a video note at 12 MB.
 *
 * The media element is held in STATE rather than a ref. A ref read during
 * render is exactly what the React Compiler forbids, and the element arriving
 * is a real state change here — the effects that start playback depend on it.
 */

const PRIMARY = '#2F6FE4';
const MUTED = '#8CA3CB';

/**
 * Take the server's absolute media URL back down to a path.
 *
 * The server builds the URL from its own `public_base_url`, which in local
 * development is not the host the app is talking to — the phone reaches the
 * API over the LAN while the backend still calls itself localhost. Sending the
 * request through apiClient's own baseURL keeps the token, the origin and the
 * request on the host the app actually reached, whatever the server thinks it
 * is called.
 */
function toApiPath(url: string): string {
  const at = url.indexOf('/v1/');
  return at === -1 ? url : url.slice(at + 3);
}

/** Fetch an authenticated media URL and expose it as something playable. */
function useAuthedMedia(url: string | null | undefined) {
  const [local, setLocal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!url || local || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await apiClient.get<Blob>(toApiPath(url), {
        responseType: 'blob',
      });
      setLocal(URL.createObjectURL(res.data));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [url, local, loading]);

  // An object URL is a document-lifetime reference; without this every played
  // note would stay in memory until the tab closed.
  useEffect(
    () => () => {
      if (local) URL.revokeObjectURL(local);
    },
    [local],
  );

  return { local, loading, failed, load };
}

function clock(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

interface NoteProps {
  url: string | null | undefined;
  durationMs: number | null | undefined;
  mine: boolean;
}

/**
 * A voice note: play button, a bar that fills as it plays, and the duration.
 *
 * The bar is drawn from the elapsed fraction rather than from real samples —
 * decoding a waveform client-side to draw forty bars costs more than the
 * honesty is worth, and a progress bar makes no claim about the audio it is
 * not entitled to make.
 */
export function AudioNote({ url, durationMs, mine }: NoteProps) {
  const { local, loading, failed, load } = useAuthedMedia(url);
  const [el, setEl] = useState<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const total = durationMs ?? 0;
  const tint = mine ? '#FFFFFF' : PRIMARY;
  const track = mine ? 'rgba(255,255,255,0.35)' : 'rgba(47,111,228,0.20)';

  // Play as soon as the fetch lands, so one tap plays rather than two.
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

  const pct = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0;

  return (
    <View style={styles.audioRow}>
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
          <ActivityIndicator size="small" color={tint} />
        ) : playing ? (
          <Pause size={16} color={tint} strokeWidth={2.4} />
        ) : (
          <Play size={16} color={tint} strokeWidth={2.4} />
        )}
      </Pressable>

      <View style={styles.audioMeta}>
        <View style={[styles.track, { backgroundColor: track }]}>
          <View style={[styles.fill, { width: `${pct}%`, backgroundColor: tint }]} />
        </View>
        <Text style={[styles.duration, { color: mine ? 'rgba(255,255,255,0.9)' : MUTED }]}>
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

/** A video note: Telegram's round clip, tapped to play. A round clip looks the
 *  same whoever sent it, so this one ignores `mine`. */
export function VideoNote({ url, durationMs }: NoteProps) {
  const { local, loading, failed, load } = useAuthedMedia(url);
  const [el, setEl] = useState<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!el || !local) return;
    void el.play().catch(() => {
      // Autoplay refused; the overlay button still works.
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

  return (
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
            onPlay: () => setPlaying(true),
            onPause: () => setPlaying(false),
            onEnded: () => setPlaying(false),
            style: { width: '100%', height: '100%', objectFit: 'cover' },
          })
        : null}

      {!playing && (
        <View style={styles.roundOverlay}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Play size={22} color="#FFFFFF" strokeWidth={2.4} />
          )}
        </View>
      )}

      <View style={styles.roundBadge}>
        <Text style={styles.roundBadgeText}>
          {failed ? 'Ochilmadi' : clock(durationMs ?? 0)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 176 },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioMeta: { flex: 1, gap: 5 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  duration: { fontSize: 11.5, fontVariant: ['tabular-nums'] },

  round: {
    width: 176,
    height: 176,
    borderRadius: 88,
    overflow: 'hidden',
    backgroundColor: '#0B1B36',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,27,54,0.35)',
  },
  roundBadge: {
    position: 'absolute',
    bottom: 12,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(11,27,54,0.55)',
  },
  roundBadgeText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
