import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import {
  type AvatarUpdateInput,
  type AvatarWire,
  type BallsBalance,
  type InventoryItemWire,
  type PurchaseInput,
  type StreakWire,
  getAvatar,
  getBalls,
  getInventory,
  getStreak,
  purchaseItem,
  updateAvatar,
} from '@/api/endpoints/gamification';
import { useChildStore } from '@/store/child';

/** The active child's id, or null until onboarding sets one. */
function useChildId(): string | null {
  return useChildStore((s) => s.child?.id ?? null);
}

export function useBalls(): UseQueryResult<BallsBalance> {
  const childId = useChildId();
  return useQuery({
    queryKey: ['balls', childId],
    queryFn: () => getBalls(childId as string),
    enabled: childId != null,
  });
}

export function useAvatar(): UseQueryResult<AvatarWire> {
  const childId = useChildId();
  return useQuery({
    queryKey: ['avatar', childId],
    queryFn: () => getAvatar(childId as string),
    enabled: childId != null,
  });
}

export function useUpdateAvatar() {
  const childId = useChildId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AvatarUpdateInput) =>
      updateAvatar(childId as string, input),
    onSuccess: (avatar) => qc.setQueryData(['avatar', childId], avatar),
  });
}

export function useStreak(): UseQueryResult<StreakWire> {
  const childId = useChildId();
  return useQuery({
    queryKey: ['streak', childId],
    queryFn: () => getStreak(childId as string),
    enabled: childId != null,
  });
}

export function useInventory(): UseQueryResult<InventoryItemWire[]> {
  const childId = useChildId();
  return useQuery({
    queryKey: ['inventory', childId],
    queryFn: () => getInventory(childId as string),
    enabled: childId != null,
  });
}

export function usePurchaseItem() {
  const childId = useChildId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PurchaseInput) =>
      purchaseItem(childId as string, input),
    onSuccess: () => {
      // Balance and owned set both change after a purchase.
      void qc.invalidateQueries({ queryKey: ['balls', childId] });
      void qc.invalidateQueries({ queryKey: ['inventory', childId] });
    },
  });
}
