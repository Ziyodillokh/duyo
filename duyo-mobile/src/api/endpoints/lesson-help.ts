import { AI_TIMEOUT_MS, apiClient } from '@/api/client';

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
  /** Human-readable Uzbek subject label ("Matematika"). */
  subject: string;
  question: string;
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
      subject: input.subject,
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
  const status = (err as { response?: { status?: number } }).response?.status;
  switch (status) {
    case 401:
      return 'Seansing tugabdi. Ilovaga qaytadan kirib, yana urinib ko\'r.';
    case 404:
      // The profile on this device no longer exists on the server.
      return "Profilingni topa olmadim. Ilovani yopib, qaytadan ochib ko'r.";
    case 422:
      return "Vazifa matni tushunarsiz bo'ldi. Uni to'liqroq yozib yubor.";
    case 429:
      return "Bugungi savollar chegarasiga yetding. Ertaga yana yordam beraman.";
    default:
      return "Yechimni olib kelolmadim. Internetni tekshirib, qayta urinib ko'r.";
  }
}
