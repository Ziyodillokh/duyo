import { Image } from 'expo-image';
import { View } from 'react-native';

const MASCOT_DEFAULT = require('../../../assets/duyo/v2/mascot-default.png');

type MascotGlow = 'cosmic' | 'soft' | 'none';

interface MascotImageProps {
  size?: number;
  glow?: MascotGlow;
}

const COSMIC_GLOW = {
  shadowColor: '#3b82f6',
  shadowOpacity: 0.5,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 0 },
  elevation: 8,
} as const;

const SOFT_GLOW = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
} as const;

export function MascotImage({ size = 176, glow = 'cosmic' }: MascotImageProps) {
  const shadowStyle =
    glow === 'cosmic' ? COSMIC_GLOW : glow === 'soft' ? SOFT_GLOW : undefined;

  return (
    <View style={{ width: size, height: size, ...shadowStyle }}>
      <Image
        source={MASCOT_DEFAULT}
        contentFit="contain"
        style={{ width: '100%', height: '100%' }}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}
