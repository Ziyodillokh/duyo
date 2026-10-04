/**
 * Which layout the page is in, for the code that has to agree with page.css.
 *
 * Stacked: the copy is a caption pinned to the foot of the screen and the
 * subject is framed in the band above it — a phone held upright, or any
 * screen under 560px. A phone held sideways is wide and short: a caption
 * there would leave the subject a sliver, so it gets the side-by-side layout
 * a wider screen has. page.css repeats this query; keep the two in step.
 */
export const STACKED_MEDIA = '(max-width: 767px) and (orientation: portrait), (max-width: 559px)';

/** At or below this small-viewport height a stacked caption drops the safety facts. */
const SHORT_SVH_PX = 600;
/** A pinned caption must leave the picture at least this share of the screen under the nav. */
const MIN_PICTURE = 0.15;
/**
 * Room kept under a pinned caption's last line: its bottom padding at most
 * (page.css), which is 2rem, or 1rem over the home indicator's ~34px inset
 * on an iPhone with its bars away.
 */
const CAPTION_FOOT_PX = 50;

let stackedQuery: MediaQueryList | null = null;

/** Read per scroll frame, so the query is made once and only its answer is asked after. */
export function isStacked(): boolean {
  stackedQuery ??= window.matchMedia(STACKED_MEDIA);
  return stackedQuery.matches;
}

/** The stacked captions have gone back into the page (see arrangeCaptions). */
export const captionsFlow = (): boolean => document.documentElement.dataset.captions === 'flow';

/**
 * The screen's height with the browser's bars showing (100svh), in px:
 * steady while the bars slide in and out, unlike innerHeight. Read when the
 * page is measured, not per frame.
 */
export function smallViewportHeight(): number {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  const h = probe.getBoundingClientRect().height;
  probe.remove();
  return h > 0 ? h : window.innerHeight;
}

/** A caption's height from its first line to its last, by layout: transforms and padding aside. */
function captionHeight(copy: Element): number {
  let top = Infinity;
  let bottom = -Infinity;
  for (const el of copy.children) {
    if (!(el instanceof HTMLElement) || el.offsetHeight === 0) continue;
    top = Math.min(top, el.offsetTop);
    bottom = Math.max(bottom, el.offsetTop + el.offsetHeight);
  }
  return bottom > top ? bottom - top : 0;
}

/**
 * Settles how the stacked captions sit, by the small viewport, so the
 * browser's bars sliding never flip it (a height media query could):
 *
 *   data-short           a short screen — the safety facts give way
 *   data-captions=flow   a caption would not fit pinned: page zoom or a
 *                        large text setting. A fixed caption taller than
 *                        the screen could never be read whole, so every
 *                        caption goes back into the page and scrolls.
 *
 * Judged by the captions' own heights, which pinning does not change, so
 * the choice cannot feed back on itself. Called on mount and whenever the
 * page is measured again.
 */
export function arrangeCaptions(): void {
  const root = document.documentElement;
  const stacked = isStacked();
  const svh = smallViewportHeight();
  const short = stacked && svh <= SHORT_SVH_PX;
  if (short !== root.hasAttribute('data-short')) root.toggleAttribute('data-short', short);
  if (!stacked) {
    if (captionsFlow()) delete root.dataset.captions;
    return;
  }
  const navBottom = document.querySelector('header nav')?.getBoundingClientRect().bottom ?? 60;
  const room = svh * (1 - MIN_PICTURE) - navBottom - CAPTION_FOOT_PX;
  const captions = document.querySelectorAll('.page-section:not([data-final]) .copy');
  const tallest = Math.max(0, ...Array.from(captions, captionHeight));
  // Written only on a change: each write restyles the whole document.
  const flow = tallest > room;
  if (flow && !captionsFlow()) root.dataset.captions = 'flow';
  else if (!flow && captionsFlow()) delete root.dataset.captions;
}
