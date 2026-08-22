// Static DTM/IELTS practice questions for Bosqich B beta.
// Real content from RAG backend in Faza 1.

export type DTMSubject = 'math' | 'physics' | 'chemistry' | 'native' | 'history';

export interface DTMQuestion {
  id: string;
  subject: DTMSubject;
  text: string;
  choices: readonly string[];
  correctIndex: number;
  explanation?: string;
}

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

export const DTM_QUESTIONS: readonly DTMQuestion[] = [
  {
    id: 'm-1',
    subject: 'math',
    text: "2x + 5 = 13 tenglamada x ning qiymati nechiga teng?",
    choices: ['3', '4', '5', '6'],
    correctIndex: 1,
    explanation: '2x = 13 - 5 = 8, demak x = 4',
  },
  {
    id: 'm-2',
    subject: 'math',
    text: '12 ning 25% i nechi?',
    choices: ['2', '3', '4', '5'],
    correctIndex: 1,
    explanation: '12 × 25/100 = 3',
  },
  {
    id: 'm-3',
    subject: 'math',
    text: "To'g'ri burchakning yig'indisi nechi gradus?",
    choices: ['90°', '180°', '270°', '360°'],
    correctIndex: 1,
  },
  {
    id: 'p-1',
    subject: 'physics',
    text: 'Tezlikning birligi qaysi?',
    choices: ['kg', 'm/s', 'N', 'J'],
    correctIndex: 1,
  },
  {
    id: 'p-2',
    subject: 'physics',
    text: "F = ma formulasidagi 'm' qaysi kattalik?",
    choices: ['Kuch', 'Massa', 'Tezlanish', 'Tezlik'],
    correctIndex: 1,
  },
  {
    id: 'n-1',
    subject: 'native',
    text: "Quyidagilardan qaysi biri otdir?",
    choices: ['Yugurmoq', "O'rgan", 'Kitob', 'Tez'],
    correctIndex: 2,
  },
  {
    id: 'n-2',
    subject: 'native',
    text: "'Bahor' so'zining bo'g'inlar soni qancha?",
    choices: ['1', '2', '3', '4'],
    correctIndex: 1,
    explanation: 'Ba-hor — 2 bo\'g\'in',
  },
];

export function questionsBySubject(subject: DTMSubject): DTMQuestion[] {
  return DTM_QUESTIONS.filter((q) => q.subject === subject);
}

export const TIMER_SECONDS_PER_QUESTION = 60;
