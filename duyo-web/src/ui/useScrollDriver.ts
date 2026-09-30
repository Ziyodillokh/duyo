/**
 * Scroll → page ground, progress bar, chrome tone and active section.
 *
 * One passive listener, throttled to one requestAnimationFrame, writing
 * styles straight onto the DOM. React only hears about it when the active
 * section changes — a handful of times per visit, not sixty times a second.
 * Each write is skipped when its value has not changed since the last frame,
 * so a still page does no work at all.
 *
 * Darkness comes from scene/timeline.ts, the same function the 3D scene
 * reads, so the ground and the galaxy can never disagree about how deep into
 * space the visitor is. The colour at that darkness comes from ground.ts.
 *
 * Where the ground changes between light and dark, neither navy nor white
 * copy reads on the colours in between, so each side's copy fades out
 * before the middle of the change and back in after it (--gap-fade).
 *
 * Faded copy is still laid out where it stood, links and all, so it has to
 * be taken out of reach as well as out of sight: below half opacity it stops
 * taking the pointer (data-faded), and keyboard focus landing on it brings
 * its section back to where the copy is whole.
 */

import { useEffect, type RefObject } from 'react';
import { PALETTE } from '../scene/contract';
import { between, darknessAt, ramp, readScroll } from '../scene/timeline';
import { SECTIONS } from '../content';
import { groundAt, groundStep } from './ground';
import { DARK_CHROME_AT } from './theme';

interface DriverRefs {
  ground: RefObject<HTMLDivElement | null>;
  progress: RefObject<HTMLDivElement | null>;
}

/** Tops of each section in document coordinates. Re-read on resize only. */
function measureTops(): number[] {
  return SECTIONS.map((s) => {
    const el = document.getElementById(s.id);
    return el ? el.getBoundingClientRect().top + window.scrollY : 0;
  });
}

/**
 * Copy opacity through a gap, by k (0 at the outgoing section's hold, 1 at
 * the incoming one's). Fully out for the middle of a light↔dark change.
 */
const OUT_FROM = 0.1;
const OUT_BY = 0.35;
const IN_FROM = 0.65;
const IN_BY = 0.9;
/** Opacity steps: coarse enough that tiny scroll jitter never restyles. */
const FADE_STEPS = 50;
/**
 * Below this the copy stops taking the pointer. Not 0: at a tenth of its
 * opacity a link is as good as invisible, and a tap there is meant for the
 * phone or the robot behind it — following the link downloads the APK.
 */
const HIT_FROM = 0.5;

/**
 * Phone width only: the copy sits under the subject, so a section scrolling
 * away slides its words up across the phone and robot. It fades out over
 * this much of a screen of upward travel instead of ghosting over them.
 */
const PHONE_MAX_WIDTH = 767;
const LEAVE_FROM = 0.08;
const LEAVE_BY = 0.26;

function leaveFade(top: number, isLast: boolean): number {
  if (isLast || window.innerWidth > PHONE_MAX_WIDTH) return 1;
  const up = (window.scrollY - top) / window.innerHeight;
  return 1 - ramp(up, LEAVE_FROM, LEAVE_BY);
}

function gapFade(i: number, a: number, b: number, k: number): number {
  if (SECTIONS[a].theme === SECTIONS[b].theme) return 1;
  if (i === a) return 1 - ramp(k, OUT_FROM, OUT_BY);
  if (i === b) return ramp(k, IN_FROM, IN_BY);
  return 1;
}

/** How much of section i's copy shows at scroll position p, 0 to 1. */
function fadeAt(i: number, p: number, tops: number[]): number {
  const { a, b, k } = between(p);
  return Math.min(gapFade(i, a, b, k), leaveFade(tops[i], i === tops.length - 1));
}

/** Whether all of el is on screen, so focusing it will not scroll. */
function isInView(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= window.innerHeight;
}

/**
 * The scroll position that shows a focused control whole and at full
 * opacity: its section's top, the hold, unless the control would sit below
 * the fold there (a section taller than a landscape phone's screen) — then
 * only as much further as it takes.
 */
function holdFor(target: Element, top: number): number {
  const bottom = target.getBoundingClientRect().bottom + window.scrollY;
  return Math.max(top, bottom - window.innerHeight);
}

/** The last section whose top has passed the middle of the viewport. */
function activeIndex(tops: number[]): number {
  const probe = window.scrollY + window.innerHeight * 0.5;
  let idx = 0;
  for (let i = 0; i < tops.length; i += 1) {
    if (tops[i] <= probe) idx = i;
  }
  return idx;
}

/**
 * A shared link like /#xavfsizlik: the browser looks for the anchor before
 * React has rendered it, finds nothing, and stays at the top. Honour it once
 * the sections exist — instantly, since arriving is not a journey.
 */
function honourInitialHash(): void {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id || !SECTIONS.some((s) => s.id === id)) return;
  const el = document.getElementById(id);
  if (!el) return;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'instant' });
}

export function useScrollDriver(refs: DriverRefs, onActive: (index: number) => void): void {
  // Mount only: a later re-run of the driver must never pull the visitor back.
  useEffect(honourInitialHash, []);

  useEffect(() => {
    const root = document.documentElement;
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    let tops = measureTops();
    const findSections = () => SECTIONS.map((sec) => document.getElementById(sec.id));
    let sectionEls = findSections();
    const lastFade = SECTIONS.map(() => -1);
    let raf = 0;
    let lastStep = -1;
    let lastProgress = -1;
    let lastDark: boolean | null = null;
    let lastActive = -1;
    let lastP = -1;

    const frame = () => {
      raf = 0;
      const p = readScroll();
      // Nothing below depends on anything but p and the measured layout.
      if (p === lastP) return;
      lastP = p;
      const darkness = darknessAt(p);

      const step = groundStep(darkness);
      if (step !== lastStep && refs.ground.current) {
        const colour = groundAt(step);
        refs.ground.current.style.backgroundColor = colour;
        // The phone-width scrim behind the copy matches the ground exactly,
        // so it never shows as a box while the ground is changing.
        root.style.setProperty('--ground', colour);
        lastStep = step;
      }

      for (let i = 0; i < sectionEls.length; i += 1) {
        const f = Math.round(fadeAt(i, p, tops) * FADE_STEPS) / FADE_STEPS;
        const el = sectionEls[i];
        if (f !== lastFade[i] && el) {
          el.style.setProperty('--gap-fade', String(f));
          // page.css: faded copy stops taking the pointer.
          el.toggleAttribute('data-faded', f < HIT_FROM);
          lastFade[i] = f;
        }
      }

      // Quantised to 1/1000 so sub-pixel scroll jitter does not restyle.
      const q = Math.round(p * 1000) / 1000;
      if (q !== lastProgress && refs.progress.current) {
        refs.progress.current.style.transform = `scaleX(${q})`;
        lastProgress = q;
      }

      const isDark = darkness > DARK_CHROME_AT;
      if (isDark !== lastDark) {
        root.dataset.ground = isDark ? 'dark' : 'light';
        themeMeta?.setAttribute('content', isDark ? PALETTE.space : PALETTE.paper);
        lastDark = isDark;
      }

      const idx = activeIndex(tops);
      if (idx !== lastActive) {
        lastActive = idx;
        onActive(idx);
      }
    };

    const schedule = () => {
      if (raf === 0) raf = requestAnimationFrame(frame);
    };
    const remeasure = () => {
      tops = measureTops();
      sectionEls = findSections();
      lastFade.fill(-1);
      lastP = -1;
      schedule();
    };

    // Keyboard focus on faded copy. Shift+Tab back to the hero from the
    // bottom of the page and the browser scrolls the link only as far as it
    // takes to show its box — at phone width that is where the hero has
    // already faded out, so the focused link and its ring are both invisible
    // (WCAG 2.4.7) and Enter follows a link nobody can see. Take the section
    // to its hold instead. Instant, reduced motion or not: the browser's own
    // focus scroll is a jump too, and a smooth one would race it. A click or
    // a tap also focuses a link, but those land only on copy that shows
    // (data-faded), so only keyboard focus (:focus-visible) is handled.
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (!(target instanceof Element) || !target.matches(':focus-visible')) return;
      if (!target.closest('.copy')) return;
      const i = sectionEls.findIndex((el) => el?.contains(target) ?? false);
      if (i < 0) return;
      if (isInView(target) && fadeAt(i, readScroll(), tops) >= 1) return;
      window.scrollTo({ top: holdFor(target, tops[i]), behavior: 'instant' });
    };

    // Web fonts and the lazy scene can change the document's height after
    // mount; the section tops have to follow or the active marker drifts.
    const ro = new ResizeObserver(remeasure);
    ro.observe(document.body);

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', remeasure, { passive: true });
    document.addEventListener('focusin', onFocusIn);
    schedule();

    return () => {
      if (raf !== 0) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', remeasure);
      document.removeEventListener('focusin', onFocusIn);
      delete root.dataset.ground;
      root.style.removeProperty('--ground');
    };
  }, [refs.ground, refs.progress, onActive]);
}
