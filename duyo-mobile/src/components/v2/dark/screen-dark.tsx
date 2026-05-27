import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type DarkBackground = 'cosmic' | 'plain';

interface ScreenDarkProps {
  children: ReactNode;
  edges?: ReadonlyArray<'top' | 'bottom' | 'left' | 'right'>;
  background?: DarkBackground;
}

const COSMIC_COLORS: ReadonlyArray<string> = [
  '#3C0366',
  '#510424',
  '#162456',
];

const COSMIC_LOCATIONS: ReadonlyArray<number> = [0, 0.5, 1];

export function ScreenDark({
  children,
  edges = ['top', 'bottom'],
  background = 'cosmic',
}: ScreenDarkProps) {
  return (
    <View style={StyleSheet.absoluteFill}>
      {background === 'cosmic' ? (
        <LinearGradient
          colors={COSMIC_COLORS as unknown as readonly [string, string, string]}
          locations={
            COSMIC_LOCATIONS as unknown as readonly [number, number, number]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: '#132340' }]}
        />
      )}
      <SafeAreaView style={{ flex: 1 }} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}
