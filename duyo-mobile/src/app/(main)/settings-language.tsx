import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { updateChild } from '@/api/endpoints/children';
import { FlagIcon } from '@/components/v2/flag-icon';
import { LANGUAGE_NAMES, useT, type TranslationKey } from '@/i18n';
import { useChildStore } from '@/store/child';
import { type Language, useLanguageStore } from '@/store/language';
import { useIsDark } from '@/store/theme';

interface LanguageOption {
  code: Language;
  hintKey: TranslationKey;
}

const OPTIONS: readonly LanguageOption[] = [
  { code: 'uz', hintKey: 'settings.languageScreen.hintUz' },
  { code: 'ru', hintKey: 'settings.languageScreen.hintRu' },
  { code: 'en', hintKey: 'settings.languageScreen.hintEn' },
];

export default function LanguageSettingsScreen() {
  const t = useT();
  const isDark = useIsDark();
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const child = useChildStore((s) => s.child);
  const setChild = useChildStore((s) => s.setChild);

  const handleSelect = (code: Language) => {
    if (code === language) return;
    setLanguage(code);

    // The profile carries the language the server reasons about — DUYO's
    // replies and generated content follow it. Best-effort: the UI has
    // already switched, and a failed sync must not block that.
    if (child) {
      setChild({ ...child, language: code });
      void updateChild(child.id, { language: code }).catch(() => undefined);
    }
  };

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
            {t('settings.language')}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 12, paddingBottom: 48 }}
        >
          <Text className="text-sm text-muted-foreground dark:text-dark-muted mb-2">
            {t('settings.languageScreen.subtitle')}
          </Text>
          {OPTIONS.map((opt) => {
            const isSel = opt.code === language;
            return (
              <Pressable
                key={opt.code}
                onPress={() => handleSelect(opt.code)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={LANGUAGE_NAMES[opt.code]}
                className={`rounded-xl border active:opacity-80 ${
                  isSel
                    ? 'bg-neon-blue/10 border-neon-blue'
                    : 'bg-card dark:bg-dark-surface border-neon-blue/20'
                }`}
                style={{ padding: 16 }}
              >
                <View className="flex-row items-center gap-3">
                  <FlagIcon code={opt.code} width={32} />
                  <View className="flex-1">
                    <Text className="text-base font-medium text-foreground dark:text-dark-text">
                      {LANGUAGE_NAMES[opt.code]}
                    </Text>
                    <Text className="text-sm text-muted-foreground dark:text-dark-muted">
                      {t(opt.hintKey)}
                    </Text>
                  </View>
                  {isSel && <Check size={20} color="#60A5FA" />}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
