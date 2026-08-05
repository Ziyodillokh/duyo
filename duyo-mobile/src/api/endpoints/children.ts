import { apiClient } from '@/api/client';
import { type ChildProfile, type Language } from '@/api/types';

export interface CreateChildInput {
  name: string;
  age: number;
  language: Language;
  /** Picked on the interests screen; the server keeps them on the profile. */
  interests?: string[];
  /** 'duyo' | 'raccoon' — which body the child chose. */
  mascot?: string;
}

export async function createChild(
  input: CreateChildInput,
): Promise<ChildProfile> {
  const { data } = await apiClient.post<ChildProfile>('/chat/children', input);
  return data;
}

/**
 * The profiles this account already has.
 *
 * Asked before onboarding decides anything: a returning user (reinstall, new
 * phone, logout) must get their existing child back instead of walking the
 * flow again and leaving a second profile behind.
 */
export async function listChildren(): Promise<ChildProfile[]> {
  const { data } = await apiClient.get<ChildProfile[]>('/chat/children');
  return data;
}

export type UpdateChildInput = Partial<CreateChildInput>;

export async function updateChild(
  childId: string,
  input: UpdateChildInput,
): Promise<ChildProfile> {
  const { data } = await apiClient.put<ChildProfile>(
    `/chat/children/${childId}`,
    input,
  );
  return data;
}
