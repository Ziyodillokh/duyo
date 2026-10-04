/**
 * Which film this page plays: its sections, in order. The home page plays
 * content.ts's SECTIONS; the robot page sets its own before anything
 * renders (robot/main.tsx). Everything that walks the sections — the
 * timeline, the scroll driver, the copy's measurements — asks here, so one
 * set of machinery runs both films. Each page is its own document, so each
 * has its own copy of this module.
 */

import { SECTIONS } from './content';
import type { Section } from './content';

let sections: readonly Section[] = SECTIONS;
let root = './';

/**
 * Once, at start, before the first render. `siteRoot` is the way from this
 * page to the site's top folder, for the files every page shares (DUYO's
 * recording): './' from the home page, '../' from the robot page's folder.
 */
export function setFilm(list: readonly Section[], siteRoot = './'): void {
  sections = list;
  root = siteRoot;
}

export const filmSections = (): readonly Section[] => sections;
export const sectionCount = (): number => sections.length;
export const siteRoot = (): string => root;
