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

/**
 * Developmental observation drawn from conversation style — deliberately NOT
 * a clinical or psychometric score (no IQ number). Backend enforces this in
 * the prompt itself; the UI must present it the same way.
 */
export interface CognitiveSection {
  vocabulary_level: string;
  curiosity_signals: string[];
  note: string;
  /** Plain-language band from the chalkboard puzzles — never a score. */
  reasoning_band: string;
  puzzles_answered: number;
  puzzles_correct: number;
}

export interface ReportSections {
  activity: ActivitySection;
  mood: MoodSection;
  safety: SafetySection;
  // Older cached reports (pre-guidance) may not carry this section.
  guidance: GuidanceSection | null;
  // Older cached reports (pre-cognitive) may not carry this section either.
  cognitive?: CognitiveSection | null;
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

/** One past report reduced to plottable aggregates. */
export interface TrendPoint {
  period_end: string;
  active_days: number;
  total_messages: number;
  concerning_count: number;
  mood_trend: string;
  vocabulary_level: string;
}

export interface TrendsRead {
  child_id: string;
  points: TrendPoint[]; // oldest → newest
}

export async function getTrends(
  childId: string,
  limit = 12,
): Promise<TrendsRead> {
  const { data } = await apiClient.get<TrendsRead>(
    `/reports/${childId}/trends`,
    { params: { limit } },
  );
  return data;
}
