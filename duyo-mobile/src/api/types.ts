// Shared DUYO API types used across the mobile client.

export type Language = 'uz' | 'ru' | 'en';
export type AgeSegment = 'junior' | 'explorer' | 'companion';
export type CrisisLevel = 'green' | 'yellow' | 'orange' | 'red';

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // unix seconds
}

export interface ChildProfile {
  id: string;
  name: string;
  age: number;
  age_segment: AgeSegment;
  language: Language;
  /** Chosen during onboarding; older profiles have none. */
  interests?: string[];
  mascot?: string | null;
}

export interface ApiErrorBody {
  detail?: string;
  message?: string;
}
