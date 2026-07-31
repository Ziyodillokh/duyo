import { apiClient } from '@/api/client';

export interface BoardStep {
  expr: string; // one chalk line — the maths only
  note: string; // small caption under it, may be empty
}

export interface BoardFigureItem {
  type: 'curve' | 'shape' | 'circle' | 'arrow' | 'label';
  points: [number, number][];
  cx?: number | null;
  cy?: number | null;
  r?: number | null;
  label: string;
}

/** Diagram primitives in the problem's own units — the view rescales them. */
export interface BoardFigure {
  caption: string;
  axes: boolean;
  items: BoardFigureItem[];
}

export interface BoardSolution {
  title: string;
  problem: string;
  steps: BoardStep[];
  answer: string;
  figure: BoardFigure | null;
}

interface BoardWire extends BoardSolution {
  is_problem: boolean;
}

/**
 * Ask whether the child's utterance is a solvable problem and, if so, get it
 * laid out for the chalkboard. Returns null when there is nothing to write.
 *
 * Runs once per voice turn, so it never throws: a failure here must not
 * disturb the conversation — the board just doesn't appear.
 */
export async function solveOnBoard(
  childId: string,
  question: string,
): Promise<BoardSolution | null> {
  try {
    const { data } = await apiClient.post<BoardWire>('/chat/board', {
      child_id: childId,
      question,
    });
    if (!data.is_problem || !data.problem || !data.steps?.length) return null;
    const figure = data.figure;
    return {
      title: data.title ?? '',
      problem: data.problem,
      steps: data.steps,
      answer: data.answer ?? '',
      figure: figure?.items?.length ? figure : null,
    };
  } catch {
    return null;
  }
}
