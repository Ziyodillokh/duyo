import { CheckCircle2, Plus, Target, Trash2, Users } from 'lucide-react-native';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Goal } from '@/api/endpoints/goals';
import {
  useAddProgress,
  useCreateGoal,
  useDeleteGoal,
  useGoals,
  useGoalSignal,
  useUpdateGoal,
} from '@/hooks/use-goals';
import { useChildStore } from '@/store/child';

function GoalProgressBar({ pct }: { pct: number }) {
  return (
    <View className="h-2 rounded-full bg-secondary dark:bg-dark-surface-soft mt-3 overflow-hidden">
      <View
        className="h-2 rounded-full bg-neon-blue"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </View>
  );
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
  const [entry, setEntry] = useState('');
  const done = goal.status === 'completed';
  const unit = goal.unit_label ?? 'qadam';

  return (
    <View
      className="rounded-xl border border-neon-blue/20 bg-card dark:bg-dark-surface"
      style={{ padding: 16 }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text
            className={`text-base font-semibold ${
              done
                ? 'text-muted-foreground dark:text-dark-muted line-through'
                : 'text-foreground dark:text-dark-text'
            }`}
          >
            {goal.title}
          </Text>
          {goal.current_unit !== null && (
            <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1">
              {goal.total_units
                ? `${goal.current_unit} / ${goal.total_units} ${unit}`
                : `${goal.current_unit}-${unit}da`}
            </Text>
          )}
        </View>
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel="Maqsadni o'chirish"
          hitSlop={10}
          className="p-1"
        >
          <Trash2 size={18} color="#94A3B8" />
        </Pressable>
      </View>

      {goal.progress_pct !== null && <GoalProgressBar pct={goal.progress_pct} />}

      {!done && (
        <View className="flex-row items-center gap-2 mt-3">
          <TextInput
            value={entry}
            onChangeText={(t) => setEntry(t.replace(/\D/g, '').slice(0, 6))}
            placeholder={`Nechanchi ${unit}?`}
            placeholderTextColor="#94A3B8"
            keyboardType="number-pad"
            accessibilityLabel="Yangi progress"
            className="flex-1 px-3 py-2 rounded-md text-base text-foreground dark:text-dark-text"
            style={{ backgroundColor: 'rgba(148,163,184,0.12)' }}
          />
          <Pressable
            onPress={() => {
              const value = Number(entry);
              if (!entry || Number.isNaN(value)) return;
              onProgress(value);
              setEntry('');
            }}
            disabled={!entry}
            accessibilityRole="button"
            accessibilityLabel="Progressni saqlash"
            className={`px-4 h-10 rounded-md items-center justify-center ${
              entry ? 'bg-neon-blue' : 'bg-secondary dark:bg-dark-surface-soft'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                entry ? 'text-white' : 'text-muted-foreground'
              }`}
            >
              Saqlash
            </Text>
          </Pressable>
          <Pressable
            onPress={onComplete}
            accessibilityRole="button"
            accessibilityLabel="Tugatdim"
            hitSlop={8}
            className="w-10 h-10 items-center justify-center"
          >
            <CheckCircle2 size={22} color="#22C55E" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function GoalsScreen() {
  const child = useChildStore((s) => s.child);
  const childId = child?.id;

  const goalsQuery = useGoals(childId);
  const signalQuery = useGoalSignal(childId);
  const createMutation = useCreateGoal(childId);
  const progressMutation = useAddProgress(childId);
  const updateMutation = useUpdateGoal(childId);
  const deleteMutation = useDeleteGoal(childId);

  const [draft, setDraft] = useState('');

  const goals = goalsQuery.data ?? [];
  const active = goals.filter((g) => g.status === 'active');
  const finished = goals.filter((g) => g.status === 'completed');
  const signals = signalQuery.data ?? [];

  const handleCreate = () => {
    const title = draft.trim();
    if (title.length < 2) return;
    createMutation.mutate(
      { title },
      {
        onSuccess: () => setDraft(''),
        onError: () =>
          Alert.alert('Saqlanmadi', "Internetni tekshirib, qayta urinib ko'ring."),
      },
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-dark-bg" edges={['top']}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-1">
            <Text className="text-2xl font-bold text-foreground dark:text-dark-text">
              Maqsadlarim
            </Text>
            <Text className="text-sm text-muted-foreground dark:text-dark-muted">
              DUYO maqsadingni eslab qoladi va unga yetishda yordam beradi
            </Text>
          </View>

          {/* New goal */}
          <View className="flex-row items-center gap-2">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Masalan: O'tkan Kunlarni o'qish"
              placeholderTextColor="#94A3B8"
              maxLength={160}
              accessibilityLabel="Yangi maqsad"
              className="flex-1 px-4 py-3 rounded-md text-base text-foreground dark:text-dark-text"
              style={{ backgroundColor: 'rgba(148,163,184,0.12)' }}
            />
            <Pressable
              onPress={handleCreate}
              disabled={draft.trim().length < 2 || createMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="Maqsad qo'shish"
              className={`w-12 h-12 rounded-md items-center justify-center ${
                draft.trim().length >= 2
                  ? 'bg-neon-blue'
                  : 'bg-secondary dark:bg-dark-surface-soft'
              }`}
            >
              <Plus
                size={22}
                color={draft.trim().length >= 2 ? '#FFFFFF' : '#94A3B8'}
              />
            </Pressable>
          </View>

          {/* "You are not alone" — counts only, never identities. */}
          {signals.length > 0 && (
            <View className="gap-2">
              {signals.map((s) => (
                <View
                  key={s.match_key}
                  className="flex-row items-center gap-2 rounded-xl border border-neon-blue/20 px-4 py-3"
                >
                  <Users size={18} color="#60A5FA" />
                  <Text className="flex-1 text-sm text-foreground dark:text-dark-text">
                    Yana{' '}
                    <Text className="font-bold text-neon-blue">{s.count} ta</Text>{' '}
                    bola ham shu maqsadda: {s.title}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* States. Never blank a list the child was just reading: on error
              with cached goals we keep the list and show a thin strip. */}
          {goalsQuery.isLoading && goals.length === 0 ? (
            <View className="rounded-xl border border-neon-blue/20 items-center" style={{ padding: 24 }}>
              <Text className="text-base font-medium text-foreground dark:text-dark-text">
                Yuklanmoqda…
              </Text>
            </View>
          ) : goalsQuery.isError && goals.length === 0 ? (
            <View className="rounded-xl border border-neon-blue/20 items-center" style={{ padding: 24 }}>
              <Text className="text-4xl">⚠️</Text>
              <Text className="text-base font-medium text-foreground dark:text-dark-text mt-2">
                Maqsadlarni yuklab bo'lmadi
              </Text>
              <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1 text-center">
                Internetni tekshirib, qaytadan urinib ko'ring
              </Text>
            </View>
          ) : goals.length === 0 ? (
            <View className="rounded-xl border border-neon-blue/20 items-center" style={{ padding: 24 }}>
              <Target size={36} color="#60A5FA" />
              <Text className="text-base font-medium text-foreground dark:text-dark-text mt-2">
                Hali maqsad yo'q
              </Text>
              <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1 text-center">
                Yuqoriga birinchi maqsadingni yoz — masalan o'qimoqchi bo'lgan
                kitobing yoki tugatmoqchi bo'lgan darsliging
              </Text>
            </View>
          ) : (
            <>
              {goalsQuery.isError && (
                <View className="rounded-md px-3 py-2" style={{ backgroundColor: 'rgba(245,158,11,0.15)' }}>
                  <Text className="text-xs text-amber-600">
                    Oflayn — oxirgi ma'lumot ko'rsatilyapti
                  </Text>
                </View>
              )}

              <View className="gap-3">
                {active.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onProgress={(value) =>
                      progressMutation.mutate({ goalId: goal.id, unitValue: value })
                    }
                    onComplete={() =>
                      updateMutation.mutate({
                        goalId: goal.id,
                        patch: { status: 'completed' },
                      })
                    }
                    onDelete={() =>
                      Alert.alert(
                        'Maqsadni o’chirish',
                        `"${goal.title}" o'chirilsinmi?`,
                        [
                          { text: 'Bekor qilish', style: 'cancel' },
                          {
                            text: "O'chirish",
                            style: 'destructive',
                            onPress: () => deleteMutation.mutate(goal.id),
                          },
                        ],
                      )
                    }
                  />
                ))}
              </View>

              {finished.length > 0 && (
                <View className="gap-3">
                  <Text className="text-sm font-semibold text-muted-foreground dark:text-dark-muted mt-2">
                    Tugatilgan ({finished.length})
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
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
