// Shared DUYO API types used across the mobile client.

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // unix seconds
}

export interface ApiErrorBody {
  detail?: string;
  message?: string;
}
