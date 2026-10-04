/** The robot page's 3D layer, lazy like the home page's (Scene3D.tsx). */
import { SceneMount } from '../SceneMount';
import { startRobotScene } from './runtime';

export default function RobotScene() {
  return <SceneMount start={startRobotScene} />;
}
