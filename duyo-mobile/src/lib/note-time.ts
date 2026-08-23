/**
 * When a note was last touched, in the form the Miya page shows it:
 * `Bugun 08:30` · `Kecha 21:15` · `2 kun oldin` · `12 mar`.
 *
 * Today and yesterday keep their clock time because that is the detail that
 * distinguishes two notes from the same day. Anything older loses it — "3 kun
 * oldin 14:22" is precision nobody reads, and it makes the column ragged.
 *
 * Measured from local midnight, not elapsed hours, so a note written at 23:50
 * still says "Kecha" when read at 00:10 rather than "Bugun".
 */

const MONTHS_SHORT = [
  'yan', 'fev', 'mar', 'apr', 'may', 'iyn',
  'iyl', 'avg', 'sen', 'okt', 'noy', 'dek',
];

function startOfLocalDay(d: Date): number {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

export function noteTimeLabel(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const when = then.getTime();
  if (Number.isNaN(when)) return '';

  const hh = String(then.getHours()).padStart(2, '0');
  const mm = String(then.getMinutes()).padStart(2, '0');

  const today = startOfLocalDay(now);
  const day = 86_400_000;

  if (when >= today) return `Bugun ${hh}:${mm}`;
  if (when >= today - day) return `Kecha ${hh}:${mm}`;

  const daysAgo = Math.round((today - startOfLocalDay(then)) / day);
  // Past a week "6 kun oldin" stops being easier to place than a date.
  if (daysAgo <= 6) return `${daysAgo} kun oldin`;

  return `${then.getDate()} ${MONTHS_SHORT[then.getMonth()]}`;
}
