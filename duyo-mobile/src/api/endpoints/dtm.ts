import { AI_TIMEOUT_MS, apiClient } from '@/api/client';
import type { DTMSubject } from '@/mocks/dtm';

// Mirrors backend duyo.schemas.dtm. Unlike /puzzles, the DTM endpoint ships
// `correct_index` inside the question payload — the backend has no "check my
// answer" route for these, because every set is generated fresh and never
// persisted. So the grading below is done against the server's own answer key,
// not against anything the client made up.

export interface DtmQuestion {
  text: string;
  choices: string[];
  correct_index: number;
  explanation: string;
}

/** How many questions one practice run asks for. Backend caps at 10. */
export const DTM_QUESTION_COUNT = 5;

/**
 * The subject slug the backend indexes textbooks under
 * (duyo.textbook.pipeline._SUBJECT_ALIASES). The screen's own keys are UI
 * labels shared with lesson-help; these are the RAG corpus names, and sending
 * the wrong one silently retrieves nothing.
 */
const SUBJECT_SLUG: Record<DTMSubject, string> = {
  math: 'matematika',
  physics: 'fizika',
  chemistry: 'kimyo',
  native: 'ona-tili',
  history: 'tarix',
};

/**
 * Generate a fresh set of DTM-style questions for a subject.
 *
 * The backend grounds these in the ingested textbook chunks for that subject.
 * It answers 200 with an EMPTY list — never an error — when it has nothing to
 * ground on or the model call fails, so an empty result is a state the caller
 * must render honestly rather than a bug to swallow.
 */
export async function fetchDtmQuestions(
  subject: DTMSubject,
  count: number = DTM_QUESTION_COUNT,
): Promise<DtmQuestion[]> {
  const { data } = await apiClient.post<{ questions: DtmQuestion[] }>(
    '/dtm/questions',
    { subject: SUBJECT_SLUG[subject], count },
    // Generation, not CRUD — the default 15s cut this off mid-thought.
    { timeout: AI_TIMEOUT_MS },
  );
  // Defend the quiz loop: a malformed row would render a question with no way
  // to answer it right. Dropping it is honest — the child sees fewer questions,
  // never a broken one.
  return (data.questions ?? []).filter(
    (q) =>
      !!q.text &&
      Array.isArray(q.choices) &&
      q.choices.length >= 2 &&
      q.correct_index >= 0 &&
      q.correct_index < q.choices.length,
  );
}
