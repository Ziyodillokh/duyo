import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setFilm } from '../film';
import RobotApp from './RobotApp';
import { ROBOT_SECTIONS } from './content';
import '../index.css';

// This page plays the robot's film, from a folder one down from the site's top.
setFilm(ROBOT_SECTIONS, '../');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RobotApp />
  </StrictMode>,
);
