import { useIsDark } from '@/store/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, CheckCircle2, Clock, XCircle } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DTM_QUESTION_COUNT } from '@/api/endpoints/dtm';
import { useDtmQuestions } from '@/hooks/use-dtm';
import { DTM_SUBJECTS, type DTMSubject } from '@/mocks/dtm';

type Stage = 'subject-select' | 'prepare' | 'quiz' | 'result';

const FULL_SCREEN_BG = '#0A1628';

/** Exam pacing, not data — DTM allows roughly a minute a question. */
const TIMER_SECONDS_PER_QUESTION = 60;

/** The sentinel stored in `answers` when the clock ran out with nothing picked.
 *  It can never equal a real correct_index, so it always grades as wrong. */
const NO_ANSWER = -1;

const labelOf = (key: DTMSubject | null) =>
  DTM_SUBJECTS.find((s) => s.key === key)?.label ?? '';

export default function DTMScreen() {
  const isDark = useIsDark();
  const [stage, setStage] = useState<Stage>('subject-select');
  const [subject, setSubject] = useState<DTMSubject | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<readonly number[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS_PER_QUESTION);

  // The set the child is answering right now. Generated per run by the
  // backend, so it is never cached and never the same twice.
  const generate = useDtmQuestions();
  const questions = useMemo(() => generate.data ?? [], [generate.data]);

  const question = questions[qIndex];
  const isLast = qIndex >= questions.length - 1;

  useEffect(() => {
    if (stage !== 'quiz' || secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [stage, secondsLeft]);

  const handleNext = (answerIndex: number) => {
    // Append only if this question has not been recorded yet. The timeout
    // effect below can fire more than once for the same expiry, and a double
    // append would shift every later answer against the wrong question.
    setAnswers((prev) => (prev.length > qIndex ? prev : [...prev, answerIndex]));
    if (isLast) {
      setStage('result');
    } else {
      setQIndex((i) => i + 1);
      setSelected(null);
      setSecondsLeft(TIMER_SECONDS_PER_QUESTION);
    }
  };

  useEffect(() => {
    if (stage === 'quiz' && secondsLeft <= 0 && selected === null) {
      handleNext(NO_ANSWER);
    }
  }, [secondsLeft, stage, selected]);

  const startQuiz = (s: DTMSubject) => {
    setSubject(s);
    setStage('prepare');
    setQIndex(0);
    setAnswers([]);
    setSelected(null);
    setSecondsLeft(TIMER_SECONDS_PER_QUESTION);
    generate.mutate(s, {
      // Only enter the quiz once there is something real to answer. An empty
      // or failed generation stays on the prepare card and says so.
      onSuccess: (qs) => {
        if (qs.length > 0) setStage('quiz');
      },
    });
  };

  const backToSubjects = () => {
    setStage('subject-select');
    setSubject(null);
    // Drop the previous run so a stale error or an old question set cannot
    // flash when the child picks the next subject.
    generate.reset();
  };

  const correctCount = useMemo(
    () => answers.filter((a, i) => a === questions[i]?.correct_index).length,
    [answers, questions],
  );

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
              if (stage === 'subject-select') router.back();
              else backToSubjects();
            }}
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            className="w-10 h-10 items-center justify-center"
          >
            <ArrowLeft size={20} color={isDark ? '#E0E7FF' : '#102033'} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground dark:text-dark-text">DTM mashq</Text>
        </View>

        {stage === 'subject-select' && (
          <ScrollView
            contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 48 }}
          >
            <View className="gap-1">
              <Text className="text-base text-muted-foreground dark:text-dark-muted">
                Qaysi fan bo'yicha mashq qilamiz?
              </Text>
              <Text className="text-sm text-muted-foreground dark:text-dark-subtitle">
                Har safar darsliklar asosida {DTM_QUESTION_COUNT} tagacha yangi
                savol tuziladi.
              </Text>
            </View>
            {DTM_SUBJECTS.map((s) => (
              <Pressable
                key={s.key}
                onPress={() => startQuiz(s.key)}
                accessibilityRole="button"
                accessibilityLabel={s.label}
                className="bg-card dark:bg-dark-surface rounded-xl border border-neon-blue/20 active:opacity-80"
                style={{ padding: 20 }}
              >
                <View className="flex-row items-center gap-4">
                  <View
                    className="items-center justify-center rounded-md"
                    style={{
                      width: 48,
                      height: 48,
                      backgroundColor: `${s.color}20`,
                    }}
                  >
                    <Text className="text-2xl">{s.emoji}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-medium text-foreground dark:text-dark-text">
                      {s.label}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Preparing / failed / nothing to ask — one card, never a blank screen
            and never an invented question. */}
        {stage === 'prepare' && (
          <ScrollView
            contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 48 }}
          >
            <View
              className="bg-card dark:bg-dark-surface rounded-xl border border-neon-blue/20 items-center"
              style={{ padding: 32 }}
            >
              {generate.isPending ? (
                <>
                  <ActivityIndicator size="large" color="#60A5FA" />
                  <Text className="text-base font-medium text-foreground dark:text-dark-text mt-4 text-center">
                    Savollar tayyorlanmoqda...
                  </Text>
                  <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-2 text-center">
                    {labelOf(subject)} bo'yicha yangi test tuzilyapti. Bu bir
                    necha soniya olishi mumkin.
                  </Text>
                </>
              ) : generate.isError ? (
                <>
                  <Text className="text-5xl mb-3">📡</Text>
                  <Text className="text-base font-medium text-foreground dark:text-dark-text text-center">
                    Savollarni ololmadim
                  </Text>
                  <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-2 text-center">
                    Aloqada yoki xizmatda muammo bor shekilli. Bir necha
                    daqiqadan keyin qayta urinib ko'r.
                  </Text>
                </>
              ) : (
                <>
                  <Text className="text-5xl mb-3">📚</Text>
                  <Text className="text-base font-medium text-foreground dark:text-dark-text text-center">
                    Hozircha savol yo'q
                  </Text>
                  <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-2 text-center">
                    {labelOf(subject)} bo'yicha savol tuza olmadim — bu fanning
                    darslik materiali hali tayyor emas. Boshqa fanni sinab ko'r
                    yoki keyinroq qayta kir.
                  </Text>
                </>
              )}
            </View>

            {!generate.isPending && (
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => subject && startQuiz(subject)}
                  accessibilityRole="button"
                  accessibilityLabel="Qayta urinish"
                  className="flex-1 rounded-md bg-neon-blue items-center justify-center active:opacity-80"
                  style={{ height: 56 }}
                >
                  <Text
                    className="text-base font-medium"
                    style={{ color: '#0A1628' }}
                  >
                    Qayta urinish
                  </Text>
                </Pressable>
                <Pressable
                  onPress={backToSubjects}
                  accessibilityRole="button"
                  accessibilityLabel="Boshqa fan"
                  className="flex-1 rounded-md bg-card dark:bg-dark-surface border border-neon-blue/20 items-center justify-center active:opacity-80"
                  style={{ height: 56 }}
                >
                  <Text className="text-base font-medium text-foreground dark:text-dark-text">
                    Boshqa fan
                  </Text>
                </Pressable>
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
              <View className="flex-row items-center gap-1">
                <Clock
                  size={16}
                  color={secondsLeft < 10 ? '#FB64B6' : '#94A3B8'}
                />
                <Text
                  className="text-sm font-medium"
                  style={{
                    color: secondsLeft < 10 ? '#FB64B6' : isDark ? '#E0E7FF' : '#102033',
                  }}
                >
                  {secondsLeft}s
                </Text>
              </View>
            </View>

            <View
              className="rounded-full overflow-hidden mb-6"
              style={{ height: 4, backgroundColor: 'rgba(96, 165, 250, 0.20)' }}
            >
              <View
                className="bg-neon-blue h-full"
                style={{
                  width: `${((qIndex + 1) / questions.length) * 100}%`,
                }}
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
              <Text
                className="text-base font-medium"
                style={{ color: '#0A1628' }}
              >
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
                    : "Yana mashq qilaylik"}
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
                        {q.explanation ? (
                          <Text className="text-xs text-muted-foreground dark:text-dark-subtitle mt-1">
                            {q.explanation}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => subject && startQuiz(subject)}
                accessibilityRole="button"
                accessibilityLabel="Yana sinash"
                className="flex-1 rounded-md bg-neon-blue items-center justify-center active:opacity-80"
                style={{ height: 56 }}
              >
                <Text
                  className="text-base font-medium"
                  style={{ color: '#0A1628' }}
                >
                  Yana sinash
                </Text>
              </Pressable>
              <Pressable
                onPress={backToSubjects}
                accessibilityRole="button"
                accessibilityLabel="Boshqa fan"
                className="flex-1 rounded-md bg-card dark:bg-dark-surface border border-neon-blue/20 items-center justify-center active:opacity-80"
                style={{ height: 56 }}
              >
                <Text className="text-base font-medium text-foreground dark:text-dark-text">
                  Boshqa fan
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
