import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Language, useLanguageStore } from '@/store/language';

interface LanguageOption {
  code: Language;
  flag: string;
  label: string;
  hint: string;
}

const OPTIONS: ReadonlyArray<LanguageOption> = [
  { code: 'uz', flag: '🇺🇿', label: "O'zbek", hint: 'Default' },
  { code: 'ru', flag: '🇷🇺', label: 'Русский', hint: 'Russian' },
  { code: 'en', flag: '🇬🇧', label: 'English', hint: 'English' },
];

export default function LanguageSettingsScreen() {
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const handleSelect = (code: Language) => {
    setLanguage(code);
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A1628' }]} />
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
            accessibilityLabel="Orqaga"
            className="w-10 h-10 items-center justify-center"
          >
            <ArrowLeft size={20} color="#E0E7FF" />
          </Pressable>
          <Text className="text-xl font-bold text-dark-text">Til</Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 12, paddingBottom: 48 }}
        >
          <Text className="text-sm text-dark-muted mb-2">
            Ilova tilini tanlang
          </Text>
          {OPTIONS.map((opt) => {
            const isSel = opt.code === language;
            return (
              <Pressable
                key={opt.code}
                onPress={() => handleSelect(opt.code)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={opt.label}
                className={`rounded-xl border active:opacity-80 ${
                  isSel
                    ? 'bg-neon-blue/10 border-neon-blue'
                    : 'bg-dark-surface border-neon-blue/20'
                }`}
                style={{ padding: 16 }}
              >
                <View className="flex-row items-center gap-3">
                  <Text className="text-3xl">{opt.flag}</Text>
                  <View className="flex-1">
                    <Text className="text-base font-medium text-dark-text">
                      {opt.label}
                    </Text>
                    <Text className="text-sm text-dark-muted">{opt.hint}</Text>
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
