import { AI_TIMEOUT_MS, apiClient } from '@/api/client';
import { type AgeSegment } from '@/api/types';

// Mirrors backend duyo.schemas.language — AI-generated practice exercises,
// grounded in published ContentType.LANGUAGE items when any exist.

export type PracticeLanguage = 'ru' | 'en';

export interface LanguageQuestion {
  text: string;
  choices: string[];
  correct_index: number;
  explanation: string;
}

export interface LanguagePracticeRequest {
  language: PracticeLanguage;
  age_segment: AgeSegment;
  topic?: string;
  count?: number;
}

export interface LanguagePracticeResponse {
  questions: LanguageQuestion[];
}

export async function getLanguageExercises(
  payload: LanguagePracticeRequest,
): Promise<LanguageQuestion[]> {
  const { data } = await apiClient.post<LanguagePracticeResponse>(
    '/language/exercises',
    payload,
    // Generates exercises with Gemini — see api/client.ts on why the 15s
    // default is wrong for anything that waits on a model.
    { timeout: AI_TIMEOUT_MS },
  );
  return data.questions;
}
