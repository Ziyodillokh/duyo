/**
 * DUYO — the page layer.
 *
 * Four strata, back to front:
 *
 *   ground   a fixed full-viewport colour: deep space, on every section.
 *            Written on scroll (useScrollDriver) from the darkness curve the
 *            3D reads, so a light section could come back without rewiring.
 *   scene    <Scene3D/>, lazy — three.js is heavier than the rest of the page
 *            together, so the copy paints first and the scene arrives after.
 *   copy     six sections from content.ts; each leaves the opposite side
 *            empty for the scene's subject. <main> and every section ignore
 *            the pointer — only the copy blocks and the footer take it — so
 *            hovers and drags anywhere else fall through to the scene.
 *   chrome   progress bar, navbar, section rail.
 *
 * Every word and every link comes from content.ts. Every href on this page is
 * real: the APK, the legal pages, or an anchor to a section that exists.
 */

import { Component, Suspense, lazy, useCallback, useRef, useState, type ReactNode } from 'react';
import { SECTIONS } from './content';
import { Footer } from './ui/Footer';
import { Navbar } from './ui/Navbar';
import { SectionBlock } from './ui/SectionBlock';
import { SectionRail } from './ui/SectionRail';
import { paletteVars } from './ui/theme';
import { useRevealReady } from './ui/useReveal';
import { useScrollDriver } from './ui/useScrollDriver';
import './ui/page.css';

const Scene3D = lazy(() => import('./Scene3D'));

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

export default function App() {
  const groundRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const onActive = useCallback((i: number) => setActiveIdx(i), []);
  useScrollDriver({ ground: groundRef, progress: progressRef }, onActive);
  useRevealReady();

  const activeId = SECTIONS[activeIdx]?.id ?? SECTIONS[0].id;
  const body = SECTIONS.slice(0, -1);
  const final = SECTIONS[SECTIONS.length - 1];

  return (
    <div className="page-root relative overflow-x-clip" style={paletteVars}>
      <div
        ref={groundRef}
        className="fixed inset-0 z-0"
        // Space from the first paint: the driver only writes after mount.
        style={{ backgroundColor: 'var(--c-space)' }}
        aria-hidden="true"
      />

      {/* Receives the drags that turn the phone. pan-y: a horizontal drag
          reaches the scene on touch instead of the browser cancelling it,
          while vertical scrolling and pinch-zoom stay native. */}
      <div className="fixed inset-0 z-[1] [touch-action:pan-y_pinch-zoom]">
        <SceneBoundary>
          <Suspense fallback={null}>
            <Scene3D />
          </Suspense>
        </SceneBoundary>
      </div>

      <div
        ref={progressRef}
        className="progress pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px]"
        aria-hidden="true"
      />
      <Navbar activeId={activeId} />
      <SectionRail activeId={activeId} />

      <main className="pointer-events-none relative z-10">
        {body.map((s, i) => (
          <SectionBlock key={s.id} section={s} isHero={i === 0} isFinal={false} />
        ))}
        {/* The last section and the footer share one viewport, so the page is
            exactly one screen per section tall and each section's scroll
            position lands where timeline.ts expects its centre. svh, not vh:
            it equals innerHeight with a mobile URL bar showing, which is what
            readScroll divides by. */}
        <div className="flex min-h-svh flex-col">
          <SectionBlock section={final} isHero={false} isFinal />
          <Footer />
        </div>
      </main>
    </div>
  );
}
