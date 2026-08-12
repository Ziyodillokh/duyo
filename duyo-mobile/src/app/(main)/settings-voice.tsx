import { useIsDark } from '@/store/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Check, Play } from 'lucide-react-native';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT, type TranslationKey } from '@/i18n';

interface VoiceOption {
  key: string;
  /** Gemini voice name — a proper noun, never translated. */
  label: string;
  descriptionKey: TranslationKey;
}

const VOICE_OPTIONS: readonly VoiceOption[] = [
  { key: 'kore', label: 'Kore', descriptionKey: 'settings.voiceScreen.voiceKore' },
  { key: 'aoede', label: 'Aoede', descriptionKey: 'settings.voiceScreen.voiceAoede' },
  { key: 'charon', label: 'Charon', descriptionKey: 'settings.voiceScreen.voiceCharon' },
  { key: 'fenrir', label: 'Fenrir', descriptionKey: 'settings.voiceScreen.voiceFenrir' },
  { key: 'leda', label: 'Leda', descriptionKey: 'settings.voiceScreen.voiceLeda' },
];

const SPEED_OPTIONS: readonly {
  key: string;
  labelKey: TranslationKey;
  multiplier: number;
}[] = [
  { key: 'slow', labelKey: 'settings.voiceScreen.speedSlow', multiplier: 0.8 },
  { key: 'normal', labelKey: 'settings.voiceScreen.speedNormal', multiplier: 1.0 },
  { key: 'fast', labelKey: 'settings.voiceScreen.speedFast', multiplier: 1.25 },
];

export default function VoiceSettingsScreen() {
  const t = useT();
  const isDark = useIsDark();
  const [selectedVoice, setSelectedVoice] = useState('kore');
  const [selectedSpeed, setSelectedSpeed] = useState('normal');

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
            {t('settings.voice')}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 48 }}
        >
          <View className="gap-3">
            <Text className="text-sm text-muted-foreground dark:text-dark-muted">
              {t('settings.voiceScreen.duyoVoice')}
            </Text>
            {VOICE_OPTIONS.map((v) => {
              const isSel = v.key === selectedVoice;
              return (
                <Pressable
                  key={v.key}
                  onPress={() => setSelectedVoice(v.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSel }}
                  accessibilityLabel={v.label}
                  className={`rounded-xl border active:opacity-80 ${
                    isSel
                      ? 'bg-neon-blue/10 border-neon-blue'
                      : 'bg-card dark:bg-dark-surface border-neon-blue/20'
                  }`}
                  style={{ padding: 16 }}
                >
                  <View className="flex-row items-center gap-3">
                    <View className="flex-1">
                      <Text className="text-base font-medium text-foreground dark:text-dark-text">
                        {v.label}
                      </Text>
                      <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1">
                        {t(v.descriptionKey)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() =>
                        Alert.alert(
                          t('common.comingSoon'),
                          t('settings.voiceScreen.sampleSoon', {
                            voice: v.label,
                          }),
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={t('settings.voiceScreen.listen')}
                      className="w-10 h-10 rounded-full bg-neon-blue/20 items-center justify-center active:opacity-80"
                    >
                      <Play size={16} color="#60A5FA" fill="#60A5FA" />
                    </Pressable>
                    {isSel && <Check size={20} color="#60A5FA" />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View className="gap-3">
            <Text className="text-sm text-muted-foreground dark:text-dark-muted">
              {t('settings.voiceScreen.speed')}
            </Text>
            <View className="flex-row gap-3">
              {SPEED_OPTIONS.map((s) => {
                const isSel = s.key === selectedSpeed;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => setSelectedSpeed(s.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSel }}
                    accessibilityLabel={t(s.labelKey)}
                    className={`flex-1 rounded-xl border items-center active:opacity-80 ${
                      isSel
                        ? 'bg-neon-blue border-neon-blue'
                        : 'bg-card dark:bg-dark-surface border-neon-blue/20'
                    }`}
                    style={{ paddingVertical: 16 }}
                  >
                    <Text
                      className="text-base font-medium"
                      style={{
                        color: isSel ? '#FFFFFF' : isDark ? '#E0E7FF' : '#102033',
                      }}
                    >
                      {t(s.labelKey)}
                    </Text>
                    <Text
                      className="text-xs mt-1"
                      style={{
                        color: isSel ? '#0A1628' : '#94A3B8',
                      }}
                    >
                      {s.multiplier}x
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            onPress={() =>
              Alert.alert(
                t('settings.voiceScreen.savedTitle'),
                t('settings.voiceScreen.savedBody'),
              )
            }
            accessibilityRole="button"
            accessibilityLabel={t('common.save')}
            className="rounded-md bg-neon-blue items-center justify-center active:opacity-80"
            style={{ height: 56 }}
          >
            <Text
              className="text-base font-medium"
              style={{ color: '#0A1628' }}
            >
              {t('common.save')}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
