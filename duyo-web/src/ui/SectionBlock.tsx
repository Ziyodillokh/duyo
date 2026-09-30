/**
 * One section of the page: a full-viewport stage whose copy takes one side
 * and leaves the other empty for the 3D subject behind it.
 *
 *   left   copy in the left ~40%, subject on the right
 *   right  copy on the right, subject on the left
 *   center copy centred — low, under the galaxy, for 'miya'; dead centre for
 *          the final call to action
 *
 * At phone width every layout collapses to the same thing: copy anchored to
 * the bottom over a scrim of the section's own ground colour, so the words
 * stay readable whatever the scene is doing above them.
 *
 * The section itself ignores the pointer; only the copy takes it, and only
 * while it shows — faded copy lets taps through to the scene (page.css,
 * data-faded). The empty half is the scene's to receive drags and hovers.
 */

import { useRef, type CSSProperties } from 'react';
import type { Cta, Proof, Section } from '../content';
import { Arrow } from './icons';
import { useReveal } from './useReveal';

interface Props {
  section: Section;
  /** The page's single h1. */
  isHero: boolean;
  /** The last section shares its viewport with the footer. */
  isFinal: boolean;
}

/**
 * Typographic glue, applied at render so content.ts stays plain text: an em
 * dash never starts a line, it stays with the word before it.
 */
const typeset = (text: string): string => text.replace(/ — /g, '\u00a0— ');

/**
 * Text never breaks inside a hyphenated compound ("qadamma-qadam",
 * "bosqichma-bosqich", "bir-biriga"): split there, it reads as two words. Used for
 * headings, body and proof labels alike. The hero's phone size is set so its
 * longest compound fits a 320px screen whole.
 */
function Words({ text }: { text: string }) {
  const words = text.split(' ');
  return (
    <>
      {words.map((w, i) => {
        const sep = i < words.length - 1 ? ' ' : '';
        if (!w.includes('-')) return w + sep;
        return (
          <span key={i}>
            <span className="whitespace-nowrap">{w}</span>
            {sep}
          </span>
        );
      })}
    </>
  );
}

/**
 * From tablet width up the hero sets each sentence on its own line —
 * "Savol bering." is a beat of its own. At phone width the column is too
 * narrow for that without stranding a single word, so the text flows.
 */
function HeadingText({ text, bySentence }: { text: string; bySentence: boolean }) {
  const t = typeset(text);
  if (!bySentence) return <Words text={t} />;
  return (
    <>
      {t.split(/(?<=\.) /).map((sentence, i) => (
        <span key={sentence} className="md:block">
          {i > 0 ? ' ' : ''}
          <Words text={sentence} />
        </span>
      ))}
    </>
  );
}

/** Stagger slot for the entrance, read by page.css as --rv. */
const rv = (i: number): CSSProperties => ({ '--rv': i }) as CSSProperties;

function rowPlacement(layout: Section['layout'], isFinal: boolean): string {
  if (layout === 'left') return 'md:items-center md:justify-start';
  if (layout === 'right') return 'md:items-center md:justify-end';
  // 'miya' sits low so the galaxy's centre stays clear above it.
  return isFinal ? 'md:items-center md:justify-center' : 'md:items-end md:justify-center md:pb-[11vh]';
}

/**
 * The hero gets a little more than the 40% the other sections do, because
 * "DUYO qadamma-qadam" has to hold one line: 11.0em in Inter semibold at
 * this tracking (measured with the face loaded — the system fallback is
 * narrower and misleads). Each breakpoint's size keeps 11em inside the
 * column with room to spare — 52px needs 572 of lg's 592 — so the headline
 * sets in three lines and ends near the middle, clear of the phone. On a
 * phone the text flows, and "DUYO" takes a line of its own.
 */
const HERO_SIZE =
  'text-[clamp(2rem,10.2vw,2.75rem)] md:text-[clamp(2.125rem,4vw,2.5rem)] lg:text-[clamp(2.5rem,3.8vw,3.25rem)]';

function copyWidth(section: Section, isHero: boolean): string {
  if (section.layout === 'center') return 'md:max-w-[36rem] md:text-center';
  if (isHero) return 'md:w-[60%] md:max-w-[37rem] lg:w-[55%]';
  return 'md:w-[40%] md:max-w-[30rem]';
}

function CtaLink({ cta, large }: { cta: Cta; large: boolean }) {
  if (cta.variant === 'primary') {
    // The final CTA spans the column on a phone, where its label would
    // otherwise wrap inside the pill at 320px.
    const size = large
      ? 'h-14 w-full justify-center px-5 text-[15.5px] gap-2 sm:w-auto sm:px-8 sm:text-[16.5px] sm:gap-2.5'
      : 'h-12 px-6 text-[15px] gap-2';
    return (
      <a href={cta.href} className={`btn-primary inline-flex items-center whitespace-nowrap rounded-full font-semibold ${size}`}>
        {cta.label}
        <Arrow size={large ? 16 : 15} />
      </a>
    );
  }
  return (
    <a href={cta.href} className="btn-ghost inline-flex h-12 items-center gap-1.5 text-[15px] font-medium">
      {cta.label}
      <Arrow size={15} />
    </a>
  );
}

function ProofGrid({ items }: { items: Proof[] }) {
  return (
    <dl className="rv proof mt-9 grid grid-cols-3 gap-4 border-t pt-6 lg:gap-6" style={rv(3)}>
      {items.map((p) => (
        <div key={p.value} className="flex flex-col-reverse justify-end gap-1.5">
          <dt className="proof-label text-[12.5px] leading-snug md:text-[13px]">
            <Words text={p.label} />
          </dt>
          {/* Tablet sets the copy in a 40% column: at 1.6rem "Taxallus" runs
              into the next value, so the full size waits for lg. */}
          <dd className="proof-value m-0 text-[1.3rem] font-semibold leading-none tracking-[-0.02em] md:text-[1.15rem] lg:text-[1.6rem]">
            {p.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SectionBlock({ section, isHero, isFinal }: Props) {
  const { id, theme, layout, badge, heading, body, proof, ctas } = section;
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);
  const headingId = `${id}-title`;
  const Heading = isHero ? 'h1' : 'h2';
  const headingSize = isHero
    ? `${HERO_SIZE} leading-[1.02] tracking-[-0.038em]`
    : 'text-[clamp(2rem,3.6vw,3rem)] leading-[1.06] tracking-[-0.03em]';
  // svh = innerHeight with a mobile URL bar showing, which readScroll uses.
  const minHeight = isFinal ? 'flex-1' : 'min-h-svh';

  return (
    <section
      ref={ref}
      id={id}
      data-theme={theme}
      aria-labelledby={headingId}
      className={`page-section pointer-events-none relative flex ${minHeight}`}
    >
      <div
        className={`mx-auto flex w-full max-w-[1240px] items-end px-6 pb-8 pt-24 md:px-12 md:pb-0 md:pt-28 lg:px-20 ${rowPlacement(layout, isFinal)}`}
      >
        <div className={`copy pointer-events-auto relative w-full ${copyWidth(section, isHero)}`}>
          <p className="rv badge mb-5 text-[11.5px] font-semibold uppercase tracking-[0.14em]" style={rv(0)}>
            {badge}
          </p>
          <Heading
            id={headingId}
            className={`rv heading m-0 font-semibold text-balance ${headingSize}`}
            style={rv(1)}
          >
            <HeadingText text={heading} bySentence={isHero} />
          </Heading>
          <p
            className={`rv body mt-5 max-w-[30rem] text-pretty text-[15.5px] leading-[1.6] md:text-[17px] ${layout === 'center' ? 'md:mx-auto' : ''}`}
            style={rv(2)}
          >
            <Words text={typeset(body)} />
          </p>
          {proof && <ProofGrid items={proof} />}
          {ctas && (
            <div
              className={`rv mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 ${layout === 'center' ? 'md:justify-center' : ''} ${isFinal ? 'md:mt-10' : ''}`}
              style={rv(3)}
            >
              {ctas.map((c) => (
                <CtaLink key={c.label} cta={c} large={isFinal} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
