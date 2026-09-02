import { Mic, Paperclip, Send, Smile, Trash2, Video } from 'lucide-react-native';
import { createElement, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { EmojiPicker } from '@/components/goals/emoji-picker';
import { Text, TextInput } from '@/components/text';
import { useT } from '@/i18n';

import {
  MAX_AUDIO_MS,
  MAX_VIDEO_MS,
  useMediaNote,
  type MediaNote,
  type NoteKind,
} from '@/hooks/use-media-note';

/**
 * The chat composer.
 *
 * Three shapes, one row height. At rest it is a text pill with a round button
 * beside it; while recording the pill is replaced by a recording strip; while
 * a note uploads the button holds a spinner.
 *
 * On the two round buttons at rest: Telegram hides video behind a tap that
 * toggles the mic icon, and records on a press-and-hold. Both gestures are
 * invisible, and this app's readers are seven-year-olds — so the choice is
 * shown instead of hidden. Empty draft shows a camera AND a microphone; typing
 * collapses them into one send button, which is where the space comes from.
 */

const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#93A9C9';
const REC = '#E0455E';

/** The composer's one height — the pill and the round buttons all share it, so
 *  the row reads as a single control rather than a tall box beside a dot. */
export const COMPOSER_H = 40;

/** The round-video viewfinder. Matches the circle a note is played back in,
 *  so what a child frames is what the room sees. */
const VIEWFINDER = 196;

interface Props {
  draft: string;
  onChangeDraft: (v: string) => void;
  onSendText: () => void;
  sending: boolean;
  /** Hand the finished clip to the caller, which uploads it. */
  onSendNote: (note: MediaNote) => void | Promise<void>;
  uploading?: boolean;
  onNotice: (message: string) => void;
}

function clock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function ChatComposer({
  draft,
  onChangeDraft,
  onSendText,
  sending,
  onSendNote,
  uploading = false,
  onNotice,
}: Props) {
  const t = useT();
  const rec = useMediaNote();
  const [emojiOpen, setEmojiOpen] = useState(false);
  const hasText = draft.trim().length > 0;
  const recording = rec.state === 'recording';
  const limit = rec.kind === 'video' ? MAX_VIDEO_MS : MAX_AUDIO_MS;

  // A recorder the child forgets about would grow until the upload is refused;
  // stopping AT the cap gives them a finished note instead of an error.
  useEffect(() => {
    if (!recording || rec.durationMs < limit) return;
    void (async () => {
      const note = await rec.stop();
      if (note) await onSendNote(note);
    })();
  }, [recording, rec, rec.durationMs, limit, onSendNote]);

  // The recorder reports refusals (no permission, insecure origin) that the
  // child needs to see; the screen owns that banner.
  useEffect(() => {
    if (rec.error) onNotice(rec.error);
  }, [rec.error, onNotice]);

  const begin = async (kind: NoteKind) => {
    await rec.start(kind);
  };

  const finish = async () => {
    const note = await rec.stop();
    if (!note) {
      onNotice(t('composer.nothingRecorded'));
      return;
    }
    await onSendNote(note);
  };

  return (
    <View>
      {/* The emoji panel sits above the composer and closes while recording —
          a viewfinder and a keyboard fighting for the same screen helps
          nobody. */}
      {emojiOpen && !recording && (
        <EmojiPicker
          onPick={(e) => onChangeDraft(draft + e)}
          onClose={() => setEmojiOpen(false)}
        />
      )}

      {recording && rec.kind === 'video' && (
        <Viewfinder
          stream={rec.stream}
          progress={Math.min(1, rec.durationMs / MAX_VIDEO_MS)}
          left={Math.max(0, MAX_VIDEO_MS - rec.durationMs)}
        />
      )}

      <View style={styles.row}>
        {recording ? (
          <View style={styles.recPill}>
            <RecDot />
            <Text style={styles.recTime}>{clock(rec.durationMs)}</Text>
            <Text style={styles.recHint} numberOfLines={1}>
              {rec.kind === 'video'
                ? t('composer.recVideo')
                : t('composer.recAudio')}
            </Text>
            <Pressable
              onPress={rec.cancel}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              hitSlop={8}
              style={styles.focusable}
            >
              <Trash2 size={18} color={REC} strokeWidth={2} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.pill}>
            <Pressable
              onPress={() => setEmojiOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={t('composer.a11yEmoji')}
              // A real touch target, not just the glyph. The icon is 19px, and
              // a 19px target is far below what a seven-year-old's finger can
              // reliably hit — `hitSlop` does not help here, because on web it
              // does not enlarge the element that actually receives the click.
              style={[styles.iconHit, styles.focusable]}
            >
              <Smile
                size={19}
                color={emojiOpen ? PRIMARY : MUTED}
                strokeWidth={1.9}
              />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={onChangeDraft}
              placeholder={t('common.messagePlaceholder')}
              placeholderTextColor={MUTED}
              style={[styles.input, styles.focusableText]}
              maxLength={500}
              multiline
              // Without this the web renderer emits `rows=2` and the pill is
              // 58pt tall before a single character is typed — the exact
              // bloat the 40pt composer exists to remove. It still grows to
              // `maxHeight` as the text wraps.
              numberOfLines={1}
              editable={!uploading}
              accessibilityLabel={t('groups.a11y.message')}
            />
            <Pressable
              onPress={() => onNotice(t('composer.attachSoon'))}
              accessibilityRole="button"
              accessibilityLabel={t('composer.attach')}
              style={[styles.iconHit, styles.focusable]}
            >
              <Paperclip size={18} color={MUTED} strokeWidth={1.9} />
            </Pressable>
          </View>
        )}

        {uploading ? (
          <View style={[styles.round, styles.roundOn]}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        ) : recording ? (
          <Pressable
            onPress={finish}
            accessibilityRole="button"
            accessibilityLabel={t('composer.sendRecording')}
            style={[styles.round, styles.roundOn, styles.focusable]}
          >
            <Send size={18} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
        ) : hasText ? (
          <Pressable
            onPress={onSendText}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel={t('common.send')}
            style={[
              styles.round,
              styles.roundOn,
              styles.focusable,
              sending && styles.roundIdle,
            ]}
          >
            <Send size={18} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
        ) : (
          <>
            <Pressable
              onPress={() => begin('video')}
              accessibilityRole="button"
              accessibilityLabel={t('composer.a11yVideo')}
              style={[styles.round, styles.roundSoft, styles.focusable]}
            >
              <Video size={18} color={PRIMARY} strokeWidth={2} />
            </Pressable>
            <Pressable
              onPress={() => begin('audio')}
              accessibilityRole="button"
              accessibilityLabel={t('composer.a11yAudio')}
              style={[styles.round, styles.roundOn, styles.focusable]}
            >
              <Mic size={18} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

/** A blinking dot, the universal "this is live" mark. */
function RecDot() {
  return <View style={styles.dot} />;
}

/**
 * The live camera feed while a video note records.
 *
 * react-native-web renders to the DOM, so a raw <video> element is legal here
 * and is the only way to show a MediaStream — expo-video plays a URL, not a
 * live stream. Native has no MediaStream at all, so this renders nothing there.
 */
function Viewfinder({
  stream,
  progress,
  left,
}: {
  stream: MediaStream | null;
  /** 0..1 of the way to the cap — drives the ring, like Telegram's. */
  progress: number;
  /** Milliseconds of recording still allowed. */
  left: number;
}) {
  /**
   * A callback ref, not a ref object and not state: a live stream has to be
   * ATTACHED to the element (`srcObject` takes no URL), and doing that in an
   * effect would mean mutating a value React owns. Attaching inside the ref
   * callback is the one place the element is legitimately ours to touch.
   * React re-runs it whenever `stream` changes, because the identity does.
   */
  const attach = useCallback(
    (node: HTMLVideoElement | null) => {
      if (!node || !stream) return;
      node.srcObject = stream;
      void node.play?.().catch(() => {
        // Autoplay of a muted local preview is normally allowed; if the
        // browser refuses, the recording itself is unaffected.
      });
    },
    [stream],
  );

  if (Platform.OS !== 'web' || !stream) return null;

  const r = VIEWFINDER / 2 - 3;
  const circumference = 2 * Math.PI * r;

  return (
    <View style={styles.viewfinderWrap}>
      <View style={styles.viewfinderHost}>
        <View style={styles.viewfinder}>
          {createElement('video', {
            ref: attach,
            autoPlay: true,
            muted: true,
            playsInline: true,
            // Mirrored, because a child expects to see themselves as in a mirror.
            style: {
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)',
            },
          })}
        </View>

        {/* The rim fills as the cap approaches — Telegram's countdown, and the
            only warning a child gets that the clip is about to stop itself. */}
        <View style={styles.viewfinderRing} pointerEvents="none">
          <Svg width={VIEWFINDER} height={VIEWFINDER}>
            <Circle
              cx={VIEWFINDER / 2}
              cy={VIEWFINDER / 2}
              r={r}
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={4}
              fill="none"
            />
            <Circle
              cx={VIEWFINDER / 2}
              cy={VIEWFINDER / 2}
              r={r}
              stroke={REC}
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={circumference * (1 - progress)}
              transform={`rotate(-90 ${VIEWFINDER / 2} ${VIEWFINDER / 2})`}
            />
          </Svg>
        </View>

        <View style={styles.viewfinderLeft} pointerEvents="none">
          <Text style={styles.viewfinderLeftText}>{clock(left)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The browser draws a black rectangle around a focused control; these are
  // round or pill-shaped, so the default ring is simply wrong.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
  focusableText: { outlineStyle: 'none', outlineWidth: 0 } as unknown as TextStyle,

  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 6,
  },

  /** 30×30 around a 19px glyph: as much target as the 40pt pill can give
   *  without making the row taller. */
  iconHit: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pill: {
    flex: 1,
    minHeight: COMPOSER_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: COMPOSER_H / 2,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    boxShadow: '0 6px 16px rgba(111,155,221,0.20)',
  },
  input: {
    flexGrow: 1, flexShrink: 1,
    fontSize: 15,
    lineHeight: 19,
    color: INK,
    maxHeight: 96,
    // 19 + 10 + 10 = 39, so a one-line draft sits at exactly COMPOSER_H.
    paddingVertical: 10,
  },

  recPill: {
    flex: 1,
    minHeight: COMPOSER_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: COMPOSER_H / 2,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(224,69,94,0.35)',
    boxShadow: '0 6px 16px rgba(224,69,94,0.18)',
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: REC },
  recTime: {
    fontSize: 14,
    fontWeight: '700',
    color: REC,
    fontVariant: ['tabular-nums'],
  },
  recHint: { flexGrow: 1, flexShrink: 1, fontSize: 13, color: MUTED },

  round: {
    width: COMPOSER_H,
    height: COMPOSER_H,
    borderRadius: COMPOSER_H / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundOn: { backgroundColor: PRIMARY },
  roundIdle: { backgroundColor: '#A8C2EA' },
  roundSoft: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    boxShadow: '0 6px 16px rgba(111,155,221,0.20)',
  },

  // Centred and large, the way Telegram frames a round video — a small circle
  // in the corner reads as a preview thumbnail, not as "you are on camera".
  viewfinderWrap: { alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10 },
  viewfinderHost: { width: VIEWFINDER, height: VIEWFINDER },
  viewfinder: {
    width: VIEWFINDER,
    height: VIEWFINDER,
    borderRadius: VIEWFINDER / 2,
    overflow: 'hidden',
    backgroundColor: '#0B1B36',
    boxShadow: '0 12px 28px rgba(111,155,221,0.38)',
  },
  viewfinderRing: { position: 'absolute', top: 0, left: 0 },
  viewfinderLeft: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 11,
    backgroundColor: 'rgba(11,27,54,0.55)',
  },
  viewfinderLeftText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
