import { useEffect } from 'react';
import { useColorScheme } from 'nativewind';
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

// Default = dark (Figma main app is dark-first).
// Light variants are layered via the `light:` opposite of `dark:` (NativeWind).
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

/**
 * Hook that syncs NativeWind's colorScheme with our persisted theme store.
 * Call once at the app root.
 */
export function useThemeBridge(): void {
  const mode = useThemeStore((s) => s.mode);
  const hydrated = useThemeStore((s) => s.hydrated);
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    if (!hydrated) return;
    setColorScheme(mode);
  }, [mode, hydrated, setColorScheme]);
}

/**
 * Convenience hook: returns `true` if dark theme is active.
 * Reads directly from the store (no NativeWind dependency).
 */
export function useIsDark(): boolean {
  return useThemeStore((s) => s.mode === 'dark');
}
