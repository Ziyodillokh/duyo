import { apiClient } from '@/api/client';

// Mirrors backend duyo.schemas.family (snake_case wire format).

export interface FamilyInviteWire {
  child_name: string;
  child_phone: string;
  claimed: boolean;
  claimed_at: string | null;
}

/** Records the child's phone and texts them a login code. */
export async function createFamilyInvite(
  childName: string,
  childPhone: string,
): Promise<FamilyInviteWire> {
  const { data } = await apiClient.post<FamilyInviteWire>('/family/invite', {
    child_name: childName,
    child_phone: childPhone,
  });
  return data;
}

/** The most recent invite this parent sent, or null if they never sent one. */
export async function getFamilyInvite(): Promise<FamilyInviteWire | null> {
  const { data } = await apiClient.get<FamilyInviteWire | null>(
    '/family/invite',
  );
  return data;
}
