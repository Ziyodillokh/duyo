/**
 * Mounts the 3D scene behind the copy.
 *
 * The canvas is created here, not rendered by React, so a StrictMode double
 * mount (or a hot reload) gets a fresh WebGL context each time instead of
 * re-initialising three.js on a canvas the previous renderer still holds.
 *
 * The canvas never takes the pointer: the runtime listens on the window, so
 * every link and button above it keeps working and a drag on empty space
 * still turns the phone.
 *
 * The page is complete without the scene. Whatever stops it — no WebGL, a
 * throw while it is built, a failure part way through start-up — only
 * removes the canvas; the copy, the nav and the download stay.
 */

import { useEffect, useRef } from 'react';
import { startScene } from './scene/runtime';
import type { SceneOptions, SceneRuntime } from './scene/runtime';

/** Fade the scene in once its first frame exists, so it never pops. */
const FADE_IN_MS = 900;

/** Hand a scene failure to the browser's error reporting without taking the page down with it. */
function report(error: unknown): void {
  if (typeof reportError === 'function') reportError(error);
  else console.error(error);
}

function tryStart(canvas: HTMLCanvasElement, options: SceneOptions): SceneRuntime | null {
  try {
    return startScene(canvas, options);
  } catch (error) {
    report(error);
    return null;
  }
}

export default function Scene3D() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      display: 'block',
      pointerEvents: 'none',
      opacity: '0',
      // A visitor who asked for stillness gets the scene at once, not faded in.
      transition: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'none'
        : `opacity ${FADE_IN_MS}ms ease-out`,
    });
    host.appendChild(canvas);

    // Start-up runs over several tasks, so the canvas is shown when the
    // first frame has actually been drawn, not after a guessed delay.
    const runtime = tryStart(canvas, {
      onFirstFrame: () => {
        canvas.style.opacity = '1';
      },
      onFail: (error) => {
        canvas.remove();
        report(error);
      },
    });
    if (!runtime) {
      canvas.remove();
      return undefined;
    }

    return () => {
      runtime.dispose();
      canvas.remove();
    };
  }, []);

  return <div ref={hostRef} className="pointer-events-none absolute inset-0" />;
}
