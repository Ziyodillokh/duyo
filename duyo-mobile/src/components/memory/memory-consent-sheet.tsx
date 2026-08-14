import { Lock, Sparkles, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  MEMORY_CATEGORY_COLOURS,
  MEMORY_CATEGORY_HINTS,
  MEMORY_CATEGORY_ICONS,
  MEMORY_CATEGORY_LABELS,
} from '@/lib/memory-categories';
import { MemoryGuardError, useMemoryStore } from '@/store/memory';
import { useMemoryConsentStore } from '@/store/memory-consent';
import { useIsDark } from '@/store/theme';

/**
 * "Buni eslab qolaymi?" — the moment the child decides what DUYO keeps.
 *
 * This was an Alert.alert. That put the single most important privacy
 * decision in the product behind an OS dialog that looks like an error: no
 * category, no colour, no way to say where the note goes, and a title
 * rendered in the same grey as "Xatolik". A child cannot consent to something
 * they have to squint at.
 *
 * Mounted ONCE, in the (main) layout, and driven by store/memory-consent.ts —
 * both the text chat and the voice screen raise the same sheet rather than
 * each rendering their own.
 */
export function MemoryConsentSheet() {
  const isDark = useIsDark();
  const pending = useMemoryConsentStore((s) => s.pending);
  const dismiss = useMemoryConsentStore((s) => s.dismiss);
  const [saving, setSaving] = useState(false);

  const [slide] = useState(() => new Animated.Value(0));
  const visible = pending !== null;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      // Settles quickly without the bounce reading as playful — this is a
      // consent prompt, not a reward.
      damping: 18,
      stiffness: 170,
      mass: 0.9,
    }).start();
  }, [visible, slide]);

  if (!pending) return null;

  const accent = MEMORY_CATEGORY_COLOURS[pending.category] ?? '#60A5FA';
  const Icon = MEMORY_CATEGORY_ICONS[pending.category];
  const label = MEMORY_CATEGORY_LABELS[pending.category] ?? pending.category;
  const hint = MEMORY_CATEGORY_HINTS[pending.category] ?? '';

  const close = () => {
    setSaving(false);
    dismiss();
  };

  const accept = () => {
    setSaving(true);
    useMemoryStore
      .getState()
      .addMemory(pending.category, pending.content, 'chat_confirmed')
      .catch((err) => {
        // A guard rejection is a successful block, not a failure to explain.
        if (!(err instanceof MemoryGuardError)) {
          console.warn('memory save failed', err);
        }
      })
      .finally(close);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Yopish"
          style={{ flex: 1, backgroundColor: 'rgba(4,10,22,0.62)' }}
        />

        <Animated.View
          style={{
            transform: [
              {
                translateY: slide.interpolate({
                  inputRange: [0, 1],
                  outputRange: [340, 0],
                }),
              },
            ],
            backgroundColor: isDark ? '#132340' : '#FFFFFF',
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            borderTopWidth: 1,
            borderColor: `${accent}44`,
          }}
        >
          <SafeAreaView edges={['bottom']}>
            {/* Grab handle — signals "this is a sheet you can dismiss". */}
            <View className="items-center pt-3">
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: isDark
                    ? 'rgba(224,231,255,0.22)'
                    : 'rgba(16,32,51,0.15)',
                }}
              />
            </View>

            <View style={{ padding: 22, paddingTop: 16 }}>
              <View className="flex-row items-center gap-3">
                <View
                  className="items-center justify-center"
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 15,
                    backgroundColor: `${accent}1F`,
                  }}
                >
                  <Icon size={22} color={accent} />
                </View>

                <View className="flex-1">
                  <Text className="text-lg font-bold text-foreground dark:text-dark-text">
                    Buni eslab qolaymi?
                  </Text>
                  <Text className="text-xs text-muted-foreground dark:text-dark-muted mt-0.5">
                    {hint}
                  </Text>
                </View>

                <Pressable
                  onPress={close}
                  accessibilityRole="button"
                  accessibilityLabel="Yopish"
                  hitSlop={10}
                  className="w-9 h-9 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: isDark
                      ? 'rgba(224,231,255,0.07)'
                      : 'rgba(16,32,51,0.05)',
                  }}
                >
                  <X size={16} color="#94A3B8" />
                </Pressable>
              </View>

              {/* The memory itself — the thing being consented to, quoted so
                  the child can check the wording before agreeing to it. */}
              <View
                className="mt-4 rounded-2xl"
                style={{
                  backgroundColor: isDark
                    ? 'rgba(96,165,250,0.07)'
                    : 'rgba(37,99,235,0.05)',
                  borderLeftWidth: 3,
                  borderLeftColor: accent,
                  padding: 15,
                }}
              >
                <Text className="text-base leading-6 text-foreground dark:text-dark-text">
                  {pending.content}
                </Text>
              </View>

              <View className="flex-row items-center gap-2 mt-3">
                <View
                  className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
                  style={{ backgroundColor: `${accent}1A` }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: accent,
                    }}
                  />
                  <Text className="text-xs font-medium" style={{ color: accent }}>
                    {label}
                  </Text>
                </View>

                {/* The promise the whole feature rests on, said plainly at
                    the moment it matters — not buried in a settings page. */}
                <View className="flex-row items-center gap-1.5 flex-1">
                  <Lock size={11} color="#94A3B8" />
                  <Text
                    className="text-xs text-muted-foreground dark:text-dark-muted"
                    numberOfLines={1}
                  >
                    Faqat shu telefonda, shifrlangan
                  </Text>
                </View>
              </View>

              <View className="flex-row gap-3 mt-5">
                <Pressable
                  onPress={close}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="Yo'q, eslab qolma"
                  className="flex-1 items-center justify-center rounded-2xl active:opacity-70"
                  style={{
                    height: 50,
                    borderWidth: 1,
                    borderColor: isDark
                      ? 'rgba(224,231,255,0.16)'
                      : 'rgba(16,32,51,0.12)',
                  }}
                >
                  <Text className="text-base font-medium text-muted-foreground dark:text-dark-muted">
                    Yo‘q
                  </Text>
                </Pressable>

                <Pressable
                  onPress={accept}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="Ha, eslab qol"
                  accessibilityState={{ disabled: saving }}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl active:opacity-80"
                  style={{ height: 50, backgroundColor: accent, opacity: saving ? 0.6 : 1 }}
                >
                  <Sparkles size={17} color="#0A1628" />
                  <Text className="text-base font-bold" style={{ color: '#0A1628' }}>
                    Eslab qol
                  </Text>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}
