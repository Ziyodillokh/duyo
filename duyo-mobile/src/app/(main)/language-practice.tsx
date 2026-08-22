import { useMutation } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getLanguageExercises,
  type LanguageQuestion,
  type PracticeLanguage,
} from '@/api/endpoints/language';
import { FlagIcon } from '@/components/v2/flag-icon';
import { useChildStore } from '@/store/child';
import { useIsDark } from '@/store/theme';

type Stage = 'language-select' | 'quiz' | 'result';

const FULL_SCREEN_BG = '#0A1628';
const QUESTION_COUNT = 5;

// Flags are drawn (components/v2/flag-icon), not emoji: the regional-
// indicator glyphs render as bare "GB" / "RU" letters on Windows and on
// Android builds without them.
const LANGUAGES: readonly {
  key: PracticeLanguage;
  label: string;
  color: string;
}[] = [
  { key: 'en', label: 'Ingliz tili', color: '#60A5FA' },
  { key: 'ru', label: 'Rus tili', color: '#FDC700' },
];

export default function LanguagePracticeScreen() {
  const isDark = useIsDark();
  const child = useChildStore((s) => s.child);
  const [stage, setStage] = useState<Stage>('language-select');
  const [questions, setQuestions] = useState<LanguageQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<readonly number[]>([]);

  const generate = useMutation({
    mutationFn: (language: PracticeLanguage) =>
      getLanguageExercises({
        language,
        age_segment: child?.age_segment ?? 'explorer',
        count: QUESTION_COUNT,
      }),
    onSuccess: (qs) => {
      if (qs.length === 0) return; // stay on select; empty state is rendered
      setQuestions(qs);
      setQIndex(0);
      setAnswers([]);
      setSelected(null);
      setStage('quiz');
    },
  });

  const question = questions[qIndex];
  const isLast = qIndex >= questions.length - 1;

  const handleNext = (answerIndex: number) => {
    setAnswers([...answers, answerIndex]);
    if (isLast) {
      setStage('result');
    } else {
      setQIndex((i) => i + 1);
      setSelected(null);
    }
  };

  const correctCount = useMemo(
    () => answers.filter((a, i) => a === questions[i]?.correct_index).length,
    [answers, questions],
  );

  const backToSelect = () => {
    setStage('language-select');
    generate.reset();
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: FULL_SCREEN_BG }]} />
      <LinearGradient
        colors={['rgba(96, 165, 250, 0.15)', 'rgba(96, 165, 250, 0.05)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View className="flex-row items-center gap-3 px-6 py-4">
          <Pressable
            onPress={() => {
              if (stage === 'language-select') router.back();
              else backToSelect();
            }}
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            className="w-10 h-10 items-center justify-center"
          >
            <ArrowLeft size={20} color={isDark ? '#E0E7FF' : '#102033'} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground dark:text-dark-text">
            Til mashqi
          </Text>
        </View>

        {stage === 'language-select' && (
          <ScrollView
            contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 48 }}
          >
            <Text className="text-base text-muted-foreground dark:text-dark-muted">
              Qaysi tilni mashq qilamiz?
            </Text>

            {LANGUAGES.map((l) => (
              <Pressable
                key={l.key}
                onPress={() => generate.mutate(l.key)}
                disabled={generate.isPending}
                accessibilityRole="button"
                accessibilityLabel={l.label}
                className="bg-card dark:bg-dark-surface rounded-xl border border-neon-blue/20 active:opacity-80"
                style={{ padding: 20, opacity: generate.isPending ? 0.6 : 1 }}
              >
                <View className="flex-row items-center gap-4">
                  <View
                    className="items-center justify-center rounded-md"
                    style={{
                      width: 48,
                      height: 48,
                      backgroundColor: `${l.color}20`,
                    }}
                  >
                    <FlagIcon code={l.key} width={30} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-medium text-foreground dark:text-dark-text">
                      {l.label}
                    </Text>
                    <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1">
                      {QUESTION_COUNT} ta savol
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}

            {generate.isPending && (
              <View className="items-center" style={{ padding: 24 }}>
                <ActivityIndicator color="#60A5FA" />
                <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-3">
                  Savollar tayyorlanmoqda…
                </Text>
              </View>
            )}

            {generate.isError && (
              <View
                className="rounded-xl border"
                style={{
                  padding: 16,
                  borderColor: 'rgba(251, 100, 182, 0.40)',
                  backgroundColor: 'rgba(251, 100, 182, 0.10)',
                }}
              >
                <Text className="text-sm font-medium text-neon-pink">
                  Savollarni yuklab bo'lmadi
                </Text>
                <Text className="text-xs text-muted-foreground dark:text-dark-muted mt-1">
                  Internetni tekshirib, qaytadan urinib ko'ring
                </Text>
              </View>
            )}

            {generate.isSuccess && generate.data.length === 0 && (
              <View
                className="rounded-xl border border-neon-blue/20 items-center"
                style={{ padding: 24 }}
              >
                <Text className="text-4xl">📚</Text>
                <Text className="text-base font-medium text-foreground dark:text-dark-text mt-2">
                  Hozircha mashq tayyor emas
                </Text>
                <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1 text-center">
                  Birozdan keyin qaytadan urinib ko'ring
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        {stage === 'quiz' && question && (
          <View className="flex-1 px-6 pb-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-sm text-muted-foreground dark:text-dark-muted">
                Savol {qIndex + 1} / {questions.length}
              </Text>
            </View>

            <View
              className="rounded-full overflow-hidden mb-6"
              style={{ height: 4, backgroundColor: 'rgba(96, 165, 250, 0.20)' }}
            >
              <View
                className="bg-neon-blue h-full"
                style={{ width: `${((qIndex + 1) / questions.length) * 100}%` }}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
              <View
                className="bg-card dark:bg-dark-surface rounded-xl border border-neon-blue/20 mb-6"
                style={{ padding: 24 }}
              >
                <Text className="text-lg text-foreground dark:text-dark-text leading-7">
                  {question.text}
                </Text>
              </View>

              <View className="gap-3">
                {question.choices.map((choice, idx) => {
                  const isSel = selected === idx;
                  return (
                    <Pressable
                      key={idx}
                      onPress={() => setSelected(idx)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSel }}
                      accessibilityLabel={choice}
                      className={`rounded-xl border active:opacity-80 ${
                        isSel
                          ? 'bg-neon-blue/20 border-neon-blue'
                          : 'bg-card dark:bg-dark-surface border-neon-blue/20'
                      }`}
                      style={{ padding: 16 }}
                    >
                      <View className="flex-row items-center gap-3">
                        <View
                          className="w-7 h-7 items-center justify-center rounded-full border"
                          style={{
                            borderColor: isSel ? '#60A5FA' : '#94A3B8',
                            backgroundColor: isSel ? '#60A5FA' : 'transparent',
                          }}
                        >
                          <Text
                            className="text-xs font-bold"
                            style={{ color: isSel ? '#0A1628' : '#94A3B8' }}
                          >
                            {String.fromCharCode(65 + idx)}
                          </Text>
                        </View>
                        <Text className="text-base text-foreground dark:text-dark-text flex-1">
                          {choice}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <Pressable
              onPress={() => selected !== null && handleNext(selected)}
              disabled={selected === null}
              accessibilityRole="button"
              accessibilityLabel={isLast ? 'Tugatish' : 'Keyingi savol'}
              className={`rounded-md items-center justify-center mt-4 ${
                selected !== null ? 'bg-neon-blue' : 'bg-neon-blue/40'
              }`}
              style={{ height: 56 }}
            >
              <Text className="text-base font-medium" style={{ color: '#0A1628' }}>
                {isLast ? 'Tugatish' : 'Keyingi'}
              </Text>
            </Pressable>
          </View>
        )}

        {stage === 'result' && (
          <ScrollView
            contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 48 }}
          >
            <View
              className="bg-card dark:bg-dark-surface rounded-xl border border-neon-blue/20 items-center"
              style={{ padding: 32 }}
            >
              <Text className="text-6xl mb-3">
                {correctCount >= questions.length * 0.7 ? '🎉' : '💪'}
              </Text>
              <Text className="text-2xl font-bold text-foreground dark:text-dark-text">
                {correctCount} / {questions.length}
              </Text>
              <Text className="text-base text-muted-foreground dark:text-dark-muted mt-2 text-center">
                {correctCount === questions.length
                  ? "Ajoyib! Hammasi to'g'ri!"
                  : correctCount >= questions.length * 0.7
                    ? 'Yaxshi natija!'
                    : 'Yana mashq qilaylik'}
              </Text>
            </View>

            <View className="gap-3">
              {questions.map((q, i) => {
                const isCorrect = answers[i] === q.correct_index;
                return (
                  <View
                    key={i}
                    className="bg-card dark:bg-dark-surface rounded-xl border border-neon-blue/20"
                    style={{ padding: 16 }}
                  >
                    <View className="flex-row items-start gap-2">
                      {isCorrect ? (
                        <CheckCircle2 size={20} color="#05DF72" />
                      ) : (
                        <XCircle size={20} color="#FB64B6" />
                      )}
                      <View className="flex-1">
                        <Text className="text-sm text-foreground dark:text-dark-text mb-2">
                          {q.text}
                        </Text>
                        <Text className="text-xs text-muted-foreground dark:text-dark-muted">
                          To'g'ri javob: {q.choices[q.correct_index]}
                        </Text>
                        {q.explanation !== '' && (
                          <Text className="text-xs text-muted-foreground dark:text-dark-subtitle mt-1">
                            {q.explanation}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            <Pressable
              onPress={backToSelect}
              accessibilityRole="button"
              accessibilityLabel="Yana mashq qilish"
              className="rounded-md bg-neon-blue items-center justify-center active:opacity-80"
              style={{ height: 56 }}
            >
              <Text className="text-base font-medium" style={{ color: '#0A1628' }}>
                Yana mashq qilish
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
