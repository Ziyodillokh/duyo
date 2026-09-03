import { AI_TIMEOUT_MS, apiClient } from '@/api/client';
import { type CrisisLevel } from '@/api/types';
import { type MemoryCategory } from '@/lib/memory-db';

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

/**
 * The extractor's suggestion for THIS turn only (see duyo-backend
 * services/memory_candidates.py) — never something the server persisted.
 * The device runs its own Memory Guard against `content` before ever
 * offering the "eslab qolaymi?" consent prompt; see memory-guard.ts.
 */
export interface MemoryCandidate {
  category: MemoryCategory;
  content: string;
}

export interface ChatRequest {
  child_id: string;
  message: string;
  conversation_id?: string;
  /**
   * Files a NEW conversation into a project as it is created. Ignored when
   * `conversation_id` names an existing one — moving that is a PATCH.
   */
  project_id?: string;
  action?: 'web_search';
  action_query?: string;
  /**
   * Short facts THIS device selected from the child's own encrypted local
   * memory as relevant to `message` (see memory-retrieval.ts). Folds into
   * this one request's prompt on the backend and is never stored there —
   * the source of truth stays on the device. Capped at 6 items server-side.
   */
  memory_context?: string[];
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
  memory_candidate?: MemoryCandidate | null;
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
  memory_candidate: MemoryCandidate | null;
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
  // AI_TIMEOUT_MS, not the client default: a grounded reply takes far longer
  // than ordinary CRUD, and the 15s default was cutting every single message
  // off before the backend could answer. See api/client.ts.
  const { data } = await apiClient.post<ChatResponseWire>('/chat', request, {
    timeout: AI_TIMEOUT_MS,
  });
  return {
    ...data,
    crisis_level: normalizeLevel(data.crisis_level),
    source: data.source ?? null,
    quick_replies: data.quick_replies ?? [],
    memory_candidate: data.memory_candidate ?? null,
  };
}

export type FeedbackRating = 'up' | 'down';

/**
 * Rate one DUYO reply. Ratings feed a human-reviewed dataset (admin panel) —
 * they never change model behaviour on their own. Re-rating overwrites.
 */
export async function rateMessage(
  messageId: string,
  childId: string,
  rating: FeedbackRating,
): Promise<void> {
  await apiClient.post(`/chat/messages/${messageId}/feedback`, {
    child_id: childId,
    rating,
  });
}

/**
 * The five things a child can say is wrong with a DUYO reply. Mirrors
 * `AiReportReason` in duyo-backend/src/duyo/models/ai_report.py — the server
 * rejects anything else, so the two lists must not drift.
 */
export type AiReportReason =
  | 'harmful'
  | 'sexual'
  | 'hateful'
  | 'scary'
  | 'other';

/**
 * Report a DUYO reply as harmful.
 *
 * NOT the same call as `rateMessage`, and the two are deliberately not merged.
 * A 👎 says the answer was poor; this says the app told a child something it
 * should not have, and lands in a safety queue a human reads. Google Play
 * requires the second from anything that declares an AI feature.
 *
 * Unlike a rating, this one is allowed to fail loudly — a child who reports
 * something and is told nothing has been given a placebo.
 */
export async function reportMessage(
  messageId: string,
  childId: string,
  reason: AiReportReason,
): Promise<void> {
  await apiClient.post(`/chat/messages/${messageId}/report`, {
    child_id: childId,
    reason,
  });
}
