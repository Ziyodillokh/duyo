/**
 * The legal and support links, in the space under the final CTA.
 * <main> ignores the pointer so the scene behind it can take it; the footer
 * opts back in, since pointer-events is inherited.
 */

import { FOOTER_LINKS } from '../content';
import { Logo } from './icons';

export function Footer() {
  return (
    <footer className="site-footer pointer-events-auto relative z-10 px-6 md:px-12 lg:px-20">
      <div className="mx-auto flex max-w-[1240px] flex-col 2xl:max-w-[1440px] gap-5 border-t py-7 md:flex-row md:items-center md:justify-between md:py-8">
        <div className="flex items-center gap-2.5">
          <span className="footer-mark flex h-7 w-7 items-center justify-center rounded-full">
            <Logo size={20} />
          </span>
          <span className="text-[13px]">© 2026 Farzandim Tech</span>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-3 text-[13px]">
          {FOOTER_LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="footer-link">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
