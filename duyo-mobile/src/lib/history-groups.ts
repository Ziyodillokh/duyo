import { type ConversationSummary } from '@/api/endpoints/conversations';

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

export const BUCKET_LABELS: Record<HistoryBucket, string> = {
  today: 'Bugun',
  yesterday: 'Kecha',
  this_week: 'Shu hafta',
  this_month: 'Shu oy',
  older: 'Oldinroq',
};

const BUCKET_ORDER: HistoryBucket[] = [
  'today',
  'yesterday',
  'this_week',
  'this_month',
  'older',
];

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
// ICU's `uz` data does not always agree with.
const WEEKDAYS_SHORT = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Juma', 'Shan'];
const MONTHS_SHORT = [
  'yan', 'fev', 'mar', 'apr', 'may', 'iyn',
  'iyl', 'avg', 'sen', 'okt', 'noy', 'dek',
];

/**
 * A compact "when" for one row: `14:30`, `Kecha`, `Chor`, `12 mar`.
 *
 * Lives next to `bucketFor` on purpose — both measure from local midnight, so
 * a row can never read "Kecha" under a "Bugun" header. Kept short because it
 * sits at the end of a title line and must never be what wraps it.
 */
export function shortWhen(iso: string, now: Date = new Date()): string {
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
  if (when >= today - day) return 'Kecha';
  // Weekday names only stay unambiguous for six days back; on the seventh,
  // "Chor" would mean either this Wednesday or last one.
  if (when >= today - 6 * day) return WEEKDAYS_SHORT[then.getDay()];
  return `${then.getDate()} ${MONTHS_SHORT[then.getMonth()]}`;
}

export interface HistorySection {
  bucket: HistoryBucket;
  title: string;
  data: ConversationSummary[];
}

/**
 * Sections for a SectionList, in recency order, with empty buckets dropped.
 * Input order is preserved inside each bucket — the API already sorts by
 * last activity.
 */
export function groupConversations(
  conversations: readonly ConversationSummary[],
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
    title: BUCKET_LABELS[bucket],
    data: byBucket.get(bucket)!,
  }));
}
