import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  BookOpen,
  Clock,
  Flame,
  Headphones,
  MessageCircle,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useChildStore } from '@/store/child';

// Strict Figma fidelity — Figma node 9:18782 (CompanionHome, age 14-16)
// Background: linear-gradient(98deg, rgb(2,6,24) 0%, rgb(22,36,86) 100%)

const MOCK_STREAK = 12;
const MOCK_STUDY_MINUTES_TODAY = 45;
const MOCK_STUDY_MINUTES_GOAL = 60;

interface Mood {
  key: string;
  emoji: string;
  label: string;
}

const MOODS: ReadonlyArray<Mood> = [
  { key: 'great', emoji: '😄', label: 'Ajoyib' },
  { key: 'good', emoji: '🙂', label: 'Yaxshi' },
  { key: 'neutral', emoji: '😐', label: 'O‘rtacha' },
  { key: 'sad', emoji: '😔', label: 'Tushkun' },
  { key: 'tired', emoji: '😴', label: 'Charchagan' },
];

interface SubjectProgress {
  key: string;
  label: string;
  percent: number;
  scoreLabel: string;
  color: string;
}

const SUBJECTS: ReadonlyArray<SubjectProgress> = [
  {
    key: 'math',
    label: 'Matematika',
    percent: 78,
    scoreLabel: '78/100',
    color: '#155DFC',
  },
  {
    key: 'physics',
    label: 'Fizika',
    percent: 52,
    scoreLabel: '52/100',
    color: '#F54900',
  },
  {
    key: 'lang',
    label: 'Ona tili',
    percent: 88,
    scoreLabel: '88/100',
    color: '#00A63E',
  },
  {
    key: 'eng',
    label: 'Ingliz tili',
    percent: 65,
    scoreLabel: '65/100',
    color: '#8200DB',
  },
];

export function CompanionHome() {
  const childName = useChildStore((s) => s.child?.name ?? 'Foydalanuvchi');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const studyProgress = MOCK_STUDY_MINUTES_TODAY / MOCK_STUDY_MINUTES_GOAL;

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#020618', '#162456']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.97, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-1">
            <Text className="text-[24px] leading-8 font-bold text-dark-text tracking-tight">
              Salom, {childName}
            </Text>
            <Text className="text-base text-dark-muted">
              Maqsadingiz sari intilamiz
            </Text>
          </View>

          <View
            className="bg-dark-surface rounded-xl border"
            style={{ padding: 20, borderColor: 'rgba(96, 165, 250, 0.20)' }}
          >
            <Text className="text-base font-medium text-dark-text mb-4">
              Bugun o'zingizni qanday his qilyapsiz?
            </Text>
            <View className="flex-row justify-between">
              {MOODS.map((m) => {
                const isSel = selectedMood === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setSelectedMood(m.key)}
                    accessibilityRole="button"
                    accessibilityLabel={m.label}
                    className={`rounded-lg items-center ${
                      isSel ? 'bg-neon-blue/20 border border-neon-blue' : ''
                    }`}
                    style={{ padding: 8, minWidth: 56 }}
                  >
                    <Text className="text-3xl">{m.emoji}</Text>
                    <Text className="text-xs text-dark-muted mt-1">
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {selectedMood && (
              <View
                className="mt-4 rounded-md"
                style={{
                  backgroundColor: 'rgba(96, 165, 250, 0.10)',
                  padding: 12,
                }}
              >
                <Text className="text-sm text-dark-text">
                  Rahmat! DUYO sizning his-tuyg'ularingizni hisobga oladi.
                </Text>
              </View>
            )}
          </View>

          <View
            className="rounded-xl overflow-hidden"
            style={{ borderWidth: 1, borderColor: '#6E11B0' }}
          >
            <LinearGradient
              colors={['rgba(130, 0, 219, 0.20)', 'rgba(110, 17, 176, 0.10)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 20 }}
            >
              <View className="flex-row items-center gap-2 mb-2">
                <Sparkles size={20} color="#C27AFF" />
                <Text className="text-sm font-bold" style={{ color: '#C27AFF' }}>
                  DUYO tavsiyasi
                </Text>
              </View>
              <Text className="text-base text-dark-text leading-6">
                Matematikada yuqori natija ko'rsatyapsiz. Bugun fizikaga
                e'tibor bering — bu DTM'da kuchli ball beradi.
              </Text>
            </LinearGradient>
          </View>

          <View
            className="bg-dark-surface rounded-xl border"
            style={{ padding: 20, borderColor: 'rgba(96, 165, 250, 0.20)' }}
          >
            <View className="flex-row items-center gap-2 mb-4">
              <TrendingUp size={20} color="#60A5FA" />
              <Text className="text-lg font-bold text-dark-text tracking-tight">
                Fanlar bo'yicha
              </Text>
            </View>
            <View className="gap-3">
              {SUBJECTS.map((s) => (
                <View key={s.key}>
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-sm text-dark-text">{s.label}</Text>
                    <Text className="text-xs text-dark-muted">
                      {s.scoreLabel}
                    </Text>
                  </View>
                  <View
                    className="rounded-full overflow-hidden"
                    style={{
                      height: 8,
                      backgroundColor: 'rgba(96, 165, 250, 0.20)',
                    }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${s.percent}%`,
                        backgroundColor: s.color,
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View
            className="bg-dark-surface rounded-xl border"
            style={{ padding: 20, borderColor: 'rgba(96, 165, 250, 0.20)' }}
          >
            <View className="flex-row items-center gap-2 mb-3">
              <Clock size={20} color="#05DF72" />
              <Text className="text-lg font-bold text-dark-text tracking-tight">
                Bugungi o'qish
              </Text>
            </View>
            <Text className="text-3xl font-bold text-dark-text mb-1">
              {MOCK_STUDY_MINUTES_TODAY} daqiqa
            </Text>
            <Text className="text-sm text-dark-muted mb-3">
              Maqsad: {MOCK_STUDY_MINUTES_GOAL} daqiqa
            </Text>
            <View
              className="rounded-full overflow-hidden"
              style={{
                height: 8,
                backgroundColor: 'rgba(5, 223, 114, 0.20)',
              }}
            >
              <View
                className="bg-neon-green h-full"
                style={{ width: `${studyProgress * 100}%` }}
              />
            </View>
          </View>

          <View className="flex-row gap-3">
            <View
              className="flex-1 rounded-xl border"
              style={{
                padding: 16,
                borderColor: 'rgba(255, 137, 4, 0.30)',
                backgroundColor: 'rgba(255, 137, 4, 0.10)',
              }}
            >
              <Flame size={24} color="#FF8904" />
              <Text
                className="text-2xl font-bold mt-2"
                style={{ color: '#FF8904' }}
              >
                {MOCK_STREAK}
              </Text>
              <Text className="text-xs text-dark-muted">Kunlik seriya</Text>
            </View>
            <Pressable
              onPress={() => router.push('/(main)/(tabs)/chat')}
              accessibilityRole="button"
              accessibilityLabel="25 daqiqalik o'qish"
              className="flex-1 rounded-xl overflow-hidden active:opacity-80"
            >
              <LinearGradient
                colors={['#2B7FFF', '#155DFC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 16 }}
              >
                <Target size={24} color="#FFFFFF" />
                <Text className="text-base font-bold text-white mt-2">
                  Boshlash
                </Text>
                <Text className="text-xs text-white/80">
                  25 daqiqa to'xtovsiz
                </Text>
              </LinearGradient>
            </Pressable>
          </View>

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => router.push('/(main)/(tabs)/chat')}
              accessibilityRole="button"
              accessibilityLabel="DUYO bilan suhbat"
              className="flex-1 bg-dark-surface rounded-xl border active:opacity-80"
              style={{
                padding: 16,
                borderColor: 'rgba(96, 165, 250, 0.20)',
              }}
            >
              <MessageCircle size={24} color="#60A5FA" />
              <Text className="text-sm font-medium text-dark-text mt-2">
                Suhbat
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(main)/(tabs)/library')}
              accessibilityRole="button"
              accessibilityLabel="DTM mashqlari"
              className="flex-1 bg-dark-surface rounded-xl border active:opacity-80"
              style={{
                padding: 16,
                borderColor: 'rgba(96, 165, 250, 0.20)',
              }}
            >
              <BookOpen size={24} color="#FDC700" />
              <Text className="text-sm font-medium text-dark-text mt-2">
                DTM mashq
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(main)/(tabs)/library')}
              accessibilityRole="button"
              accessibilityLabel="Podkast"
              className="flex-1 bg-dark-surface rounded-xl border active:opacity-80"
              style={{
                padding: 16,
                borderColor: 'rgba(96, 165, 250, 0.20)',
              }}
            >
              <Headphones size={24} color="#FB64B6" />
              <Text className="text-sm font-medium text-dark-text mt-2">
                Podkast
              </Text>
            </Pressable>
          </View>

          <View
            className="rounded-xl border"
            style={{
              padding: 20,
              borderColor: 'rgba(96, 165, 250, 0.20)',
              backgroundColor: 'rgba(96, 165, 250, 0.05)',
            }}
          >
            <Text
              className="text-sm italic text-dark-subtitle text-center leading-6"
            >
              "Maqsadga erishish yo'lida har bir qadam muhim"
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
