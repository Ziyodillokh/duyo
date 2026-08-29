import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  CloudOff,
  PenLine,
  Sparkles,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { lessonHelpErrorMessage } from '@/api/endpoints/lesson-help';
import { KeyboardAvoidingView } from '@/components/keyboard-avoiding-view';
import { Text, TextInput } from '@/components/text';
import { useLessonHelp } from '@/hooks/use-lesson-help';
import { glass, lift } from '@/lib/glass';
import { SUBJECTS, type Subject } from '@/lib/subjects';
import { useChildStore } from '@/store/child';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
// Same family as settings and notifications: frosted panes on pale blue.
const PRIMARY = '#2F6FE4';
const TITLE = '#2A63DC';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const DANGER = '#E0455E';
const GREEN = '#22B573';
const PLACEHOLDER = '#7693C2';
const HAIRLINE = 'rgba(47,111,228,0.10)';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';
/** The disabled fill. Not `PRIMARY` at low opacity: a translucent button lets
 *  the page's gradient through and reads as a hole rather than a dimmed one. */
const PRIMARY_OFF = '#A8C2EA';

// `stage` is DERIVED from the request, never set by hand. The old screen kept
// its own state machine and moved to "result" on a 1.5s setTimeout, which is
// how it could show a solution it had not asked anyone for.
type Stage = 'input' | 'solving' | 'result' | 'error';

export default function LessonHelpScreen() {
  const child = useChildStore((s) => s.child);
  const [subject, setSubject] = useState<Subject>('math');
  const [question, setQuestion] = useState('');
  const solve = useLessonHelp(child?.id);

  const stage: Stage = solve.isPending
    ? 'solving'
    : solve.isError
      ? 'error'
      : solve.data
        ? 'result'
        : 'input';

  // The backend enforces 3..2000 on the question; matching it here means the
  // child is stopped by a greyed-out button rather than by a 422.
  const trimmed = question.trim();
  const canSubmit = trimmed.length >= 3 && trimmed.length <= 2000 && !!child;

  const askAgain = () => solve.reset();

  const handleSubmit = () => {
    if (!canSubmit || solve.isPending) return;
    const meta = SUBJECTS.find((s) => s.key === subject);
    solve.mutate({
      // The readable Uzbek label, not the key — it goes into the tutor prompt
      // as "Fan: ..." (see api/endpoints/lesson-help.ts).
      subject: meta?.label ?? subject,
      question: trimmed,
    });
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.root} edges={['top']}>
        {/* ── Header: 48pt glass rounds, the inner-screen pattern ────── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (stage === 'input') router.back();
              else askAgain();
            }}
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            style={[glass(24, 'sm'), styles.headerButton, styles.focusable]}
          >
            <ArrowLeft size={23} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>Dars yordami</Text>
          {/* Keeps the title centred. */}
          <View style={styles.headerButton} />
        </View>

        <KeyboardAvoidingView behavior="padding" style={styles.root}>
          {stage === 'input' && (
            <ScrollView
              contentContainerStyle={styles.page}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Fan tanlang</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chips}
                >
                  {SUBJECTS.map((s) => {
                    const sel = s.key === subject;
                    return (
                      <Pressable
                        key={s.key}
                        onPress={() => setSubject(s.key)}
                        accessibilityRole="button"
                        accessibilityLabel={s.label}
                        style={[
                          glass(18, 'sm'),
                          styles.chip,
                          sel && styles.chipOn,
                          styles.focusable,
                        ]}
                      >
                        <Text style={styles.chipEmoji}>{s.emoji}</Text>
                        <Text style={[styles.chipText, sel && styles.chipTextOn]}>
                          {s.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Dashed on purpose: the one drop target on the page should not
                  look like the solid panes around it. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Vazifani yuklash"
                onPress={() =>
                  Alert.alert(
                    'Tez orada',
                    "Kamera/galereya integratsiyasi Faza 1'da qo'shiladi",
                  )
                }
                style={[styles.upload, styles.focusable]}
              >
                <Camera size={30} color={PRIMARY} strokeWidth={1.9} />
                <Text style={styles.uploadTitle}>Vazifani yuklash</Text>
                <Text style={styles.uploadBody}>
                  Rasm chiqaring yoki galereyadan tanlang
                </Text>
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>yoki yozing</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={[glass(22, 'md', 0.6), styles.inputCard]}>
                <View style={styles.inputHead}>
                  <PenLine size={16} color={PRIMARY} strokeWidth={2.2} />
                  <Text style={styles.inputLabel}>Vazifa matni</Text>
                </View>
                <TextInput
                  value={question}
                  onChangeText={setQuestion}
                  placeholder="Vazifani shu yerga yozing..."
                  placeholderTextColor={PLACEHOLDER}
                  multiline
                  style={styles.input}
                  accessibilityLabel="Vazifa matni"
                />
              </View>

              {/* A profile is what the tutor is age-tuned to, so without one
                  there is nothing honest to send. Said out loud rather than
                  left as a mysteriously dead button. */}
              {!child && (
                <Text style={styles.notice}>
                  Avval profilingni tanla — yordam bolaning yoshiga moslanadi.
                </Text>
              )}

              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmit }}
                accessibilityLabel="DUYO'dan yordam so'rash"
                style={[
                  styles.button,
                  canSubmit ? styles.buttonOn : styles.buttonOff,
                  styles.submit,
                  styles.focusable,
                ]}
              >
                <Sparkles size={18} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.buttonOnText}>DUYO'dan yordam so'rash</Text>
              </Pressable>
            </ScrollView>
          )}

          {stage === 'solving' && (
            <View style={styles.centre}>
              <Text style={styles.centreEmoji}>🤔</Text>
              <Text style={styles.centreTitle}>DUYO yechimni o'ylayapti...</Text>
              {/* Indeterminate on purpose. The bar this replaces was frozen at
                  60% — a progress claim nothing was measuring. */}
              <ActivityIndicator color={PRIMARY} />
            </View>
          )}

          {stage === 'error' && (
            <View style={styles.centre}>
              <CloudOff size={38} color={DANGER} strokeWidth={1.9} />
              <Text style={styles.centreBody}>
                {lessonHelpErrorMessage(solve.error)}
              </Text>
              <Pressable
                onPress={handleSubmit}
                accessibilityRole="button"
                accessibilityLabel="Qayta urinish"
                style={[
                  styles.button,
                  styles.buttonOn,
                  styles.buttonInline,
                  styles.focusable,
                ]}
              >
                <Text style={styles.buttonOnText}>Qayta urinish</Text>
              </Pressable>
              <Pressable
                onPress={askAgain}
                accessibilityRole="button"
                accessibilityLabel="Vazifani tahrirlash"
                style={[styles.link, styles.focusable]}
              >
                <Text style={styles.linkText}>Vazifani tahrirlash</Text>
              </Pressable>
            </View>
          )}

          {stage === 'result' && solve.data && (
            <ScrollView
              contentContainerStyle={styles.page}
              showsVerticalScrollIndicator={false}
            >
              <View style={[glass(22, 'md', 0.55), styles.askedCard]}>
                <Text style={styles.askedCaption}>Sizning vazifangiz:</Text>
                <Text style={styles.askedText}>
                  {solve.variables?.question ?? question}
                </Text>
              </View>

              {/* available=false means the tutor could not reach the model and
                  `steps` is its apology. Rendering that under "DUYO yechimi"
                  would be the app claiming a solution it does not have. */}
              {!solve.data.available ? (
                <View style={styles.apology}>
                  <View style={styles.apologyHead}>
                    <CloudOff size={18} color={DANGER} strokeWidth={2.1} />
                    <Text style={styles.apologyTitle}>
                      {solve.data.steps[0]?.title ?? 'Hozir yordam berolmayman'}
                    </Text>
                  </View>
                  <Text style={styles.apologyBody}>
                    {solve.data.steps[0]?.detail ??
                      "Kechir, hozir yechimni tayyorlay olmayapman. Birozdan so'ng yana urinib ko'r."}
                  </Text>
                </View>
              ) : (
                <View style={styles.steps}>
                  <View style={styles.stepsHead}>
                    <Sparkles size={18} color={PRIMARY} strokeWidth={2.1} />
                    <Text style={styles.stepsTitle}>DUYO yechimi</Text>
                  </View>
                  {solve.data.steps.map((step, i) => (
                    <View key={i} style={[glass(20, 'sm', 0.55), styles.step]}>
                      {!!step.title && (
                        <Text style={styles.stepTitle}>{step.title}</Text>
                      )}
                      <Text style={styles.stepDetail}>{step.detail}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Only when the tutor actually produced one — an empty green
                  "Yakuniy javob" box is the fake answer this screen used to
                  hard-code. Plenty of real questions ("tushuntirib ber") have
                  steps but no single result line. */}
              {solve.data.available && !!solve.data.answer && (
                <View style={styles.finalCard}>
                  <View style={styles.finalHead}>
                    <CheckCircle2 size={20} color={GREEN} strokeWidth={2.2} />
                    <Text style={styles.finalLabel}>Yakuniy javob</Text>
                  </View>
                  <Text style={styles.finalAnswer}>{solve.data.answer}</Text>
                </View>
              )}

              <View style={styles.buttonRow}>
                {solve.data.available ? (
                  <Pressable
                    onPress={() => router.push('/(main)/(tabs)/chat')}
                    accessibilityRole="button"
                    accessibilityLabel="Tushuntirish"
                    style={[styles.button, styles.buttonOn, styles.focusable]}
                  >
                    <Text style={styles.buttonOnText}>Tushuntirish</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleSubmit}
                    accessibilityRole="button"
                    accessibilityLabel="Qayta urinish"
                    style={[styles.button, styles.buttonOn, styles.focusable]}
                  >
                    <Text style={styles.buttonOnText}>Qayta urinish</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => {
                    askAgain();
                    setQuestion('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Yangi vazifa"
                  style={[glass(18, 'md'), styles.button, styles.focusable]}
                >
                  <Text style={styles.buttonText}>Yangi vazifa</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
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
    gap: 18,
  },

  // ── Subject chips ──────────────────────────────────────────────────────
  field: { gap: 10 },
  fieldLabel: { marginLeft: 4, fontSize: 15, fontWeight: '600', color: INK },
  // The vertical padding is for the chips' own shadow: a horizontal
  // ScrollView clips at its content box, and `sm` reaches 11pt below.
  chips: { gap: 10, paddingRight: 4, paddingVertical: 5 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    paddingHorizontal: 14,
  },
  chipOn: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipEmoji: { fontSize: 16 },
  chipText: { fontSize: 14.5, fontWeight: '600', color: INK },
  chipTextOn: { color: '#FFFFFF' },

  // ── Upload well ────────────────────────────────────────────────────────
  upload: {
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(47,111,228,0.35)',
    backgroundColor: 'rgba(255,255,255,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  uploadTitle: { marginTop: 12, fontSize: 15.5, fontWeight: '700', color: INK },
  uploadBody: { marginTop: 3, fontSize: 13, color: MUTED, textAlign: 'center' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: HAIRLINE },
  dividerText: { fontSize: 13, color: MUTED },

  // ── Question input ─────────────────────────────────────────────────────
  inputCard: { padding: 16 },
  inputHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  inputLabel: { fontSize: 14, fontWeight: '700', color: INK },
  input: {
    minHeight: 120,
    fontSize: 15.5,
    lineHeight: 22,
    color: INK,
    textAlignVertical: 'top',
    padding: 0,
  },
  notice: { fontSize: 13.5, lineHeight: 19, color: DANGER },

  // ── Buttons ────────────────────────────────────────────────────────────
  buttonRow: { flexDirection: 'row', gap: 12 },
  button: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  // A raised button on the glass page: the same shadow ladder as every other
  // object, so the eye can tell how high it sits relative to the cards near it.
  buttonOn: { backgroundColor: PRIMARY, boxShadow: lift('md') },
  buttonOff: { backgroundColor: PRIMARY_OFF },
  // Sole button on a column page: it must not stretch to the page's height.
  submit: { flex: 0 },
  // Sits inside a centred column, so it hugs its label instead of filling.
  buttonInline: { flex: 0, alignSelf: 'center', paddingHorizontal: 28 },
  buttonOnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  buttonText: { fontSize: 17, fontWeight: '600', color: INK, letterSpacing: -0.2 },
  link: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontSize: 14, fontWeight: '600', color: MUTED },

  // ── Solving / error ────────────────────────────────────────────────────
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  centreEmoji: { fontSize: 44 },
  centreTitle: { fontSize: 17, fontWeight: '700', color: INK, textAlign: 'center' },
  centreBody: { fontSize: 15, lineHeight: 22, color: INK, textAlign: 'center' },

  // ── Result ─────────────────────────────────────────────────────────────
  askedCard: { padding: 18 },
  askedCaption: { fontSize: 13, fontWeight: '600', color: MUTED },
  askedText: { marginTop: 6, fontSize: 15.5, lineHeight: 22, color: INK },

  // The tutor's apology is tinted rather than glass: it is the one pane on
  // the page that is not a solution, and it should not look like one.
  apology: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(224,69,94,0.28)',
    backgroundColor: 'rgba(224,69,94,0.08)',
    padding: 18,
    gap: 8,
  },
  apologyHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  apologyTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: DANGER },
  apologyBody: { fontSize: 15, lineHeight: 22, color: INK },

  steps: { gap: 10 },
  stepsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 2,
  },
  stepsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TITLE,
    letterSpacing: -0.3,
  },
  step: { padding: 14 },
  stepTitle: {
    marginBottom: 4,
    fontSize: 13.5,
    fontWeight: '700',
    color: PRIMARY,
  },
  stepDetail: { fontSize: 15, lineHeight: 22, color: INK },

  finalCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(34,181,115,0.30)',
    backgroundColor: 'rgba(34,181,115,0.10)',
    padding: 18,
  },
  finalHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  finalLabel: { fontSize: 13.5, fontWeight: '700', color: GREEN },
  finalAnswer: { marginTop: 8, fontSize: 22, fontWeight: '800', color: INK },
});
