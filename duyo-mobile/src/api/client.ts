import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';

const DEFAULT_BASE_URL = 'https://api.duyo.uz/v1';

/**
 * Ordinary CRUD: fail fast, because a stuck request here is a bug, not work.
 */
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Endpoints that wait on a language model.
 *
 * A chat turn runs crisis screening, retrieval and then a grounded Gemini
 * generation; grounded generations alone routinely take 10-20 seconds, and
 * the voice socket in the same app is logged at 15-75 seconds of model time.
 * Under the 15-second default EVERY chat message was cut off by the client at
 * exactly 15.0s — nginx recorded a wall of `POST /v1/chat 499 rt:14.9`, the
 * backend never got to answer, and the child was told to check a connection
 * that was working perfectly.
 *
 * 60s is chosen to sit above the slowest observed model turn with headroom,
 * while still bounding a genuinely hung request.
 */
export const AI_TIMEOUT_MS = 60_000;

export const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().tokens?.accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // The language the child is reading the app in, on every request. The child
  // profile carries the same value, but the header also covers calls made
  // before a profile exists (onboarding, auth).
  if (config.headers) {
    config.headers['Accept-Language'] = useLanguageStore.getState().language;
  }
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

// One refresh at a time. Without this, a screen that fires several queries at
// once (the brain screen loads notes + graph together) would send one refresh
// per request, and all but the first would present an already-rotated token.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { tokens, userId, setAuth, clearAuth } = useAuthStore.getState();
  const refreshToken = tokens?.refreshToken;
  if (!refreshToken) {
    clearAuth();
    return null;
  }
  try {
    // Bare axios, not apiClient: going through the instance would re-enter
    // this interceptor if the refresh itself 401s.
    const { data } = await axios.post<{
      access_token: string;
      refresh_token: string;
    }>(`${apiClient.defaults.baseURL}/auth/refresh`, {
      refresh_token: refreshToken,
    });
    setAuth(
      { accessToken: data.access_token, refreshToken: data.refresh_token },
      userId ?? '',
    );
    return data.access_token;
  } catch {
    // The refresh token is spent or invalid — this is a real logout.
    clearAuth();
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const isAuthCall = config?.url?.includes('/auth/');

    // The access token lives 15 minutes (backend jwt_access_token_expire_minutes),
    // so without this a child gets thrown back to the phone-number screen
    // mid-conversation. Refresh once, then replay the original request.
    if (error.response?.status === 401 && config && !config._retried && !isAuthCall) {
      config._retried = true;
      refreshing = refreshing ?? refreshAccessToken().finally(() => {
        refreshing = null;
      });
      const token = await refreshing;
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
        return apiClient(config);
      }
    }

    // A 401 from the login endpoints means "wrong code", not "your session
    // died" — clearing auth there logged out a signed-in user over one
    // mistyped digit.
    if (error.response?.status === 401 && !isAuthCall) {
      useAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  },
);
