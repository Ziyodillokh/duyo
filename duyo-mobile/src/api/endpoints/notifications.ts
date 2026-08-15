import { apiClient } from '@/api/client';

// Mirrors backend duyo.schemas.notification (snake_case wire format).

export interface NotificationWire {
  id: string;
  channel: string;
  title: string;
  body: string;
  sent_at: string | null;
  read: boolean;
}

export interface UnreadCountWire {
  count: number;
}

export async function getNotifications(
  childId: string,
): Promise<NotificationWire[]> {
  const { data } = await apiClient.get<NotificationWire[]>('/notifications', {
    params: { child_id: childId },
  });
  return data;
}

export async function getUnreadCount(
  childId: string,
): Promise<UnreadCountWire> {
  const { data } = await apiClient.get<UnreadCountWire>(
    '/notifications/unread-count',
    { params: { child_id: childId } },
  );
  return data;
}

export async function markNotificationRead(
  childId: string,
  campaignId: string,
): Promise<NotificationWire> {
  const { data } = await apiClient.post<NotificationWire>(
    `/notifications/${campaignId}/read`,
    null,
    { params: { child_id: childId } },
  );
  return data;
}
