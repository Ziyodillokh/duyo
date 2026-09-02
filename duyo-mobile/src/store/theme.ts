import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { asyncStorage } from '@/lib/async-storage';

export type ThemeMode = 'dark' | 'light';

interface ThemeState {
  mode: ThemeMode;
  hydrated: boolean;
  toggle: () => void;
  setHydrated: (hydrated: boolean) => void;
}

// Default = dark (Figma main app is dark-first).
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'dark',
      hydrated: false,
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

/**
 * Convenience hook: returns `true` if dark theme is active.
 *
 * The store is the only place the theme lives. There used to be a
 * `useThemeBridge` beside this that pushed `mode` into NativeWind's
 * `setColorScheme`, so `dark:` utilities would follow the switch — it went
 * with NativeWind itself, which no styling in the app had used for a while.
 */
export function useIsDark(): boolean {
  return useThemeStore((s) => s.mode === 'dark');
}
