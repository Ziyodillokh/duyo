// Static mock content for Bosqich B beta.
// Real content comes from RAG backend in Faza 1 (~2026-09).

export type LibraryCategory =
  | 'poems'
  | 'stories'
  | 'lessons'
  | 'language'
  | 'dtm';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface LibraryItem {
  id: string;
  category: LibraryCategory;
  title: string;
  author?: string;
  emoji: string;
  duration: string;
  difficulty: Difficulty;
  progress?: number; // 0..1 — present means user started it
}

export interface CategoryMeta {
  key: LibraryCategory;
  label: string;
  emoji: string;
  color: string;
}

export const CATEGORIES: ReadonlyArray<CategoryMeta> = [
  { key: 'poems', label: "She'rlar", emoji: '📖', color: '#FDC700' },
  { key: 'stories', label: 'Ertaklar', emoji: '📚', color: '#FB64B6' },
  { key: 'lessons', label: 'Darslar', emoji: '🎓', color: '#60A5FA' },
  { key: 'language', label: 'Til', emoji: '🌍', color: '#05DF72' },
  { key: 'dtm', label: 'DTM/IELTS', emoji: '🎯', color: '#FF8904' },
];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Oson',
  medium: "O'rtacha",
  hard: 'Qiyin',
};

export const DIFFICULTY_COLORS: Record<
  Difficulty,
  { bg: string; border: string; text: string }
> = {
  easy: {
    bg: 'rgba(5, 223, 114, 0.20)',
    border: 'rgba(5, 223, 114, 0.40)',
    text: '#05DF72',
  },
  medium: {
    bg: 'rgba(252, 211, 77, 0.20)',
    border: 'rgba(252, 211, 77, 0.40)',
    text: '#FDC700',
  },
  hard: {
    bg: 'rgba(255, 137, 4, 0.20)',
    border: 'rgba(255, 137, 4, 0.40)',
    text: '#FF8904',
  },
};

export const LIBRARY_ITEMS: ReadonlyArray<LibraryItem> = [
  // Poems
  {
    id: 'p-vatan',
    category: 'poems',
    title: 'Vatan',
    author: 'Abdulla Oripov',
    emoji: '🌅',
    duration: '5 daq',
    difficulty: 'easy',
    progress: 0.6,
  },
  {
    id: 'p-ona',
    category: 'poems',
    title: 'Ona',
    author: 'Hamid Olimjon',
    emoji: '👩',
    duration: '4 daq',
    difficulty: 'easy',
  },
  {
    id: 'p-bahor',
    category: 'poems',
    title: 'Bahor',
    author: 'Zulfiya',
    emoji: '🌸',
    duration: '6 daq',
    difficulty: 'medium',
  },
  {
    id: 'p-mehnat',
    category: 'poems',
    title: 'Mehnat',
    author: 'Abdulla Oripov',
    emoji: '🌾',
    duration: '5 daq',
    difficulty: 'medium',
  },
  // Stories
  {
    id: 's-zumrad',
    category: 'stories',
    title: 'Zumrad va Qimmat',
    emoji: '🐦',
    duration: '12 daq',
    difficulty: 'easy',
  },
  {
    id: 's-ur-tegirmon',
    category: 'stories',
    title: 'Ur tegirmon',
    emoji: '🌾',
    duration: '8 daq',
    difficulty: 'easy',
  },
  {
    id: 's-chol',
    category: 'stories',
    title: 'Chol va anjir',
    emoji: '🌳',
    duration: '10 daq',
    difficulty: 'medium',
  },
  // Lessons
  {
    id: 'l-math-mult',
    category: 'lessons',
    title: "Matematika: Ko'paytirish",
    emoji: '✖️',
    duration: '15 daq',
    difficulty: 'medium',
    progress: 0.4,
  },
  {
    id: 'l-math-div',
    category: 'lessons',
    title: "Matematika: Bo'lish",
    emoji: '➗',
    duration: '15 daq',
    difficulty: 'medium',
  },
  {
    id: 'l-geo-rivers',
    category: 'lessons',
    title: "O'zbekiston daryolari",
    emoji: '🏞',
    duration: '10 daq',
    difficulty: 'easy',
  },
  // Language
  {
    id: 'lng-en-greet',
    category: 'language',
    title: 'Inglizcha salomlashish',
    emoji: '🇬🇧',
    duration: '7 daq',
    difficulty: 'easy',
  },
  {
    id: 'lng-en-family',
    category: 'language',
    title: 'Inglizcha: Oila',
    emoji: '👨‍👩‍👧',
    duration: '8 daq',
    difficulty: 'easy',
  },
  // DTM
  {
    id: 'd-math-1',
    category: 'dtm',
    title: 'Matematika: 1-test',
    emoji: '🧮',
    duration: '30 daq',
    difficulty: 'hard',
  },
  {
    id: 'd-physics-1',
    category: 'dtm',
    title: 'Fizika: Mexanika',
    emoji: '⚛️',
    duration: '40 daq',
    difficulty: 'hard',
  },
];

export const CONTINUE_ITEMS = LIBRARY_ITEMS.filter(
  (i) => i.progress !== undefined && i.progress > 0,
);

export function itemsByCategory(category: LibraryCategory): LibraryItem[] {
  return LIBRARY_ITEMS.filter((i) => i.category === category);
}
