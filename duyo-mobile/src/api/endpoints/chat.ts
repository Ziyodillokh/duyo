import { apiClient } from '@/api/client';
import { type CrisisLevel } from '@/api/types';

export interface QuickReply {
  label: string;
  action: 'web_search' | 'dismiss';
  query?: string;
}

export interface SourceRef {
  title: string;
  url?: string;
}

export interface ChatSource {
  type: 'textbook' | 'web' | 'none';
  label: string;
  refs: SourceRef[];
}

export interface ChatRequest {
  child_id: string;
  message: string;
  conversation_id?: string;
  action?: 'web_search';
  action_query?: string;
}

interface ChatResponseWire {
  conversation_id: string;
  message_id: string;
  reply: string;
  crisis_level: string; // Backend serialises CrisisLevel enum as UPPERCASE.
  model: string;
  latency_ms: number;
  source?: ChatSource | null;
  quick_replies?: QuickReply[];
}

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  reply: string;
  crisis_level: CrisisLevel;
  model: string;
  latency_ms: number;
  source?: ChatSource | null;
  quick_replies: QuickReply[];
}

function normalizeLevel(raw: string): CrisisLevel {
  const lowered = raw.toLowerCase();
  if (
    lowered === 'green' ||
    lowered === 'yellow' ||
    lowered === 'orange' ||
    lowered === 'red'
  ) {
    return lowered;
  }
  return 'green';
}

export async function sendChatMessage(
  request: ChatRequest,
): Promise<ChatResponse> {
  const { data } = await apiClient.post<ChatResponseWire>('/chat', request);
  return {
    ...data,
    crisis_level: normalizeLevel(data.crisis_level),
    source: data.source ?? null,
    quick_replies: data.quick_replies ?? [],
  };
}
