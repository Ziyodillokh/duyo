import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { TranslationKey } from '@/i18n';
import { asyncStorage } from '@/lib/async-storage';

/**
 * Which voice DUYO speaks with.
 *
 * ## Why the names are Google's and the labels are not
 *
 * `key` is a prebuilt Gemini voice name and goes to the server untranslated —
 * the model config takes that exact string. `labelKey` is what a child reads,
 * and `hintKey` is Google's own one-word description of the voice's character
 * — both are translation keys, not words, because this table is built once at
 * module load and a resolved string here could never follow a language switch.
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
  labelKey: TranslationKey;
  hintKey: TranslationKey;
}

export const VOICE_CHOICES: readonly VoiceChoice[] = [
  {
    key: 'Achernar',
    labelKey: 'voice.choice.achernar',
    hintKey: 'voice.choice.achernarHint',
  },
  {
    key: 'Sulafat',
    labelKey: 'voice.choice.sulafat',
    hintKey: 'voice.choice.sulafatHint',
  },
  {
    key: 'Vindemiatrix',
    labelKey: 'voice.choice.vindemiatrix',
    hintKey: 'voice.choice.vindemiatrixHint',
  },
  {
    key: 'Leda',
    labelKey: 'voice.choice.leda',
    hintKey: 'voice.choice.ledaHint',
  },
  {
    key: 'Charon',
    labelKey: 'voice.choice.charon',
    hintKey: 'voice.choice.charonHint',
  },
  {
    key: 'Algenib',
    labelKey: 'voice.choice.algenib',
    hintKey: 'voice.choice.algenibHint',
  },
  {
    key: 'Kore',
    labelKey: 'voice.choice.kore',
    hintKey: 'voice.choice.koreHint',
  },
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
