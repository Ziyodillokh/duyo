import { type ComponentProps, type ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { KeyboardAvoidingView as NativeKAV } from 'react-native-keyboard-controller';

type Behavior = NonNullable<ComponentProps<typeof NativeKAV>['behavior']>;

/**
 * KeyboardAvoidingView that also lays out correctly on web.
 *
 * The native one exists to read IME insets — a concern browsers handle
 * themselves, so on web it only costs layout: its Reanimated wrapper renders an
 * intermediate element that stays `flex: 0 0 auto`, so a `flex-1` child (the
 * chat message list) collapses to its content height and the composer floats
 * mid-screen instead of sitting at the bottom.
 *
 * Web therefore gets a plain filling View; iOS/Android keep the real thing.
 *
 * The `className` passthrough this used to carry is gone: it existed for
 * callers on nativewind, and every one of them now passes `style`.
 */
export function KeyboardAvoidingView({
  children,
  style,
  behavior = 'translate-with-padding',
}: {
  children: ReactNode;
  style?: ViewStyle;
  /** Forwarded to the native view; ignored on web. */
  behavior?: Behavior;
}) {
  if (Platform.OS === 'web') {
    return <View style={style}>{children}</View>;
  }
  return (
    <NativeKAV behavior={behavior} style={style}>
      {children}
    </NativeKAV>
  );
}
