import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  CheckCircle2,
  Plus,
  Target,
  Trash2,
  Users,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAvoidingView } from '@/components/keyboard-avoiding-view';
import { fetchGoalCatalog, type Goal, type GoalCatalogEntry } from '@/api/endpoints/goals';
import { GoalMatesSection } from '@/components/goals/goal-mates-section';
import { useT } from '@/i18n';
import { glass, lift } from '@/lib/glass';
import {
  useAddProgress,
  useCreateGoal,
  useDeleteGoal,
  useGoals,
  useGoalSignal,
  useUpdateGoal,
} from '@/hooks/use-goals';
import { useChildStore } from '@/store/child';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
// Same family as settings, dtm and goal-mates: frosted panes on pale blue. The
// navy/neon build this replaces predated the glass system and read as a
// different app bolted onto this one.
const PRIMARY = '#2F6FE4';
const TITLE = '#2A63DC';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const GREEN = '#22B573';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';
const PLACEHOLDER = '#7693C2';
/** The disabled fill. Not `PRIMARY` at low opacity: a translucent button lets
 *  the page's gradient through and reads as a hole rather than a dimmed one. */
const PRIMARY_OFF = '#A8C2EA';
/** The offline strip. Amber survives the restyle — it is the one warning on a
 *  page of blues — but darkened, because the neon orange was unreadable on a
 *  pale ground. */
const WARN = '#B4661A';
const WARN_BG = 'rgba(251,146,60,0.16)';

/**
 * Debounced catalog search behind the free-text draft.
 *
 * A goal only becomes matchable to another child through a curated
 * `match_key` (see models/goal.py) — raw title text is never compared, by
 * design, so it can't leak whatever a child typed. Picking a suggestion here
 * is the one path that attaches a match_key; typing and just hitting "+"
 * still creates a perfectly good goal, only a private one.
 */
const NO_SUGGESTIONS: GoalCatalogEntry[] = [];

function useCatalogSuggestions(query: string, age: number | undefined) {
  const [results, setResults] = useState<GoalCatalogEntry[]>(NO_SUGGESTIONS);
  const q = query.trim();

  useEffect(() => {
    // Under two characters nothing is fetched and the render below answers
    // with the empty list directly — no synchronous setState needed.
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchGoalCatalog(q, age).then((entries) => {
        if (!cancelled) setResults(entries);
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, age]);

  return q.length < 2 ? NO_SUGGESTIONS : results;
}

function GoalCard({
  goal,
  onProgress,
  onComplete,
  onDelete,
}: {
  goal: Goal;
  onProgress: (value: number) => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const [entry, setEntry] = useState('');
  const done = goal.status === 'completed';
  const unit = goal.unit_label ?? t('goals.unitStep');
  const canSave = entry.length > 0;

  return (
    <View
      style={[
        glass(22, 'md', done ? 0.5 : 0.62),
        styles.card,
        done && styles.cardDone,
      ]}
    >
      <View style={styles.cardHead}>
        <View style={styles.cardHeadBody}>
          <Text style={[styles.goalTitle, done && styles.goalTitleDone]}>
            {goal.title}
          </Text>
          {goal.current_unit !== null && (
            <Text style={styles.goalMeta}>
              {goal.total_units
                ? t('goals.progressOf', {
                    cur: goal.current_unit,
                    tot: goal.total_units,
                    unit,
                  })
                : t('goals.progressAt', { cur: goal.current_unit, unit })}
            </Text>
          )}
          {done && <Text style={styles.goalDone}>{t('goals.done')}</Text>}
        </View>
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={t('goals.delete.title')}
          hitSlop={10}
          style={[styles.iconButton, styles.focusable]}
        >
          <Trash2 size={18} color={MUTED} />
        </Pressable>
      </View>

      {goal.progress_pct !== null && (
        <View style={styles.progress}>
          <View style={styles.track}>
            <View
              style={[
                styles.trackFill,
                done && styles.trackFillDone,
                { width: `${Math.max(0, Math.min(100, goal.progress_pct ?? 0))}%` },
              ]}
            />
          </View>
          <Text style={styles.progressPct}>
            {Math.round(goal.progress_pct ?? 0)}%
          </Text>
        </View>
      )}

      {!done && (
        <View style={[styles.entryRow, styles.entryRowSpaced]}>
          <TextInput
            value={entry}
            onChangeText={(t) => setEntry(t.replace(/\D/g, '').slice(0, 6))}
            placeholder={t('goals.progressPlaceholder', { unit })}
            placeholderTextColor={PLACEHOLDER}
            keyboardType="number-pad"
            accessibilityLabel={t('goals.a11y.progress')}
            style={styles.entryInput}
          />
          <Pressable
            onPress={() => {
              const value = Number(entry);
              if (!canSave || Number.isNaN(value)) return;
              onProgress(value);
              setEntry('');
            }}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel={t('goals.a11y.saveProgress')}
            style={({ pressed }) => [
              styles.saveButton,
              canSave ? styles.buttonOn : styles.buttonOff,
              pressed && canSave && styles.pressed,
              styles.focusable,
            ]}
          >
            <Text style={styles.buttonText}>{t('common.save')}</Text>
          </Pressable>
          <Pressable
            onPress={onComplete}
            accessibilityRole="button"
            accessibilityLabel={t('goals.markDone')}
            hitSlop={8}
            style={[styles.completeButton, styles.focusable]}
          >
            <CheckCircle2 size={24} color={GREEN} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function GoalsScreen({ onBack }: { onBack?: () => void } = {}) {
  const t = useT();
  const child = useChildStore((s) => s.child);
  const childId = child?.id;

  const goalsQuery = useGoals(childId);
  const signalQuery = useGoalSignal(childId);
  const createMutation = useCreateGoal(childId);
  const progressMutation = useAddProgress(childId);
  const updateMutation = useUpdateGoal(childId);
  const deleteMutation = useDeleteGoal(childId);

  const [draft, setDraft] = useState('');
  // Set only when the child taps a suggestion below; any further edit to the
  // text clears it, so a stale key never rides along with different words.
  const [picked, setPicked] = useState<GoalCatalogEntry | null>(null);
  const suggestions = useCatalogSuggestions(picked ? '' : draft, child?.age);

  const goals = goalsQuery.data ?? [];
  const active = goals.filter((g) => g.status === 'active');
  const finished = goals.filter((g) => g.status === 'completed');
  const signals = signalQuery.data ?? [];
  const canAdd = draft.trim().length >= 2;

  const handleChangeDraft = (text: string) => {
    setDraft(text);
    if (picked && text !== picked.title) setPicked(null);
  };

  const handlePickSuggestion = (entry: GoalCatalogEntry) => {
    setPicked(entry);
    setDraft(entry.title);
  };

  const handleCreate = () => {
    if (!canAdd) return;
    createMutation.mutate(
      {
        title: draft.trim(),
        kind: picked?.kind,
        match_key: picked?.match_key,
      },
      {
        onSuccess: () => {
          setDraft('');
          setPicked(null);
        },
        onError: () =>
          Alert.alert(t('common.saveFailedTitle'), t('common.checkInternetRetry')),
      },
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.root} edges={['top']}>
        <KeyboardAvoidingView behavior="padding" style={styles.root}>
          <ScrollView
            contentContainerStyle={styles.page}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* The back button is a SIBLING of the title, not a thing floating
                over it. The route used to position it absolutely while this
                screen dodged it with a fixed paddingTop — two files guessing
                at each other, and the guess was wrong: on web `insets.top` is
                0, so the button ended at y=66 and the title started at 56. */}
            <View style={styles.intro}>
              <View style={styles.titleRow}>
                {onBack ? (
                <Pressable
                  onPress={onBack}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.back')}
                  style={[glass(23, 'sm', 0.9), styles.backButton, styles.focusable]}
                >
                  <ArrowLeft size={22} color={PRIMARY} strokeWidth={2.1} />
                </Pressable>
                ) : null}
                <Text style={styles.screenTitle}>{t('goals.title')}</Text>
              </View>
              <Text style={styles.screenSubtitle}>{t('goals.subtitle')}</Text>
            </View>

            {/* Add a goal by hand — DUYO also adds them from conversation. */}
            <View style={[glass(22, 'md', 0.62), styles.card]}>
              <View style={styles.entryRow}>
                <TextInput
                  value={draft}
                  onChangeText={handleChangeDraft}
                  placeholder={t('goals.draftPlaceholder')}
                  placeholderTextColor={PLACEHOLDER}
                  maxLength={160}
                  accessibilityLabel={t('goals.a11y.newGoal')}
                  style={styles.draftInput}
                />
                <Pressable
                  onPress={handleCreate}
                  disabled={!canAdd || createMutation.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={t('goals.add')}
                  style={({ pressed }) => [
                    styles.addButton,
                    canAdd ? styles.buttonOn : styles.buttonOff,
                    pressed && canAdd && styles.pressed,
                    styles.focusable,
                  ]}
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Plus size={22} color="#FFFFFF" />
                  )}
                </Pressable>
              </View>

              {/* Picking one of these is what lets another child with the same
                  goal find you — free-typed text never matches anyone. */}
              {!picked && suggestions.length > 0 && (
                <View style={styles.suggestions}>
                  {suggestions.map((entry) => (
                    <Pressable
                      key={entry.match_key}
                      onPress={() => handlePickSuggestion(entry)}
                      accessibilityRole="button"
                      accessibilityLabel={t('goals.a11y.pickSuggestion', {
                        title: entry.title,
                      })}
                      style={({ pressed }) => [
                        styles.suggestion,
                        pressed && styles.pressed,
                        styles.focusable,
                      ]}
                    >
                      <Text style={styles.suggestionText} numberOfLines={1}>
                        {entry.title}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {picked && (
                <View style={styles.matchNote}>
                  <Users size={13} color={GREEN} />
                  <Text style={styles.matchNoteText}>{t('goals.matchNote')}</Text>
                </View>
              )}
            </View>

            {/* "You are not alone" — counts only, never identities. */}
            {signals.map((s) => (
              <View
                key={s.match_key}
                style={[glass(22, 'md', 0.62), styles.card, styles.signalCard]}
              >
                <View style={styles.signalWell}>
                  <Users size={20} color={PRIMARY} />
                </View>
                <View style={styles.signalBody}>
                  <Text style={styles.signalTitle}>
                    {t('goals.signalCount', { count: s.count })}
                  </Text>
                  <Text style={styles.signalGoal} numberOfLines={1}>
                    {s.title}
                  </Text>
                </View>
              </View>
            ))}

            {/* States. A cached list is never blanked out mid-read. */}
            {goalsQuery.isLoading && goals.length === 0 ? (
              <View style={styles.loading}>
                <ActivityIndicator color={PRIMARY} />
              </View>
            ) : goalsQuery.isError && goals.length === 0 ? (
              <View style={[glass(28, 'lg', 0.6), styles.statusCard]}>
                <Text style={styles.statusEmoji}>⚠️</Text>
                <Text style={styles.statusTitle}>{t('goals.loadFailed')}</Text>
                <Text style={styles.statusBody}>
                  {t('common.checkInternetRetry')}
                </Text>
              </View>
            ) : goals.length === 0 ? (
              <View style={[glass(28, 'lg', 0.6), styles.statusCard]}>
                <View style={styles.emptyWell}>
                  <Target size={30} color={PRIMARY} />
                </View>
                <Text style={styles.statusTitle}>{t('goals.empty.title')}</Text>
                <Text style={styles.statusBody}>{t('goals.empty.body')}</Text>
              </View>
            ) : (
              <>
                {goalsQuery.isError && (
                  <View style={styles.offline}>
                    <Text style={styles.offlineText}>
                      {t('common.offlineCached')}
                    </Text>
                  </View>
                )}

                {active.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onProgress={(value) =>
                      progressMutation.mutate({
                        goalId: goal.id,
                        unitValue: value,
                      })
                    }
                    onComplete={() =>
                      updateMutation.mutate({
                        goalId: goal.id,
                        patch: { status: 'completed' },
                      })
                    }
                    onDelete={() =>
                      Alert.alert(
                        t('goals.delete.title'),
                        t('goals.delete.body', { title: goal.title }),
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          {
                            text: t('common.delete'),
                            style: 'destructive',
                            onPress: () => deleteMutation.mutate(goal.id),
                          },
                        ],
                      )
                    }
                  />
                ))}

                {finished.length > 0 && (
                  <>
                    <Text style={styles.sectionHeading}>
                      {t('goals.finishedHeading', { count: finished.length })}
                    </Text>
                    {finished.map((goal) => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        onProgress={() => {}}
                        onComplete={() => {}}
                        onDelete={() => deleteMutation.mutate(goal.id)}
                      />
                    ))}
                  </>
                )}
              </>
            )}

            {/* Peers working toward the same thing. Sits below the child's own
                goals: the goal comes first, the company second. */}
            <GoalMatesSection childId={childId} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/** The app's field, as FormInput draws it: a near-solid well with a tinted
 *  hairline instead of a shadow, so a control never outranks the card it is
 *  drawn on. */
const field = (height: number, radius: number, fontSize: number) =>
  ({
    flex: 1,
    // A flex child will not shrink below its intrinsic width unless told it
    // may, and an <input> on the web has a wide intrinsic width. Without this
    // the row overflowed the card and pushed the "tugatdim" tick off the
    // right-hand edge.
    minWidth: 0,
    height,
    paddingHorizontal: 14,
    paddingVertical: 0,
    borderRadius: radius,
    fontSize,
    color: INK,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(47,111,228,0.12)',
    // The browser's own focus ring is a square drawn outside the radius; the
    // tinted border above is what marks the field instead.
    outlineStyle: 'none',
    outlineWidth: 0,
  }) as unknown as TextStyle;

const styles = StyleSheet.create({
  root: { flex: 1 },
  // The browser's default focus ring is a square drawn around a rounded
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
  pressed: { opacity: 0.85 },

  page: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 96,
    gap: 16,
  },

  intro: { gap: 6, paddingHorizontal: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  screenTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: TITLE,
  },
  screenSubtitle: { fontSize: 13.5, lineHeight: 19, color: MUTED },

  card: { padding: 16 },
  cardDone: { borderColor: 'rgba(34,181,115,0.45)' },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardHeadBody: { flex: 1 },
  goalTitle: { fontSize: 16, fontWeight: '700', color: INK },
  goalTitleDone: { color: MUTED },
  goalMeta: { marginTop: 4, fontSize: 13.5, color: MUTED },
  goalDone: { marginTop: 4, fontSize: 13.5, fontWeight: '600', color: GREEN },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  progress: { marginTop: 16 },
  track: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: 'rgba(47,111,228,0.12)',
  },
  trackFill: { height: '100%', borderRadius: 5, backgroundColor: PRIMARY },
  trackFillDone: { backgroundColor: GREEN },
  progressPct: { marginTop: 8, fontSize: 12, color: MUTED, textAlign: 'right' },

  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entryRowSpaced: { marginTop: 16 },
  draftInput: field(48, 16, 16),
  entryInput: field(44, 14, 15),
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A raised button on the glass page: the same shadow ladder as every other
  // object, so the eye can tell how high it sits next to the card it is on.
  buttonOn: { backgroundColor: PRIMARY, boxShadow: lift('md') },
  buttonOff: { backgroundColor: PRIMARY_OFF },
  buttonText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  suggestion: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47,111,228,0.10)',
  },
  suggestionText: { fontSize: 12.5, fontWeight: '600', color: PRIMARY },

  matchNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  matchNoteText: { fontSize: 12.5, color: GREEN },

  signalCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  signalWell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47,111,228,0.10)',
  },
  signalBody: { flex: 1 },
  signalTitle: { fontSize: 16, fontWeight: '700', color: INK },
  signalGoal: { marginTop: 2, fontSize: 13.5, color: MUTED },

  loading: { alignItems: 'center', padding: 32 },
  statusCard: { alignItems: 'center', padding: 28 },
  statusEmoji: { fontSize: 38 },
  statusTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
  },
  statusBody: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    textAlign: 'center',
  },
  emptyWell: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47,111,228,0.10)',
  },

  offline: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: WARN_BG,
  },
  offlineText: { fontSize: 12.5, fontWeight: '600', color: WARN },

  sectionHeading: { marginTop: 8, fontSize: 16, fontWeight: '700', color: INK },
});
