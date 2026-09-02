import type { TranslationKey } from '@/i18n';

/**
 * Which catalogue goals belong to which room.
 *
 * These rules MIRROR duyo-backend/src/duyo/services/groups.py — the server is
 * the authority (it decides membership and gates every group route), and this
 * copy exists only so the app can show a category tag beside a goal and list
 * the goals that would let a child into a room, without a round trip per goal.
 * Change one and change the other: a divergence here shows a child a door
 * that the server will not open.
 */
export type CategoryRule = (matchKey: string) => boolean;

/** Keyed by the server's category key. Order matters where a key could match
 *  two rules — "til" is checked before "talim" for the same reason there. */
export const CATEGORY_RULES: Record<string, CategoryRule> = {
  it: (k) => k.includes('dasturlash'),
  til: (k) => k.includes('ingliz') || k.includes('ielts'),
  talim: (k) => k.startsWith('textbook_') || k.startsWith('exam_'),
  kitoblar: (k) => k.startsWith('book_') || k === 'habit_har_kuni_kitob',
  sport: (k) => k.includes('sport'),
  sayohat: (k) => k.includes('sayohat'),
  ijod: (k) => k.includes('chizish') || k.includes('gitara'),
  rivoj: (k) => k.startsWith('habit_') || k.startsWith('skill_'),
};

/** Translation KEYS, not words: this table is built once at module load, so a
 *  finished label here could never follow a language switch. The screen that
 *  draws the tag resolves it with `t()` at render. */
export const CATEGORY_LABELS: Record<string, TranslationKey> = {
  it: 'goals.cat.it',
  til: 'goals.cat.language',
  talim: 'goals.cat.education',
  kitoblar: 'goals.cat.books',
  sport: 'goals.cat.sport',
  sayohat: 'goals.cat.travel',
  ijod: 'goals.cat.creativity',
  rivoj: 'goals.cat.selfDev',
};

/** Precedence order, matching the server's tuple. */
const ORDER = ['it', 'til', 'talim', 'kitoblar', 'sport', 'sayohat', 'ijod', 'rivoj'];

export function categoryOf(
  matchKey: string | null,
): { key: string; label: TranslationKey } | null {
  if (!matchKey) return null;
  for (const key of ORDER) {
    if (CATEGORY_RULES[key](matchKey)) return { key, label: CATEGORY_LABELS[key] };
  }
  return null;
}
