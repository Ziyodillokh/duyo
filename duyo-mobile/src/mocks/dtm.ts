// Subject picker config for the DTM practice and lesson-help screens.
//
// This is presentation config, not data: the label, emoji and accent colour a
// human chose for each subject. The QUESTIONS that used to live here were
// fake — they now come from POST /v1/dtm/questions (see api/endpoints/dtm.ts),
// which also owns the mapping from these keys to the backend's corpus slugs.

export type DTMSubject = 'math' | 'physics' | 'chemistry' | 'native' | 'history';

export interface DTMSubjectMeta {
  key: DTMSubject;
  label: string;
  emoji: string;
  color: string;
}

export const DTM_SUBJECTS: readonly DTMSubjectMeta[] = [
  { key: 'math', label: 'Matematika', emoji: '🧮', color: '#60A5FA' },
  { key: 'physics', label: 'Fizika', emoji: '⚛️', color: '#FB64B6' },
  { key: 'chemistry', label: 'Kimyo', emoji: '🧪', color: '#05DF72' },
  { key: 'native', label: 'Ona tili', emoji: '📝', color: '#FDC700' },
  { key: 'history', label: 'Tarix', emoji: '🏛', color: '#FF8904' },
];
