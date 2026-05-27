// Shared DUYO API types used across the mobile client.

export type Language = 'uz' | 'ru' | 'en';
export type AgeSegment = 'junior' | 'explorer' | 'companion';

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
}

export interface ApiErrorBody {
  detail?: string;
  message?: string;
}
