// The school subjects a child can ask for help with.
//
// Presentation config, not data: the label, emoji and accent colour a human
// chose for each subject. It lived in src/mocks/dtm.ts, next to fake DTM quiz
// questions that were replaced by a real endpoint long ago; when the DTM
// screen itself was removed, this was the only thing left in that file — and
// nothing about it was ever a mock or ever DTM-specific.

import type { TranslationKey } from '@/i18n';

export type Subject = 'math' | 'physics' | 'chemistry' | 'native' | 'history';

export interface SubjectMeta {
  /** The server contract — never translated. */
  key: Subject;
  /** A translation KEY, resolved with `t()` where the chip is drawn. The table
   *  is built once at module load, so a finished word here could never follow
   *  a language switch. */
  label: TranslationKey;
  emoji: string;
  color: string;
}

export const SUBJECTS: readonly SubjectMeta[] = [
  { key: 'math', label: 'subject.math', emoji: '🧮', color: '#60A5FA' },
  { key: 'physics', label: 'subject.physics', emoji: '⚛️', color: '#FB64B6' },
  { key: 'chemistry', label: 'subject.chemistry', emoji: '🧪', color: '#05DF72' },
  { key: 'native', label: 'subject.native', emoji: '📝', color: '#FDC700' },
  { key: 'history', label: 'subject.history', emoji: '🏛', color: '#FF8904' },
];
