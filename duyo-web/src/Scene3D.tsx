/** The home page's 3D layer, lazy (App.tsx): its film on the shared mount. */
import { SceneMount } from './SceneMount';
import { startScene } from './scene/runtime';

export default function Scene3D() {
  return <SceneMount start={startScene} />;
}
