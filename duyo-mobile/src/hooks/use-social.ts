import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
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
