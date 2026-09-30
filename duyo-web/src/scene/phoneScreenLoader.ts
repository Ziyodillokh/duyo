/**
 * Fetches and decodes the app captures for the phone's screen (phoneScreen.ts).
 *
 * The screen says, whenever the visible screens change, which captures it
 * wants decoded and in what order of urgency: the ones on display first, then
 * the neighbouring sections'. Those load at most two at a time in that order
 * — on a slow phone network the frame the visitor is looking at must not
 * queue behind four others. Everything else is let go, so only about three
 * sections' worth of decoded pixels are held at once (a capture is 4 MB
 * decoded); their bytes stay in the HTTP cache, warmed in the background, so
 * coming back to a section re-decodes without downloading again.
 *
 * A capture that fails is retried with a backoff; one that still fails is
 * tried again the next time it is wanted after a cool-down, or at once when
 * the browser comes back online — a request dropped on a train must not
 * leave a blank screen for the rest of the visit.
 */

export type Shot = HTMLImageElement;

export interface Loader<N extends string> {
  /** The decoded capture, or null while it is not. */
  get(name: N): Shot | null;
  /** Keep these decoded, most urgent first, and let every other capture go. */
  want(names: readonly N[]): void;
  dispose(): void;
}

/** Two at a time: enough to fill a fast link, few enough to keep order on a slow one. */
const CONCURRENCY = 2;
const RETRIES = 2;
const RETRY_MS = 1500;
/** After the retries, how long before a failed capture is asked for again. */
const COOL_DOWN_MS = 10_000;

interface Entry {
  shot: Shot | null;
  loading: Shot | null;
  tries: number;
  /** performance.now() before which it is not started again. */
  retryAt: number;
}

export function createLoader<N extends string>(
  srcs: Readonly<Record<N, string>>,
  onChange: (name: N) => void,
): Loader<N> {
  const names = Object.keys(srcs) as N[];
  const entries = new Map<N, Entry>(names.map((n) => [n, { shot: null, loading: null, tries: 0, retryAt: 0 }]));
  const entry = (n: N): Entry => {
    const e = entries.get(n);
    if (!e) throw new Error(`phoneScreen: unknown capture ${n}`);
    return e;
  };
  let wanted: readonly N[] = [];
  let inflight = 0;
  let disposed = false;
  const timers = new Set<number>();
  const warmed = new Set<N>();
  const warmers = new Set<Shot>();

  const later = (ms: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      pump();
    }, ms);
    timers.add(id);
  };

  const settle = (n: N, img: Shot, ok: boolean) => {
    const e = entry(n);
    if (e.loading !== img) return; // let go, or disposed, while it loaded
    e.loading = null;
    inflight--;
    if (ok) {
      e.shot = img;
      e.tries = 0;
      onChange(n);
    } else if (++e.tries <= RETRIES) {
      e.retryAt = performance.now() + RETRY_MS * e.tries;
      later(RETRY_MS * e.tries);
    } else {
      e.tries = 0;
      e.retryAt = performance.now() + COOL_DOWN_MS;
      later(COOL_DOWN_MS); // still wanted then? try again
    }
    pump();
  };

  const start = (n: N) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = srcs[n];
    entry(n).loading = img;
    inflight++;
    img.decode().then(
      () => settle(n, img, true),
      // decode() can reject for an image that did load; trust the pixels.
      () => settle(n, img, img.complete && img.naturalWidth > 0),
    );
  };

  /** With every wanted capture in, fetch one more into the HTTP cache: bytes only, never held. */
  const warm = () => {
    const next = names.find((n) => !warmed.has(n) && !wanted.includes(n));
    if (!next) return;
    warmed.add(next);
    const img = new Image();
    img.fetchPriority = 'low';
    img.onload = img.onerror = () => {
      warmers.delete(img);
      pump();
    };
    warmers.add(img);
    img.src = srcs[next];
  };

  /** Start what is wanted and due, in order, up to CONCURRENCY at once. */
  function pump(): void {
    if (disposed) return;
    const now = performance.now();
    for (const n of wanted) {
      if (inflight >= CONCURRENCY) return;
      const e = entry(n);
      if (!e.shot && !e.loading && now >= e.retryAt) start(n);
    }
    if (inflight === 0 && warmers.size === 0) warm();
  }

  const onOnline = () => {
    entries.forEach((e) => (e.retryAt = 0));
    pump();
  };
  window.addEventListener('online', onOnline);

  return {
    get: (n) => entry(n).shot,
    want(list) {
      wanted = list;
      for (const [n, e] of entries) {
        if (list.includes(n)) continue;
        if (e.loading) {
          e.loading.removeAttribute('src'); // nobody is waiting for it now
          e.loading = null;
          inflight--;
        }
        if (e.shot) {
          e.shot = null;
          onChange(n);
        }
      }
      pump();
    },
    dispose() {
      disposed = true;
      window.removeEventListener('online', onOnline);
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
      for (const e of entries.values()) {
        e.loading?.removeAttribute('src');
        e.loading = null;
        e.shot = null;
      }
      warmers.forEach((img) => img.removeAttribute('src'));
      warmers.clear();
    },
  };
}
