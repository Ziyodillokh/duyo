import { AI_TIMEOUT_MS, apiClient } from '@/api/client';
import { translate } from '@/i18n';
import { SUBJECTS } from '@/lib/subjects';
import { useLanguageStore } from '@/store/language';

// Mirrors backend duyo.schemas.chat.LessonHelpRequest / LessonHelpResponse
// (POST /v1/chat/lesson-help). Stateless on the server: nothing is persisted,
// so there is no query to invalidate and no id to keep — one question in, one
// solution out.

export interface LessonStep {
  title: string;
  detail: string;
}

interface LessonHelpWire {
  steps: LessonStep[];
  answer: string;
  /** Older builds of the backend omit this; absent means "real solution". */
  available?: boolean;
}

export interface LessonSolution {
  steps: LessonStep[];
  /** May be empty for an explain-type question that has no single result. */
  answer: string;
  /**
   * False when the model was unreachable and `steps` is the backend's calm
   * apology rather than a worked solution. The endpoint answers 200 either
   * way — a child must never meet a 500 — so this is the ONLY thing that
   * separates the two, and rendering the apology under "DUYO yechimi" would
   * be the app claiming it solved something it did not.
   */
  available: boolean;
}

export interface LessonHelpInput {
  /** A `subjects.ts` key ('math'), or a subject label the child already sees.
   *  Either way the request carries the readable word — see `readable()`. */
  subject: string;
  question: string;
}

/**
 * The readable subject word for the prompt.
 *
 * `SUBJECTS[].label` holds a translation KEY now, and a key going into the
 * tutor prompt would read as "Fan: subject.math". Both the key and the label
 * key resolve here, in the child's own language — the answer comes back in
 * that language anyway (api/client sends Accept-Language).
 */
function readable(subject: string): string {
  const language = useLanguageStore.getState().language;
  const meta = SUBJECTS.find((s) => s.key === subject || s.label === subject);
  return meta ? translate(language, meta.label) : subject;
}

/**
 * Ask the tutor for a step-by-step solution.
 *
 * Throws on transport failure — unlike the chalkboard, this screen is the
 * whole point of the child's tap, so a failure has to be shown, not swallowed.
 */
export async function solveLesson(
  childId: string,
  input: LessonHelpInput,
): Promise<LessonSolution> {
  const { data } = await apiClient.post<LessonHelpWire>(
    '/chat/lesson-help',
    {
      child_id: childId,
      // The backend feeds this straight into the prompt as "Fan: {subject}",
      // so it wants the readable label, NOT the textbook corpus slug that
      // api/endpoints/dtm.ts maps to for retrieval.
      subject: readable(input.subject),
      question: input.question,
    },
    // A grounded, multi-step generation — the 15s CRUD default cuts it off.
    { timeout: AI_TIMEOUT_MS },
  );
  return {
    steps: data.steps ?? [],
    answer: data.answer ?? '',
    available: data.available !== false && (data.steps?.length ?? 0) > 0,
  };
}

/**
 * What to tell the child when the request itself failed (the model being down
 * is not this case — that arrives as a 200 with available=false).
 */
export function lessonHelpErrorMessage(err: unknown): string {
  // No hooks in a plain module: the language is read at call time, which is
  // the moment the request failed, so it is always the current one.
  const language = useLanguageStore.getState().language;
  const status = (err as { response?: { status?: number } }).response?.status;
  switch (status) {
    case 401:
      return translate(language, 'lessonHelp.err.session');
    case 404:
      // The profile on this device no longer exists on the server.
      return translate(language, 'lessonHelp.err.noProfile');
    case 422:
      return translate(language, 'lessonHelp.err.badQuestion');
    case 429:
      return translate(language, 'lessonHelp.err.limit');
    default:
      return translate(language, 'lessonHelp.err.generic');
  }
}
