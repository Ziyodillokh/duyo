import { useMutation } from '@tanstack/react-query';

import {
  type LessonHelpInput,
  type LessonSolution,
  solveLesson,
} from '@/api/endpoints/lesson-help';

/**
 * Ask the tutor to solve one homework question.
 *
 * A mutation, not a query: the child decides when to ask, the server persists
 * nothing, and re-running it on window focus or a remount would burn a model
 * call for an answer they are already reading.
 */
export function useLessonHelp(childId: string | undefined) {
  return useMutation<LessonSolution, unknown, LessonHelpInput>({
    mutationFn: (input) => solveLesson(childId!, input),
    // One shot. The default retry would make every failure take three times
    // as long to admit, and the model-down case never reaches here anyway —
    // the backend answers it 200 with available=false.
    retry: false,
  });
}
