import { apiClient } from '@/api/client';

/** Who is holding the phone — answered on the first onboarding screen. */
export type AccountRole = 'parent' | 'child';

export interface Account {
  id: string;
  phone: string;
  role: AccountRole | null;
  display_name: string | null;
  created_at: string;
  last_login_at: string | null;
  children_count: number;
}

export interface AccountUpdate {
  role?: AccountRole;
  display_name?: string;
}

/** Partial — anything omitted is left as it was on the server. */
export async function updateMe(input: AccountUpdate): Promise<Account> {
  const { data } = await apiClient.patch<Account>('/me', input);
  return data;
}

/**
 * Close the account, permanently.
 *
 * Play has required since 31 May 2024 that an account can be deleted from
 * inside the app, not only by writing to someone — and the server cascades
 * this: children, conversations, messages, goals, notes, social settings and
 * friendships, plus the stored photos and any pending OTP. Crisis events are
 * the one carve-out, held for the retention period the privacy policy states.
 */
export async function deleteMe(): Promise<void> {
  await apiClient.delete('/me');
}
