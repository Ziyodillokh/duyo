import { apiClient } from '@/api/client';

export type MoodValue = 'great' | 'good' | 'okay' | 'sad' | 'stressed';

export interface TodayMood {
  mood: MoodValue | null;
  entry_date: string;
}

export async function getTodayMood(childId: string): Promise<TodayMood> {
  const { data } = await apiClient.get<TodayMood>(
    `/children/${childId}/mood/today`,
  );
  return data;
}

export async function setTodayMood(
  childId: string,
  mood: MoodValue,
): Promise<TodayMood> {
  const { data } = await apiClient.put<TodayMood>(
    `/children/${childId}/mood/today`,
    { mood },
  );
  return data;
}
