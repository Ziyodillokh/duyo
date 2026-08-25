import { Platform } from 'react-native';

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

/**
 * Replace the child's profile photo.
 *
 * Sent as multipart, not as base64 JSON: a 2 MB image becomes ~2.7 MB of
 * base64 and the server would have to decode it back, so the bytes go over
 * the wire as bytes.
 *
 * `uri` is what expo-image-picker hands back — a `file://` path on a device,
 * a `blob:`/`data:` URL on web. React Native's FormData understands the RN
 * file shape directly; on web the blob has to be fetched first, because the
 * same shape there produces the string "[object Object]".
 */
export async function uploadChildPhoto(
  childId: string,
  uri: string,
  mimeType = 'image/jpeg',
): Promise<ChildProfile> {
  const form = new FormData();
  const name = `photo.${mimeType.split('/')[1] ?? 'jpg'}`;

  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append('file', blob, name);
  } else {
    form.append('file', { uri, name, type: mimeType } as unknown as Blob);
  }

  const { data } = await apiClient.post<ChildProfile>(
    `/chat/children/${childId}/photo`,
    form,
    // Explicitly undefined, not 'multipart/form-data': the boundary is part
    // of that header and only the runtime knows it. Setting the type by hand
    // sends one without a boundary and the server parses nothing.
    { headers: { 'Content-Type': undefined } },
  );
  return data;
}

/** Go back to the mascot. Returns the profile, so the caller never has to
 *  guess what the state is now. */
export async function deleteChildPhoto(childId: string): Promise<ChildProfile> {
  const { data } = await apiClient.delete<ChildProfile>(
    `/chat/children/${childId}/photo`,
  );
  return data;
}
