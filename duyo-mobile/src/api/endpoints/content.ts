import { apiClient } from '@/api/client';

export type ContentType =
  | 'poem'
  | 'story'
  | 'lesson'
  | 'audio'
  | 'language'
  | 'dtm';

export interface ContentListItem {
  id: string;
  type: ContentType;
  title: string;
  age_segment: string;
  language: string;
  author: string | null;
  audio_url: string | null;
  likes: number;
}

export interface ContentDetail extends ContentListItem {
  body: string | null;
}

export interface ListContentParams {
  type?: string;
  age_segment?: string;
  language?: string;
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
