import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle2, Plus, Target, Trash2, Users } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Goal } from '@/api/endpoints/goals';
import { DarkCard } from '@/components/v2/dark/dark-card';
import { ProgressBar } from '@/components/v2/dark/progress-bar';
import {
  useAddProgress,
  useCreateGoal,
  useDeleteGoal,
  useGoals,
  useGoalSignal,
  useUpdateGoal,
} from '@/hooks/use-goals';
import { useChildStore } from '@/store/child';
import { useIsDark } from '@/store/theme';

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
  const isDark = useIsDark();
  const [entry, setEntry] = useState('');
  const done = goal.status === 'completed';
  const unit = goal.unit_label ?? 'qadam';
  const canSave = entry.length > 0;

  return (
    <DarkCard glow={done ? 'green' : 'none'}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text
            className={`text-base font-bold ${
              done
                ? 'text-muted-foreground dark:text-dark-muted'
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
          {done && (
            <Text className="text-sm font-medium text-neon-green mt-1">
              Tugatilgan 🎉
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

      {goal.progress_pct !== null && (
        <View className="mt-4">
          <ProgressBar
            value={(goal.progress_pct ?? 0) / 100}
            color={done ? 'green' : 'blue'}
            height={10}
          />
          <Text className="text-xs text-muted-foreground dark:text-dark-muted text-right mt-2">
            {Math.round(goal.progress_pct ?? 0)}%
          </Text>
        </View>
      )}

      {!done && (
        <View className="flex-row items-center gap-2 mt-4">
          <TextInput
            value={entry}
            onChangeText={(t) => setEntry(t.replace(/\D/g, '').slice(0, 6))}
            placeholder={`Nechanchi ${unit}?`}
            placeholderTextColor="#94A3B8"
            keyboardType="number-pad"
            accessibilityLabel="Yangi progress"
            className="flex-1 px-4 rounded-md text-base text-foreground dark:text-dark-text"
            style={{
              height: 44,
              backgroundColor: isDark ? '#1E3A5F' : '#F4F8FF',
            }}
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
            accessibilityLabel="Progressni saqlash"
            className={`px-4 rounded-md items-center justify-center active:opacity-80 ${
              canSave ? 'bg-neon-blue' : ''
            }`}
            style={{
              height: 44,
              backgroundColor: canSave
                ? undefined
                : isDark
                  ? '#1E3A5F'
                  : '#F4F8FF',
            }}
          >
            <Text
              className="text-sm font-medium"
              style={{ color: canSave ? '#0A1628' : '#94A3B8' }}
            >
              Saqlash
            </Text>
          </Pressable>
          <Pressable
            onPress={onComplete}
            accessibilityRole="button"
            accessibilityLabel="Tugatdim"
            hitSlop={8}
            className="items-center justify-center"
            style={{ width: 44, height: 44 }}
          >
            <CheckCircle2 size={24} color="#34D399" />
          </Pressable>
        </View>
      )}
    </DarkCard>
  );
}

export default function GoalsScreen() {
  const isDark = useIsDark();
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
  const canAdd = draft.trim().length >= 2;

  const handleCreate = () => {
    if (!canAdd) return;
    createMutation.mutate(
      { title: draft.trim() },
      {
        onSuccess: () => setDraft(''),
        onError: () =>
          Alert.alert(
            'Saqlanmadi',
            "Internetni tekshirib, qayta urinib ko'ring.",
          ),
      },
    );
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' },
        ]}
      />
      <LinearGradient
        colors={['rgba(96, 165, 250, 0.20)', 'rgba(252, 211, 77, 0.20)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.96, y: 0.2 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 96 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View className="gap-1">
              <Text className="text-[24px] leading-8 font-bold text-foreground dark:text-dark-text tracking-tight">
                Maqsadlarim
              </Text>
              <Text className="text-sm text-muted-foreground dark:text-dark-muted">
                DUYO suhbat davomida maqsadingni o'zi eslab qoladi
              </Text>
            </View>

            {/* Add a goal by hand — DUYO also adds them from conversation. */}
            <DarkCard>
              <View className="flex-row items-center gap-2">
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Masalan: O'tkan Kunlarni o'qish"
                  placeholderTextColor="#94A3B8"
                  maxLength={160}
                  accessibilityLabel="Yangi maqsad"
                  className="flex-1 px-4 rounded-md text-base text-foreground dark:text-dark-text"
                  style={{
                    height: 48,
                    backgroundColor: isDark ? '#1E3A5F' : '#F4F8FF',
                  }}
                />
                <Pressable
                  onPress={handleCreate}
                  disabled={!canAdd || createMutation.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Maqsad qo'shish"
                  className={`items-center justify-center rounded-md active:opacity-80 ${
                    canAdd ? 'bg-neon-blue' : ''
                  }`}
                  style={{
                    width: 48,
                    height: 48,
                    backgroundColor: canAdd
                      ? undefined
                      : isDark
                        ? '#1E3A5F'
                        : '#F4F8FF',
                  }}
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator color="#0A1628" />
                  ) : (
                    <Plus size={22} color={canAdd ? '#0A1628' : '#94A3B8'} />
                  )}
                </Pressable>
              </View>
            </DarkCard>

            {/* "You are not alone" — counts only, never identities. */}
            {signals.map((s) => (
              <DarkCard key={s.match_key} glow="blue">
                <View className="flex-row items-center gap-3">
                  <View
                    className="rounded-full items-center justify-center"
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor: 'rgba(96,165,250,0.15)',
                    }}
                  >
                    <Users size={20} color="#60A5FA" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-foreground dark:text-dark-text">
                      {s.count} ta bola ham shu maqsadda
                    </Text>
                    <Text
                      className="text-sm text-muted-foreground dark:text-dark-muted"
                      numberOfLines={1}
                    >
                      {s.title}
                    </Text>
                  </View>
                </View>
              </DarkCard>
            ))}

            {/* States. A cached list is never blanked out mid-read. */}
            {goalsQuery.isLoading && goals.length === 0 ? (
              <View className="items-center" style={{ padding: 32 }}>
                <ActivityIndicator color={isDark ? '#60A5FA' : '#102033'} />
              </View>
            ) : goalsQuery.isError && goals.length === 0 ? (
              <DarkCard className="items-center">
                <Text className="text-4xl">⚠️</Text>
                <Text className="text-base font-medium text-foreground dark:text-dark-text mt-2">
                  Maqsadlarni yuklab bo'lmadi
                </Text>
                <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1 text-center">
                  Internetni tekshirib, qaytadan urinib ko'ring
                </Text>
              </DarkCard>
            ) : goals.length === 0 ? (
              <DarkCard className="items-center">
                <View
                  className="rounded-full items-center justify-center"
                  style={{
                    width: 64,
                    height: 64,
                    backgroundColor: 'rgba(96,165,250,0.15)',
                  }}
                >
                  <Target size={30} color="#60A5FA" />
                </View>
                <Text className="text-base font-bold text-foreground dark:text-dark-text mt-3">
                  Hali maqsad yo'q
                </Text>
                <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1 text-center">
                  DUYO bilan gaplashganingda maqsadingni o'zi eslab qoladi —
                  yoki yuqoriga o'zing yozib qo'ysang bo'ladi
                </Text>
              </DarkCard>
            ) : (
              <>
                {goalsQuery.isError && (
                  <View
                    className="rounded-md px-4 py-2"
                    style={{ backgroundColor: 'rgba(251,146,60,0.15)' }}
                  >
                    <Text className="text-xs" style={{ color: '#FB923C' }}>
                      Oflayn — oxirgi ma'lumot ko'rsatilyapti
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
                        "Maqsadni o'chirish",
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

                {finished.length > 0 && (
                  <>
                    <Text className="text-base font-bold text-foreground dark:text-dark-text mt-2">
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
                  </>
                )}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
