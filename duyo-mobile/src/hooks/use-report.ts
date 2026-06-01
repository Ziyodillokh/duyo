import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { type ReportRead, getReport } from '@/api/endpoints/reports';
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
