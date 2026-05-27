import { apiClient } from '@/api/client';
import { type CrisisLevel } from '@/api/types';

export interface ChatRequest {
  child_id: string;
  message: string;
  conversation_id?: string;
}

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  reply: string;
  crisis_level: CrisisLevel;
  model: string;
  latency_ms: number;
}

export async function sendChatMessage(
  request: ChatRequest,
): Promise<ChatResponse> {
  const { data } = await apiClient.post<ChatResponse>('/chat', request);
  return data;
}
