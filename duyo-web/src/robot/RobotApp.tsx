/**
 * The DUYO Robot page (duyo.uz/robot/): the concept deck as a film — DUYO,
 * the beam from its hand and the galaxy it throws, scrolled through in six
 * sections. The page layer is the home page's (ui/FilmPage.tsx).
 */

import { lazy } from 'react';
import { FilmPage } from '../ui/FilmPage';
import { ROBOT_FOOTER, ROBOT_NAV, ROBOT_NEXT, ROBOT_SECTIONS } from './content';

const RobotScene = lazy(() => import('./RobotScene'));

export default function RobotApp() {
  return (
    <FilmPage name="robot" sections={ROBOT_SECTIONS} Scene={RobotScene} nav={ROBOT_NAV} footerLinks={ROBOT_FOOTER} next={ROBOT_NEXT} />
  );
}
