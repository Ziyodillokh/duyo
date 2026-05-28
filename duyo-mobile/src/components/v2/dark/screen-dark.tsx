import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useIsDark } from '@/store/theme';

type DarkBackground = 'cosmic' | 'plain';

interface ScreenDarkProps {
  children: ReactNode;
  edges?: ReadonlyArray<'top' | 'bottom' | 'left' | 'right'>;
  background?: DarkBackground;
}

const DARK_COSMIC: ReadonlyArray<string> = ['#3C0366', '#510424', '#162456'];
const LIGHT_COSMIC: ReadonlyArray<string> = ['#EFE4FB', '#FCE7E7', '#E0E9FF'];
const COSMIC_LOCATIONS: ReadonlyArray<number> = [0, 0.5, 1];

export function ScreenDark({
  children,
  edges = ['top', 'bottom'],
  background = 'cosmic',
}: ScreenDarkProps) {
  const isDark = useIsDark();

  return (
    <View style={StyleSheet.absoluteFill}>
      {background === 'cosmic' ? (
        <LinearGradient
          colors={
            (isDark
              ? DARK_COSMIC
              : LIGHT_COSMIC) as unknown as readonly [
              string,
              string,
              string,
            ]
          }
          locations={
            COSMIC_LOCATIONS as unknown as readonly [number, number, number]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? '#132340' : '#F4F8FF' },
          ]}
        />
      )}
      <SafeAreaView style={{ flex: 1 }} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}
