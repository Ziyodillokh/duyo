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
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getLanguageExercises,
  type LanguageQuestion,
  type PracticeLanguage,
} from '@/api/endpoints/language';
import { Text } from '@/components/text';
import { FlagIcon } from '@/components/v2/flag-icon';
import { glass, lift } from '@/lib/glass';
import { useChildStore } from '@/store/child';

type Stage = 'language-select' | 'quiz' | 'result';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const DANGER = '#E0455E';
const GREEN = '#22B573';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

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
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (stage === 'language-select') router.back();
              else backToSelect();
            }}
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            style={[glass(24, 'sm'), styles.headerButton, styles.focusable]}
          >
            <ArrowLeft size={22} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <Text style={styles.headerTitle}>Til mashqi</Text>
        </View>

        {stage === 'language-select' && (
          <ScrollView contentContainerStyle={styles.selectScroll}>
            <Text style={styles.prompt}>Qaysi tilni mashq qilamiz?</Text>

            {LANGUAGES.map((l) => (
              <Pressable
                key={l.key}
                onPress={() => generate.mutate(l.key)}
                disabled={generate.isPending}
                accessibilityRole="button"
                accessibilityLabel={l.label}
                style={({ pressed }) => [
                  glass(24, 'md'),
                  styles.languageCard,
                  generate.isPending && styles.busy,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.languageRow}>
                  {/* The well keeps the language's own colour — it is the only
                      thing telling the two cards apart at a glance. */}
                  <View
                    style={[
                      glass(14, 'flush'),
                      styles.flagWell,
                      { backgroundColor: `${l.color}22` },
                    ]}
                  >
                    <FlagIcon code={l.key} width={30} />
                  </View>
                  <View style={styles.languageMeta}>
                    <Text style={styles.languageLabel}>{l.label}</Text>
                    <Text style={styles.languageCount}>
                      {QUESTION_COUNT} ta savol
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}

            {generate.isPending && (
              <View style={styles.pendingBlock}>
                <ActivityIndicator color={PRIMARY} />
                <Text style={styles.pendingText}>Savollar tayyorlanmoqda…</Text>
              </View>
            )}

            {generate.isError && (
              <View style={styles.errorBlock}>
                <Text style={styles.errorTitle}>Savollarni yuklab bo'lmadi</Text>
                <Text style={styles.errorBody}>
                  Internetni tekshirib, qaytadan urinib ko'ring
                </Text>
              </View>
            )}

            {generate.isSuccess && generate.data.length === 0 && (
              <View style={[glass(24, 'md', 0.55), styles.emptyBlock]}>
                <Text style={styles.emptyEmoji}>📚</Text>
                <Text style={styles.emptyTitle}>Hozircha mashq tayyor emas</Text>
                <Text style={styles.emptyBody}>
                  Birozdan keyin qaytadan urinib ko'ring
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        {stage === 'quiz' && question && (
          <View style={styles.quiz}>
            <View style={styles.quizHead}>
              <Text style={styles.quizCount}>
                Savol {qIndex + 1} / {questions.length}
              </Text>
            </View>

            <View style={styles.track}>
              <LinearGradient
                colors={['#4F86EE', '#7FB2FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.trackFill,
                  { width: `${((qIndex + 1) / questions.length) * 100}%` },
                ]}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.grow}>
              <View style={[glass(24, 'md', 0.6), styles.questionCard]}>
                <Text style={styles.questionText}>{question.text}</Text>
              </View>

              <View style={styles.choices}>
                {question.choices.map((choice, idx) => {
                  const isSel = selected === idx;
                  return (
                    <Pressable
                      key={idx}
                      onPress={() => setSelected(idx)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSel }}
                      accessibilityLabel={choice}
                      style={({ pressed }) => [
                        styles.choice,
                        styles.focusable,
                        isSel ? styles.choiceOn : glass(20, 'md', 0.55),
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.choiceRow}>
                        <View
                          style={[styles.bullet, isSel && styles.bulletOn]}
                        >
                          <Text
                            style={[
                              styles.bulletText,
                              isSel && styles.bulletTextOn,
                            ]}
                          >
                            {String.fromCharCode(65 + idx)}
                          </Text>
                        </View>
                        <Text style={styles.choiceText}>{choice}</Text>
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
              style={({ pressed }) => [
                styles.filled,
                styles.next,
                styles.focusable,
                selected === null && styles.filledOff,
                pressed && selected !== null && styles.pressed,
              ]}
            >
              <Text style={styles.filledLabel}>
                {isLast ? 'Tugatish' : 'Keyingi'}
              </Text>
            </Pressable>
          </View>
        )}

        {stage === 'result' && (
          <ScrollView contentContainerStyle={styles.resultScroll}>
            <View style={[glass(28, 'lg', 0.62), styles.scoreCard]}>
              <Text style={styles.scoreEmoji}>
                {correctCount >= questions.length * 0.7 ? '🎉' : '💪'}
              </Text>
              <Text style={styles.score}>
                {correctCount} / {questions.length}
              </Text>
              <Text style={styles.scoreCaption}>
                {correctCount === questions.length
                  ? "Ajoyib! Hammasi to'g'ri!"
                  : correctCount >= questions.length * 0.7
                    ? 'Yaxshi natija!'
                    : 'Yana mashq qilaylik'}
              </Text>
            </View>

            <View style={styles.review}>
              {questions.map((q, i) => {
                const isCorrect = answers[i] === q.correct_index;
                return (
                  <View key={i} style={[glass(22, 'md', 0.55), styles.reviewCard]}>
                    <View style={styles.reviewRow}>
                      {isCorrect ? (
                        <CheckCircle2 size={20} color={GREEN} />
                      ) : (
                        <XCircle size={20} color={DANGER} />
                      )}
                      <View style={styles.grow}>
                        <Text style={styles.reviewQuestion}>{q.text}</Text>
                        <Text style={styles.reviewAnswer}>
                          To'g'ri javob: {q.choices[q.correct_index]}
                        </Text>
                        {q.explanation !== '' && (
                          <Text style={styles.reviewExplanation}>
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
              style={({ pressed }) => [
                styles.filled,
                styles.focusable,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.filledLabel}>Yana mashq qilish</Text>
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  grow: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: INK },

  // ── Language select ────────────────────────────────────────────────────
  selectScroll: { padding: 24, gap: 16, paddingBottom: 48 },
  prompt: { fontSize: 16, color: MUTED },
  languageCard: { padding: 20 },
  busy: { opacity: 0.6 },
  languageRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  flagWell: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageMeta: { flex: 1 },
  languageLabel: { fontSize: 16, fontWeight: '600', color: INK },
  languageCount: { marginTop: 4, fontSize: 14, color: MUTED },

  pendingBlock: { alignItems: 'center', padding: 24 },
  pendingText: { marginTop: 12, fontSize: 14, color: MUTED },

  // A failure is not a pane of the page's glass — it keeps its own tinted
  // outline so it reads as a notice rather than as content.
  errorBlock: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(224,69,94,0.35)',
    backgroundColor: 'rgba(224,69,94,0.10)',
  },
  errorTitle: { fontSize: 14, fontWeight: '600', color: DANGER },
  errorBody: { marginTop: 4, fontSize: 12, color: MUTED },

  emptyBlock: { padding: 24, alignItems: 'center' },
  emptyEmoji: { fontSize: 36, lineHeight: 44 },
  emptyTitle: { marginTop: 8, fontSize: 16, fontWeight: '600', color: INK },
  emptyBody: {
    marginTop: 4,
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
  },

  // ── Quiz ───────────────────────────────────────────────────────────────
  quiz: { flex: 1, paddingHorizontal: 24, paddingBottom: 24 },
  quizHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quizCount: { fontSize: 14, color: MUTED },
  track: {
    height: 4,
    marginBottom: 24,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(47,111,228,0.16)',
  },
  trackFill: { height: '100%' },

  questionCard: { padding: 24, marginBottom: 24 },
  questionText: { fontSize: 18, lineHeight: 28, color: INK },

  choices: { gap: 12 },
  choice: { padding: 16, borderRadius: 20 },
  // The picked answer stops being a pane and becomes the page's blue — the
  // same lift as its neighbours, so choosing does not make it hover.
  choiceOn: {
    backgroundColor: 'rgba(47,111,228,0.14)',
    borderWidth: 1,
    borderColor: PRIMARY,
    boxShadow: lift('md'),
  },
  choiceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: MUTED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletOn: { borderColor: PRIMARY, backgroundColor: PRIMARY },
  bulletText: { fontSize: 12, fontWeight: '700', color: MUTED },
  bulletTextOn: { color: '#FFFFFF' },
  choiceText: { flex: 1, fontSize: 16, color: INK },

  next: { marginTop: 16 },

  // ── Result ─────────────────────────────────────────────────────────────
  resultScroll: { padding: 24, gap: 24, paddingBottom: 48 },
  scoreCard: { padding: 32, alignItems: 'center' },
  scoreEmoji: { marginBottom: 12, fontSize: 60, lineHeight: 70 },
  score: { fontSize: 24, fontWeight: '700', color: INK },
  scoreCaption: {
    marginTop: 8,
    fontSize: 16,
    color: MUTED,
    textAlign: 'center',
  },

  review: { gap: 12 },
  reviewCard: { padding: 16 },
  reviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  reviewQuestion: { marginBottom: 8, fontSize: 14, color: INK },
  reviewAnswer: { fontSize: 12, color: MUTED },
  reviewExplanation: { marginTop: 4, fontSize: 12, color: MUTED },

  // A filled button styles its own surface, so it takes the light on its own
  // (`lift`) rather than the whole glass material.
  filled: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    boxShadow: lift('md'),
  },
  // Nothing to press yet, so it sits back down on the page.
  filledOff: {
    backgroundColor: 'rgba(47,111,228,0.35)',
    boxShadow: lift('sm'),
  },
  filledLabel: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },

  pressed: { opacity: 0.8 },
  // The browser's default focus ring is a black rectangle around a rounded
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
});
