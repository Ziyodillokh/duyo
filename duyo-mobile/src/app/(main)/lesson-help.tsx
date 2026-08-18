import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  PenLine,
  Sparkles,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAvoidingView } from '@/components/keyboard-avoiding-view';
import { DTM_SUBJECTS, type DTMSubject } from '@/mocks/dtm';
import { useIsDark } from '@/store/theme';

type Stage = 'input' | 'solving' | 'result';

interface MockSolutionStep {
  title: string;
  detail: string;
}

const MOCK_SOLUTION_STEPS: readonly MockSolutionStep[] = [
  {
    title: '1-bosqich: Tenglamani sodda qiling',
    detail: "Har ikkala tomonni umumiy maxraj orqali ko'paytirib chiqarib oling.",
  },
  {
    title: "2-bosqich: x ning bo'yicha ajratib oling",
    detail: 'Noma\'lumlarni bir tomonga, raqamlarni boshqasiga olib o\'ting.',
  },
  {
    title: '3-bosqich: Yechim',
    detail: 'x = 4. Tekshirish: tenglamaga qo\'yib ko\'rsak teng chiqadi.',
  },
];

const MOCK_FINAL_ANSWER = 'x = 4';

export default function LessonHelpScreen() {
  const isDark = useIsDark();
  const [stage, setStage] = useState<Stage>('input');
  const [subject, setSubject] = useState<DTMSubject>('math');
  const [question, setQuestion] = useState('');

  const canSubmit = question.trim().length >= 3;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setStage('solving');
    setTimeout(() => setStage('result'), 1500);
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' }]} />
      <LinearGradient
        colors={['rgba(96, 165, 250, 0.15)', 'rgba(252, 211, 77, 0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.97, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View className="flex-row items-center gap-3 px-6 py-4">
          <Pressable
            onPress={() => {
              if (stage === 'input') router.back();
              else setStage('input');
            }}
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            className="w-10 h-10 items-center justify-center"
          >
            <ArrowLeft size={20} color={isDark ? '#E0E7FF' : '#102033'} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground dark:text-dark-text">Dars yordami</Text>
        </View>

        <KeyboardAvoidingView behavior="padding" className="flex-1">
          {stage === 'input' && (
            <ScrollView
              contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 48 }}
            >
              <View className="gap-2">
                <Text className="text-base text-foreground dark:text-dark-text">Fan tanlang</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 12 }}
                >
                  {DTM_SUBJECTS.map((s) => {
                    const sel = s.key === subject;
                    return (
                      <Pressable
                        key={s.key}
                        onPress={() => setSubject(s.key)}
                        accessibilityRole="button"
                        accessibilityLabel={s.label}
                        className={`flex-row items-center gap-2 rounded-md border active:opacity-80 ${
                          sel
                            ? 'bg-neon-blue border-neon-blue'
                            : 'bg-card dark:bg-dark-surface border-neon-blue/20'
                        }`}
                        style={{ paddingHorizontal: 16, paddingVertical: 10 }}
                      >
                        <Text className="text-base">{s.emoji}</Text>
                        <Text
                          className="text-sm font-medium"
                          style={{
                            color: sel ? '#FFFFFF' : isDark ? '#E0E7FF' : '#102033',
                          }}
                        >
                          {s.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Vazifani yuklash"
                onPress={() =>
                  Alert.alert(
                    'Tez orada',
                    "Kamera/galereya integratsiyasi Faza 1'da qo'shiladi",
                  )
                }
                className="rounded-xl border border-dashed items-center justify-center active:opacity-80"
                style={{
                  borderColor: 'rgba(96, 165, 250, 0.40)',
                  padding: 32,
                  backgroundColor: 'rgba(96, 165, 250, 0.05)',
                }}
              >
                <Camera size={32} color="#60A5FA" />
                <Text className="text-base font-medium text-foreground dark:text-dark-text mt-3">
                  Vazifani yuklash
                </Text>
                <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1">
                  Rasm chiqaring yoki galereyadan tanlang
                </Text>
              </Pressable>

              <View className="flex-row items-center gap-3">
                <View
                  className="flex-1 h-px"
                  style={{ backgroundColor: 'rgba(96, 165, 250, 0.20)' }}
                />
                <Text className="text-sm text-muted-foreground dark:text-dark-muted">yoki yozing</Text>
                <View
                  className="flex-1 h-px"
                  style={{ backgroundColor: 'rgba(96, 165, 250, 0.20)' }}
                />
              </View>

              <View
                className="bg-card dark:bg-dark-surface rounded-xl border border-neon-blue/20"
                style={{ padding: 16 }}
              >
                <View className="flex-row items-center gap-2 mb-2">
                  <PenLine size={16} color="#60A5FA" />
                  <Text className="text-sm font-medium text-foreground dark:text-dark-text">
                    Vazifa matni
                  </Text>
                </View>
                <TextInput
                  value={question}
                  onChangeText={setQuestion}
                  placeholder="Vazifani shu yerga yozing..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  className="text-base text-foreground dark:text-dark-text"
                  style={{ minHeight: 120, textAlignVertical: 'top' }}
                  accessibilityLabel="Vazifa matni"
                />
              </View>

              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit}
                accessibilityRole="button"
                accessibilityLabel="DUYO'dan yordam so'rash"
                className={`rounded-md items-center justify-center active:opacity-80 flex-row gap-2 ${
                  canSubmit ? 'bg-neon-blue' : 'bg-neon-blue/40'
                }`}
                style={{ height: 56 }}
              >
                <Sparkles size={18} color="#0A1628" />
                <Text
                  className="text-base font-medium"
                  style={{ color: '#0A1628' }}
                >
                  DUYO'dan yordam so'rash
                </Text>
              </Pressable>
            </ScrollView>
          )}

          {stage === 'solving' && (
            <View className="flex-1 items-center justify-center px-6 gap-4">
              <Text className="text-5xl">🤔</Text>
              <Text className="text-lg font-medium text-foreground dark:text-dark-text">
                DUYO yechimni o'ylayapti...
              </Text>
              <View
                className="rounded-full overflow-hidden mt-2"
                style={{
                  width: 200,
                  height: 4,
                  backgroundColor: 'rgba(96, 165, 250, 0.20)',
                }}
              >
                <View
                  className="bg-neon-blue h-full"
                  style={{ width: '60%' }}
                />
              </View>
            </View>
          )}

          {stage === 'result' && (
            <ScrollView
              contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 48 }}
            >
              <View
                className="bg-card dark:bg-dark-surface rounded-xl border border-neon-blue/20"
                style={{ padding: 20 }}
              >
                <Text className="text-sm text-muted-foreground dark:text-dark-muted mb-2">
                  Sizning vazifangiz:
                </Text>
                <Text className="text-base text-foreground dark:text-dark-text">{question}</Text>
              </View>

              <View className="gap-3">
                <View className="flex-row items-center gap-2">
                  <Sparkles size={18} color="#60A5FA" />
                  <Text className="text-lg font-bold text-foreground dark:text-dark-text tracking-tight">
                    DUYO yechimi
                  </Text>
                </View>
                {MOCK_SOLUTION_STEPS.map((step, i) => (
                  <View
                    key={i}
                    className="bg-card dark:bg-dark-surface rounded-xl border border-neon-blue/20"
                    style={{ padding: 16 }}
                  >
                    <Text className="text-sm font-medium text-neon-cyan mb-1">
                      {step.title}
                    </Text>
                    <Text className="text-base text-foreground dark:text-dark-text leading-6">
                      {step.detail}
                    </Text>
                  </View>
                ))}
              </View>

              <View
                className="rounded-xl border"
                style={{
                  padding: 20,
                  borderColor: 'rgba(5, 223, 114, 0.40)',
                  backgroundColor: 'rgba(5, 223, 114, 0.10)',
                }}
              >
                <View className="flex-row items-center gap-2">
                  <CheckCircle2 size={20} color="#05DF72" />
                  <Text className="text-sm font-medium text-neon-green">
                    Yakuniy javob
                  </Text>
                </View>
                <Text className="text-2xl font-bold text-foreground dark:text-dark-text mt-2">
                  {MOCK_FINAL_ANSWER}
                </Text>
              </View>

              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => router.push('/(main)/(tabs)/chat')}
                  accessibilityRole="button"
                  accessibilityLabel="Tushuntirish"
                  className="flex-1 rounded-md bg-neon-blue items-center justify-center active:opacity-80"
                  style={{ height: 56 }}
                >
                  <Text
                    className="text-base font-medium"
                    style={{ color: '#0A1628' }}
                  >
                    Tushuntirish
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setStage('input');
                    setQuestion('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Yangi vazifa"
                  className="flex-1 rounded-md bg-card dark:bg-dark-surface border border-neon-blue/20 items-center justify-center active:opacity-80"
                  style={{ height: 56 }}
                >
                  <Text className="text-base font-medium text-foreground dark:text-dark-text">
                    Yangi vazifa
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
