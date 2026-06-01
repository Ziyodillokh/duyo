import { apiClient } from '@/api/client';

// Mirrors backend duyo.schemas.gamification (snake_case wire format).

export interface BallsBalance {
  balance: number;
  level: number;
  level_name: string;
  current_threshold: number;
  next_threshold: number | null;
  balls_to_next: number | null;
}

export interface InventoryItemWire {
  item_key: string;
  category: string;
  created_at: string;
}

export interface AvatarWire {
  body_shape: string;
  primary_color: string;
  accent: string;
  face_style: string;
}

// All fields optional — a partial update only changes provided dimensions.
export type AvatarUpdateInput = Partial<AvatarWire>;

export interface StreakWire {
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
}

export interface PurchaseInput {
  item_key: string;
  category: string;
  cost: number;
}

const base = (childId: string): string => `/gamification/${childId}`;

export async function getBalls(childId: string): Promise<BallsBalance> {
  const { data } = await apiClient.get<BallsBalance>(`${base(childId)}/balls`);
  return data;
}

export async function getInventory(
  childId: string,
): Promise<InventoryItemWire[]> {
  const { data } = await apiClient.get<InventoryItemWire[]>(
    `${base(childId)}/inventory`,
  );
  return data;
}

export async function purchaseItem(
  childId: string,
  input: PurchaseInput,
): Promise<InventoryItemWire> {
  const { data } = await apiClient.post<InventoryItemWire>(
    `${base(childId)}/inventory/purchase`,
    input,
  );
  return data;
}

export async function getAvatar(childId: string): Promise<AvatarWire> {
  const { data } = await apiClient.get<AvatarWire>(`${base(childId)}/avatar`);
  return data;
}

export async function updateAvatar(
  childId: string,
  input: AvatarUpdateInput,
): Promise<AvatarWire> {
  const { data } = await apiClient.put<AvatarWire>(
    `${base(childId)}/avatar`,
    input,
  );
  return data;
}

export async function getStreak(childId: string): Promise<StreakWire> {
  const { data } = await apiClient.get<StreakWire>(`${base(childId)}/streak`);
  return data;
}
