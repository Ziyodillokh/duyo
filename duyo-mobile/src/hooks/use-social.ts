import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { confirmGoal, createGoal, type GoalKind } from '@/api/endpoints/goals';

import {
  listGroupMembers,
  listGroupMessages,
  listGroups,
  sendGroupMessage,
  acceptFriend,
  blockFriend,
  declineFriend,
  fetchHandleSuggestions,
  getSocialSettings,
  listFriends,
  listGoalMates,
  listPeerMessages,
  type PeerMessage,
  reportFriend,
  sendFriendRequest,
  sendPeerMessage,
  updateSocialSettings,
} from '@/api/endpoints/social';

export function useSocialSettings(childId: string | undefined) {
  return useQuery({
    queryKey: ['social-settings', childId],
    queryFn: () => getSocialSettings(childId!),
    enabled: !!childId,
  });
}

export function useUpdateSocialSettings(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: {
      discoverable?: boolean;
      display_name?: string;
      regenerate_handle?: boolean;
    }) => updateSocialSettings(childId!, patch),
    onSuccess: (data) => {
      qc.setQueryData(['social-settings', childId], data);
      qc.invalidateQueries({ queryKey: ['goal-mates', childId] });
    },
  });
}

export function useHandleSuggestions(childId: string | undefined) {
  return useQuery({
    queryKey: ['handle-suggestions', childId],
    queryFn: () => fetchHandleSuggestions(childId!),
    enabled: !!childId,
    // Fresh options on every visit to the editor — that is the point of them.
    staleTime: 0,
    gcTime: 0,
  });
}

export function useGoalMates(childId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['goal-mates', childId],
    queryFn: () => listGoalMates(childId!),
    enabled: !!childId && enabled,
    staleTime: 15_000,
    // Same reasoning as useFriends: no push channel to a child, so a mate who
    // added the matching goal after this screen opened is only ever found by
    // polling.
    refetchInterval: 20_000,
  });
}

export function useFriends(childId: string | undefined) {
  return useQuery({
    queryKey: ['friends', childId],
    queryFn: () => listFriends(childId!),
    enabled: !!childId,
    // Picks up an incoming request without the child pulling to refresh; there
    // is no push channel to a child in this app.
    refetchInterval: 20_000,
  });
}

function invalidateSocial(qc: ReturnType<typeof useQueryClient>, childId?: string) {
  qc.invalidateQueries({ queryKey: ['friends', childId] });
  qc.invalidateQueries({ queryKey: ['goal-mates', childId] });
}

export function useSendFriendRequest(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (peerChildId: string) => sendFriendRequest(childId!, peerChildId),
    onSuccess: () => invalidateSocial(qc, childId),
  });
}

export function useAcceptFriend(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friendshipId: string) => acceptFriend(childId!, friendshipId),
    onSuccess: () => invalidateSocial(qc, childId),
  });
}

export function useDeclineFriend(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friendshipId: string) => declineFriend(childId!, friendshipId),
    onSuccess: () => invalidateSocial(qc, childId),
  });
}

export function useBlockFriend(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friendshipId: string) => blockFriend(childId!, friendshipId),
    onSuccess: () => invalidateSocial(qc, childId),
  });
}

export function useReportFriend(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { friendshipId: string; reason?: string }) =>
      reportFriend(childId!, vars.friendshipId, vars.reason),
    onSuccess: () => invalidateSocial(qc, childId),
  });
}

/**
 * Thread history. Polled while the screen is open — the socket is a later
 * optimisation and the cursor endpoint stays the source of truth either way.
 */
export function usePeerMessages(
  childId: string | undefined,
  friendshipId: string | undefined,
) {
  return useQuery({
    queryKey: ['peer-messages', childId, friendshipId],
    queryFn: () => listPeerMessages(childId!, friendshipId!),
    enabled: !!childId && !!friendshipId,
    refetchInterval: 3_000,
  });
}

export function useSendPeerMessage(
  childId: string | undefined,
  friendshipId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => sendPeerMessage(childId!, friendshipId!, body),
    onSuccess: (result) => {
      if (!result.message) return; // refused — the screen explains it
      qc.setQueryData<PeerMessage[]>(
        ['peer-messages', childId, friendshipId],
        (prev) => [...(prev ?? []), result.message!],
      );
    },
  });
}

// ── Goal groups ─────────────────────────────────────────────────────────────

export function useGroups(childId: string | undefined) {
  return useQuery({
    queryKey: ['groups', childId],
    queryFn: () => listGroups(childId as string),
    enabled: childId != null,
  });
}

export function useGroupMembers(childId: string | undefined, key: string | undefined) {
  return useQuery({
    queryKey: ['group-members', childId, key],
    queryFn: () => listGroupMembers(childId as string, key as string),
    enabled: childId != null && !!key,
  });
}

export function useGroupMessages(childId: string | undefined, key: string | undefined) {
  return useQuery({
    queryKey: ['group-messages', childId, key],
    queryFn: () => listGroupMessages(childId as string, key as string),
    enabled: childId != null && !!key,
    // A room is other children typing; poll while it is open.
    refetchInterval: 5000,
  });
}

export function useSendGroupMessage(childId: string | undefined, key: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      sendGroupMessage(childId as string, key as string, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-messages', childId, key] });
    },
  });
}

/**
 * Join a room by taking on one of its goals.
 *
 * There is no join request to approve, because there is nobody to approve it:
 * a room is a catalogue category, not somebody's club. What "joining" means
 * here is adopting a goal from that category and confirming it — which is the
 * same fact the server reads membership from, so the door and the state can
 * never disagree.
 */
export function useJoinGroup(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { match_key: string; title: string; kind: GoalKind }) => {
      const goal = await createGoal(childId as string, {
        title: entry.title,
        kind: entry.kind,
        match_key: entry.match_key,
      });
      // Unconfirmed goals never introduce a child to anyone, so the join is
      // not finished until this lands.
      return confirmGoal(childId as string, goal.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups', childId] });
      qc.invalidateQueries({ queryKey: ['goal-mates', childId] });
      qc.invalidateQueries({ queryKey: ['goals', childId] });
    },
  });
}
