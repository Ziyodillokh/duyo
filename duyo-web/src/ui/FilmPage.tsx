/**
 * A film page: the layer every DUYO page is built from — the home page's
 * film (App.tsx) and the robot page's (robot/RobotApp.tsx).
 *
 * Four strata, back to front:
 *
 *   ground   a fixed full-viewport colour: deep space, on every section.
 *            Written on scroll (useScrollDriver) from the darkness curve the
 *            3D reads, so a light section could come back without rewiring.
 *   scene    the page's <Scene/>, lazy — three.js is heavier than the rest of the page
 *            together, so the copy paints first and the scene arrives after.
 *   copy     the film's sections (film.ts); each leaves the opposite side
 *            empty for the scene's subject. <main> and every section ignore
 *            the pointer — only the copy blocks and the footer take it — so
 *            hovers and drags anywhere else fall through to the scene.
 *   chrome   progress bar, navbar, section rail.
 *
 * Every word and every link comes from the page's content. Every href is
 * real: the APK, the other pages, or an anchor to a section that exists.
 */

import { Component, Suspense, useCallback, useRef, useState } from 'react';
import type { ComponentType, LazyExoticComponent, ReactNode } from 'react';
import type { Section } from '../content';
import { Footer } from './Footer';
import type { FooterLink } from './Footer';
import { Navbar } from './Navbar';
import type { NavConfig } from './Navbar';
import { SectionBlock } from './SectionBlock';
import type { NextPage } from './SectionBlock';
import { SectionRail } from './SectionRail';
import { paletteVars } from './theme';
import { useRevealReady } from './useReveal';
import { useScrollDriver } from './useScrollDriver';
import './copy-extras.css';
import './page.css';
import './sideways.css';

export interface FilmPageProps {
  /** Which page this is, for the few styles that differ (sideways.css). */
  name: 'home' | 'robot';
  /** The film's sections — the same list film.ts was given. */
  sections: readonly Section[];
  /** The 3D layer, lazy: three.js is heavier than the rest of the page together. */
  Scene: LazyExoticComponent<ComponentType>;
  nav: NavConfig;
  footerLinks: readonly FooterLink[];
  /** Offered under the last section's call to action. */
  next?: NextPage;
}

/**
 * The page is complete without the scene. If its chunk fails to arrive (a
 * dropped connection, or a deploy that removed the file a cached page still
 * asks for) or it throws while rendering, React would otherwise unmount the
 * whole root — copy, nav and the download with it. This leaves the scene's
 * layer empty instead.
 */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

export function FilmPage({ name, sections, Scene, nav, footerLinks, next }: FilmPageProps) {
  const groundRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const onActive = useCallback((i: number) => setActiveIdx(i), []);
  useScrollDriver({ ground: groundRef, progress: progressRef }, onActive);
  useRevealReady();

  const activeId = sections[activeIdx]?.id ?? sections[0].id;
  const body = sections.slice(0, -1);
  const final = sections[sections.length - 1];

  // The root clips both ways: the copy's soft shade (page.css) reaches past
  // the footer, and on a short window it would make the page taller than one
  // screen per section and end the film early (timeline.ts).
  return (
    <div className="page-root relative overflow-clip" data-page={name} style={paletteVars}>
      <div
        ref={groundRef}
        className="fixed inset-0 z-0"
        // Space from the first paint: the driver only writes after mount.
        style={{ backgroundColor: 'var(--c-space)' }}
        aria-hidden="true"
      />

      {/* Receives the drags that turn the phone. pan-y: a horizontal drag
          reaches the scene on touch instead of the browser cancelling it,
          while vertical scrolling and pinch-zoom stay native. As tall as the
          screen with a phone's browser bars tucked away (100lvh), so the
          bars sliding in and out never resize the canvas mid-scroll. */}
      <div className="scene-layer fixed inset-x-0 top-0 z-[1] [touch-action:pan-y_pinch-zoom]">
        <SceneBoundary>
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </SceneBoundary>
      </div>

      <div
        ref={progressRef}
        className="progress pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px]"
        aria-hidden="true"
      />
      <Navbar sections={sections} activeId={activeId} {...nav} />
      <SectionRail sections={sections} activeId={activeId} />

      <main className="pointer-events-none relative z-10">
        {body.map((s, i) => (
          <SectionBlock key={s.id} section={s} isHero={i === 0} isFinal={false} />
        ))}
        {/* The last section and the footer share one viewport, so the page is
            exactly one screen per section tall and each section's scroll
            position lands where timeline.ts expects its centre. svh, not vh:
            it equals innerHeight with a mobile URL bar showing. At phone
            width the last section takes the whole screen and the footer
            comes after it; readScroll ends the film at that section. */}
        <div className="flex min-h-svh flex-col">
          <SectionBlock section={final} isHero={false} isFinal next={next} />
          <Footer links={footerLinks} />
        </div>
      </main>
    </div>
  );
}
