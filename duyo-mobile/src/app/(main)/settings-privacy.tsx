import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  UserX,
} from 'lucide-react-native';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteMe } from '@/api/endpoints/me';
import { Text } from '@/components/text';
import { useT } from '@/i18n';
import { glass } from '@/lib/glass';
import { useAuthStore } from '@/store/auth';

/** Play wants the policy reachable from inside the app, not only from the
 *  listing — this is the page the store entry points at. */
const PRIVACY_URL = 'https://duyo.uz/privacy.html';
/** The terms carry the community rules for child-to-child messaging, which
 *  Play's UGC policy requires a user to be able to read. The app published
 *  them and then linked them nowhere. */
const TERMS_URL = 'https://duyo.uz/terms.html';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
// Same family as settings and notifications: frosted panes on pale blue.
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const DANGER = '#E0455E';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

interface PrivacyAction {
  key: string;
  Icon: typeof UserX;
  label: string;
  description: string;
  destructive?: boolean;
  onPress: () => void;
}

export default function PrivacySettingsScreen() {
  const t = useT();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  /**
   * Two taps, and the second one says what is actually about to happen.
   *
   * A single confirm on a destructive row this far down a settings screen is
   * how an account gets closed by accident. The first dialog explains, the
   * second is the point of no return — and the copy names what goes, because
   * "are you sure?" does not tell a thirteen-year-old that their chats,
   * memories and notes go with it.
   */
  /** Non-null while the typed confirmation is open; the text typed so far. */
  const [confirmText, setConfirmText] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const confirmWord = t('settings.privacyScreen.closeAccountWord');
  const canClose = confirmText?.trim().toUpperCase() === confirmWord.toUpperCase();

  const reallyClose = () => {
    setClosing(true);
    void deleteMe()
      // Signing out locally is what the child sees as "it happened"; the
      // server has already cascaded by now.
      .then(() => clearAuth())
      .catch(() => {
        setClosing(false);
        Alert.alert(
          t('settings.privacyScreen.closeAccountLabel'),
          t('common.checkInternetRetry'),
        );
      });
  };

  const handleCloseAccount = () => {
    Alert.alert(
      t('settings.privacyScreen.closeAccountLabel'),
      t('settings.privacyScreen.closeAccountBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.continue'),
          style: 'destructive',
          // Not a second dialog. Play's pre-launch report drives a Robo
          // crawler that taps every button it finds, dialog buttons included —
          // so two confirmations are two taps, and the account it would close
          // is the reviewer's own. Typing a word is something a crawler does
          // not do, and it is the standard shape for an irreversible action.
          onPress: () => setConfirmText(''),
        },
      ],
    );
  };

  const ACTIONS: readonly PrivacyAction[] = [
    {
      key: 'close',
      Icon: UserX,
      label: t('settings.privacyScreen.closeAccountLabel'),
      description: t('settings.privacyScreen.closeAccountDesc'),
      destructive: true,
      onPress: handleCloseAccount,
    },
  ];

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* ── Header: 48pt glass round, the inner-screen pattern ─────── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={[glass(24, 'sm'), styles.headerButton, styles.focusable]}
          >
            <ArrowLeft size={23} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>{t('settings.privacy')}</Text>
          {/* Keeps the title centred. */}
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* The policy is what the screen leads with, so it is the one pane
              held highest off the page. */}
          <View style={[glass(24, 'lg', 0.62), styles.policy]}>
            <View style={styles.policyHead}>
              <FileText size={18} color={PRIMARY} strokeWidth={2} />
              <Text style={styles.policyTitle}>
                {t('settings.privacyScreen.policyTitle')}
              </Text>
            </View>
            <Text style={styles.policyBody}>
              {t('settings.privacyScreen.policyBody')}
            </Text>
            <Pressable
              onPress={() => {
                void Linking.openURL(PRIVACY_URL).catch(() =>
                  Alert.alert(
                    t('settings.privacyScreen.policyTitle'),
                    PRIVACY_URL,
                  ),
                );
              }}
              accessibilityRole="link"
              accessibilityLabel={t('settings.privacyScreen.readFullA11y')}
              style={({ pressed }) => [
                glass(15, 'sm', 0.7),
                styles.readFull,
                styles.focusable,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.readFullText}>
                {t('settings.privacyScreen.readFull')}
              </Text>
              <ExternalLink size={14} color={PRIMARY} strokeWidth={2.2} />
            </Pressable>
            <Pressable
              onPress={() => {
                void Linking.openURL(TERMS_URL).catch(() =>
                  Alert.alert(t('settings.privacyScreen.termsTitle'), TERMS_URL),
                );
              }}
              accessibilityRole="link"
              accessibilityLabel={t('settings.privacyScreen.termsA11y')}
              style={({ pressed }) => [
                glass(15, 'sm', 0.7),
                styles.readFull,
                styles.focusable,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.readFullText}>
                {t('settings.privacyScreen.termsTitle')}
              </Text>
              <ExternalLink size={14} color={PRIMARY} strokeWidth={2.2} />
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('settings.privacyScreen.dataSection')}
            </Text>
            {ACTIONS.map((a) => (
              <Pressable
                key={a.key}
                onPress={a.onPress}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                style={({ pressed }) => [
                  glass(20, 'md'),
                  styles.action,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.actionRow}>
                  <View
                    style={[
                      styles.iconWell,
                      a.destructive && styles.iconWellDanger,
                    ]}
                  >
                    <a.Icon
                      size={18}
                      color={a.destructive ? DANGER : PRIMARY}
                      strokeWidth={2}
                    />
                  </View>
                  <View style={styles.actionBody}>
                    <Text
                      style={[
                        styles.actionLabel,
                        a.destructive && styles.actionLabelDanger,
                      ]}
                    >
                      {a.label}
                    </Text>
                    <Text style={styles.actionDesc}>{a.description}</Text>
                  </View>
                  <ChevronRight size={18} color={MUTED} strokeWidth={2.2} />
                </View>
              </Pressable>
            ))}

            {confirmText !== null && (
              <View style={[glass(20, 'md'), styles.confirmCard]}>
                <Text style={styles.confirmTitle}>
                  {t('settings.privacyScreen.closeAccountConfirmTitle')}
                </Text>
                <Text style={styles.confirmBody}>
                  {t('settings.privacyScreen.closeAccountTypeWord', {
                    word: confirmWord,
                  })}
                </Text>
                <TextInput
                  value={confirmText}
                  onChangeText={setConfirmText}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!closing}
                  placeholder={confirmWord}
                  placeholderTextColor={MUTED}
                  style={styles.confirmInput}
                  accessibilityLabel={t('settings.privacyScreen.closeAccountTypeWord', {
                    word: confirmWord,
                  })}
                />
                <View style={styles.confirmRow}>
                  <Pressable
                    onPress={() => setConfirmText(null)}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.cancel')}
                    style={[styles.confirmBtn, styles.focusable]}
                  >
                    <Text style={styles.confirmBtnText}>{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={reallyClose}
                    disabled={!canClose || closing}
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.privacyScreen.closeAccountConfirm')}
                    style={[
                      styles.confirmBtn,
                      styles.confirmBtnDanger,
                      (!canClose || closing) && styles.confirmBtnOff,
                      styles.focusable,
                    ]}
                  >
                    <Text style={styles.confirmBtnDangerText}>
                      {closing
                        ? t('common.sending')
                        : t('settings.privacyScreen.closeAccountConfirm')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  confirmCard: { gap: 10, marginTop: 12, padding: 16 },
  confirmTitle: { color: DANGER, fontSize: 15, fontWeight: '700' },
  confirmBody: { color: INK, fontSize: 13.5, lineHeight: 19 },
  confirmInput: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderColor: 'rgba(34,64,111,0.18)',
    borderRadius: 12,
    borderWidth: 1,
    color: INK,
    fontSize: 15,
    letterSpacing: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  confirmRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  confirmBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 12,
  },
  confirmBtnDanger: { backgroundColor: DANGER },
  confirmBtnDangerText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  confirmBtnOff: { opacity: 0.45 },
  confirmBtnText: { color: INK, fontSize: 14, fontWeight: '600' },
  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 14,
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flexGrow: 1, flexShrink: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: INK,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 48,
    gap: 18,
  },
  pressed: { opacity: 0.8 },
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  policy: { padding: 18 },
  policyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  policyTitle: {
    flexGrow: 1, flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: INK,
  },
  policyBody: {
    fontSize: 14,
    lineHeight: 21,
    color: MUTED,
    marginBottom: 14,
  },
  readFull: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  readFullText: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY,
  },

  section: { gap: 10 },
  sectionTitle: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: MUTED,
  },

  action: { padding: 16 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47,111,228,0.10)',
  },
  iconWellDanger: { backgroundColor: 'rgba(224,69,94,0.10)' },
  actionBody: { flex: 1, gap: 2 },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: INK,
  },
  actionLabelDanger: { color: DANGER },
  actionDesc: {
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
  },
});
