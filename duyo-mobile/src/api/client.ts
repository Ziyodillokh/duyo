import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { useAuthStore } from '@/store/auth';

const DEFAULT_BASE_URL = 'https://api.duyo.uz/v1';

export const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().tokens?.accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
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
