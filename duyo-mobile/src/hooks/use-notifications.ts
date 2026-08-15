import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import {
  type NotificationWire,
  type UnreadCountWire,
  getNotifications,
  getUnreadCount,
  markNotificationRead,
} from '@/api/endpoints/notifications';
import { useChildStore } from '@/store/child';

/** The active child's id, or null until onboarding sets one. */
function useChildId(): string | null {
  return useChildStore((s) => s.child?.id ?? null);
}

export function useNotifications(): UseQueryResult<NotificationWire[]> {
  const childId = useChildId();
  return useQuery({
    queryKey: ['notifications', childId],
    queryFn: () => getNotifications(childId as string),
    enabled: childId != null,
  });
}

export function useUnreadNotificationCount(): UseQueryResult<UnreadCountWire> {
  const childId = useChildId();
  return useQuery({
    queryKey: ['notifications-unread-count', childId],
    queryFn: () => getUnreadCount(childId as string),
    enabled: childId != null,
  });
}

export function useMarkNotificationRead() {
  const childId = useChildId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (campaignId: string) =>
      markNotificationRead(childId as string, campaignId),
    onSuccess: (updated) => {
      qc.setQueryData<NotificationWire[]>(
        ['notifications', childId],
        (prev) => prev?.map((n) => (n.id === updated.id ? updated : n)),
      );
      void qc.invalidateQueries({
        queryKey: ['notifications-unread-count', childId],
      });
    },
  });
}
