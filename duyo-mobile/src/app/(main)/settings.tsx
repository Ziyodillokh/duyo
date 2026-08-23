import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  BrainCircuit,
  Crown,
  Globe,
  HelpCircle,
  LogOut,
  Mic,
  Moon,
  Shield,
  // Users, // OTA-ONA BO'LIMI O'CHIRILGAN — qatori bilan birga kommentda
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsRow } from '@/components/v2/dark/settings-row';
import { SettingsSection } from '@/components/v2/dark/settings-section';
import { LANGUAGE_NAMES, useT } from '@/i18n';
import { useAuthStore } from '@/store/auth';
import { useChildStore } from '@/store/child';
import { useLanguageStore } from '@/store/language';
import { useMascotStore } from '@/store/mascot';
import { useThemeStore , useIsDark } from '@/store/theme';


export default function SettingsScreen() {
  const t = useT();
  const isDark = useIsDark();
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
        colors={['rgba(96, 165, 250, 0.20)', 'rgba(252, 211, 77, 0.20)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' }]} />
      <LinearGradient
        colors={['rgba(96, 165, 250, 0.15)', 'rgba(252, 211, 77, 0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View className="flex-row items-center gap-3 px-6 py-4">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            className="w-10 h-10 items-center justify-center"
          >
            <ArrowLeft size={20} color={isDark ? '#E0E7FF' : '#102033'} />
          </Pressable>
          <Text className="text-2xl font-bold text-foreground dark:text-dark-text">
            {t('settings.title')}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          <SettingsSection title={t('settings.section.general')}>
            <SettingsRow
              Icon={Globe}
              label={t('settings.language')}
              trailing={
                <Text className="text-sm text-muted-foreground dark:text-dark-muted">
                  {LANGUAGE_NAMES[language]}
                </Text>
              }
              showChevron
              onPress={() => router.push('/(main)/settings-language')}
            />
            <SettingsRow
              Icon={Moon}
              label={t('settings.darkMode')}
              trailing={
                <Switch
                  value={themeMode === 'dark'}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#334155', true: '#60A5FA' }}
                  thumbColor={isDark ? "#0A1628" : "#FFFFFF"}
                />
              }
            />
            <SettingsRow
              Icon={Bell}
              label={t('settings.notifications')}
              trailing={
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                  trackColor={{ false: '#334155', true: '#60A5FA' }}
                  thumbColor={isDark ? "#0A1628" : "#FFFFFF"}
                />
              }
            />
            <SettingsRow
              Icon={Mic}
              label={t('settings.voice')}
              showChevron
              isLast
              onPress={() => router.push('/(main)/settings-voice')}
            />
          </SettingsSection>

          <SettingsSection title={t('settings.section.safety')}>
            <SettingsRow
              Icon={BrainCircuit}
              label={t('settings.memory')}
              trailing={
                <Text className="text-sm text-muted-foreground dark:text-dark-muted">
                  {t('settings.memoryValue')}
                </Text>
              }
              showChevron
              onPress={() => router.push('/(main)/memory')}
            />
            <SettingsRow
              Icon={Shield}
              label={t('settings.privacy')}
              showChevron
              isLast
              onPress={() => router.push('/(main)/settings-privacy')}
            />
            {/* OTA-ONA BO'LIMI O'CHIRILGAN — ilova hozircha faqat bola uchun.
                Qatorning asl kodi:
            <SettingsRow
              Icon={Users}
              label={t('settings.parentLink')}
              trailing={
                <View className="bg-emerald-400/30 rounded-full px-3 py-1">
                  <Text className="text-xs text-emerald-400">
                    {t('settings.parentLinkConnected')}
                  </Text>
                </View>
              }
              showChevron
              isLast
              onPress={() => router.push('/(main)/parent-connection')}
            />
            */}
          </SettingsSection>

          <SettingsSection title={t('settings.section.subscription')}>
            <SettingsRow
              Icon={Crown}
              label={t('settings.plan')}
              trailing={
                <Text className="text-sm text-muted-foreground dark:text-dark-muted">
                  {t('settings.planValue')}
                </Text>
              }
              showChevron
              isLast
              onPress={() => router.push('/(main)/subscription')}
            />
          </SettingsSection>

          <SettingsSection title={t('settings.section.help')}>
            <SettingsRow
              Icon={HelpCircle}
              label={t('settings.help')}
              showChevron
              isLast
              onPress={() => router.push('/(main)/settings-help')}
            />
          </SettingsSection>

          <Pressable
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel={t('settings.logout')}
            className="flex-row items-center justify-center gap-2 py-3"
          >
            <LogOut size={16} color="#F87171" />
            <Text className="text-sm font-medium text-red-400">
              {t('settings.logout')}
            </Text>
          </Pressable>

          <View className="items-center gap-1 pt-4">
            <Text className="text-sm text-muted-foreground dark:text-dark-muted">DUYO v1.0.0</Text>
            <Text className="text-sm text-muted-foreground dark:text-dark-muted">
              {t('common.copyright')}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
