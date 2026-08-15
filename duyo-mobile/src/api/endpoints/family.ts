import { apiClient } from '@/api/client';

// Mirrors backend duyo.schemas.family (snake_case wire format).

export interface FamilyInviteWire {
  child_name: string;
  child_phone: string;
  claimed: boolean;
  claimed_at: string | null;
  /** Set when the invitee refused. A waiting screen must not spin on this. */
  declined_at: string | null;
  expires_at: string;
}

/**
 * An offer awaiting THIS account's decision — nothing is linked yet.
 * Returned by /auth/otp/verify; `from_phone` is who is asking, which is how
 * the invitee tells a parent they know from a stranger who typed their number.
 */
export interface PendingFamilyInviteWire {
  id: string;
  child_name: string;
  from_phone: string;
  expires_at: string;
}

/** Consent to being added to the inviting parent's family. */
export async function acceptFamilyInvite(): Promise<FamilyInviteWire> {
  const { data } = await apiClient.post<FamilyInviteWire>(
    '/family/invite/accept',
  );
  return data;
}

/** Refuse the offer. It is never re-offered. */
export async function declineFamilyInvite(): Promise<FamilyInviteWire> {
  const { data } = await apiClient.post<FamilyInviteWire>(
    '/family/invite/decline',
  );
  return data;
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
