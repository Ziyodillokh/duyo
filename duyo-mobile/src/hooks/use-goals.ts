import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addGoalProgress,
  createGoal,
  type CreateGoalInput,
  deleteGoal,
  fetchGoalSignal,
  type Goal,
  listGoals,
  updateGoal,
} from '@/api/endpoints/goals';

export function useGoals(childId: string | undefined) {
  return useQuery({
    queryKey: ['goals', childId],
    queryFn: () => listGoals(childId!),
    enabled: !!childId,
  });
}

/** Anonymous "N other children share this goal" counts. */
export function useGoalSignal(childId: string | undefined) {
  return useQuery({
    queryKey: ['goal-signal', childId],
    queryFn: () => fetchGoalSignal(childId!),
    enabled: !!childId,
    // Counts move slowly; refetching on every focus would be noise.
    staleTime: 5 * 60_000,
  });
}

export function useCreateGoal(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGoalInput) => createGoal(childId!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals', childId] });
      qc.invalidateQueries({ queryKey: ['goal-signal', childId] });
      // A goal picked from the catalog can turn up a mate the instant it is
      // created — without this the child only sees them after the 60s cache
      // window lapses or they leave and reopen the screen.
      qc.invalidateQueries({ queryKey: ['goal-mates', childId] });
    },
  });
}

export function useAddProgress(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { goalId: string; unitValue: number; note?: string }) =>
      addGoalProgress(childId!, vars.goalId, vars.unitValue, { note: vars.note }),
    onSuccess: (updated: Goal) => {
      // Write through so the bar moves immediately, then revalidate.
      qc.setQueryData<Goal[]>(['goals', childId], (prev) =>
        prev?.map((g) => (g.id === updated.id ? updated : g)),
      );
      qc.invalidateQueries({ queryKey: ['goals', childId] });
    },
  });
}

export function useUpdateGoal(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      goalId: string;
      patch: Parameters<typeof updateGoal>[2];
    }) => updateGoal(childId!, vars.goalId, vars.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals', childId] });
      qc.invalidateQueries({ queryKey: ['goal-signal', childId] });
    },
  });
}

export function useDeleteGoal(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (goalId: string) => deleteGoal(childId!, goalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals', childId] });
      qc.invalidateQueries({ queryKey: ['goal-signal', childId] });
    },
  });
}
