import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { asyncStorage } from '@/lib/async-storage';

/**
 * Which voice DUYO speaks with.
 *
 * ## Why the names are Google's and the labels are not
 *
 * `key` is a prebuilt Gemini voice name and goes to the server untranslated —
 * the model config takes that exact string. `label` is what a child reads, and
 * `hint` is Google's own one-word description of the voice's character,
 * rendered into Uzbek.
 *
 * Google documents CHARACTER — Soft, Warm, Gentle, Youthful, Informative,
 * Gravelly — and does NOT document gender. So neither do we. Labelling one of
 * these "erkak ovozi" would be a guess printed as a fact, and a child who
 * picked it and heard something else would be right to stop trusting the
 * screen. They are named by how they sound; the preview is what settles the
 * rest.
 *
 * ## Why this is persisted and the old one was not
 *
 * The setting used to live in the settings screen's own `useState`: it survived
 * until the child navigated away, reached no store and no request, and the
 * server had "Kore" hard-coded regardless. Choosing a voice did nothing at all.
 */
export interface VoiceChoice {
  /** The prebuilt Gemini voice name. Sent verbatim; never translated. */
  key: string;
  label: string;
  hint: string;
}

export const VOICE_CHOICES: readonly VoiceChoice[] = [
  { key: 'Achernar', label: 'Mayin', hint: 'Yumshoq va past ohangda' },
  { key: 'Sulafat', label: 'Iliq', hint: 'Do‘stona, iliq ohangda' },
  { key: 'Vindemiatrix', label: 'Muloyim', hint: 'Sekin va muloyim' },
  { key: 'Leda', label: 'Yosh', hint: 'Tetik, yoshlarnikiga yaqin' },
  { key: 'Charon', label: 'Bosiq', hint: 'Tinch va tushuntiruvchi' },
  { key: 'Algenib', label: 'Qirrali', hint: 'Quyuq, biroz g‘adir-budir' },
  { key: 'Kore', label: 'Qat’iy', hint: 'Aniq va ishonchli' },
];

/** What the server falls back to, so the app and the API agree on the default. */
export const DEFAULT_VOICE = 'Kore';

interface VoiceSettingsState {
  voice: string;
  hydrated: boolean;
  setVoice: (voice: string) => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useVoiceSettingsStore = create<VoiceSettingsState>()(
  persist(
    (set) => ({
      voice: DEFAULT_VOICE,
      hydrated: false,
      setVoice: (voice) => set({ voice }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'duyo-voice-settings',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({ voice: state.voice }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
