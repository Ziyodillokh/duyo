import { Check, RefreshCw, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { KeyboardAvoidingView } from '@/components/keyboard-avoiding-view';
import { handleRejectionMessage } from '@/api/endpoints/social';
import { useHandleSuggestions, useUpdateSocialSettings } from '@/hooks/use-social';
import { useIsDark } from '@/store/theme';

const MAX_LEN = 20;

interface Props {
  visible: boolean;
  childId: string | undefined;
  current: string;
  onClose: () => void;
}

/**
 * Lets the child choose their own peer-visible name.
 *
 * It used to be assigned at random from a list that included personal names,
 * so a boy could be handed "Lola". A child embarrassed by their nickname works
 * around it — usually by telling the peer their real name, which is exactly
 * what the pseudonym exists to prevent. Choosing removes that pressure.
 *
 * Typing is allowed but validated server-side: the handle appears on every
 * message, so it gets the same contact-detail screening a message body does.
 */
export function HandleEditor({ visible, childId, current, onClose }: Props) {
  const isDark = useIsDark();
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);

  const suggestions = useHandleSuggestions(childId);
  const update = useUpdateSocialSettings(childId);

  // Reset when the sheet opens — done as React's render-phase adjustment
  // (not an effect), so the reset lands in the same render that shows the
  // sheet instead of one frame after it.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setValue(current);
      setError(null);
    }
  }

  const trimmed = value.trim();
  const canSave = trimmed.length >= 3 && trimmed !== current && !update.isPending;

  const save = () => {
    setError(null);
    update.mutate(
      { display_name: trimmed },
      {
        onSuccess: onClose,
        onError: (err) =>
          setError(
            handleRejectionMessage(err) ??
              "Saqlanmadi. Internetni tekshirib, qayta urinib ko'ring.",
          ),
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <KeyboardAvoidingView behavior="padding">
          <View
            className="rounded-t-3xl"
            style={{
              backgroundColor: isDark ? '#0F2038' : '#FFFFFF',
              padding: 24,
              paddingBottom: 36,
            }}
          >
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-lg font-bold text-foreground dark:text-dark-text">
                Taxallusingni tanla
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Yopish"
                hitSlop={10}
                className="p-1"
              >
                <X size={20} color="#94A3B8" />
              </Pressable>
            </View>
            <Text className="text-sm text-muted-foreground dark:text-dark-muted mb-4">
              Boshqa bolalar seni shu nom bilan ko'radi. Haqiqiy isming
              ko'rinmaydi.
            </Text>

            <View className="flex-row items-center gap-2">
              <TextInput
                value={value}
                onChangeText={(t) => {
                  setValue(t.slice(0, MAX_LEN));
                  setError(null);
                }}
                placeholder="Masalan: Burgut-42"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={MAX_LEN}
                accessibilityLabel="Taxallus"
                className="flex-1 px-4 rounded-md text-base text-foreground dark:text-dark-text"
                style={{
                  height: 48,
                  backgroundColor: isDark ? '#1E3A5F' : '#F4F8FF',
                }}
              />
              <Pressable
                onPress={save}
                disabled={!canSave}
                accessibilityRole="button"
                accessibilityLabel="Saqlash"
                className="rounded-md items-center justify-center"
                style={{
                  width: 48,
                  height: 48,
                  backgroundColor: canSave ? '#60A5FA' : 'rgba(148,163,184,0.2)',
                }}
              >
                {update.isPending ? (
                  <ActivityIndicator color="#0A1628" />
                ) : (
                  <Check size={22} color={canSave ? '#0A1628' : '#94A3B8'} />
                )}
              </Pressable>
            </View>

            {error && (
              <View
                className="mt-3 rounded-md px-3 py-2"
                style={{ backgroundColor: 'rgba(239,68,68,0.15)' }}
              >
                <Text className="text-xs" style={{ color: '#F87171' }}>
                  {error}
                </Text>
              </View>
            )}

            <View className="flex-row items-center justify-between mt-5 mb-2">
              <Text className="text-sm font-medium text-muted-foreground dark:text-dark-muted">
                Tayyor variantlar
              </Text>
              <Pressable
                onPress={() => suggestions.refetch()}
                accessibilityRole="button"
                accessibilityLabel="Yangi variantlar"
                hitSlop={8}
                className="flex-row items-center gap-1 p-1"
              >
                <RefreshCw size={14} color="#60A5FA" />
                <Text className="text-xs" style={{ color: '#60A5FA' }}>
                  Yangilash
                </Text>
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {(suggestions.data ?? []).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => {
                      setValue(s);
                      setError(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={s}
                    className="rounded-full px-4 py-2"
                    style={{
                      backgroundColor:
                        value === s ? '#60A5FA' : 'rgba(96,165,250,0.15)',
                    }}
                  >
                    <Text
                      className="text-sm font-medium"
                      style={{ color: value === s ? '#0A1628' : '#60A5FA' }}
                    >
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
