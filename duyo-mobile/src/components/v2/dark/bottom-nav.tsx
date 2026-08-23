import { Brain, Target } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MascotHead } from '@/components/v2/mascot-image';
import { useIsDark } from '@/store/theme';

/** Every tab route the navigator owns. The dock surfaces three of them; home
 *  and profile are reached from the screens themselves — home by each
 *  section's back button, profile from the home header. */
export type TabKey = 'home' | 'chat' | 'goals' | 'brain' | 'profile';

interface DockItem {
  key: Extract<TabKey, 'goals' | 'chat' | 'brain'>;
  label: string;
  Icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  /** The centre slot is DUYO itself, so it shows the mascot, not an icon. */
  mascot?: boolean;
}

/** The three places the product leads with, in the order the home dashboard
 *  drew them. Bosh sahifa and Profil deliberately are not here: the dock is
 *  the hub's three doors, and the hub is reached by going back. */
const DOCK: readonly DockItem[] = [
  { key: 'goals', label: 'Bir maqsad', Icon: Target },
  { key: 'chat', label: 'DUYO', mascot: true },
  { key: 'brain', label: 'Neo Miyya', Icon: Brain },
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
/** How far DUYO's bubble stands proud of the bar's top edge. */
const RAISE = 26;
const BUBBLE = 64;
/**
 * What a screen must leave clear beneath its content, INCLUDING the device's
 * bottom inset — the bar is pinned at `insets.bottom + NAV_BAR_GAP`, so a
 * flat constant under-reserves by the whole inset (34pt on a notched iPhone,
 * ~48 on Android 3-button) and buries whatever sits at the bottom.
 *
 * A hook rather than a constant on purpose: the inset is only knowable at
 * render time, and the previous constant read as the whole answer while
 * being only part of one.
 */
export function useNavClearance(extra = 0): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + NAV_BAR_GAP + NAV_BAR_HEIGHT + RAISE + extra;
}

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
 * The app's dock — the same three doors the home dashboard drew, now on every
 * tab: Bir maqsad, DUYO, Neo Miyya.
 *
 * It FLOATS over the screen rather than taking a strip of layout, which is
 * what lets the glass read as glass — a bar in the flow would need an opaque
 * background of its own and would just be a coloured strip. Scrolling
 * screens therefore have to leave `NAV_CLEARANCE` beneath their content.
 * Home renders it too and no longer carries a dock of its own — one bar,
 * everywhere.
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
        {DOCK.map((tab) => {
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
              {tab.mascot ? (
                // The bubble itself is drawn above, outside the bar; this
                // just reserves its column so the label lines up.
                <View style={styles.iconSlot} />
              ) : (
                <View style={[styles.iconSlot, isActive && { backgroundColor: c.pill }]}>
                  {tab.Icon ? (
                    <tab.Icon size={28} color={colour} strokeWidth={isActive ? 2.2 : 1.9} />
                  ) : null}
                </View>
              )}
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

      {/* DUYO, standing proud of the bar. A sibling of the bar rather than a
          child of it, so no rounded-corner clipping can eat it. */}
      <Pressable
        onPress={() => onSelect('chat')}
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'chat' }}
        accessibilityLabel="DUYO"
        style={[
          styles.bubble,
          {
            backgroundColor: c.fill,
            borderColor: active === 'chat' ? c.active : c.border,
            boxShadow: c.shadow,
          },
        ]}
      >
        <MascotHead size={44} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Tall enough to hold the raised bubble as well as the bar, so nothing
  // has to overflow its parent.
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: NAV_BAR_HEIGHT + RAISE,
    justifyContent: 'flex-end',
  },
  bubble: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    marginHorizontal: 20,
    height: NAV_BAR_HEIGHT,
    borderRadius: 30,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Three equal columns — 116.6pt each at the spec's 350pt bar.
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconSlot: {
    width: 48,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  labelActive: { fontWeight: '700' },
});

export { DOCK };
