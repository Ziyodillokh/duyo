import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import {
  cancelSubscription,
  type BillingPeriod,
  type PaidTier,
  type PaymentProvider,
  type SubscribeRequest,
  type SubscriptionRead,
  type TierInfo,
  checkout,
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

// ── The real purchase path ───────────────────────────────────────────────────

/**
 * Start a Click/Payme order. Returns the URL to send the buyer to.
 *
 * No cache write on success on purpose: a checkout URL is not a subscription,
 * and writing one into ['subscription'] would tell the child they own
 * something they have not paid for yet.
 */
/**
 * Cancel, from inside the app.
 *
 * The plan list has always promised "cancel any time" while the only way to do
 * it was an email address — and the endpoint has existed the whole time with
 * nothing calling it. A subscription a child can start in two taps and cannot
 * stop is the shape of a complaint, whatever the policy says.
 */
export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelSubscription,
    onSuccess: (sub) => {
      qc.setQueryData(['subscription'], sub);
      void qc.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: ({ tier, period, provider }: CheckoutArgs) =>
      checkout(tier, period, provider),
  });
}

export interface CheckoutArgs {
  tier: PaidTier;
  period: BillingPeriod;
  provider: PaymentProvider;
}

/** Throw away what we think we know about the plan and ask the server again. */
export function useRefreshSubscription(): () => void {
  const qc = useQueryClient();
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['subscription'] });
    void qc.invalidateQueries({ queryKey: ['plans'] });
  }, [qc]);
}

/** How often we re-ask while a payment is in flight. */
const SETTLEMENT_POLL_MS = 3_000;
/** How long we keep asking before we admit we cannot see the payment. */
const SETTLEMENT_WINDOW_MS = 90_000;

interface PendingPurchase {
  tier: string;
  /** The expiry BEFORE the purchase — the thing the webhook will move. */
  expiresAtBefore: string | null;
}

export interface PaymentSettlement {
  /** The server has not confirmed yet and we are still asking. */
  isChecking: boolean;
  /** The webhook landed: the plan the child paid for is really on. */
  isSettled: boolean;
  /** We stopped asking without ever seeing it. */
  hasGivenUp: boolean;
  begin: (tier: string, expiresAtBefore: string | null) => void;
  checkAgain: () => void;
}

/**
 * The gap between paying and owning.
 *
 * Click confirms a payment to the SERVER, never to the app — the child comes
 * back from the browser and the app still holds the pre-payment answer. If we
 * simply re-render that, a child who has just handed over 59 000 so'm is shown
 * the word "free", and the only conclusion available to them is that the money
 * is gone. So a purchase is remembered here and we keep asking until the
 * answer changes, saying "checking" for as long as we genuinely do not know.
 *
 * Settlement is a CHANGE in expiry, not merely landing on the right tier: a
 * child renewing the plan they are already on would otherwise be congratulated
 * the instant they tapped, before any money moved.
 */
export function usePaymentSettlement(
  subscription: SubscriptionRead | undefined,
): PaymentSettlement {
  const qc = useQueryClient();
  const [pending, setPending] = useState<PendingPurchase | null>(null);
  const [hasGivenUp, setHasGivenUp] = useState(false);

  const isSettled =
    pending !== null &&
    subscription !== undefined &&
    subscription.tier === pending.tier &&
    subscription.expires_at !== pending.expiresAtBefore;

  const isChecking = pending !== null && !isSettled && !hasGivenUp;

  useEffect(() => {
    if (!isChecking) return;
    const poll = setInterval(() => {
      void qc.invalidateQueries({ queryKey: ['subscription'] });
    }, SETTLEMENT_POLL_MS);
    // Bounded, because a cancelled payment produces exactly the same silence
    // as a slow one and we must eventually stop pretending to be busy.
    const giveUp = setTimeout(() => setHasGivenUp(true), SETTLEMENT_WINDOW_MS);
    return () => {
      clearInterval(poll);
      clearTimeout(giveUp);
    };
  }, [isChecking, qc]);

  const begin = useCallback((tier: string, expiresAtBefore: string | null) => {
    setHasGivenUp(false);
    setPending({ tier, expiresAtBefore });
  }, []);

  const checkAgain = useCallback(() => {
    setHasGivenUp(false);
    void qc.invalidateQueries({ queryKey: ['subscription'] });
  }, [qc]);

  // Never both at once: a webhook that lands late still wins over the
  // give-up message, and the child sees the plan, not an apology for it.
  return {
    isChecking,
    isSettled,
    hasGivenUp: hasGivenUp && pending !== null && !isSettled,
    begin,
    checkAgain,
  };
}
