import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type ConversationSummary,
  createProject,
  deleteConversation,
  deleteProject,
  listConversations,
  listProjects,
  type Project,
  renameConversation,
  setConversationProject,
  updateProject,
} from '@/api/endpoints/conversations';

/** Everything the history and project screens read; invalidated together. */
const HISTORY = 'conversations';
const PROJECTS = 'projects';

export function useConversations(
  childId: string | undefined,
  opts?: { projectId?: string; ungrouped?: boolean },
) {
  return useQuery({
    queryKey: [HISTORY, childId, opts?.projectId ?? null, opts?.ungrouped ?? false],
    queryFn: () => listConversations(childId!, opts),
    enabled: !!childId,
  });
}

export function useProjects(childId: string | undefined) {
  return useQuery({
    queryKey: [PROJECTS, childId],
    queryFn: () => listProjects(childId!),
    enabled: !!childId,
  });
}

/**
 * Both lists are invalidated after any write.
 *
 * A conversation moving between projects changes the ungrouped list, the
 * project's own list, AND both projects' counts — narrowing this would mean
 * enumerating those cases correctly every time one is added.
 */
function useHistoryMutation<TArgs, TResult>(
  childId: string | undefined,
  fn: (args: TArgs) => Promise<TResult>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [HISTORY, childId] });
      qc.invalidateQueries({ queryKey: [PROJECTS, childId] });
    },
  });
}

export function useRenameConversation(childId: string | undefined) {
  return useHistoryMutation<{ id: string; title: string }, ConversationSummary>(
    childId,
    ({ id, title }) => renameConversation(childId!, id, title),
  );
}

export function useMoveConversation(childId: string | undefined) {
  return useHistoryMutation<
    { id: string; projectId: string | null },
    ConversationSummary
  >(childId, ({ id, projectId }) =>
    setConversationProject(childId!, id, projectId),
  );
}

export function useDeleteConversation(childId: string | undefined) {
  return useHistoryMutation<string, void>(childId, (id) =>
    deleteConversation(childId!, id),
  );
}

export function useCreateProject(childId: string | undefined) {
  return useHistoryMutation<
    { name: string; instructions?: string; colour?: string },
    Project
  >(childId, (input) => createProject(childId!, input));
}

export function useUpdateProject(childId: string | undefined) {
  return useHistoryMutation<
    { id: string; name?: string; instructions?: string; colour?: string; pinned?: boolean },
    Project
  >(childId, ({ id, ...patch }) => updateProject(childId!, id, patch));
}

export function useDeleteProject(childId: string | undefined) {
  return useHistoryMutation<string, void>(childId, (id) =>
    deleteProject(childId!, id),
  );
}
