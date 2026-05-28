import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { asyncStorage } from '@/lib/async-storage';

export type ThemeMode = 'dark' | 'light';

interface ThemeState {
  mode: ThemeMode;
  hydrated: boolean;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  setHydrated: (hydrated: boolean) => void;
}

// Default = dark (Figma design is dark-first for main app).
// Full light-mode rebuild of main screens is Faza 2 scope.
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'dark',
      hydrated: false,
      setMode: (mode) => set({ mode }),
      toggle: () => set({ mode: get().mode === 'dark' ? 'light' : 'dark' }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'duyo-theme',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({ mode: state.mode }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
