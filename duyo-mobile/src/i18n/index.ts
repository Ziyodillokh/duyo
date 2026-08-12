import { useCallback } from 'react';

import type { Language } from '@/api/types';
import { useLanguageStore } from '@/store/language';

import { TRANSLATIONS, type TranslationKey } from './translations';

export type { TranslationKey };

export type TranslateVars = Record<string, string | number>;
export type TranslateFn = (key: TranslationKey, vars?: TranslateVars) => string;

const FALLBACK_LANGUAGE: Language = 'uz';

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Translate outside a component — API layers, store subscribers, anything
 * without hooks. Inside a component use `useT()` so the screen re-renders
 * when the child switches language.
 */
export function translate(
  language: Language,
  key: TranslationKey,
  vars?: TranslateVars,
): string {
  const table = TRANSLATIONS[language] ?? TRANSLATIONS[FALLBACK_LANGUAGE];
  return interpolate(table[key], vars);
}

/** The current language's translator. Re-renders on a language change. */
export function useT(): TranslateFn {
  const language = useLanguageStore((s) => s.language);
  return useCallback(
    (key: TranslationKey, vars?: TranslateVars) =>
      translate(language, key, vars),
    [language],
  );
}

/** What each language calls itself — never translated. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  uz: "O'zbek",
  ru: 'Русский',
  en: 'English',
};
