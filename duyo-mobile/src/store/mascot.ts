import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { asyncStorage } from '@/lib/async-storage';

/** Which body the child picked during onboarding. */
export type MascotVariant = 'duyo' | 'raccoon';

interface MascotState {
  variant: MascotVariant;
  setVariant: (variant: MascotVariant) => void;
}

// Persisted so the mascot survives a restart: every avatar in the app (chat,
// voice, home, profile) reads this, so a child who picked the raccoon keeps
// talking to the raccoon.
export const useMascotStore = create<MascotState>()(
  persist(
    (set) => ({
      variant: 'duyo',
      setVariant: (variant) => set({ variant }),
    }),
    {
      name: 'duyo-mascot',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({ variant: state.variant }),
    },
  ),
);

export function useMascotVariant(): MascotVariant {
  return useMascotStore((s) => s.variant);
}
