import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { BRAIN_BACKDROP } from '@/config/brain-backdrop';

/** Video file extensions we will hand to expo-video. Everything else is
 *  treated as a still image.
 *
 *  Why sniff the extension instead of asking the config to declare a type:
 *  the whole point of brain-backdrop.ts is that ONE line changes the
 *  backdrop. Making the author also remember to flip a `kind` field is a
 *  second thing to get wrong, and getting it wrong shows a blank screen.
 */
const VIDEO_EXT = /\.(mp4|m3u8|mpd|mov|webm|mkv)(\?|#|$)/i;

function isVideo(uri: string | number): boolean {
  // A bundled require() is a number; those are only ever used for video here,
  // because a bundled still image would be simpler to set as a plain Image.
  if (typeof uri === 'number') return true;
  return VIDEO_EXT.test(uri);
}

/**
 * The video OR image behind the Miya sky.
 *
 * ## Why this sits at screen level and not inside NoteGraph
 *
 * The pinch/pan gesture in note-graph.tsx transforms ONLY its inner
 * `Animated.View`; the frame around it never moves. So anything rendered
 * outside that inner view is, structurally, immune to the zoom — the planets
 * scale and this stays put. That is the behaviour we want, and it comes free
 * from the existing layering rather than from any code here.
 *
 * ## pointerEvents="none" is load-bearing
 *
 * This sits under a gesture surface. A VideoView that accepts touches would
 * swallow the pinch before the GestureDetector ever saw it, and the sky would
 * simply stop zooming. Never remove it.
 *
 * ## Failure is silent by design
 *
 * A bad URL, a dead network, an unsupported codec — none of them may take the
 * Miya screen down. On any error this renders nothing and the solid `#070B1A`
 * backdrop underneath carries the screen exactly as it did before.
 */
export function BrainBackdrop() {
  const { uri, opacity, tint } = BRAIN_BACKDROP;
  const [failed, setFailed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Matches use-graph-sim.ts: a child who has asked the OS to stop animations
  // gets a still frame, not a looping video.
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduceMotion(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (v) => alive && setReduceMotion(v),
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // `useVideoPlayer` is a hook, so it cannot be skipped when there is no
  // source — passing null is the supported way to hold a player with nothing
  // loaded, and keeps the hook order stable across config changes.
  const video = uri !== null && isVideo(uri);

  // Passing null keeps the hook order stable when the source is a still
  // image — hooks cannot be skipped, and a player with nothing loaded costs
  // nothing.
  const player = useVideoPlayer(video ? uri : null, (p) => {
    p.loop = true;
    p.muted = true;      // a background that makes noise is a bug, not a feature
    p.play();
  });

  useEffect(() => {
    if (!player) return;
    try {
      if (reduceMotion) player.pause();
      else player.play();
    } catch {
      // A player torn down mid-effect throws; nothing here is worth crashing for.
    }
  }, [player, reduceMotion]);

  // Surface load errors so we can fall back instead of showing a black hole.
  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error' || error) setFailed(true);
    });
    return () => sub.remove();
  }, [player]);

  if (!uri || failed) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {!video ? (
        <Image
          source={uri}
          style={[StyleSheet.absoluteFill, { opacity }]}
          contentFit="cover"
          // A still costs nothing to decode, which is the whole reason to
          // prefer one on the cheap Android phones this app runs on: no
          // per-frame work competing with the sky's physics simulation.
          cachePolicy="memory-disk"
          transition={400}
          onError={() => setFailed(true)}
        />
      ) : (
      <VideoView
        style={[StyleSheet.absoluteFill, { opacity }]}
        player={player}
        nativeControls={false}
        contentFit="cover"
        // A backdrop must never float out of the screen it belongs to.
        allowsPictureInPicture={false}
        // Android: textureView, not the default surfaceView. A SurfaceView
        // punches its own window through the view hierarchy and fights with
        // anything drawn over it — and the ENTIRE Miya UI is drawn over this.
        // textureView composites normally, at a small GPU cost we can afford
        // for one muted background clip.
        surfaceType="textureView"
      />
      )}

      {/* DUYO's own colours laid over whatever video is behind, so swapping
          the clip cannot change the app's identity — and so white star and
          label text keeps something dark to sit on. */}
      {tint && (
        <LinearGradient
          colors={[
            'rgba(60, 3, 102, 0.42)',
            'rgba(7, 11, 26, 0.30)',
            'rgba(22, 36, 86, 0.55)',
          ]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}
