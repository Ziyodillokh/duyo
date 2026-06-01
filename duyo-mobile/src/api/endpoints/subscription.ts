import { apiClient } from '@/api/client';

// Mirrors backend duyo.schemas.subscription (Concept §12). Subscriptions are
// user-scoped (not child-scoped). Payment is MOCKED for MVP — only the 'mock'
// provider is processed server-side until Click/Payme land.

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
