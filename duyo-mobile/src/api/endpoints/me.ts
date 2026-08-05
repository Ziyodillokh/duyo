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

export async function getMe(): Promise<Account> {
  const { data } = await apiClient.get<Account>('/me');
  return data;
}

/** Partial — anything omitted is left as it was on the server. */
export async function updateMe(input: AccountUpdate): Promise<Account> {
  const { data } = await apiClient.patch<Account>('/me', input);
  return data;
}
