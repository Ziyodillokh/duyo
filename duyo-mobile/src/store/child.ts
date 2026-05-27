import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { type ChildProfile } from '@/api/types';
import { asyncStorage } from '@/lib/async-storage';

interface ChildState {
  child: ChildProfile | null;
  hydrated: boolean;
  setChild: (child: ChildProfile) => void;
  clearChild: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useChildStore = create<ChildState>()(
  persist(
    (set) => ({
      child: null,
      hydrated: false,
      setChild: (child) => set({ child }),
      clearChild: () => set({ child: null }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'duyo-child',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({ child: state.child }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
