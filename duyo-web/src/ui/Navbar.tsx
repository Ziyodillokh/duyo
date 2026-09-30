/**
 * The established navbar: a round logo pill beside a nav pill, centred.
 *
 * Both pills change tone with the ground — #EDEDED and dark text on paper,
 * translucent dark glass and light text in space — driven by the
 * `data-ground` attribute useScrollDriver sets, so the swap is a CSS
 * transition and costs React nothing.
 *
 * At phone width the four section links do not fit beside the download
 * button, so the pill shows the current section's name instead: the visitor
 * still knows where they are, and the one action that matters stays in reach.
 * Below 360px even that name would be cut mid-word, so the pill holds only
 * the button; its padding is even on every side so the button sits centred.
 */

import { APK_URL, SECTIONS } from '../content';
import { Arrow, Logo } from './icons';

const NAV_SECTIONS = SECTIONS.filter((s) => s.id !== 'yuklab');

export function Navbar({ activeId }: { activeId: string }) {
  const active = SECTIONS.find((s) => s.id === activeId);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-center gap-2 px-4 pt-4 md:pt-5">
      <a
        href={`#${SECTIONS[0].id}`}
        aria-label="DUYO — sahifa boshiga"
        className="nav-glass nav-logo pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
      >
        <Logo />
      </a>

      <nav
        aria-label="Bo‘limlar"
        className="nav-glass pointer-events-auto flex h-11 min-w-0 items-center gap-0.5 rounded-full p-1"
      >
        {NAV_SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-current={activeId === s.id ? 'true' : undefined}
            className="nav-item hidden whitespace-nowrap rounded-full px-3.5 py-[7px] text-[13.5px] font-medium md:inline-block"
          >
            {s.nav}
          </a>
        ))}

        {active && active.id !== 'yuklab' && (
          <span className="nav-current whitespace-nowrap px-3 text-[13px] font-medium max-[359px]:hidden md:hidden" aria-hidden="true">
            {active.nav}
          </span>
        )}

        <a
          href={APK_URL}
          className="btn-primary group inline-flex md:ml-1 h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[13.5px] font-semibold"
        >
          Yuklab olish
          <Arrow size={13} />
        </a>
      </nav>
    </header>
  );
}
