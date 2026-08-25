import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import { View } from 'react-native';

import { MascotImage } from '@/components/v2/mascot-image';
import { useAuthedImage } from '@/hooks/use-authed-image';
import { useChildStore } from '@/store/child';

/**
 * The child's face, or DUYO's.
 *
 * One component so the two states can never diverge: a photo is a circle
 * cropped to fill, no photo is the mascot at full size on a transparent
 * ground. Callers ask for a size and get the right one of the two.
 *
 * The mascot is also what a failed photo load falls back to — the hook
 * returns null rather than an error, because a profile showing DUYO is a
 * correct screen and a broken-image icon is not.
 */
export function ChildAvatar({
  size,
  glow = 'soft',
  fallback,
}: {
  size: number;
  /** Only reaches the mascot; a photo carries its own edge. */
  glow?: 'cosmic' | 'soft' | 'none';
  /** What to show when there is no photo. Defaults to the mascot.
   *
   *  The dashboard header passes a plain person icon instead: the mascot
   *  is already standing full-size in the middle of that screen, and a
   *  second small copy of it in the corner reads as a duplicate rather
   *  than as "you". */
  fallback?: ReactNode;
}) {
  const photoUrl = useChildStore((s) => s.child?.photo_url) ?? null;
  const local = useAuthedImage(photoUrl);

  if (!local) return <>{fallback ?? <MascotImage size={size} glow={glow} />}</>;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        // A white rim, so a dark photo still reads as a disc against the
        // pale glass rather than as a hole in it.
        borderWidth: Math.max(1.5, size * 0.025),
        borderColor: '#FFFFFF',
      }}
    >
      <Image
        source={{ uri: local }}
        // cover, not contain: a portrait photo letterboxed inside a circle
        // is grey bars either side of a small face.
        contentFit="cover"
        style={{ width: '100%', height: '100%' }}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}
