/**
 * A scene's start-up, the same on both pages: the stage at once, the pieces
 * over the next few tasks (each page's own `assemble`), then its `run`.
 * Null when there is no WebGL; options.onFirstFrame says when there is
 * something to show. Torn down newest first — the loop and its listeners,
 * then the pieces, then the renderer they were drawn with — and a failure
 * part way through tears down what was built and reports it.
 */

import { createStage } from '../three/stage';
import type { Stage } from '../three/stage';

export interface SceneRuntime {
  dispose: () => void;
}

export interface SceneOptions {
  /** Once, when the first frame has been drawn: the canvas can be shown. */
  onFirstFrame?: () => void;
  /** Building failed after the start returned; the scene has already torn itself down. */
  onFail?: (error: unknown) => void;
}

/** Registers a piece's teardown once it exists. */
export type Own = (teardown: () => void) => void;

export function startStaged<P>(
  canvas: HTMLCanvasElement,
  options: SceneOptions,
  assemble: (stage: Stage, own: Own, alive: () => boolean) => Promise<P | null>,
  run: (stage: Stage, parts: P, options: SceneOptions) => () => void,
): SceneRuntime | null {
  const stage = createStage(canvas, { deferEnvironment: true });
  if (!stage) return null;
  const owned: Array<() => void> = [stage.dispose];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    [...owned].reverse().forEach((teardown) => teardown());
  };
  const alive = () => !disposed;

  assemble(stage, (teardown) => owned.push(teardown), alive)
    .then((parts) => {
      if (parts && alive()) owned.push(run(stage, parts, options));
    })
    .catch((error: unknown) => {
      if (!alive()) return;
      dispose();
      options.onFail?.(error);
    });

  return { dispose };
}
