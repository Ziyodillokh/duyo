/**
 * Copy rises into place as its section arrives.
 *
 * The hidden state is opt-in: `html.reveal-ready` is added before first paint
 * (layout effect), so without JavaScript — or if these hooks never run —
 * every word is simply visible. The `is-in` class toggles on the section
 * element directly; React does not re-render for it.
 *
 * Each section observes itself, so a section that remounts (hot reload, a
 * future conditional) is observed afresh instead of left invisible while an
 * observer watches its detached predecessor.
 *
 * A section re-arms only once it is entirely off screen, so returning to it
 * replays the entrance, but nothing ever fades out while it is being read.
 * Under prefers-reduced-motion page.css shows everything at rest.
 */

import { useLayoutEffect, type RefObject } from 'react';

const ENTER_RATIO = 0.3;

/** Once, on the page root: arm the hidden starting state. */
export function useRevealReady(): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add('reveal-ready');
    return () => root.classList.remove('reveal-ready');
  }, []);
}

/** Per section: add `is-in` on arrival, remove it once fully gone. */
export function useReveal(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio >= ENTER_RATIO) el.classList.add('is-in');
        else if (!e.isIntersecting) el.classList.remove('is-in');
      },
      { threshold: [0, ENTER_RATIO] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
}
