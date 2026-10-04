/**
 * The established navbar: a round logo pill beside a nav pill, centred.
 *
 * Both pills change tone with the ground — #EDEDED and dark text on paper,
 * translucent dark glass and light text in space — driven by the
 * `data-ground` attribute useScrollDriver sets, so the swap is a CSS
 * transition and costs React nothing.
 *
 * From tablet up the pill holds every section but the last (its download is
 * the pill's own button) and a link to the other page.
 *
 * At phone width the section links do not fit beside the download button,
 * so the pill shows the current section's name instead: the visitor still
 * knows where they are, and the one action that matters stays in reach.
 * Below 360px even that name would be cut mid-word, so the pill holds only
 * the button; its padding is even on every side so the button sits centred.
 */

import type { Section } from '../content';
import { Arrow, Logo } from './icons';

export interface NavConfig {
  /** Where the round logo goes, and what it says to a screen reader. */
  logo: { href: string; label: string };
  /**
   * The other page; with `isNew`, set apart by a small lit node. With
   * `wideOnly` it waits for a desktop's width: the robot page's section
   * names are longer, and its logo already leads home.
   */
  link: { href: string; label: string; isNew?: boolean; wideOnly?: boolean };
  cta: { href: string; label: string };
}

interface Props extends NavConfig {
  sections: readonly Section[];
  activeId: string;
}

export function Navbar({ sections, activeId, logo, link, cta }: Props) {
  const navSections = sections.slice(0, -1);
  const active = navSections.find((s) => s.id === activeId);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-center gap-2 px-4 pt-4 md:pt-5">
      <a
        href={logo.href}
        aria-label={logo.label}
        className="nav-glass nav-logo pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
      >
        <Logo size={28} />
      </a>

      <nav
        aria-label="Bo‘limlar"
        className="nav-glass pointer-events-auto flex h-11 min-w-0 items-center gap-0.5 rounded-full p-1"
      >
        {navSections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-current={activeId === s.id ? 'true' : undefined}
            className="nav-item hidden whitespace-nowrap rounded-full px-3 py-[7px] text-[13.5px] font-medium md:inline-block lg:px-3.5"
          >
            {s.nav}
          </a>
        ))}
        <a
          href={link.href}
          className={`nav-item hidden items-center gap-2 whitespace-nowrap rounded-full px-3 py-[7px] text-[13.5px] font-medium lg:px-3.5 ${link.wideOnly ? 'lg:inline-flex' : 'md:inline-flex'}`}
        >
          {link.isNew && <span className="nav-new" aria-hidden="true" />}
          {link.label}
        </a>

        {active && (
          <span className="nav-current whitespace-nowrap px-3 text-[13px] font-medium max-[359px]:hidden md:hidden" aria-hidden="true">
            {active.nav}
          </span>
        )}

        <a
          href={cta.href}
          className="btn-primary group inline-flex md:ml-1 h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[13.5px] font-semibold"
        >
          {cta.label}
          <Arrow size={13} />
        </a>
      </nav>
    </header>
  );
}
