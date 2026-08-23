import { isAxiosError } from 'axios';

import { apiClient } from '@/api/client';

export type ContentType =
  | 'poem'
  | 'story'
  | 'lesson'
  | 'audio'
  | 'language'
  | 'dtm'
  | 'pdf'
  | 'photo';

export interface ContentListItem {
  id: string;
  type: ContentType;
  title: string;
  age_segment: string;
  language: string;
  author: string | null;
  audio_url: string | null;
  image_url: string | null;
  likes: number;
}

export interface ContentDetail extends ContentListItem {
  body: string | null;
  pdf_url: string | null;
}

export interface ListContentParams {
  type?: string;
  age_segment?: string;
  language?: string;
  /** Title/author search, matched server-side — the response is capped by
   *  `limit`, so searching on the client would only ever see the first page. */
  q?: string;
  limit?: number;
}

export async function listContent(
  params?: ListContentParams,
): Promise<ContentListItem[]> {
  const { data } = await apiClient.get<ContentListItem[]>('/content', {
    params,
  });
  return data;
}

export async function getContent(id: string): Promise<ContentDetail> {
  const { data } = await apiClient.get<ContentDetail>(`/content/${id}`);
  return data;
}

/** An unpublished or deleted item — a permanent answer, so never retried and
 *  shown as "not found" rather than as a network failure. */
export function isContentNotFound(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 404;
}
