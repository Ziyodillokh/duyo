import { create } from 'zustand';

export type UserType = 'child' | 'parent';

interface OnboardingState {
  userType: UserType | null;
  pendingName: string;
  pendingAge: number | null;
  pendingInterests: ReadonlyArray<string>;
  pendingAvatarConfig: Record<string, string>;
  setUserType: (userType: UserType) => void;
  setPendingName: (name: string) => void;
  setPendingAge: (age: number) => void;
  setPendingInterests: (interests: ReadonlyArray<string>) => void;
  setPendingAvatarConfig: (config: Record<string, string>) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()((set) => ({
  userType: null,
  pendingName: '',
  pendingAge: null,
  pendingInterests: [],
  pendingAvatarConfig: {},
  setUserType: (userType) => set({ userType }),
  setPendingName: (pendingName) => set({ pendingName }),
  setPendingAge: (pendingAge) => set({ pendingAge }),
  setPendingInterests: (pendingInterests) => set({ pendingInterests }),
  setPendingAvatarConfig: (pendingAvatarConfig) => set({ pendingAvatarConfig }),
  reset: () =>
    set({
      userType: null,
      pendingName: '',
      pendingAge: null,
      pendingInterests: [],
      pendingAvatarConfig: {},
    }),
}));
