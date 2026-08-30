import { Brain, Target } from 'lucide-react-native';
import { type ComponentType, useEffect } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MascotHead } from '@/components/v2/mascot-image';
import { lift } from '@/lib/glass';

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
 * render time, and the previous constant read as the whole answer while being
 * only part of one.
 */
export function useNavClearance(extra = 0): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + NAV_BAR_GAP + NAV_BAR_HEIGHT + RAISE + extra;
}

/**
 * The dock's colours.
 *
 * There is one set, not a light and a dark one. The dark bar used to appear on
 * whichever tabs were missing from a `forceLight` list, which after the glass
 * migration meant it turned night-coloured over the AI and Profile screens
 * whenever the child had picked dark mode — seemingly at random, since nothing
 * on screen had changed. Nothing under this dock is dark any more (the one
 * dark ground left in the app is Miya's map, which has always carried a light
 * bar), so the second palette had no screen left to belong to.
 */
const C = {
  fill: 'rgba(255,255,255,0.82)',
  border: 'rgba(255,255,255,0.9)',
  shadow: '0 16px 34px rgba(111,155,221,0.32), inset 0 1.5px 0 rgba(255,255,255,0.95)',
  active: '#2F6FE4',
  inactive: '#8CA3CB',
  label: '#33507F',
  pill: 'rgba(47,111,228,0.12)',
};

/** Quick enough to feel like a response, soft enough not to twitch. */
const SPRING = { damping: 17, stiffness: 210, mass: 0.7 };

/**
 * One door in the dock.
 *
 * ## Why the indicator is animated rather than toggled
 *
 * It used to be a plain `isActive && { backgroundColor }`, so the pill behind
 * the icon appeared and vanished between one frame and the next. A shape that
 * blinks into existence under your thumb does not read as "this tab is now
 * selected" — it reads as a rectangle that appeared on the icon, which is
 * exactly how it was described. Growing it from 60% with a spring gives the
 * eye something to follow from the old tab to the new one.
 *
 * ## Why the icon is drawn twice
 *
 * Lucide takes its colour as a PROP, and a prop cannot be interpolated by a
 * style animation. Rather than reach for animated props on an SVG, both
 * colours are rendered stacked and cross-faded by opacity — the same result,
 * at the cost of one extra element that is transparent half the time.
 */
function DockTab({
  tab,
  isActive,
  onSelect,
}: {
  tab: DockItem;
  isActive: boolean;
  onSelect: (key: TabKey) => void;
}) {
  const on = useSharedValue(isActive ? 1 : 0);
  const press = useSharedValue(0);

  useEffect(() => {
    on.set(withSpring(isActive ? 1 : 0, SPRING));
  }, [isActive, on]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: on.get(),
    transform: [{ scale: 0.6 + on.get() * 0.4 }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      // The lift is what makes the tab feel picked up rather than repainted.
      { translateY: -2 * on.get() },
      { scale: (1 + 0.08 * on.get()) * (1 - 0.07 * press.get()) },
    ],
  }));

  const activeIcon = useAnimatedStyle(() => ({ opacity: on.get() }));
  const idleIcon = useAnimatedStyle(() => ({ opacity: 1 - on.get() }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(on.get(), [0, 1], [C.label, C.active]),
  }));

  const Icon = tab.Icon;

  return (
    <Pressable
      onPress={() => onSelect(tab.key)}
      onPressIn={() => press.set(withSpring(1, SPRING))}
      onPressOut={() => press.set(withSpring(0, SPRING))}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={tab.label}
      style={[styles.item, styles.focusable]}
    >
      {/* The marker for where you are. It sits behind the whole door — icon
          AND label — rather than behind the icon alone: a badge around one
          glyph reads as a state of that glyph, while a pane under both reads
          as the door being lifted forward, which is the thing being said. */}
      <Animated.View style={[styles.tile, pillStyle]} />

      {tab.mascot ? (
        // The bubble itself is drawn above, outside the bar; this just
        // reserves its column so the label lines up.
        <View style={styles.iconSlot} />
      ) : (
        <View style={styles.iconSlot}>
          <Animated.View style={iconStyle}>
            {Icon ? (
              <>
                <Animated.View style={idleIcon}>
                  <Icon size={28} color={C.inactive} strokeWidth={1.9} />
                </Animated.View>
                <Animated.View style={[StyleSheet.absoluteFill, activeIcon]}>
                  <Icon size={28} color={C.active} strokeWidth={2.2} />
                </Animated.View>
              </>
            ) : null}
          </Animated.View>
        </View>
      )}

      {/* Animated colour, fixed weight. Swapping the weight would swap the font
          FILE — each Inter weight is its own family, see lib/fonts.ts — and the
          two faces are not the same width, so the label would jog sideways
          every time the tab changed. */}
      <Animated.Text
        style={[styles.label, labelStyle]}
        numberOfLines={1}
        // Raw Animated.Text bypasses the app Text wrapper, so it does not
        // inherit the Android clip default — set it here. See
        // components/text.tsx for the ROM ellipsize mechanism.
        ellipsizeMode="clip"
      >
        {tab.label}
      </Animated.Text>
    </Pressable>
  );
}

/**
 * The app's dock — the same three doors the home dashboard drew, now on every
 * tab: Bir maqsad, DUYO, Neo Miyya.
 *
 * It FLOATS over the screen rather than taking a strip of layout, which is what
 * lets the glass read as glass — a bar in the flow would need an opaque
 * background of its own and would just be a coloured strip. Scrolling screens
 * therefore have to leave `useNavClearance()` beneath their content. Home
 * renders it too and no longer carries a dock of its own — one bar, everywhere.
 */
export function BottomNav({ active, onSelect }: BottomNavProps) {
  const insets = useSafeAreaInsets();
  const chatOn = useSharedValue(active === 'chat' ? 1 : 0);
  const bubblePress = useSharedValue(0);

  useEffect(() => {
    chatOn.set(withSpring(active === 'chat' ? 1 : 0, SPRING));
  }, [active, chatOn]);

  const bubbleStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(chatOn.get(), [0, 1], [C.border, C.active]),
    transform: [
      { scale: (1 + 0.04 * chatOn.get()) * (1 - 0.06 * bubblePress.get()) },
    ],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: insets.bottom + NAV_BAR_GAP }]}
    >
      <View style={styles.bar}>
        {DOCK.map((tab) => (
          <DockTab
            key={tab.key}
            tab={tab}
            isActive={tab.key === active}
            onSelect={onSelect}
          />
        ))}
      </View>

      {/* DUYO, standing proud of the bar. A sibling of the bar rather than a
          child of it, so no rounded-corner clipping can eat it. */}
      <Animated.View style={[styles.bubble, bubbleStyle]}>
        <Pressable
          onPress={() => onSelect('chat')}
          onPressIn={() => bubblePress.set(withSpring(1, SPRING))}
          onPressOut={() => bubblePress.set(withSpring(0, SPRING))}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === 'chat' }}
          accessibilityLabel="DUYO"
          style={[styles.bubbleTouch, styles.focusable]}
        >
          <MascotHead size={44} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Two rectangles the platform draws for us, both suppressed.
   *
   * `outline*` is the browser's focus ring — a square around whatever was last
   * clicked, which on a rounded pill and a circular mascot reads as a stray box
   * behind the tab.
   *
   * `WebkitTapHighlightColor` is the other one, and it is the one that shows up
   * on a phone: every WebView and mobile browser flashes a translucent grey
   * RECTANGLE over the element you tap, ignoring its border radius entirely.
   * Suppressing the focus ring never touched it. Native ignores both keys.
   */
  focusable: {
    outlineStyle: 'none',
    outlineWidth: 0,
    WebkitTapHighlightColor: 'transparent',
  } as unknown as ViewStyle,

  // Tall enough to hold the raised bubble as well as the bar, so nothing has
  // to overflow its parent.
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
    backgroundColor: C.fill,
    boxShadow: C.shadow,
  },
  bubbleTouch: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bar: {
    marginHorizontal: 20,
    height: NAV_BAR_HEIGHT,
    borderRadius: 30,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.fill,
    borderColor: C.border,
    boxShadow: C.shadow,
  },
  // Three equal columns — 116.6pt each at the spec's 350pt bar.
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconSlot: {
    width: 48,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * The active door, as a raised pane of the same glass the bar is made of.
   *
   * It used to be a 12%-alpha blue wash, which on a white translucent bar was
   * very nearly nothing — you could not tell at a glance which tab you were
   * on. This is brighter than the bar it sits on (0.95 against 0.82) and
   * carries the ladder's own contact-plus-ambient shadow, so it reads as a
   * tile lifted toward you rather than as a tinted patch.
   *
   * Negative top/bottom because the row centres its children on content
   * height: the pane has to reach past the icon and label to enclose them.
   */
  tile: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: -6,
    bottom: -6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.98)',
    boxShadow: lift('md'),
  },
  // Animated.Text is RN's Text, not the app wrapper, so the family is named
  // here rather than inherited — see lib/fonts.ts for why each weight is its
  // own family name.
  label: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});

export { DOCK };
