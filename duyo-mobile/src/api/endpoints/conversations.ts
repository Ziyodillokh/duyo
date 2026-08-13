import { apiClient } from '@/api/client';

// Mirrors duyo-backend duyo/api/v1/conversations.py.

export interface ConversationSummary {
  id: string;
  /** Never empty — the server falls back to a first-message preview. */
  title: string;
  project_id: string | null;
  message_count: number;
  preview: string | null;
  updated_at: string;
  created_at: string;
}

export interface HistoryMessage {
  id: string;
  role: 'child' | 'assistant';
  content: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  instructions: string | null;
  colour: string | null;
  conversation_count: number;
  created_at: string;
  updated_at: string;
}

/** The palette the backend accepts — anything else is rejected as unknown. */
export const PROJECT_COLOURS = [
  '#60A5FA',
  '#05DF72',
  '#FDC700',
  '#FB64B6',
  '#A78BFA',
  '#FB923C',
] as const;

export async function listConversations(
  childId: string,
  opts?: { projectId?: string; ungrouped?: boolean; limit?: number },
): Promise<ConversationSummary[]> {
  const { data } = await apiClient.get<ConversationSummary[]>(
    `/children/${childId}/conversations`,
    {
      params: {
        project_id: opts?.projectId,
        ungrouped: opts?.ungrouped ? true : undefined,
        limit: opts?.limit,
      },
    },
  );
  return data;
}

/**
 * A conversation's messages, oldest-first.
 *
 * Without `before` this is the END of the thread, which is what reopening a
 * chat should show. Pass the id of the oldest message you hold to page
 * further back.
 */
export async function listConversationMessages(
  childId: string,
  conversationId: string,
  opts?: { before?: string; limit?: number },
): Promise<HistoryMessage[]> {
  const { data } = await apiClient.get<HistoryMessage[]>(
    `/children/${childId}/conversations/${conversationId}/messages`,
    { params: { before: opts?.before, limit: opts?.limit } },
  );
  return data;
}

export async function renameConversation(
  childId: string,
  conversationId: string,
  title: string,
): Promise<ConversationSummary> {
  const { data } = await apiClient.patch<ConversationSummary>(
    `/children/${childId}/conversations/${conversationId}`,
    { title },
  );
  return data;
}

/**
 * Move a conversation into a project, or out of every project.
 *
 * `clear_project` exists because a plain null cannot say "remove it" —
 * an absent field and an explicit null arrive identically.
 */
export async function setConversationProject(
  childId: string,
  conversationId: string,
  projectId: string | null,
): Promise<ConversationSummary> {
  const { data } = await apiClient.patch<ConversationSummary>(
    `/children/${childId}/conversations/${conversationId}`,
    projectId === null
      ? { clear_project: true }
      : { project_id: projectId },
  );
  return data;
}

export async function deleteConversation(
  childId: string,
  conversationId: string,
): Promise<void> {
  await apiClient.delete(
    `/children/${childId}/conversations/${conversationId}`,
  );
}

// --- projects ---------------------------------------------------------------

export async function listProjects(childId: string): Promise<Project[]> {
  const { data } = await apiClient.get<Project[]>(
    `/children/${childId}/projects`,
  );
  return data;
}

export async function createProject(
  childId: string,
  input: { name: string; instructions?: string; colour?: string },
): Promise<Project> {
  const { data } = await apiClient.post<Project>(
    `/children/${childId}/projects`,
    input,
  );
  return data;
}

export async function updateProject(
  childId: string,
  projectId: string,
  patch: { name?: string; instructions?: string; colour?: string },
): Promise<Project> {
  const { data } = await apiClient.patch<Project>(
    `/children/${childId}/projects/${projectId}`,
    patch,
  );
  return data;
}

export async function deleteProject(
  childId: string,
  projectId: string,
): Promise<void> {
  await apiClient.delete(`/children/${childId}/projects/${projectId}`);
}

/** Why a project write failed, in words the child can act on. */
export function projectErrorMessage(err: unknown): string {
  const res = (err as { response?: { status?: number; data?: { detail?: string } } })
    .response;
  if (res?.status === 429 && res.data?.detail) return res.data.detail;
  if (res?.status === 422) return "Bu nomni ishlatib bo'lmaydi.";
  return "Saqlanmadi. Internetni tekshirib, qayta urinib ko'r.";
}
