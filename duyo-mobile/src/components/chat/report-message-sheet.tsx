import {
  AlertTriangle,
  Check,
  ChevronRight,
  Flag,
  Ghost,
  HeartCrack,
  MoreHorizontal,
  ShieldAlert,
  X,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type AiReportReason } from '@/api/endpoints/chat';
import { Text } from '@/components/text';
import { useT, type TranslationKey } from '@/i18n';
import { glass, lift } from '@/lib/glass';

const INK = '#22406F';
const MUTED = '#8CA3CB';
const DANGER = '#E0455E';
const GREEN = '#22B573';

/**
 * The order they are offered in, worst first. A child scanning this list is
 * already upset, so the reason they are most likely looking for is the one
 * they read first.
 */
const REASONS: {
  key: AiReportReason;
  Icon: typeof Flag;
  labelKey: TranslationKey;
}[] = [
  { key: 'harmful', Icon: ShieldAlert, labelKey: 'chat.report.harmful' },
  { key: 'sexual', Icon: AlertTriangle, labelKey: 'chat.report.sexual' },
  { key: 'hateful', Icon: HeartCrack, labelKey: 'chat.report.hateful' },
  { key: 'scary', Icon: Ghost, labelKey: 'chat.report.scary' },
  { key: 'other', Icon: MoreHorizontal, labelKey: 'chat.report.other' },
];

/** Enough of the reply to recognise which one is being reported. */
const QUOTE_LINES = 4;

type Phase = 'picking' | 'sending' | 'sent' | 'failed';

/**
 * "Bu javob noto'g'ri edi" — reporting one of DUYO's OWN replies.
 *
 * Separate from the 👎 beside it on purpose. A thumbs-down is a preference
 * ("didn't like this answer"); this is a safety report, it names what was
 * wrong, and it reaches a queue a human reads. Google Play requires the second
 * of anything that declares a generative-AI feature and does not accept the
 * first in its place.
 *
 * A sheet rather than Alert.alert, which is what the peer surfaces still use:
 * Android's dialog renders at most three buttons, and five reasons plus a
 * cancel silently loses two of them. It also gives the confirmation somewhere
 * to live — a child who reports something and sees the screen simply close has
 * no reason to believe anyone was told.
 */
export function ReportMessageSheet({
  quote,
  onSubmit,
  onClose,
}: {
  /** The reply being reported, quoted back so the child can check it. */
  quote: string;
  onSubmit: (reason: AiReportReason) => Promise<void>;
  onClose: () => void;
}) {
  const t = useT();
  // Mounted only while a report is open, so both of these start fresh each
  // time and reopening on another reply cannot inherit the last one's
  // confirmation screen.
  const [phase, setPhase] = useState<Phase>('picking');
  /** Which row is in flight, so the spinner lands on the one that was tapped. */
  const [pending, setPending] = useState<AiReportReason | null>(null);
  const [slide] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(slide, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 170,
      mass: 0.9,
    }).start();
  }, [slide]);

  const pick = (reason: AiReportReason) => {
    setPending(reason);
    setPhase('sending');
    onSubmit(reason)
      .then(() => setPhase('sent'))
      .catch(() => setPhase('failed'));
  };

  const sent = phase === 'sent';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={styles.scrim}
        />

        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [
                {
                  translateY: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [420, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <SafeAreaView edges={['bottom']}>
            <View style={styles.handleRow}>
              <View style={styles.handle} />
            </View>

            <View style={styles.body}>
              <View style={styles.headerRow}>
                <View
                  style={[
                    styles.iconWell,
                    { backgroundColor: sent ? `${GREEN}1F` : `${DANGER}1F` },
                  ]}
                >
                  {sent ? (
                    <Check size={22} color={GREEN} />
                  ) : (
                    <Flag size={22} color={DANGER} />
                  )}
                </View>

                <View style={styles.headerText}>
                  <Text style={styles.title}>
                    {sent ? t('chat.report.sentTitle') : t('chat.report.title')}
                  </Text>
                  <Text style={styles.hint}>
                    {sent ? t('chat.report.sentBody') : t('chat.report.body')}
                  </Text>
                </View>

                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                  hitSlop={10}
                  style={[styles.close, styles.focusable]}
                >
                  <X size={16} color={MUTED} />
                </Pressable>
              </View>

              {!sent && (
                <>
                  <View style={styles.quote}>
                    <Text style={styles.quoteText} numberOfLines={QUOTE_LINES}>
                      {quote}
                    </Text>
                  </View>

                  {phase === 'failed' && (
                    <Text style={styles.error}>{t('chat.report.failed')}</Text>
                  )}

                  {/* Scrolls: five rows plus the quote outgrow a small phone
                      in landscape, and a reason a child cannot reach is a
                      reason they do not have. */}
                  <ScrollView
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                  >
                    {REASONS.map(({ key, Icon, labelKey }) => (
                      <Pressable
                        key={key}
                        onPress={() => pick(key)}
                        disabled={phase === 'sending'}
                        accessibilityRole="button"
                        accessibilityLabel={t(labelKey)}
                        accessibilityState={{ disabled: phase === 'sending' }}
                        style={({ pressed }) => [
                          styles.reason,
                          pressed && styles.reasonPressed,
                          styles.focusable,
                        ]}
                      >
                        <Icon size={19} color={DANGER} />
                        <Text style={styles.reasonText}>{t(labelKey)}</Text>
                        {pending === key && phase === 'sending' ? (
                          <ActivityIndicator size="small" color={MUTED} />
                        ) : (
                          <ChevronRight size={17} color={MUTED} />
                        )}
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              )}

              {sent && (
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                  style={({ pressed }) => [
                    styles.done,
                    pressed && styles.reasonPressed,
                    styles.focusable,
                  ]}
                >
                  <Text style={styles.doneText}>{t('common.close')}</Text>
                </Pressable>
              )}
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { flex: 1, backgroundColor: 'rgba(4,10,22,0.62)' },

  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(224,69,94,0.26)',
    boxShadow: lift('xl'),
  },

  handleRow: { alignItems: 'center', paddingTop: 12 },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(16,32,51,0.15)',
  },

  body: { padding: 22, paddingTop: 16 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWell: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontWeight: '700', color: INK },
  hint: { fontSize: 12, marginTop: 2, color: MUTED },

  close: {
    ...glass(18, 'sm', 0.55),
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  quote: {
    marginTop: 16,
    borderRadius: 20,
    padding: 15,
    borderLeftWidth: 3,
    borderLeftColor: DANGER,
    backgroundColor: 'rgba(224,69,94,0.05)',
    boxShadow: lift('flush'),
  },
  quoteText: { fontSize: 15, lineHeight: 22, color: INK },

  error: { marginTop: 12, fontSize: 13, color: DANGER },

  // Capped so the sheet never grows past roughly half the screen; the rows
  // scroll inside it instead of pushing the header off the top.
  list: { marginTop: 14, maxHeight: 280 },
  listContent: { gap: 8 },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(16,32,51,0.10)',
  },
  reasonPressed: { opacity: 0.7 },
  reasonText: { flex: 1, fontSize: 15, fontWeight: '500', color: INK },

  done: {
    marginTop: 20,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(16,32,51,0.12)',
  },
  doneText: { fontSize: 16, fontWeight: '600', color: INK },
});
