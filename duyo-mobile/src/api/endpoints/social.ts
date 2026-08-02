import { apiClient } from '@/api/client';

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

/** Everything the app is ever allowed to know about another child. */
export interface PeerCard {
  child_id: string;
  display_name: string;
  age_segment: 'junior' | 'explorer' | 'companion';
}

export interface GoalMate {
  peer: PeerCard;
  match_key: string;
  shared_goal: string;
}

export interface Friendship {
  id: string;
  peer: PeerCard;
  status: FriendshipStatus;
  /** True when the other child sent it — i.e. this side may accept. */
  incoming: boolean;
  match_key: string | null;
  created_at: string;
}

export interface PeerMessage {
  id: string;
  seq: number;
  body: string;
  mine: boolean;
  created_at: string;
}

export interface SocialSettings {
  display_name: string;
  discoverable: boolean;
}

export async function getSocialSettings(
  childId: string,
): Promise<SocialSettings> {
  const { data } = await apiClient.get<SocialSettings>(
    `/social/${childId}/settings`,
  );
  return data;
}

export async function updateSocialSettings(
  childId: string,
  patch: {
    discoverable?: boolean;
    display_name?: string;
    regenerate_handle?: boolean;
  },
): Promise<SocialSettings> {
  const { data } = await apiClient.put<SocialSettings>(
    `/social/${childId}/settings`,
    patch,
  );
  return data;
}

/** Options to pick from — every word is an animal or a natural feature. */
export async function fetchHandleSuggestions(
  childId: string,
): Promise<string[]> {
  try {
    const { data } = await apiClient.get<{ suggestions: string[] }>(
      `/social/${childId}/handle-suggestions`,
    );
    return data.suggestions;
  } catch {
    return [];
  }
}

/** Pulls the child-facing reason out of a rejected handle. */
export function handleRejectionMessage(err: unknown): string | null {
  const res = (err as { response?: { status?: number; data?: { detail?: string } } })
    .response;
  if (res?.status === 422 && res.data?.detail) return res.data.detail;
  return null;
}

export async function listGoalMates(childId: string): Promise<GoalMate[]> {
  const { data } = await apiClient.get<GoalMate[]>(
    `/social/${childId}/goal-mates`,
  );
  return data;
}

export async function sendFriendRequest(
  childId: string,
  peerChildId: string,
): Promise<Friendship> {
  const { data } = await apiClient.post<Friendship>(
    `/social/${childId}/friend-requests`,
    { peer_child_id: peerChildId },
  );
  return data;
}

export async function listFriends(childId: string): Promise<Friendship[]> {
  const { data } = await apiClient.get<Friendship[]>(
    `/social/${childId}/friends`,
  );
  return data;
}

export async function acceptFriend(
  childId: string,
  friendshipId: string,
): Promise<Friendship> {
  const { data } = await apiClient.post<Friendship>(
    `/social/${childId}/friends/${friendshipId}/accept`,
  );
  return data;
}

export async function declineFriend(
  childId: string,
  friendshipId: string,
): Promise<void> {
  await apiClient.post(`/social/${childId}/friends/${friendshipId}/decline`);
}

export async function blockFriend(
  childId: string,
  friendshipId: string,
): Promise<void> {
  await apiClient.post(`/social/${childId}/friends/${friendshipId}/block`);
}

export async function reportFriend(
  childId: string,
  friendshipId: string,
  reason?: string,
): Promise<void> {
  await apiClient.post(`/social/${childId}/friends/${friendshipId}/report`, {
    reason,
  });
}

/** Paged on `seq` — the only orderable key. Pass the highest seq you hold. */
export async function listPeerMessages(
  childId: string,
  friendshipId: string,
  afterSeq = 0,
): Promise<PeerMessage[]> {
  const { data } = await apiClient.get<PeerMessage[]>(
    `/social/${childId}/friends/${friendshipId}/messages`,
    { params: { after_seq: afterSeq } },
  );
  return data;
}

export interface SendPeerMessageResult {
  message: PeerMessage | null;
  /** Set when the server refused to deliver — shown to the sender as-is. */
  rejected: string | null;
}

/**
 * Never throws on a refusal: a blocked message is an expected outcome the UI
 * has to explain, not an error state.
 */
export async function sendPeerMessage(
  childId: string,
  friendshipId: string,
  body: string,
): Promise<SendPeerMessageResult> {
  try {
    const { data } = await apiClient.post<PeerMessage>(
      `/social/${childId}/friends/${friendshipId}/messages`,
      { body },
    );
    return { message: data, rejected: null };
  } catch (err) {
    const detail = (
      err as { response?: { status?: number; data?: { detail?: string } } }
    ).response;
    if (detail?.status === 422 && detail.data?.detail) {
      return { message: null, rejected: detail.data.detail };
    }
    throw err;
  }
}
