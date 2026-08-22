import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenGradientProps {
  children: ReactNode;
  edges?: readonly ('top' | 'bottom' | 'left' | 'right')[];
}

export function ScreenGradient({
  children,
  edges = ['top', 'bottom'],
}: ScreenGradientProps) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['rgba(37, 99, 235, 0.05)', 'rgba(255, 199, 0, 0.10)']}
        locations={[0, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1 }} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}
