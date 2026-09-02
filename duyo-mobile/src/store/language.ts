import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { type Language } from '@/api/types';
import { asyncStorage } from '@/lib/async-storage';
import { queryClient } from '@/lib/query-client';

export type { Language };

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
      /**
       * Switching the language has to throw the server's answers away too.
       *
       * Half of what the child reads is not in translations.ts — goal titles,
       * achievement names, plan features, notification bodies, library items
       * and conversation titles all arrive from the API. `api/client` already
       * sends `Accept-Language` on every request, so the server WOULD answer
       * in the new language; nothing was asking it again. No query key
       * carries the language, and the client keeps answers for 30s with
       * `refetchOnWindowFocus` off, so the previous language stayed in the
       * cache and the app read half-translated.
       *
       * `invalidateQueries` rather than `clear()`: it marks everything stale
       * and refetches what is mounted, so the screen in front of the child
       * fills in instead of emptying first.
       *
       * It lives here rather than in the settings screen because three places
       * change the language — onboarding, settings, and the voice orb's own
       * language cycle — and only one of them would have remembered.
       */
      setLanguage: (language) => {
        set({ language });
        void queryClient.invalidateQueries();
      },
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
