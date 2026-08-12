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

// Word characters for the three languages the app ships in. Written as an
// explicit class rather than /[\p{L}\p{N}]+/u ON PURPOSE: React Native runs
// on Hermes, and a Unicode property escape that Hermes does not implement
// throws where the regex is EVALUATED, not where the file is imported. This
// regex used to sit inside tokenize(), which the chat screen calls on the
// send path — so the throw surfaced as "Xabar yuborilmadi. Internetni
// tekshiring." and no message ever left the phone. Nothing else in the app
// uses \p{...}, so there was no prior evidence it was safe here.
//
// Text is lowercased before matching, so a-z covers Latin; the Ѐ-ӿ range is
// U+0400–U+04FF, i.e. Cyrillic (Uzbek ў қ ғ ҳ and Russian alike); the four
// apostrophes are the forms Uzbek uses in o', g', ta'lim across keyboards.
const WORD_RE = /[a-z0-9Ѐ-ӿ'’ʻʼ]+/g;

/** Lowercased, punctuation-stripped significant words — stopwords and short tokens dropped. */
export function tokenize(text: string): string[] {
  // Fresh lastIndex each call — WORD_RE is /g and module-level, so a shared
  // instance would resume mid-string on the next call.
  WORD_RE.lastIndex = 0;
  const words = text.toLowerCase().match(WORD_RE) ?? [];
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

// The app's three languages all inflect nouns, so the same concept rarely
// arrives as the same exact token, and a child asking "Algebrani tushuntirib
// ber" about a memory that says "algebra bo'yicha qiynaladi" is exactly the
// case retrieval must not miss. Absent a real stemmer, two tokens sharing
// their first MIN_STEM_LEN characters are treated as one concept.
//
// A COMMON prefix, not "one starts with the other": Uzbek is agglutinative
// and appends ("algebra" → "algebrani", which either rule catches), but
// Russian is fusional and REPLACES the ending — "математика" → "математику"
// differ in the final letter, so neither is a prefix of the other and the
// stricter rule scored them as unrelated.
//
// Below the threshold tokens must match exactly, so short unrelated words
// ("bola" vs "bo'lim") cannot collide on a coincidental prefix.
const MIN_STEM_LEN = 5;

function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && a[i] === b[i]) i += 1;
  return i;
}

function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < MIN_STEM_LEN || b.length < MIN_STEM_LEN) return false;
  return commonPrefixLength(a, b) >= MIN_STEM_LEN;
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
