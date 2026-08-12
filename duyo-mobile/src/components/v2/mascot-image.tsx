import { Image } from 'expo-image';
import { Platform, View, type ViewStyle } from 'react-native';

import { useMascotVariant, type MascotVariant } from '@/store/mascot';

// The two bodies the child picks between during onboarding.
export const MASCOT_VARIANTS: Record<MascotVariant, number> = {
  duyo: require('../../../assets/duyo/v2/mascot-default.png'),
  raccoon: require('../../../assets/duyo/v2/mascot-raccoon.png'),
};

type MascotGlow = 'cosmic' | 'soft' | 'none';

interface MascotImageProps {
  size?: number;
  glow?: MascotGlow;
  /** Defaults to the body the child picked; pass explicitly only to preview one. */
  variant?: MascotVariant;
}

// The mascot PNG is transparent, so a shadow must follow its silhouette. On
// the web `shadow*` compiles to box-shadow, which traces the View's rectangle
// instead — that is where the grey square behind the robot came from. CSS
// drop-shadow reads the image's alpha, matching what iOS does natively.
const WEB_GLOWS: Record<MascotGlow, ViewStyle> = {
  cosmic: { filter: 'drop-shadow(0 0 12px rgba(59, 130, 246, 0.45))' },
  soft: { filter: 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.18))' },
  none: {},
};

const NATIVE_GLOWS: Record<MascotGlow, ViewStyle> = {
  cosmic: {
    shadowColor: '#3b82f6',
    shadowOpacity: 0.5,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  soft: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  none: {},
};

export function MascotImage({
  size = 176,
  glow = 'cosmic',
  variant,
}: MascotImageProps) {
  const picked = useMascotVariant();
  // Android's `elevation` is rectangular too and has no alpha-aware
  // equivalent, so it is left off entirely rather than drawing a box.
  const glowStyle =
    Platform.OS === 'web' ? WEB_GLOWS[glow] : NATIVE_GLOWS[glow];

  return (
    <View style={{ width: size, height: size, ...glowStyle }}>
      <Image
        source={MASCOT_VARIANTS[variant ?? picked]}
        contentFit="contain"
        style={{ width: '100%', height: '100%' }}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}
