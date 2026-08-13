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
