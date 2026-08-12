import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import type { Language } from '@/store/language';

/**
 * Flag emoji (🇺🇿 🇷🇺 🇬🇧) fall back to bare "UZ" / "RU" / "GB" letters on
 * Windows and on Android builds without regional-indicator glyphs, so the
 * flags are drawn here instead. Every flag is authored in a 60x40 box.
 */

interface FlagIconProps {
  code: Language;
  /** Width in px; height follows the 3:2 box. */
  width?: number;
}

// 12 stars beside the crescent: rows of 3, 4 and 5, widening to the left.
const UZ_STARS: readonly (readonly [number, number])[] = [
  [23, 2.9],
  [27, 2.9],
  [31, 2.9],
  [19, 6.6],
  [23, 6.6],
  [27, 6.6],
  [31, 6.6],
  [15, 10.3],
  [19, 10.3],
  [23, 10.3],
  [27, 10.3],
  [31, 10.3],
];

export function FlagIcon({ code, width = 36 }: FlagIconProps) {
  // ids must be unique per instance, and free of characters url(#…) chokes on.
  const clipId = `flag-${code}-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const height = Math.round((width * 2) / 3);

  return (
    <View
      style={{
        width,
        height,
        borderRadius: Math.max(3, Math.round(width * 0.09)),
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(15, 23, 42, 0.15)',
      }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 60 40">
        {code === 'uz' && (
          <>
            <Rect width={60} height={40} fill="#FFFFFF" />
            <Rect width={60} height={12.6} fill="#0099B5" />
            <Rect y={27.4} width={60} height={12.6} fill="#1EB53A" />
            <Rect y={12.6} width={60} height={0.9} fill="#CE1126" />
            <Rect y={26.5} width={60} height={0.9} fill="#CE1126" />
            {/* Crescent: a white disc with a blue one biting into its right. */}
            <Circle cx={10.6} cy={6.4} r={4.4} fill="#FFFFFF" />
            <Circle cx={12.9} cy={6.4} r={4.4} fill="#0099B5" />
            {UZ_STARS.map(([cx, cy]) => (
              <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={0.85} fill="#FFFFFF" />
            ))}
          </>
        )}

        {code === 'ru' && (
          <>
            <Rect width={60} height={13.34} fill="#FFFFFF" />
            <Rect y={13.34} width={60} height={13.33} fill="#0039A6" />
            <Rect y={26.67} width={60} height={13.33} fill="#D52B1E" />
          </>
        )}

        {code === 'en' && (
          <>
            <Defs>
              {/* Quadrants that offset the red saltire off the white one. */}
              <ClipPath id={clipId}>
                <Path d="M30,20 h30 v20 z v20 h-30 z h-30 v-20 z v-20 h30 z" />
              </ClipPath>
            </Defs>
            <Rect width={60} height={40} fill="#012169" />
            <Path
              d="M0,0 L60,40 M60,0 L0,40"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={8}
            />
            <G clipPath={`url(#${clipId})`}>
              <Path
                d="M0,0 L60,40 M60,0 L0,40"
                fill="none"
                stroke="#C8102E"
                strokeWidth={5}
              />
            </G>
            <Path
              d="M30,0 V40 M0,20 H60"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={11}
            />
            <Path
              d="M30,0 V40 M0,20 H60"
              fill="none"
              stroke="#C8102E"
              strokeWidth={6.6}
            />
          </>
        )}
      </Svg>
    </View>
  );
}
