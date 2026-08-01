import { apiClient } from '@/api/client';

// Mirrors backend duyo.schemas.puzzle. The correct answer is never in the
// question payload — it only comes back after the child picks.

export interface Puzzle {
  puzzle_id: string;
  text: string;
  choices: string[];
  difficulty: number;
}

export interface PuzzleAnswer {
  is_correct: boolean;
  correct_index: number;
  explanation: string;
}

/** Next unseen puzzle for this child, or null once the catalogue runs out. */
export async function getNextPuzzle(childId: string): Promise<Puzzle | null> {
  const { data } = await apiClient.get<Puzzle | null>('/puzzles/next', {
    params: { child_id: childId },
  });
  return data ?? null;
}

export async function answerPuzzle(
  puzzleId: string,
  childId: string,
  chosenIndex: number,
): Promise<PuzzleAnswer> {
  const { data } = await apiClient.post<PuzzleAnswer>(
    `/puzzles/${puzzleId}/answer`,
    { child_id: childId, chosen_index: chosenIndex },
  );
  return data;
}
