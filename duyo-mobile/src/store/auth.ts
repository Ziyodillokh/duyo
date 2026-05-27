import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { type AuthTokens } from '@/api/types';
import { secureStorage } from '@/lib/secure-storage';

interface AuthState {
  tokens: AuthTokens | null;
  userId: string | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  setAuth: (tokens: AuthTokens, userId: string) => void;
  clearAuth: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      tokens: null,
      userId: null,
      isAuthenticated: false,
      hydrated: false,
      setAuth: (tokens, userId) =>
        set({ tokens, userId, isAuthenticated: true }),
      clearAuth: () =>
        set({ tokens: null, userId: null, isAuthenticated: false }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'duyo-auth',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        tokens: state.tokens,
        userId: state.userId,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
