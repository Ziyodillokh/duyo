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

/** A goal room: one catalogue category within one age band. Membership is
 *  derived server-side from confirmed goals, so there is nothing to join. */
export interface GroupCard {
  key: string;
  category: string;
  label: string;
  members: number;
  joined: boolean;
}

export interface GroupMessage {
  id: string;
  seq: number;
  /** For a voice/video note this is the TRANSCRIPT — the text the safety
   *  screen actually judged, and the caption for anyone who cannot play it. */
  body: string;
  sender_name: string;
  mine: boolean;
  created_at: string;
  /** Authenticated URL of the clip; null for a plain text message. */
  media_url?: string | null;
  media_kind?: 'audio' | 'video' | null;
  media_duration_ms?: number | null;
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

/**
 * Why a friend request failed, in words a child can act on.
 *
 * The server answers these deliberately — a connection cap, too many requests
 * still waiting, a suspended account, a peer who is no longer suggestable —
 * and every one of them used to surface as "Biroz keyin urinib ko'ring",
 * which tells a child to keep retrying something that will never succeed.
 */
export function friendRequestErrorMessage(err: unknown): string {
  const status = (err as { response?: { status?: number } }).response?.status;
  switch (status) {
    case 429:
      return "Hozircha yangi do'st qo'sha olmaysan — avvalgi so'rovlaringga javob kelsin yoki ro'yxatingda joy bo'shasin.";
    case 403:
      return "Hozir maqsaddoshlar bo'limi sen uchun vaqtincha yopiq.";
    case 404:
      return "Bu do'st taklifi endi mavjud emas. Ro'yxatni yangilab ko'r.";
    default:
      return "So'rov yuborilmadi. Internetni tekshirib, qayta urinib ko'r.";
  }
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

// ── Goal groups ─────────────────────────────────────────────────────────────

export async function listGroups(childId: string): Promise<GroupCard[]> {
  const { data } = await apiClient.get<GroupCard[]>(`/social/${childId}/groups`);
  return data;
}

export async function listGroupMembers(
  childId: string,
  key: string,
): Promise<PeerCard[]> {
  const { data } = await apiClient.get<PeerCard[]>(
    `/social/${childId}/groups/${encodeURIComponent(key)}/members`,
  );
  return data;
}

export async function listGroupMessages(
  childId: string,
  key: string,
): Promise<GroupMessage[]> {
  const { data } = await apiClient.get<GroupMessage[]>(
    `/social/${childId}/groups/${encodeURIComponent(key)}/messages`,
  );
  return data;
}

export async function sendGroupMessage(
  childId: string,
  key: string,
  body: string,
): Promise<GroupMessage> {
  const { data } = await apiClient.post<GroupMessage>(
    `/social/${childId}/groups/${encodeURIComponent(key)}/messages`,
    { body },
  );
  return data;
}

/**
 * Send a recorded voice or video note.
 *
 * Multipart rather than JSON+base64: a 12 MB clip base64-encodes to 16 MB of
 * string that has to be held in memory twice.
 *
 * The Content-Type override is NOT cosmetic. apiClient defaults to
 * `application/json`, and axios's default transformRequest reacts to that by
 * running FormData through `formDataToJSON` — the request still succeeds, the
 * file is simply gone. Overriding the type and passing an identity
 * transformRequest is what keeps the bytes in the body; the browser then
 * replaces the header with a boundary-bearing one of its own.
 */
export async function sendGroupNote(
  childId: string,
  key: string,
  note: { blob?: Blob; uri: string; mimeType: string; durationMs: number },
): Promise<GroupMessage> {
  const form = new FormData();
  const ext = note.mimeType.includes('mp4')
    ? 'mp4'
    : note.mimeType.includes('webm')
      ? 'webm'
      : 'bin';
  const filename = `note.${ext}`;

  if (note.blob) {
    form.append('file', note.blob, filename);
  } else {
    // Native: react-native's FormData takes the {uri, name, type} shape and
    // streams the file itself.
    form.append('file', {
      uri: note.uri,
      name: filename,
      type: note.mimeType,
    } as unknown as Blob);
  }
  form.append('kind', note.mimeType.startsWith('video/') ? 'video' : 'audio');
  form.append('duration_ms', String(Math.round(note.durationMs)));

  const { data } = await apiClient.post<GroupMessage>(
    `/social/${childId}/groups/${encodeURIComponent(key)}/notes`,
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (body) => body,
    },
  );
  return data;
}
