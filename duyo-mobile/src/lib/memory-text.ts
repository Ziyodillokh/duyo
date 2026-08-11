/**
 * Shared tokenizer for the local memory system — used by both
 * memory-retrieval.ts (query → relevant memories) and memory-graph.ts
 * (memory → memory relationships). Deliberately simple: keyword overlap
 * over embeddings, because there is no on-device model to produce
 * embeddings from, and a child's memory set (tens to low hundreds of rows)
 * is far too small to need one.
 */

// Short, curated stopword list across the app's three languages (uz/ru/en).
// Not exhaustive linguistics — just common function words that would
// otherwise "link" every memory to every other memory through words like
// "va" or "men".
const STOPWORDS = new Set([
  // Uzbek
  'va', 'men', 'sen', 'u', 'bu', 'bir', 'ham', 'lekin', 'uchun', 'bilan',
  'kabi', 'juda', 'emas', 'yoki', 'edi', 'bor', 'yoq', "yo'q", 'qanday',
  'nima', 'qachon', 'qayerda', 'nega', 'menga', 'senga', 'unga', 'meni',
  'seni', 'uni', 'о', 'da', 'ni', 'ning', 'ga', 'dan',
  // Russian
  'и', 'в', 'на', 'я', 'ты', 'он', 'она', 'это', 'что', 'как', 'но', 'для',
  'с', 'у', 'мне', 'меня', 'не',
  // English
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'is', 'am', 'are',
  'i', 'you', 'he', 'she', 'it', 'my', 'me', 'to', 'of', 'in',
]);

const MIN_TOKEN_LEN = 3;

/** Lowercased, punctuation-stripped significant words — stopwords and short tokens dropped. */
export function tokenize(text: string): string[] {
  const words = (text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []) as string[];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    if (w.length < MIN_TOKEN_LEN || STOPWORDS.has(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

// Uzbek is agglutinative — "algebra" and "algebrani" ("algebra"+accusative
// -ni) are the same concept but never the same exact token, and a child
// asking "Algebrani tushuntirib ber" about a memory that says "algebra
// bo'yicha qiynaladi" is exactly the case retrieval must not miss. Absent a
// real stemmer, a shared prefix of MIN_STEM_LEN+ characters is treated as a
// match — cheap, dependency-free, and right often enough for short nouns.
// Below the threshold two tokens must match exactly, so short unrelated
// words ("bor" vs "bola") don't false-positive on a coincidental prefix.
const MIN_STEM_LEN = 5;

function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < MIN_STEM_LEN || b.length < MIN_STEM_LEN) return false;
  return a.startsWith(b) || b.startsWith(a);
}

/** Count of tokens shared between two token sets — the overlap score used throughout. */
export function overlapScore(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  let score = 0;
  for (const ta of a) {
    if (b.some((tb) => tokensMatch(ta, tb))) score += 1;
  }
  return score;
}
