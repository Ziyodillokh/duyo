import { useIsDark } from '@/store/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  MessageSquare,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT, type TranslationKey } from '@/i18n';

interface FAQItem {
  id: string;
  questionKey: TranslationKey;
  answerKey: TranslationKey;
}

const FAQ_ITEMS: readonly FAQItem[] = [
  {
    id: 'q1',
    questionKey: 'settings.helpScreen.q1',
    answerKey: 'settings.helpScreen.a1',
  },
  {
    id: 'q2',
    questionKey: 'settings.helpScreen.q2',
    answerKey: 'settings.helpScreen.a2',
  },
  {
    id: 'q3',
    questionKey: 'settings.helpScreen.q3',
    answerKey: 'settings.helpScreen.a3',
  },
  {
    id: 'q4',
    questionKey: 'settings.helpScreen.q4',
    answerKey: 'settings.helpScreen.a4',
  },
  {
    id: 'q5',
    questionKey: 'settings.helpScreen.q5',
    answerKey: 'settings.helpScreen.a5',
  },
];

export default function HelpSettingsScreen() {
  const t = useT();
  const isDark = useIsDark();
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) =>
    setOpenId((current) => (current === id ? null : id));

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' }]} />
      <LinearGradient
        colors={['rgba(96, 165, 250, 0.20)', 'rgba(252, 211, 77, 0.15)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.97, y: 1 }}
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
          <Text className="text-xl font-bold text-foreground dark:text-dark-text">
            {t('settings.help')}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 48 }}
        >
          <View className="gap-3">
            <Text className="text-sm text-muted-foreground dark:text-dark-muted">
              {t('settings.helpScreen.faqSection')}
            </Text>
            {FAQ_ITEMS.map((f) => {
              const isOpen = openId === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => toggle(f.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  accessibilityLabel={t(f.questionKey)}
                  className="rounded-xl bg-card dark:bg-dark-surface border border-neon-blue/20 active:opacity-80"
                  style={{ padding: 16 }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-medium text-foreground dark:text-dark-text flex-1 mr-2">
                      {t(f.questionKey)}
                    </Text>
                    {isOpen ? (
                      <ChevronUp size={20} color="#94A3B8" />
                    ) : (
                      <ChevronDown size={20} color="#94A3B8" />
                    )}
                  </View>
                  {isOpen && (
                    <Text className="text-sm text-muted-foreground dark:text-dark-muted leading-6 mt-3">
                      {t(f.answerKey)}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View className="gap-3">
            <Text className="text-sm text-muted-foreground dark:text-dark-muted">
              {t('settings.helpScreen.contact')}
            </Text>
            <Pressable
              onPress={() =>
                Alert.alert(
                  t('settings.helpScreen.email'),
                  t('settings.helpScreen.emailBody'),
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Email"
              className="rounded-xl bg-card dark:bg-dark-surface border border-neon-blue/20 active:opacity-80"
              style={{ padding: 16 }}
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="w-10 h-10 items-center justify-center rounded-md"
                  style={{ backgroundColor: 'rgba(96, 165, 250, 0.10)' }}
                >
                  <Mail size={18} color="#60A5FA" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-foreground dark:text-dark-text">
                    {t('settings.helpScreen.email')}
                  </Text>
                  <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1">
                    support@duyo.uz
                  </Text>
                </View>
                <ExternalLink size={18} color="#94A3B8" />
              </View>
            </Pressable>

            <Pressable
              onPress={() =>
                Alert.alert(
                  'Telegram',
                  t('settings.helpScreen.telegramBody'),
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Telegram"
              className="rounded-xl bg-card dark:bg-dark-surface border border-neon-blue/20 active:opacity-80"
              style={{ padding: 16 }}
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="w-10 h-10 items-center justify-center rounded-md"
                  style={{ backgroundColor: 'rgba(96, 165, 250, 0.10)' }}
                >
                  <MessageSquare size={18} color="#60A5FA" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-foreground dark:text-dark-text">
                    {t('settings.helpScreen.telegram')}
                  </Text>
                  <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1">
                    @duyo_support
                  </Text>
                </View>
                <ExternalLink size={18} color="#94A3B8" />
              </View>
            </Pressable>
          </View>

          <View className="items-center gap-1 pt-4">
            <Text className="text-sm text-muted-foreground dark:text-dark-muted">DUYO v1.0.0</Text>
            <Text className="text-xs text-muted-foreground dark:text-dark-muted">
              {t('common.copyright')}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
