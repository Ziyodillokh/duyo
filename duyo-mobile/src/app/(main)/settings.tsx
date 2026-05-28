import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  Crown,
  HelpCircle,
  Languages,
  LogOut,
  Mic,
  Moon,
  Shield,
  Users,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsRow } from '@/components/v2/dark/settings-row';
import { SettingsSection } from '@/components/v2/dark/settings-section';
import { useAuthStore } from '@/store/auth';
import { useChildStore } from '@/store/child';
import { useLanguageStore } from '@/store/language';
import { useThemeStore } from '@/store/theme';

const LANGUAGE_LABELS = {
  uz: "O'zbek",
  ru: 'Русский',
  en: 'English',
} as const;

export default function SettingsScreen() {
  const language = useLanguageStore((s) => s.language);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const clearChild = useChildStore((s) => s.clearChild);
  const themeMode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const [notifications, setNotifications] = useState(true);

  const handleLogout = () => {
    Alert.alert('Chiqish', "Hisobdan chiqishni xohlaysizmi?", [
      { text: 'Bekor qilish', style: 'cancel' },
      {
        text: 'Chiqish',
        style: 'destructive',
        onPress: () => {
          clearAuth();
          clearChild();
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
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A1628' }]} />
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
            accessibilityLabel="Orqaga"
            className="w-10 h-10 items-center justify-center"
          >
            <ArrowLeft size={20} color="#E0E7FF" />
          </Pressable>
          <Text className="text-2xl font-bold text-foreground dark:text-dark-text">Sozlamalar</Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          <SettingsSection title="Umumiy">
            <SettingsRow
              Icon={Languages}
              label="Til"
              trailing={
                <Text className="text-sm text-muted-foreground dark:text-dark-muted">
                  {LANGUAGE_LABELS[language]}
                </Text>
              }
              showChevron
              onPress={() => router.push('/(main)/settings-language')}
            />
            <SettingsRow
              Icon={Moon}
              label="Qorongʻu rejim"
              trailing={
                <Switch
                  value={themeMode === 'dark'}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#334155', true: '#60A5FA' }}
                  thumbColor="#0A1628"
                />
              }
            />
            <SettingsRow
              Icon={Bell}
              label="Bildirishnomalar"
              trailing={
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                  trackColor={{ false: '#334155', true: '#60A5FA' }}
                  thumbColor="#0A1628"
                />
              }
            />
            <SettingsRow
              Icon={Mic}
              label="Ovoz sozlamalari"
              showChevron
              isLast
              onPress={() => router.push('/(main)/settings-voice')}
            />
          </SettingsSection>

          <SettingsSection title="Xavfsizlik">
            <SettingsRow
              Icon={Shield}
              label="Maxfiylik"
              showChevron
              onPress={() => router.push('/(main)/settings-privacy')}
            />
            <SettingsRow
              Icon={Users}
              label="Ota-ona ulanishi"
              trailing={
                <View className="bg-emerald-400/30 rounded-full px-3 py-1">
                  <Text className="text-xs text-emerald-400">Ulangan</Text>
                </View>
              }
              showChevron
              isLast
              onPress={() => router.push('/(main)/parent-connection')}
            />
          </SettingsSection>

          <SettingsSection title="Obuna">
            <SettingsRow
              Icon={Crown}
              label="Obuna rejasi"
              trailing={<Text className="text-sm text-muted-foreground dark:text-dark-muted">Do'st</Text>}
              showChevron
              isLast
              onPress={() => router.push('/(main)/subscription')}
            />
          </SettingsSection>

          <SettingsSection title="Yordam">
            <SettingsRow
              Icon={HelpCircle}
              label="Yordam"
              showChevron
              isLast
              onPress={() => router.push('/(main)/settings-help')}
            />
          </SettingsSection>

          <Pressable
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Chiqish"
            className="flex-row items-center justify-center gap-2 py-3"
          >
            <LogOut size={16} color="#F87171" />
            <Text className="text-sm font-medium text-red-400">Chiqish</Text>
          </Pressable>

          <View className="items-center gap-1 pt-4">
            <Text className="text-sm text-muted-foreground dark:text-dark-muted">DUYO v1.0.0</Text>
            <Text className="text-sm text-muted-foreground dark:text-dark-muted">
              © 2026 DUYO. Barcha huquqlar himoyalangan.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
