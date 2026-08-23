import { useQuery } from '@tanstack/react-query';

import {
  getContent,
  isContentNotFound,
  listContent,
} from '@/api/endpoints/content';
import { type AgeSegment } from '@/api/types';

/**
 * Published library content for one child.
 *
 * `ageSegment` is sent to the server, which widens it to "this segment plus
 * the universal 'all'" — the age gate is the backend's job, not a client-side
 * filter. It is omitted while the child profile is still loading so the query
 * key changes (and refetches) once the segment is known, rather than caching
 * an unfiltered list under a filtered-looking key.
 *
 * `q` is sent too, for the reason in ListContentParams: the response is capped
 * at `limit`, so a client-side search would silently miss everything past it.
 * Callers pass a DEBOUNCED value — the key changes on every keystroke.
 */
export function useContentLibrary(ageSegment: AgeSegment | undefined, q = '') {
  const search = q.trim();
  return useQuery({
    queryKey: ['content', { ageSegment: ageSegment ?? null, q: search }],
    queryFn: () =>
      listContent({
        ...(ageSegment ? { age_segment: ageSegment } : {}),
        ...(search ? { q: search } : {}),
        limit: 200,
      }),
    // A published library changes on editorial timescales, not per visit.
    staleTime: 5 * 60 * 1000,
  });
}

export function useContentItem(id: string) {
  return useQuery({
    queryKey: ['content-item', id],
    queryFn: () => getContent(id),
    enabled: id !== '',
    staleTime: 5 * 60 * 1000,
    // 404 means unpublished or gone; retrying cannot change that answer.
    retry: (count, err) => !isContentNotFound(err) && count < 2,
  });
}
