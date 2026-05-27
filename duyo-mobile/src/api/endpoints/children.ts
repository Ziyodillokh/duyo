import { apiClient } from '@/api/client';
import { type ChildProfile, type Language } from '@/api/types';

export interface CreateChildInput {
  name: string;
  age: number;
  language: Language;
}

export async function createChild(
  input: CreateChildInput,
): Promise<ChildProfile> {
  const { data } = await apiClient.post<ChildProfile>('/chat/children', input);
  return data;
}
