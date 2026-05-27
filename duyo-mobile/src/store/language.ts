import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { asyncStorage } from '@/lib/async-storage';

// Mirror of backend Language enum (duyo-backend/src/duyo/models/child.py).
export type Language = 'uz' | 'ru' | 'en';

interface LanguageState {
  language: Language;
  hydrated: boolean;
  setLanguage: (language: Language) => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'uz',
      hydrated: false,
      setLanguage: (language) => set({ language }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'duyo-language',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({ language: state.language }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
