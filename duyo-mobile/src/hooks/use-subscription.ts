import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import {
  type SubscribeRequest,
  type SubscriptionRead,
  type TierInfo,
  cancelSubscription,
  getCurrentSubscription,
  getPlans,
  subscribe,
} from '@/api/endpoints/subscription';

/** Public plan catalogue (free → standart → premium). */
export function usePlans(): UseQueryResult<TierInfo[]> {
  return useQuery({ queryKey: ['plans'], queryFn: getPlans });
}

/** The signed-in user's current subscription (defaults to free). */
export function useCurrentSubscription(): UseQueryResult<SubscriptionRead> {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: getCurrentSubscription,
  });
}

export function useSubscribe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: SubscribeRequest) => subscribe(req),
    onSuccess: (sub) => qc.setQueryData(['subscription'], sub),
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelSubscription,
    onSuccess: (sub) => qc.setQueryData(['subscription'], sub),
  });
}
