import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getTodayMood,
  type MoodValue,
  setTodayMood,
  type TodayMood,
} from '@/api/endpoints/mood';
import { useChildStore } from '@/store/child';

export function useTodayMood() {
  const childId = useChildStore((s) => s.child?.id);
  return useQuery({
    queryKey: ['mood-today', childId],
    queryFn: () => getTodayMood(childId!),
    enabled: !!childId,
  });
}

export function useSetTodayMood() {
  const childId = useChildStore((s) => s.child?.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mood: MoodValue) => setTodayMood(childId!, mood),
    // Paint the selection immediately — a mood tap that waits on the network
    // feels broken, and the value is trivially re-derivable if the call fails.
    onMutate: async (mood) => {
      await qc.cancelQueries({ queryKey: ['mood-today', childId] });
      const previous = qc.getQueryData<TodayMood>(['mood-today', childId]);
      qc.setQueryData<TodayMood>(['mood-today', childId], (prev) => ({
        mood,
        entry_date: prev?.entry_date ?? new Date().toISOString().slice(0, 10),
      }));
      return { previous };
    },
    onError: (_err, _mood, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(['mood-today', childId], ctx.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['mood-today', childId] });
    },
  });
}
