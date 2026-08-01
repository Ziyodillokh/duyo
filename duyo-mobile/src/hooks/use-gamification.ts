import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useEffect } from 'react';

import {
  type AchievementWire,
  type AvatarUpdateInput,
  type AvatarWire,
  type BallsBalance,
  type BallsTransactionWire,
  type InventoryItemWire,
  type PurchaseInput,
  type StreakWire,
  checkinStreak,
  getAchievements,
  getAvatar,
  getBalls,
  getBallsHistory,
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

export function useBallsHistory(): UseQueryResult<BallsTransactionWire[]> {
  const childId = useChildId();
  return useQuery({
    queryKey: ['balls-history', childId],
    queryFn: () => getBallsHistory(childId as string),
    enabled: childId != null,
  });
}

export function useAchievements(): UseQueryResult<AchievementWire[]> {
  const childId = useChildId();
  return useQuery({
    queryKey: ['achievements', childId],
    queryFn: () => getAchievements(childId as string),
    enabled: childId != null,
  });
}

/**
 * Check the child in for today, once per mount of the home screen. The
 * backend ignores a second call on the same day, so the only cost of an extra
 * render is one cheap request — and without this the streak never advances,
 * which is what left the activity cards permanently empty.
 */
export function useDailyCheckin(): void {
  const childId = useChildId();
  const qc = useQueryClient();

  useEffect(() => {
    if (childId == null) return;
    let cancelled = false;
    void checkinStreak(childId)
      .then((streak) => {
        if (cancelled) return;
        qc.setQueryData(['streak', childId], streak);
      })
      // A failed check-in must never break the dashboard; the streak simply
      // stays where it was and the next launch tries again.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [childId, qc]);
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
