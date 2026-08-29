// The school subjects a child can ask for help with.
//
// Presentation config, not data: the label, emoji and accent colour a human
// chose for each subject. It lived in src/mocks/dtm.ts, next to fake DTM quiz
// questions that were replaced by a real endpoint long ago; when the DTM
// screen itself was removed, this was the only thing left in that file — and
// nothing about it was ever a mock or ever DTM-specific.

export type Subject = 'math' | 'physics' | 'chemistry' | 'native' | 'history';

export interface SubjectMeta {
  key: Subject;
  label: string;
  emoji: string;
  color: string;
}

export const SUBJECTS: readonly SubjectMeta[] = [
  { key: 'math', label: 'Matematika', emoji: '🧮', color: '#60A5FA' },
  { key: 'physics', label: 'Fizika', emoji: '⚛️', color: '#FB64B6' },
  { key: 'chemistry', label: 'Kimyo', emoji: '🧪', color: '#05DF72' },
  { key: 'native', label: 'Ona tili', emoji: '📝', color: '#FDC700' },
  { key: 'history', label: 'Tarix', emoji: '🏛', color: '#FF8904' },
];
