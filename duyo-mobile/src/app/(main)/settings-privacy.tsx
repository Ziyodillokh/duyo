import { LinearGradient } from 'expo-linear-gradient';
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
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { useT } from '@/i18n';
import { glass } from '@/lib/glass';

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
  // Nothing here can delete anything yet: the screen has no API client, and
  // DELETE /v1/me does not exist. Until it does, the only thing this row may
  // say is where a real person answers — a dialog that claims the account is
  // being closed would be a lie told to a 13-year-old.
  const handleCloseAccount = () => {
    Alert.alert(
      t('settings.privacyScreen.closeAccountLabel'),
      t('settings.privacyScreen.closeAccountManual'),
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
              onPress={() =>
                Alert.alert(
                  t('common.comingSoon'),
                  t('settings.privacyScreen.policySoon'),
                )
              }
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
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
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
