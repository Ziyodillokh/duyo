/**
 * Where you are, in a form you can act on: one marker per section down the
 * right edge. The active marker stretches; hovering or focusing any marker
 * shows its name. Desktop only — at phone width the navbar carries the
 * current section's name instead.
 */

import type { Section } from '../content';

export function SectionRail({ sections, activeId }: { sections: readonly Section[]; activeId: string }) {
  return (
    <nav
      aria-label="Bo‘limlar bo‘ylab"
      className="rail fixed right-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-end lg:flex xl:right-7"
    >
      {sections.map((s, i) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          aria-label={`${i + 1}. ${s.nav}`}
          aria-current={activeId === s.id ? 'true' : undefined}
          className="rail-item flex items-center justify-end gap-3 py-[7px] pl-4"
        >
          <span className="rail-label whitespace-nowrap text-[12px] font-medium">{s.nav}</span>
          <span className="rail-mark block" />
        </a>
      ))}
    </nav>
  );
}
