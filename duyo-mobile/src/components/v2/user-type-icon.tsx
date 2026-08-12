import { Image } from 'expo-image';

import type { UserType } from '@/store/onboarding';

/**
 * The two onboarding identities.
 *
 * Plain images, not emoji: 👧 and 👨‍👩‍👧‍👦 render in a different style on every
 * OS and the family ZWJ sequence falls apart entirely on Windows.
 *
 * To swap the artwork, overwrite these two files — no code change. Both are
 * transparent PNGs cropped to the same 3:2 frame with the subject filling it,
 * so the two cards end up exactly the same height.
 */
const ARTWORK: Record<UserType, number> = {
  child: require('../../../assets/onboarding/child.png'),
  parent: require('../../../assets/onboarding/parent.png'),
};

/** Both source images share this frame; the card height follows from it. */
const ASPECT = 3 / 2;

interface UserTypeIconProps {
  type: UserType;
}

export function UserTypeIcon({ type }: UserTypeIconProps) {
  return (
    <Image
      source={ARTWORK[type]}
      style={{ width: '100%', aspectRatio: ASPECT }}
      contentFit="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
