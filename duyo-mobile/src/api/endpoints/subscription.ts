import { apiClient } from '@/api/client';

// Mirrors backend duyo.schemas.subscription and duyo.schemas.payment
// (Concept §12). Subscriptions are user-scoped, not child-scoped.
//
// Two ways in exist server-side and they are not interchangeable:
// /subscriptions/subscribe is the MOCK activation and is 404 in production;
// /payments/checkout is the real one — it creates an order and hands back a
// gateway URL, and the tier only turns on when the gateway's webhook reaches
// the server. Nothing the app does can activate a plan by itself.

export type PaidTier = 'standart' | 'premium';
export type BillingPeriod = 'monthly' | 'yearly';

export interface TierInfo {
  key: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  daily_message_limit: number | null;
  ai_turns_per_day: number;
  languages: number;
  voice: boolean;
  max_children: number;
  features: string[];
}

export interface SubscriptionRead {
  tier: string;
  status: string;
  provider: string | null;
  started_at: string | null;
  expires_at: string | null;
}

export interface SubscribeRequest {
  tier: PaidTier;
  period?: BillingPeriod;
  provider?: 'mock' | 'click' | 'payme';
}

export async function getPlans(): Promise<TierInfo[]> {
  const { data } = await apiClient.get<TierInfo[]>('/subscriptions/plans');
  return data;
}

export async function getCurrentSubscription(): Promise<SubscriptionRead> {
  const { data } = await apiClient.get<SubscriptionRead>(
    '/subscriptions/current',
  );
  return data;
}

export async function subscribe(
  req: SubscribeRequest,
): Promise<SubscriptionRead> {
  const { data } = await apiClient.post<SubscriptionRead>(
    '/subscriptions/subscribe',
    req,
  );
  return data;
}

export async function cancelSubscription(): Promise<SubscriptionRead> {
  const { data } = await apiClient.post<SubscriptionRead>(
    '/subscriptions/cancel',
    {},
  );
  return data;
}

// ── Real payment: POST /payments/checkout ────────────────────────────────────

/** Gateways the backend can build a checkout URL for (duyo.models.payment). */
export type PaymentProvider = 'click' | 'payme';

/** Mirrors duyo.schemas.payment.CheckoutRequest. */
export interface CheckoutRequest {
  tier: PaidTier;
  period: BillingPeriod;
  provider: PaymentProvider;
}

/** Mirrors duyo.schemas.payment.CheckoutResponse. `amount` is so'm, not tiyin. */
export interface CheckoutResponse {
  order_id: string;
  provider: string;
  amount: number;
  checkout_url: string;
}

/**
 * Open an order and get the gateway URL to send the buyer to.
 *
 * This does NOT grant anything. The order is created `pending`; the tier turns
 * on only when the gateway calls the webhook back.
 */
export async function checkout(
  tier: PaidTier,
  period: BillingPeriod,
  provider: PaymentProvider,
): Promise<CheckoutResponse> {
  const { data } = await apiClient.post<CheckoutResponse>('/payments/checkout', {
    tier,
    period,
    provider,
  } satisfies CheckoutRequest);
  return data;
}

/** Why a checkout could not be started, in the shape the screen must speak. */
export type CheckoutFailure =
  /** 503 — the gateway has no credentials yet. `detail` is the server's own
   *  Uzbek sentence, which is more truthful than anything we could guess. */
  | { kind: 'unconfigured'; detail: string | null }
  | { kind: 'offline' }
  | { kind: 'unknown' };

/**
 * A missing provider config is the expected state until the keys are set, so
 * it must not be flattened into "something went wrong" — that would send the
 * owner hunting for a bug in code that is working.
 */
export function classifyCheckoutError(err: unknown): CheckoutFailure {
  const axiosErr = err as {
    code?: string;
    response?: { status?: number; data?: { detail?: string } };
  };
  const status = axiosErr?.response?.status;
  if (status === 503) {
    return { kind: 'unconfigured', detail: axiosErr.response?.data?.detail ?? null };
  }
  // No response at all: the request never reached the server (dead network,
  // DNS, or our own 15s timeout).
  if (!axiosErr?.response) return { kind: 'offline' };
  return { kind: 'unknown' };
}
