import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  BrainCircuit,
  ChevronRight,
  Crown,
  Globe,
  HelpCircle,
  LogOut,
  Mic,
  Moon,
  Shield,
  type LucideIcon,
  // Users, // OTA-ONA BO'LIMI O'CHIRILGAN — qatori bilan birga kommentda
} from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { LANGUAGE_NAMES, useT } from '@/i18n';
import { glass } from '@/lib/glass';
import { useAuthStore } from '@/store/auth';
import { useChildStore } from '@/store/child';
import { useLanguageStore } from '@/store/language';
import { useMascotStore } from '@/store/mascot';
import { useThemeStore } from '@/store/theme';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
// Same family as notifications and goal-mates: frosted panes on pale blue.
// The screen commits to the light look the way its siblings do — the theme
// toggle below still drives the screens that carry a dark variant.
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const DANGER = '#E0455E';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';
const HAIRLINE = 'rgba(47,111,228,0.10)';

export default function SettingsScreen() {
  const t = useT();
  const language = useLanguageStore((s) => s.language);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const clearChild = useChildStore((s) => s.clearChild);
  const resetMascot = useMascotStore((s) => s.setVariant);
  const themeMode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const [notifications, setNotifications] = useState(true);

  const handleLogout = () => {
    Alert.alert(t('settings.logout'), t('settings.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.logout'),
        style: 'destructive',
        onPress: () => {
          clearAuth();
          clearChild();
          // The next child picks their own body during onboarding.
          resetMascot('duyo');
          router.replace('/(onboarding)/language');
        },
      },
    ]);
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* ── Header: the inner-screen glass pattern ─────────────────── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={[glass(24, 'sm'), styles.headerButton]}
          >
            <ArrowLeft size={23} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>{t('settings.title')}</Text>
          {/* Keeps the title centred. */}
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 6,
            paddingBottom: 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Section title={t('settings.section.general')}>
            <Row
              Icon={Globe}
              label={t('settings.language')}
              value={LANGUAGE_NAMES[language]}
              onPress={() => router.push('/(main)/settings-language')}
            />
            <Row
              Icon={Moon}
              label={t('settings.darkMode')}
              trailing={
                <Switch
                  value={themeMode === 'dark'}
                  onValueChange={toggleTheme}
                  trackColor={{ false: 'rgba(140,163,203,0.35)', true: PRIMARY }}
                  thumbColor="#FFFFFF"
                />
              }
            />
            <Row
              Icon={Bell}
              label={t('settings.notifications')}
              trailing={
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                  trackColor={{ false: 'rgba(140,163,203,0.35)', true: PRIMARY }}
                  thumbColor="#FFFFFF"
                />
              }
            />
            <Row
              Icon={Mic}
              label={t('settings.voice')}
              onPress={() => router.push('/(main)/settings-voice')}
              isLast
            />
          </Section>

          <Section title={t('settings.section.safety')}>
            <Row
              Icon={BrainCircuit}
              label={t('settings.memory')}
              value={t('settings.memoryValue')}
              onPress={() => router.push('/(main)/memory')}
            />
            <Row
              Icon={Shield}
              label={t('settings.privacy')}
              onPress={() => router.push('/(main)/settings-privacy')}
              isLast
            />
            {/* OTA-ONA BO'LIMI O'CHIRILGAN — ilova hozircha faqat bola uchun.
                Qatorning asl kodi:
            <Row
              Icon={Users}
              label={t('settings.parentLink')}
              value={t('settings.parentLinkConnected')}
              onPress={() => router.push('/(main)/parent-connection')}
              isLast
            />
            */}
          </Section>

          <Section title={t('settings.section.subscription')}>
            <Row
              Icon={Crown}
              label={t('settings.plan')}
              value={t('settings.planValue')}
              onPress={() => router.push('/(main)/subscription')}
              isLast
            />
          </Section>

          <Section title={t('settings.section.help')}>
            <Row
              Icon={HelpCircle}
              label={t('settings.help')}
              onPress={() => router.push('/(main)/settings-help')}
              isLast
            />
          </Section>

          {/* Logout is its own pane — an exit should not sit inside a group
              of preferences a child taps casually. */}
          <Pressable
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel={t('settings.logout')}
            style={[glass(22, 'md', 0.5), styles.logout]}
          >
            <LogOut size={18} color={DANGER} strokeWidth={2.2} />
            <Text style={styles.logoutText}>{t('settings.logout')}</Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>DUYO v1.0.0</Text>
            <Text style={styles.footerText}>{t('common.copyright')}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── The glass settings vocabulary ────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={[glass(22, 'md', 0.6), styles.pane]}>{children}</View>
    </View>
  );
}

function Row({
  Icon,
  label,
  value,
  trailing,
  onPress,
  isLast,
}: {
  Icon: LucideIcon;
  label: string;
  value?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      style={[styles.row, !isLast && styles.rowDivider]}
    >
      <View style={styles.iconWell}>
        <Icon size={19} color={PRIMARY} strokeWidth={2} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      {!!value && <Text style={styles.rowValue}>{value}</Text>}
      {trailing}
      {onPress && <ChevronRight size={18} color={MUTED} strokeWidth={2.2} />}
    </Pressable>
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
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: INK,
  },

  section: { marginBottom: 18 },
  sectionTitle: {
    marginLeft: 6,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: MUTED,
  },
  pane: { paddingHorizontal: 14 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47,111,228,0.10)',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: INK,
  },
  rowValue: {
    fontSize: 13,
    color: MUTED,
  },

  logout: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: DANGER,
  },

  footer: {
    alignItems: 'center',
    gap: 2,
    paddingTop: 22,
  },
  footerText: {
    fontSize: 12,
    color: MUTED,
  },
});
