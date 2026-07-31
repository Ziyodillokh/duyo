import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import {
  type ReportRead,
  type TrendsRead,
  getReport,
  getTrends,
} from '@/api/endpoints/reports';
import { useChildStore } from '@/store/child';

/** Parent report for the active child (Concept §11). */
export function useReport(): UseQueryResult<ReportRead> {
  const childId = useChildStore((s) => s.child?.id ?? null);
  return useQuery({
    queryKey: ['report', childId],
    queryFn: () => getReport(childId as string),
    enabled: childId != null,
  });
}

/** Past reports as a series — reads cached rows only, so it's cheap. */
export function useTrends(): UseQueryResult<TrendsRead> {
  const childId = useChildStore((s) => s.child?.id ?? null);
  return useQuery({
    queryKey: ['report-trends', childId],
    queryFn: () => getTrends(childId as string),
    enabled: childId != null,
  });
}
