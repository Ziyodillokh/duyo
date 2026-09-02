import { type ConversationSummary } from '@/api/endpoints/conversations';
import { translate, type TranslateFn, type TranslationKey } from '@/i18n';
import { useLanguageStore } from '@/store/language';

/**
 * Group a history list by recency, the way a person remembers conversations:
 * "the one from this morning", "the one last week". A flat list of 40 rows
 * with timestamps is technically the same information and far harder to scan.
 *
 * Buckets are computed from local midnight, not from elapsed hours — a chat
 * at 23:50 yesterday belongs under "Kecha" at 00:10 today, not under "Bugun".
 */

export type HistoryBucket =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'older';

/**
 * Translation KEYS, not finished words.
 *
 * This table is built once at module evaluation, so a label written out here
 * would be frozen in whatever language the app happened to start in and no
 * language switch could ever move it. The caller resolves each key with its
 * own `t`, which is also what makes the switch redraw the list.
 */
export const BUCKET_LABELS: Record<HistoryBucket, TranslationKey> = {
  today: 'date.bucket.today',
  yesterday: 'date.bucket.yesterday',
  this_week: 'date.bucket.thisWeek',
  this_month: 'date.bucket.thisMonth',
  older: 'date.bucket.older',
};

const BUCKET_ORDER: HistoryBucket[] = [
  'today',
  'yesterday',
  'this_week',
  'this_month',
  'older',
];

/**
 * The translator for a caller that has not been threaded yet — the chat
 * drawer and the notifications list still call `shortWhen` with one argument.
 *
 * It reads the language at CALL time, never at module load, so those screens
 * are at least in the right language the next time anything redraws them.
 * Only a caller that passes its own `t` is guaranteed to redraw the moment
 * the child switches, which is why every call site in this feature does.
 */
const currentLanguageT: TranslateFn = (key, vars) =>
  translate(useLanguageStore.getState().language, key, vars);

function startOfLocalDay(d: Date): number {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

export function bucketFor(iso: string, now: Date = new Date()): HistoryBucket {
  const when = new Date(iso).getTime();
  const today = startOfLocalDay(now);
  const day = 86_400_000;

  if (when >= today) return 'today';
  if (when >= today - day) return 'yesterday';
  if (when >= today - 7 * day) return 'this_week';
  if (when >= today - 30 * day) return 'this_month';
  return 'older';
}

// Written out rather than taken from Intl: Hermes ships without full ICU on
// Android, so `toLocaleDateString('uz')` silently falls back to English on
// most devices. These are also simply the right Uzbek abbreviations, which
// ICU's `uz` data does not always agree with. Keys rather than words, for the
// same reason as BUCKET_LABELS. Sunday first, because `Date#getDay` is.
const WEEKDAYS_SHORT = [
  'date.weekdayShort.sun',
  'date.weekdayShort.mon',
  'date.weekdayShort.tue',
  'date.weekdayShort.wed',
  'date.weekdayShort.thu',
  'date.weekdayShort.fri',
  'date.weekdayShort.sat',
] as const satisfies readonly TranslationKey[];

const MONTHS_SHORT = [
  'date.monthShort.jan', 'date.monthShort.feb', 'date.monthShort.mar',
  'date.monthShort.apr', 'date.monthShort.may', 'date.monthShort.jun',
  'date.monthShort.jul', 'date.monthShort.aug', 'date.monthShort.sep',
  'date.monthShort.oct', 'date.monthShort.nov', 'date.monthShort.dec',
] as const satisfies readonly TranslationKey[];

/**
 * A compact "when" for one row: `14:30`, `Kecha`, `Chor`, `12 mar`.
 *
 * Lives next to `bucketFor` on purpose — both measure from local midnight, so
 * a row can never read "Kecha" under a "Bugun" header. Kept short because it
 * sits at the end of a title line and must never be what wraps it.
 */
export function shortWhen(
  iso: string,
  t: TranslateFn = currentLanguageT,
  now: Date = new Date(),
): string {
  const then = new Date(iso);
  const when = then.getTime();
  if (Number.isNaN(when)) return '';

  const today = startOfLocalDay(now);
  const day = 86_400_000;

  if (when >= today) {
    const hh = String(then.getHours()).padStart(2, '0');
    const mm = String(then.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  if (when >= today - day) return t('date.bucket.yesterday');
  // Weekday names only stay unambiguous for six days back; on the seventh,
  // "Chor" would mean either this Wednesday or last one.
  if (when >= today - 6 * day) return t(WEEKDAYS_SHORT[then.getDay()]);
  // The day-then-month order is a phrase, not a constant: it is right for
  // Uzbek and Russian and the wrong way round for some English readers.
  return t('date.dayMonth', {
    day: then.getDate(),
    month: t(MONTHS_SHORT[then.getMonth()]),
  });
}

export interface HistorySection {
  bucket: HistoryBucket;
  title: string;
  data: ConversationSummary[];
}

/**
 * Sections in recency order, with empty buckets dropped. Input order is
 * preserved inside each bucket — the API already sorts by last activity.
 *
 * `t` is threaded in rather than read from a store here so that the memo the
 * caller wraps this in has the language among its dependencies; a translator
 * fetched inside would leave the list in the old language until something
 * else invalidated it.
 */
export function groupConversations(
  conversations: readonly ConversationSummary[],
  t: TranslateFn,
  now: Date = new Date(),
): HistorySection[] {
  const byBucket = new Map<HistoryBucket, ConversationSummary[]>();
  for (const conv of conversations) {
    const bucket = bucketFor(conv.updated_at, now);
    const list = byBucket.get(bucket);
    if (list) list.push(conv);
    else byBucket.set(bucket, [conv]);
  }

  return BUCKET_ORDER.filter((b) => byBucket.get(b)?.length).map((bucket) => ({
    bucket,
    title: t(BUCKET_LABELS[bucket]),
    data: byBucket.get(bucket)!,
  }));
}
