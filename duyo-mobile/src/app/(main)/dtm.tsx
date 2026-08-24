import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, CheckCircle2, Clock, XCircle } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DTM_QUESTION_COUNT } from '@/api/endpoints/dtm';
import { Text } from '@/components/text';
import { useDtmQuestions } from '@/hooks/use-dtm';
import { glass, lift } from '@/lib/glass';
import { DTM_SUBJECTS, type DTMSubject } from '@/mocks/dtm';

type Stage = 'subject-select' | 'prepare' | 'quiz' | 'result';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
// Same family as settings and notifications: frosted panes on pale blue. The
// navy build this replaces predated the glass system and read as a different
// app bolted onto this one.
const PRIMARY = '#2F6FE4';
const TITLE = '#2A63DC';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const DANGER = '#E0455E';
const GREEN = '#22B573';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';
/** The disabled fill. Not `PRIMARY` at low opacity: a translucent button lets
 *  the page's gradient through and reads as a hole rather than a dimmed one. */
const PRIMARY_OFF = '#A8C2EA';

/** Exam pacing, not data — DTM allows roughly a minute a question. */
const TIMER_SECONDS_PER_QUESTION = 60;

/** The sentinel stored in `answers` when the clock ran out with nothing picked.
 *  It can never equal a real correct_index, so it always grades as wrong. */
const NO_ANSWER = -1;

const labelOf = (key: DTMSubject | null) =>
  DTM_SUBJECTS.find((s) => s.key === key)?.label ?? '';

export default function DTMScreen() {
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

  const lowTime = secondsLeft < 10;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {/* ── Header: 48pt glass rounds, the inner-screen pattern ────── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (stage === 'subject-select') router.back();
              else backToSubjects();
            }}
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            style={[glass(24, 'sm'), styles.headerButton, styles.focusable]}
          >
            <ArrowLeft size={23} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>DTM mashq</Text>
          {/* Keeps the title centred. */}
          <View style={styles.headerButton} />
        </View>

        {stage === 'subject-select' && (
          <ScrollView
            contentContainerStyle={styles.page}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.intro}>
              <Text style={styles.introTitle}>
                Qaysi fan bo'yicha mashq qilamiz?
              </Text>
              <Text style={styles.introBody}>
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
                style={[glass(22, 'md'), styles.subject, styles.focusable]}
              >
                {/* The subject's own accent survives the restyle — it is the
                    only thing telling five identical panes apart. */}
                <View
                  style={[styles.subjectWell, { backgroundColor: `${s.color}26` }]}
                >
                  <Text style={styles.subjectEmoji}>{s.emoji}</Text>
                </View>
                <Text style={styles.subjectLabel}>{s.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Preparing / failed / nothing to ask — one card, never a blank screen
            and never an invented question. */}
        {stage === 'prepare' && (
          <ScrollView
            contentContainerStyle={styles.pageWide}
            showsVerticalScrollIndicator={false}
          >
            <View style={[glass(28, 'lg', 0.6), styles.statusCard]}>
              {generate.isPending ? (
                <>
                  <ActivityIndicator size="large" color={PRIMARY} />
                  <Text style={styles.statusTitle}>
                    Savollar tayyorlanmoqda...
                  </Text>
                  <Text style={styles.statusBody}>
                    {labelOf(subject)} bo'yicha yangi test tuzilyapti. Bu bir
                    necha soniya olishi mumkin.
                  </Text>
                </>
              ) : generate.isError ? (
                <>
                  <Text style={styles.statusEmoji}>📡</Text>
                  <Text style={styles.statusTitle}>Savollarni ololmadim</Text>
                  <Text style={styles.statusBody}>
                    Aloqada yoki xizmatda muammo bor shekilli. Bir necha
                    daqiqadan keyin qayta urinib ko'r.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.statusEmoji}>📚</Text>
                  <Text style={styles.statusTitle}>Hozircha savol yo'q</Text>
                  <Text style={styles.statusBody}>
                    {labelOf(subject)} bo'yicha savol tuza olmadim — bu fanning
                    darslik materiali hali tayyor emas. Boshqa fanni sinab ko'r
                    yoki keyinroq qayta kir.
                  </Text>
                </>
              )}
            </View>

            {!generate.isPending && (
              <View style={styles.buttonRow}>
                <Pressable
                  onPress={() => subject && startQuiz(subject)}
                  accessibilityRole="button"
                  accessibilityLabel="Qayta urinish"
                  style={[styles.button, styles.buttonOn, styles.focusable]}
                >
                  <Text style={styles.buttonOnText}>Qayta urinish</Text>
                </Pressable>
                <Pressable
                  onPress={backToSubjects}
                  accessibilityRole="button"
                  accessibilityLabel="Boshqa fan"
                  style={[glass(18, 'md'), styles.button, styles.focusable]}
                >
                  <Text style={styles.buttonText}>Boshqa fan</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        )}

        {stage === 'quiz' && question && (
          <View style={styles.quiz}>
            <View style={styles.quizHead}>
              <Text style={styles.counter}>
                Savol {qIndex + 1} / {questions.length}
              </Text>
              {/* The clock is a chip, not loose text: it is the one thing on
                  the page that changes every second. */}
              <View style={[glass(14, 'sm'), styles.timer]}>
                <Clock size={15} color={lowTime ? DANGER : MUTED} strokeWidth={2.2} />
                <Text style={[styles.timerText, lowTime && styles.timerTextLow]}>
                  {secondsLeft}s
                </Text>
              </View>
            </View>

            <View style={styles.track}>
              <View
                style={[
                  styles.trackFill,
                  { width: `${((qIndex + 1) / questions.length) * 100}%` },
                ]}
              />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.quizScroll}
              contentContainerStyle={styles.quizBody}
            >
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
                      style={[
                        glass(18, 'sm'),
                        styles.choice,
                        isSel && styles.choiceOn,
                        styles.focusable,
                      ]}
                    >
                      <View style={[styles.letter, isSel && styles.letterOn]}>
                        <Text
                          style={[styles.letterText, isSel && styles.letterTextOn]}
                        >
                          {String.fromCharCode(65 + idx)}
                        </Text>
                      </View>
                      <Text style={styles.choiceText}>{choice}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <Pressable
              onPress={() => selected !== null && handleNext(selected)}
              disabled={selected === null}
              accessibilityRole="button"
              accessibilityState={{ disabled: selected === null }}
              accessibilityLabel={isLast ? 'Tugatish' : 'Keyingi savol'}
              style={[
                styles.button,
                selected !== null ? styles.buttonOn : styles.buttonOff,
                styles.next,
                styles.focusable,
              ]}
            >
              <Text style={styles.buttonOnText}>
                {isLast ? 'Tugatish' : 'Keyingi'}
              </Text>
            </Pressable>
          </View>
        )}

        {stage === 'result' && (
          <ScrollView
            contentContainerStyle={styles.pageWide}
            showsVerticalScrollIndicator={false}
          >
            {/* The score is the one hero object on this page, so it sits
                highest — every review card below it is deliberately lower. */}
            <View style={[glass(30, 'lg', 0.62), styles.statusCard]}>
              <Text style={styles.scoreEmoji}>
                {correctCount >= questions.length * 0.7 ? '🎉' : '💪'}
              </Text>
              <Text style={styles.score}>
                {correctCount} / {questions.length}
              </Text>
              <Text style={styles.statusBody}>
                {correctCount === questions.length
                  ? "Ajoyib! Hammasi to'g'ri!"
                  : correctCount >= questions.length * 0.7
                    ? 'Yaxshi natija!'
                    : 'Yana mashq qilaylik'}
              </Text>
            </View>

            <View style={styles.reviewList}>
              {questions.map((q, i) => {
                const isCorrect = answers[i] === q.correct_index;
                return (
                  <View key={i} style={[glass(20, 'sm', 0.5), styles.review]}>
                    {isCorrect ? (
                      <CheckCircle2 size={20} color={GREEN} strokeWidth={2.2} />
                    ) : (
                      <XCircle size={20} color={DANGER} strokeWidth={2.2} />
                    )}
                    <View style={styles.reviewBody}>
                      <Text style={styles.reviewQuestion}>{q.text}</Text>
                      <Text style={styles.reviewAnswer}>
                        To'g'ri javob: {q.choices[q.correct_index]}
                      </Text>
                      {q.explanation ? (
                        <Text style={styles.reviewExplanation}>
                          {q.explanation}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => subject && startQuiz(subject)}
                accessibilityRole="button"
                accessibilityLabel="Yana sinash"
                style={[styles.button, styles.buttonOn, styles.focusable]}
              >
                <Text style={styles.buttonOnText}>Yana sinash</Text>
              </Pressable>
              <Pressable
                onPress={backToSubjects}
                accessibilityRole="button"
                accessibilityLabel="Boshqa fan"
                style={[glass(18, 'md'), styles.button, styles.focusable]}
              >
                <Text style={styles.buttonText}>Boshqa fan</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // The browser's default focus ring is a square drawn around a rounded
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 14,
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: INK,
  },

  page: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 44,
    gap: 14,
  },
  pageWide: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 44,
    gap: 20,
  },

  // ── Subject picker ─────────────────────────────────────────────────────
  intro: { gap: 4, paddingHorizontal: 4, paddingBottom: 2 },
  introTitle: { fontSize: 17, fontWeight: '700', color: INK },
  introBody: { fontSize: 13.5, lineHeight: 19, color: MUTED },
  subject: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  subjectWell: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectEmoji: { fontSize: 24 },
  subjectLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: INK },

  // ── Prepare / result hero ──────────────────────────────────────────────
  statusCard: { alignItems: 'center', padding: 28 },
  statusEmoji: { fontSize: 42 },
  statusTitle: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
  },
  statusBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    textAlign: 'center',
  },
  scoreEmoji: { fontSize: 52 },
  score: { marginTop: 10, fontSize: 30, fontWeight: '800', color: TITLE },

  // ── Buttons ────────────────────────────────────────────────────────────
  buttonRow: { flexDirection: 'row', gap: 12 },
  button: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A raised button on the glass page: the same shadow ladder as every other
  // object, so the eye can tell how high it sits relative to the cards near it.
  buttonOn: { backgroundColor: PRIMARY, boxShadow: lift('md') },
  buttonOff: { backgroundColor: PRIMARY_OFF },
  buttonOnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  buttonText: { fontSize: 17, fontWeight: '600', color: INK, letterSpacing: -0.2 },

  // ── Quiz ───────────────────────────────────────────────────────────────
  quiz: { flex: 1, paddingHorizontal: 20, paddingBottom: 20 },
  quizHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  counter: { fontSize: 13.5, fontWeight: '600', color: MUTED },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
  },
  timerText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: INK,
    fontVariant: ['tabular-nums'],
  },
  timerTextLow: { color: DANGER },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(47,111,228,0.12)',
    marginBottom: 18,
  },
  trackFill: { height: '100%', borderRadius: 3, backgroundColor: PRIMARY },
  quizScroll: { flex: 1 },
  quizBody: { paddingBottom: 10 },
  questionCard: { padding: 20, marginBottom: 16 },
  questionText: { fontSize: 17, lineHeight: 26, color: INK },
  choices: { gap: 10 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  choiceOn: {
    backgroundColor: 'rgba(47,111,228,0.14)',
    borderColor: PRIMARY,
  },
  choiceText: { flex: 1, fontSize: 15.5, lineHeight: 21, color: INK },
  letter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: MUTED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterOn: { borderColor: PRIMARY, backgroundColor: PRIMARY },
  letterText: { fontSize: 13, fontWeight: '700', color: MUTED },
  letterTextOn: { color: '#FFFFFF' },
  next: { flex: 0, marginTop: 14 },

  // ── Result review ──────────────────────────────────────────────────────
  reviewList: { gap: 10 },
  reviewBody: { flex: 1 },
  review: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
  },
  reviewQuestion: { fontSize: 14, lineHeight: 20, color: INK },
  reviewAnswer: { marginTop: 6, fontSize: 13, lineHeight: 18, color: MUTED },
  reviewExplanation: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(140,163,203,0.9)',
  },
});
