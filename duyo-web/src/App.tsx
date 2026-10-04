/**
 * DUYO — the home page: the film of the app, from DUYO saying hello to the
 * download. The page layer is ui/FilmPage.tsx; this says what it plays.
 */

import { lazy } from 'react';
import { APK_URL, FOOTER_LINKS, ROBOT_PAGE, SECTIONS } from './content';
import { FilmPage } from './ui/FilmPage';

const Scene3D = lazy(() => import('./Scene3D'));

const NAV = {
  logo: { href: `#${SECTIONS[0].id}`, label: 'DUYO — sahifa boshiga' },
  link: { href: ROBOT_PAGE.href, label: ROBOT_PAGE.nav, isNew: true },
  cta: { href: APK_URL, label: 'Yuklab olish' },
};

export default function App() {
  return (
    <FilmPage
      name="home"
      sections={SECTIONS}
      Scene={Scene3D}
      nav={NAV}
      footerLinks={FOOTER_LINKS}
      next={{ href: ROBOT_PAGE.href, label: ROBOT_PAGE.teaser }}
    />
  );
}
