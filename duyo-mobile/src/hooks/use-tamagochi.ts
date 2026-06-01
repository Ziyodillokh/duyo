import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import {
  type InteractInput,
  type TamagochiState,
  getTamagochi,
  interactTamagochi,
} from '@/api/endpoints/tamagochi';
import { useChildStore } from '@/store/child';

/** The active child's tamagochi metrics (lazy-decayed server-side). */
export function useTamagochi(): UseQueryResult<TamagochiState> {
  const childId = useChildStore((s) => s.child?.id ?? null);
  return useQuery({
    queryKey: ['tamagochi', childId],
    queryFn: () => getTamagochi(childId as string),
    enabled: childId != null,
  });
}

export function useInteractTamagochi() {
  const childId = useChildStore((s) => s.child?.id ?? null);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InteractInput) =>
      interactTamagochi(childId as string, input),
    onSuccess: (state) => {
      // Server returns the fresh state — seed the cache directly.
      qc.setQueryData(['tamagochi', childId], state);
    },
  });
}
