import { apiClient } from '@/api/client';

export type GoalKind = 'book' | 'textbook' | 'skill' | 'exam' | 'habit' | 'other';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned';
export type GoalSource =
  | 'child_stated'
  | 'parent_set'
  | 'onboarding'
  | 'inferred';

export interface Goal {
  id: string;
  child_id: string;
  kind: GoalKind;
  title: string;
  match_key: string | null;
  target_ref: Record<string, unknown> | null;
  status: GoalStatus;
  source: GoalSource;
  confirmed_at: string | null;
  unit_label: string | null;
  current_unit: number | null;
  total_units: number | null;
  progress_pct: number | null;
  last_progress_at: string | null;
  target_date: string | null;
  created_at: string;
}

export interface GoalEvent {
  id: string;
  unit_value: number | null;
  note: string | null;
  source: GoalSource;
  created_at: string;
}

/** How many OTHER children share a goal. A count — never an identity. */
export interface GoalSignal {
  match_key: string;
  title: string;
  count: number;
}

export interface GoalCatalogEntry {
  match_key: string;
  kind: GoalKind;
  title: string;
  target_ref: Record<string, unknown> | null;
  /** The age band this goal is published for; the server already filters
   *  by the child's age, these are for showing "12–16" on a chip. */
  age_min: number;
  age_max: number;
}

export interface CreateGoalInput {
  title: string;
  kind?: GoalKind;
  match_key?: string;
  unit_label?: string;
  total_units?: number;
}

export async function listGoals(
  childId: string,
  status?: GoalStatus,
): Promise<Goal[]> {
  const { data } = await apiClient.get<Goal[]>(`/children/${childId}/goals`, {
    params: status ? { status } : undefined,
  });
  return data;
}

export async function createGoal(
  childId: string,
  input: CreateGoalInput,
): Promise<Goal> {
  const { data } = await apiClient.post<Goal>(`/children/${childId}/goals`, {
    kind: input.kind ?? 'other',
    title: input.title,
    match_key: input.match_key,
    unit_label: input.unit_label,
    total_units: input.total_units,
    source: 'child_stated',
  });
  return data;
}

export async function addGoalProgress(
  childId: string,
  goalId: string,
  unitValue: number,
  opts?: { note?: string; allowRegress?: boolean },
): Promise<Goal> {
  const { data } = await apiClient.post<Goal>(
    `/children/${childId}/goals/${goalId}/progress`,
    {
      unit_value: unitValue,
      note: opts?.note,
      allow_regress: opts?.allowRegress ?? false,
    },
  );
  return data;
}

export async function updateGoal(
  childId: string,
  goalId: string,
  patch: { status?: GoalStatus; title?: string; total_units?: number },
): Promise<Goal> {
  const { data } = await apiClient.patch<Goal>(
    `/children/${childId}/goals/${goalId}`,
    patch,
  );
  return data;
}

export async function deleteGoal(
  childId: string,
  goalId: string,
): Promise<void> {
  await apiClient.delete(`/children/${childId}/goals/${goalId}`);
}

/**
 * Anonymous "others are doing this too" counts.
 *
 * Never throws: this is a nice-to-have strip on the goals screen, and a
 * failure here must not blank the child's own goals.
 */
export async function fetchGoalSignal(childId: string): Promise<GoalSignal[]> {
  try {
    const { data } = await apiClient.get<GoalSignal[]>(
      `/children/${childId}/goal-signal`,
    );
    return data;
  } catch {
    return [];
  }
}

export async function fetchGoalCatalog(
  q?: string,
  age?: number,
): Promise<GoalCatalogEntry[]> {
  // `age` narrows the picker to what this child may actually be matched
  // over — the server enforces the band on save regardless, so this only
  // stops a chip from being shown and then silently not linking.
  try {
    const { data } = await apiClient.get<GoalCatalogEntry[]>('/goals/catalog', {
      params: { ...(q ? { q } : {}), ...(age ? { age } : {}) },
    });
    return data;
  } catch {
    return [];
  }
}

/** Confirm a goal the child agreed to. Only confirmed goals introduce a child
 *  to anyone — see duyo-backend services/social.py and services/groups.py. */
export async function confirmGoal(childId: string, goalId: string): Promise<Goal> {
  const { data } = await apiClient.post<Goal>(
    `/children/${childId}/goals/${goalId}/confirm`,
  );
  return data;
}
