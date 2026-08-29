import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { asyncStorage } from '@/lib/async-storage';

interface OnboardingState {
  pendingName: string;
  pendingAge: number | null;
  pendingInterests: readonly string[];
  pendingAvatarConfig: Record<string, string>;
  setPendingName: (name: string) => void;
  setPendingAge: (age: number) => void;
  setPendingInterests: (interests: readonly string[]) => void;
  setPendingAvatarConfig: (config: Record<string, string>) => void;
  reset: () => void;
}

const EMPTY = {
  pendingName: '',
  pendingAge: null,
  pendingInterests: [] as readonly string[],
  pendingAvatarConfig: {} as Record<string, string>,
};

// Persisted, unlike the other in-flight state in this app: onboarding spans
// eight screens and Android happily kills the app while the child is in the
// SMS app or reading a notification. Losing the answers halfway meant the
// profile was created with whatever survived, or not at all.
export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...EMPTY,
      setPendingName: (pendingName) => set({ pendingName }),
      setPendingAge: (pendingAge) => set({ pendingAge }),
      setPendingInterests: (pendingInterests) => set({ pendingInterests }),
      setPendingAvatarConfig: (pendingAvatarConfig) =>
        set({ pendingAvatarConfig }),
      reset: () => set({ ...EMPTY }),
    }),
    {
      name: 'duyo-onboarding',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({
        pendingName: state.pendingName,
        pendingAge: state.pendingAge,
        pendingInterests: state.pendingInterests,
        pendingAvatarConfig: state.pendingAvatarConfig,
      }),
    },
  ),
);
