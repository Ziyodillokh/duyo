import {
  Brain,
  Home,
  MessageCircle,
  Target,
  User,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsDark } from '@/store/theme';

export type TabKey = 'home' | 'chat' | 'goals' | 'brain' | 'profile';

interface TabItem {
  key: TabKey;
  label: string;
  Icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

// Position 3 of 5 IS the middle, so Maqsaddosh lands centre with no reordering.
// Kutubxona is not gone: it moved to a pushed screen at /(main)/library,
// reachable from the profile screen.
const TABS: readonly TabItem[] = [
  { key: 'home', label: 'Bosh sahifa', Icon: Home },
  { key: 'chat', label: 'Suhbat', Icon: MessageCircle },
  { key: 'goals', label: 'Maqsaddosh', Icon: Target },
  // Inventory moved inside Profil — it is part of "what I have", and the slot
  // it freed goes to the note graph.
  { key: 'brain', label: 'Miya', Icon: Brain },
  { key: 'profile', label: 'Profil', Icon: User },
];

interface BottomNavProps {
  active: TabKey;
  onSelect: (key: TabKey) => void;
  /** The glass screens (home, Maqsaddoshlar) paint their own morning sky and
   *  ignore the theme, so the bar over them must ignore it too — otherwise a
   *  dark bar lands on a light screen whenever the child picks dark mode. */
  forceLight?: boolean;
}

/** Spec chrome, shared with the home dashboard's dock: a 350x80 bar, radius
 *  30, sitting 12pt clear of the bottom inside 20pt gutters. */
export const NAV_BAR_HEIGHT = 80;
export const NAV_BAR_GAP = 12;
/** What a scrolling screen must leave clear beneath its content. */
export const NAV_CLEARANCE = NAV_BAR_HEIGHT + NAV_BAR_GAP * 2;

const LIGHT = {
  fill: 'rgba(255,255,255,0.82)',
  border: 'rgba(255,255,255,0.9)',
  shadow: '0 16px 34px rgba(111,155,221,0.32), inset 0 1.5px 0 rgba(255,255,255,0.95)',
  active: '#2F6FE4',
  inactive: '#8CA3CB',
  label: '#33507F',
  pill: 'rgba(47,111,228,0.12)',
};
const DARK = {
  fill: 'rgba(16,26,46,0.93)',
  border: 'rgba(140,180,255,0.18)',
  shadow: '0 14px 30px rgba(0,0,0,0.45), inset 0 1.5px 0 rgba(255,255,255,0.08)',
  active: '#60A5FA',
  inactive: '#8296B4',
  label: '#AFC1DC',
  pill: 'rgba(96,165,250,0.16)',
};

/**
 * The app's tab bar, in the same frosted glass as the home dashboard's dock.
 *
 * It FLOATS over the screen rather than taking a strip of layout, which is
 * what lets the glass read as glass — a bar in the flow would need an opaque
 * background of its own and would just be a coloured strip. Scrolling
 * screens therefore have to leave `NAV_CLEARANCE` beneath their content;
 * the home tab hides this bar entirely and ships its own three-item dock.
 */
export function BottomNav({ active, onSelect, forceLight }: BottomNavProps) {
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const c = isDark && !forceLight ? DARK : LIGHT;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: insets.bottom + NAV_BAR_GAP }]}
    >
      <View
        style={[
          styles.bar,
          { backgroundColor: c.fill, borderColor: c.border, boxShadow: c.shadow },
        ]}
      >
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          const colour = isActive ? c.active : c.inactive;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onSelect(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              style={styles.item}
            >
              {/* A soft pill instead of the old lifted circle: it marks the
                  current tab without breaking the flat bar the spec asks for,
                  and it cannot be clipped by the safe-area container the way
                  a negative margin was (see 8e0d72b). */}
              <View style={[styles.iconSlot, isActive && { backgroundColor: c.pill }]}>
                <tab.Icon size={24} color={colour} strokeWidth={isActive ? 2.2 : 1.9} />
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  { color: isActive ? c.active : c.label },
                  isActive && styles.labelActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0 },
  bar: {
    marginHorizontal: 20,
    height: NAV_BAR_HEIGHT,
    borderRadius: 30,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Five equal columns — 70pt each at the spec's 350pt bar.
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconSlot: {
    width: 40,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { marginTop: 4, fontSize: 11, fontWeight: '600' },
  labelActive: { fontWeight: '700' },
});

export { TABS };
