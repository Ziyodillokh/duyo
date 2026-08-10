/**
 * Memory Guard — the on-device, deterministic gate a memory candidate must
 * pass BEFORE the child ever sees a "buni eslab qolaymi?" consent prompt.
 *
 * This is deliberately separate from, and does not trust, the server-side
 * extractor prompt (MEMORY_CANDIDATE_EXTRACT_PROMPT in duyo-backend). Per
 * the architecture principle "LLM memory'ning egasi bo'lmasin" — an LLM can
 * misjudge or be prompt-injected via the child's own message; a regex/rule
 * classifier cannot be talked out of its rules. Two independent layers:
 * the backend prompt is told never to surface sensitive data (defense 1),
 * and this Guard re-checks everything that reaches the device regardless of
 * source — extracted from chat OR typed by hand into "Mening Xotiram"
 * (defense 2, authoritative).
 *
 * False positives (blocking something harmless) are the safe failure mode
 * here — a missed "remember this" is a minor annoyance; a saved phone
 * number is a privacy incident. Every pattern below is tuned to over-block.
 */

export type GuardVerdict = 'safe' | 'sensitive';

export interface GuardResult {
  verdict: GuardVerdict;
  /** Machine-readable reason tags, for the "nega bloklandi?" UI hint and for tests. */
  reasons: string[];
}

// 7+ digit runs (with optional spaces/dashes/parens/leading +) catch both
// Uzbek phone numbers (+998 90 123 45 67) and most other phone formats.
// Deliberately loose: a false hit on a long non-phone number just means
// DUYO plays it safe and skips saving.
const PHONE_LIKE = /(\+?\d[\d\s\-()]{5,}\d)/;

// 12+ digit runs (spaces optional) — payment card numbers.
const CARD_LIKE = /\b(?:\d[ -]?){12,19}\b/;

const EMAIL_LIKE = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;

// Address / location vocabulary (uz + ru). Paired with a digit elsewhere in
// the text by the rule below — the digit is what turns "men ko'chada
// o'ynayman" (harmless) into "Amir Temur ko'chasi 24-uy" (an address).
const ADDRESS_WORDS =
  /(ko'cha|kocha|кўча|mahalla|kvartira|tuman|viloyat|индекс|manzil(im)?|адрес|улиц)/i;

// Numbered dwelling forms, which the vocabulary list above misses on its own.
// Uzbek puts the number FIRST and hyphenates — "24-uy", "12-kvartira",
// "5-dom" — so a word-then-number pattern never fires on the most common way
// an Uzbek child would actually write their address. Both orders and the
// abbreviated "kv." / "кв." forms are covered.
const _DWELLING = "uy|xonadon|kvartira|kv|dom|уй|дом|кв";

// `\b` is useless here: JavaScript's \w is ASCII-only, so there is no word
// boundary before a Cyrillic letter and /\bдом/ never matches. An explicit
// "not a letter or digit" class covers Latin, Cyrillic and digits alike.
// Written without lookbehind or \p{...} so the pattern behaves identically
// on Hermes as it does under Node.
const _EDGE = "[^a-z0-9\\u0400-\\u04ff]";

// "24-uy", "12-kvartira", "5-dom" — number first (Uzbek).
const DWELLING_NUM_FIRST = new RegExp(`\\d+\\s*-?\\s*(${_DWELLING})($|${_EDGE})`, 'i');
// "дом 15", "kv. 12", "uy 7" — word first (Russian, and abbreviations).
const DWELLING_WORD_FIRST = new RegExp(`(^|${_EDGE})(${_DWELLING})\\.?\\s*\\d+`, 'i');

const CREDENTIAL_WORDS =
  /(parol(im)?|пароль|password|pin[\s-]?kod|pin[\s-]?code|login(im)?|maxfiy kalit|api[\s-]?key|token)/i;

const PAYMENT_WORDS =
  /(karta raqam|card number|cvv|cvc|karta kodi|to'lov kartasi|hisob raqam(im)?|счёт)/i;

// "hozir ... turibman/man" + a place name is a live-location statement, not
// a durable fact — distinct from "Toshkentda yashayman" which the server
// prompt already treats as profile-safe (a city is not a precise location).
const LIVE_LOCATION_WORDS = /(hozir .*(turibman|man)\b|прямо сейчас .*(нахожусь))/i;

interface GuardRule {
  reason: string;
  test: (text: string) => boolean;
}

const RULES: GuardRule[] = [
  { reason: 'phone_number', test: (t) => PHONE_LIKE.test(t) },
  { reason: 'card_number', test: (t) => CARD_LIKE.test(t) },
  { reason: 'email', test: (t) => EMAIL_LIKE.test(t) },
  {
    reason: 'address',
    test: (t) =>
      (ADDRESS_WORDS.test(t) && /\d/.test(t)) ||
      DWELLING_NUM_FIRST.test(t) ||
      DWELLING_WORD_FIRST.test(t),
  },
  { reason: 'credential', test: (t) => CREDENTIAL_WORDS.test(t) },
  { reason: 'payment', test: (t) => PAYMENT_WORDS.test(t) },
  { reason: 'live_location', test: (t) => LIVE_LOCATION_WORDS.test(t) },
];

/**
 * Classify one piece of memory content (category is not consulted — the
 * TEXT is what could leak, regardless of which bucket the extractor filed
 * it under).
 */
export function screenMemoryContent(content: string): GuardResult {
  const text = content.trim();
  if (text.length === 0) {
    return { verdict: 'sensitive', reasons: ['empty'] };
  }
  const reasons = RULES.filter((rule) => rule.test(text)).map((rule) => rule.reason);
  return reasons.length > 0
    ? { verdict: 'sensitive', reasons }
    : { verdict: 'safe', reasons: [] };
}

/** Human-readable (Uzbek) hint for why something was blocked — best-effort, for UI only. */
export function describeGuardReasons(reasons: readonly string[]): string {
  const labels: Record<string, string> = {
    empty: "bo'sh matn",
    phone_number: 'telefon raqamiga oxshash',
    card_number: 'karta raqamiga oxshash',
    email: 'email manzil',
    address: 'manzilga oxshash',
    credential: 'parol/kalit so\'zga oxshash',
    payment: "to'lov ma'lumotiga oxshash",
    live_location: 'hozirgi joylashuvga oxshash',
  };
  return reasons.map((r) => labels[r] ?? r).join(', ');
}
