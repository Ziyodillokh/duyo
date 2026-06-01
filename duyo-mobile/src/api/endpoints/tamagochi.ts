import { apiClient } from '@/api/client';

// Mirrors backend duyo.schemas.tamagochi (Concept §4). Metrics are 0–100.

export interface TamagochiState {
  energy: number;
  joy: number;
  learning: number;
  health: number;
}

export type InteractionKind = 'check_in' | 'lesson' | 'play' | 'activity';

export interface InteractInput {
  kind: InteractionKind;
  amount?: number;
}

export async function getTamagochi(childId: string): Promise<TamagochiState> {
  const { data } = await apiClient.get<TamagochiState>(`/tamagochi/${childId}`);
  return data;
}

export async function interactTamagochi(
  childId: string,
  input: InteractInput,
): Promise<TamagochiState> {
  const { data } = await apiClient.post<TamagochiState>(
    `/tamagochi/${childId}/interact`,
    input,
  );
  return data;
}
