import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

// The dashboard's card surface (CompanionHome sits on a fixed navy gradient,
// so these are deliberately literal rather than theme-aware).
export const PANEL_SURFACE = 'rgba(255,255,255,0.06)';
export const PANEL_BORDER = 'rgba(96,165,250,0.18)';
export const PANEL_MUTED = '#94A3B8';
export const PANEL_TEXT = '#CBD5E1';

interface PanelProps {
  title: string;
  icon?: ReactNode;
  /** Small trailing element — a counter, a badge. */
  trailing?: ReactNode;
  children: ReactNode;
}

export function Panel({ title, icon, trailing, children }: PanelProps) {
  return (
    <View
      className="rounded-xl"
      style={{
        backgroundColor: PANEL_SURFACE,
        borderWidth: 1,
        borderColor: PANEL_BORDER,
        padding: 16,
      }}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          {icon}
          <Text className="text-sm font-bold text-white">{title}</Text>
        </View>
        {trailing}
      </View>
      {children}
    </View>
  );
}
