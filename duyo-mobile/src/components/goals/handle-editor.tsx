import { Check, RefreshCw, X } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Text, TextInput } from '@/components/text';

import { KeyboardAvoidingView } from '@/components/keyboard-avoiding-view';
import { handleRejectionMessage } from '@/api/endpoints/social';
import { useHandleSuggestions, useUpdateSocialSettings } from '@/hooks/use-social';
import { useT } from '@/i18n';
import { glass, lift } from '@/lib/glass';

const MAX_LEN = 20;

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
// The sheet opens over the goals page and the peers list, both of which are
// pale blue glass now, so it is one light material too — the navy variant it
// used to carry would have dropped a different app over a light page.
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const DANGER = '#E0455E';
const PLACEHOLDER = '#7693C2';
const MUTED_WASH = 'rgba(140,163,203,0.16)';

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
  const t = useT();
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
          setError(handleRejectionMessage(err) ?? t('handle.saveFailed')),
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <KeyboardAvoidingView behavior="padding">
          {/* Chrome floating over the page: the top of the ladder, 'xl'. */}
          <View style={styles.sheet}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{t('handle.title')}</Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                hitSlop={10}
                style={[styles.closeButton, styles.focusable]}
              >
                <X size={20} color={MUTED} />
              </Pressable>
            </View>
            <Text style={styles.subtitle}>{t('handle.subtitle')}</Text>

            <View style={styles.inputRow}>
              <TextInput
                value={value}
                onChangeText={(t) => {
                  setValue(t.slice(0, MAX_LEN));
                  setError(null);
                }}
                placeholder={t('handle.placeholder')}
                placeholderTextColor={PLACEHOLDER}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={MAX_LEN}
                accessibilityLabel={t('handle.label')}
                style={styles.input}
              />
              <Pressable
                onPress={save}
                disabled={!canSave}
                accessibilityRole="button"
                accessibilityLabel={t('common.save')}
                style={[
                  styles.saveButton,
                  canSave ? styles.saveOn : styles.saveOff,
                  styles.focusable,
                ]}
              >
                {update.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Check size={22} color={canSave ? '#FFFFFF' : MUTED} />
                )}
              </Pressable>
            </View>

            {/* `? :`, not `&&`: an empty rejection string would reach React as
                a bare text node, which inside a View is a hard error on
                react-native-web. */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.suggestHead}>
              <Text style={styles.suggestLabel}>{t('handle.suggestions')}</Text>
              <Pressable
                onPress={() => suggestions.refetch()}
                accessibilityRole="button"
                accessibilityLabel={t('handle.a11yRefresh')}
                hitSlop={8}
                style={[styles.refresh, styles.focusable]}
              >
                <RefreshCw size={14} color={PRIMARY} />
                <Text style={styles.refreshText}>{t('common.refresh')}</Text>
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.suggestRow}>
                {(suggestions.data ?? []).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => {
                      setValue(s);
                      setError(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={s}
                    style={[
                      styles.suggestion,
                      value === s ? styles.suggestionOn : styles.suggestionOff,
                      styles.focusable,
                    ]}
                  >
                    <Text
                      style={
                        value === s
                          ? styles.suggestionLabelOn
                          : styles.suggestionLabel
                      }
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

const styles = StyleSheet.create({
  // The browser draws a square focus ring around whatever was last clicked,
  // which is the wrong shape on every rounded control below.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  // Tinted rather than neutral black: the page behind is pale blue, and a grey
  // scrim over it reads as dirt on the glass the same way a grey shadow does.
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,38,74,0.38)' },
  sheet: {
    ...glass(30, 'xl', 0.96),
    // Only the top corners are visible; the bottom edge runs off the screen.
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 24,
    paddingBottom: 36,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: { fontSize: 19, fontWeight: '700', color: INK },
  // 34pt, because hitSlop does not grow the clickable box on web and an
  // icon-only control needs a real target there.
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MUTED_WASH,
  },
  subtitle: { fontSize: 13.5, lineHeight: 19, color: MUTED, marginBottom: 16 },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    fontSize: 16,
    color: INK,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(47,111,228,0.12)',
    boxShadow: lift('sm'),
    // The browser's own focus ring is a square drawn outside the radius.
    outlineStyle: 'none',
    outlineWidth: 0,
  } as unknown as TextStyle,
  saveButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveOn: { backgroundColor: PRIMARY, boxShadow: lift('sm') },
  // Not PRIMARY at low opacity: a translucent button lets the sheet through
  // and reads as a hole rather than a dimmed control.
  saveOff: { backgroundColor: MUTED_WASH },

  errorBox: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(224,69,94,0.10)',
  },
  errorText: { fontSize: 12, lineHeight: 17, color: DANGER },

  suggestHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 8,
  },
  suggestLabel: { fontSize: 13.5, fontWeight: '600', color: MUTED },
  refresh: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  refreshText: { fontSize: 12, fontWeight: '600', color: PRIMARY },

  suggestRow: { flexDirection: 'row', gap: 8 },
  suggestion: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Unchosen chips are 'flush' — they are drawn ON the sheet, and a pane that
  // shadows the pane it is part of is the tell that depth is being faked. The
  // chosen one lifts off it by exactly one rung, which is the whole signal.
  suggestionOff: glass(999, 'flush', 0.72),
  // Same 1pt border as the unchosen chips, so choosing one does not resize it.
  suggestionOn: {
    backgroundColor: PRIMARY,
    borderWidth: 1,
    borderColor: PRIMARY,
    boxShadow: lift('sm'),
  },
  suggestionLabel: { fontSize: 13.5, fontWeight: '600', color: INK },
  suggestionLabelOn: { fontSize: 13.5, fontWeight: '600', color: '#FFFFFF' },
});
