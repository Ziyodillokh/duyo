import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { glass, lift } from '@/lib/glass';

/**
 * The app's action sheet.
 *
 * ## Why this exists rather than `Alert.alert`
 *
 * Every actions menu in the app was an `Alert.alert` with a list of buttons.
 * On a phone that works. On web it is nothing at all — react-native-web ships
 *
 *     class Alert { static alert() {} }
 *
 * an empty function, so the three-dot menus on the history and project lists
 * opened nothing, silently, with no error to notice. Anything reachable only
 * through one of those menus — renaming, moving a chat into a project,
 * deleting, pinning — was unreachable in the browser.
 *
 * ## Why it is not just a web fix
 *
 * A native alert with five buttons is a poor way to offer actions on either
 * platform: it stacks them in a system font, gives them no icons, and puts the
 * destructive one in the same visual weight as the rest. This is the app's own
 * material, so an action can carry an icon, a destructive one can look
 * destructive, and the sheet can say what it is about above the choices.
 */

export interface SheetAction {
  label: string;
  onPress: () => void;
  /** Draws in the danger colour and sits last, under a divider. */
  destructive?: boolean;
  icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const DANGER = '#E0455E';

export function ActionSheet({
  visible,
  title,
  message,
  actions,
  onClose,
}: {
  visible: boolean;
  title?: string;
  message?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const t = useSharedValue(0);

  useEffect(() => {
    t.set(
      withTiming(visible ? 1 : 0, {
        duration: visible ? 220 : 160,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [visible, t]);

  const scrim = useAnimatedStyle(() => ({ opacity: t.get() }));
  const sheet = useAnimatedStyle(() => ({
    // Rises rather than fades: a sheet that appears in place reads as a dialog
    // interrupting you, one that slides up reads as a drawer you opened.
    transform: [{ translateY: (1 - t.get()) * 260 }],
    opacity: t.get(),
  }));

  const ordinary = actions.filter((a) => !a.destructive);
  const destructive = actions.filter((a) => a.destructive);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.scrim, scrim]}>
        {/* The scrim is the dismiss target, which is what makes tapping away
            work without a Cancel row having to exist for it. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Yopish"
          accessibilityRole="button"
        />
      </Animated.View>

      <View style={styles.host} pointerEvents="box-none">
        <Animated.View
          style={[
            // Opaque, unlike every other glass surface in the app.
            // The others float over a gradient; this one covers TEXT, and at
            // 0.94 the bold row labels underneath read straight through it —
            // 6% of #22406F on white is plainly visible. A modal surface has
            // to be a surface. The border and the lift keep the glass shape.
            glass(28, 'xl', 1),
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 12) + 8 },
            sheet,
          ]}
        >
          <View style={styles.grabber} />

          {!!title && (
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          )}
          {!!message && <Text style={styles.message}>{message}</Text>}

          {ordinary.map((a) => (
            <Row key={a.label} action={a} onClose={onClose} />
          ))}

          {destructive.length > 0 && <View style={styles.divider} />}
          {destructive.map((a) => (
            <Row key={a.label} action={a} onClose={onClose} />
          ))}

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Bekor qilish"
            style={({ pressed }) => [
              styles.cancel,
              pressed && styles.pressed,
              styles.focusable,
            ]}
          >
            <Text style={styles.cancelText}>Bekor qilish</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Row({ action, onClose }: { action: SheetAction; onClose: () => void }) {
  const Icon = action.icon;
  const colour = action.destructive ? DANGER : INK;
  return (
    <Pressable
      onPress={() => {
        // Close first: the sheet is gone before whatever this opens arrives,
        // so a push never lands behind a dismissing modal.
        onClose();
        action.onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, styles.focusable]}
    >
      {Icon ? (
        <Icon size={19} color={action.destructive ? DANGER : PRIMARY} strokeWidth={2} />
      ) : (
        <View style={styles.iconGap} />
      )}
      <Text style={[styles.rowText, { color: colour }]} numberOfLines={1}>
        {action.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  focusable: {
    outlineStyle: 'none',
    outlineWidth: 0,
    WebkitTapHighlightColor: 'transparent',
  } as unknown as ViewStyle,

  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16,32,64,0.34)',
  },
  host: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    marginHorizontal: 10,
    paddingTop: 8,
    paddingHorizontal: 8,
    // Square at the bottom edge: only the top of this sheet is ever seen.
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(140,163,203,0.45)',
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    paddingHorizontal: 12,
    paddingBottom: 2,
  },
  message: {
    fontSize: 13.5,
    lineHeight: 19,
    color: MUTED,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  iconGap: { width: 19 },
  rowText: { flexGrow: 1, flexShrink: 1, fontSize: 16, fontWeight: '600' },
  pressed: { backgroundColor: 'rgba(47,111,228,0.09)' },

  divider: {
    height: 1,
    marginVertical: 6,
    marginHorizontal: 12,
    backgroundColor: 'rgba(47,111,228,0.12)',
  },

  cancel: {
    marginTop: 8,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(47,111,228,0.08)',
    boxShadow: lift('flush'),
  },
  cancelText: { fontSize: 16, fontWeight: '700', color: PRIMARY },
});
