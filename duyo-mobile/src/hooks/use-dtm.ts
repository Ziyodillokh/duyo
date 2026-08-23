import { useMutation } from '@tanstack/react-query';

import { type DtmQuestion, fetchDtmQuestions } from '@/api/endpoints/dtm';
import type { DTMSubject } from '@/mocks/dtm';

/**
 * Ask the backend for a practice set.
 *
 * A mutation rather than a query: each run is a fresh generation, and "Yana
 * sinash" must produce NEW questions, not a cached copy of the ones the child
 * has already answered. Nothing here is cached for the same reason.
 */
export function useDtmQuestions() {
  return useMutation<DtmQuestion[], unknown, DTMSubject>({
    mutationFn: (subject: DTMSubject) => fetchDtmQuestions(subject),
  });
}
