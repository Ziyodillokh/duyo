import { apiClient } from '@/api/client';

// Mirrors backend duyo.schemas.report (Concept §11 — privacy-aggregate only,
// no raw message text ever crosses this boundary).

export interface ActivitySection {
  active_days: number;
  total_messages: number;
  conversations: number;
  window_days: number;
}

export interface MoodSection {
  mood_trend: string;
  mood_summary: string;
  topics: string[];
  stress_signals: string;
  highlight: string;
}

export interface SafetySection {
  by_level: Record<string, number>;
  concerning_count: number;
  had_red: boolean;
}

export interface GuidanceSection {
  tips: string[];
  focus: string;
}

export interface ReportSections {
  activity: ActivitySection;
  mood: MoodSection;
  safety: SafetySection;
  // Older cached reports (pre-guidance) may not carry this section.
  guidance: GuidanceSection | null;
}

export interface ReportRead {
  child_id: string;
  period_start: string;
  period_end: string;
  llm_ok: boolean;
  cached: boolean;
  sections: ReportSections;
}

export async function getReport(
  childId: string,
  refresh = false,
): Promise<ReportRead> {
  const { data } = await apiClient.get<ReportRead>(`/reports/${childId}`, {
    params: refresh ? { refresh: true } : undefined,
  });
  return data;
}
