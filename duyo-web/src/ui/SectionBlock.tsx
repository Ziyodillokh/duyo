/**
 * One section of the page: a full-viewport stage whose copy takes one side
 * and leaves the other empty for the 3D subject behind it.
 *
 *   left   copy in the left ~40%, subject on the right
 *   right  copy on the right, subject on the left
 *   center copy centred, low — unused now: copy scrolls while the scene
 *          holds still, so centred copy passes across the subject
 *
 * At phone width every layout collapses to the same thing: a caption pinned
 * to the foot of the screen over a scrim of the ground colour, handing over
 * to the next section's in place (useScrollDriver), so the words stay
 * readable and whole whatever the scene is doing above them. The last
 * section's copy is not pinned: it arrives with the footer.
 *
 * The section itself ignores the pointer; only the copy takes it, and only
 * while it shows — faded copy lets taps through to the scene (page.css,
 * data-faded). The empty half is the scene's to receive drags and hovers.
 */

import { Fragment, useRef, type CSSProperties } from 'react';
import faceUrl from '../assets/duyo-face.webp';
import { SCROLL_HINT } from '../content';
import type { Cta, Promo, Proof, Section } from '../content';
import { Arrow } from './icons';
import { Points } from './Points';
import { HeadingText, Words, typeset } from './typeset';
import { VoiceButton, VoiceCaption } from './VoiceButton';
import { useReveal } from './useReveal';

/** Another page, offered under the last section's call to action. */
export interface NextPage {
  href: string;
  label: string;
  /** Not on a phone held upright, where the footer just under it carries the same link. */
  wideOnly?: boolean;
}

interface Props {
  section: Section;
  /** The page's single h1. */
  isHero: boolean;
  /** The last section shares its viewport with the footer. */
  isFinal: boolean;
  /** The last section's way on to another page. */
  next?: NextPage;
}

/** Stagger slot for the entrance, read by page.css as --rv. */
const rv = (i: number): CSSProperties => ({ '--rv': i }) as CSSProperties;

function rowPlacement(layout: Section['layout'], isFinal: boolean): string {
  if (layout === 'left') return 'md:items-center md:justify-start';
  if (layout === 'right') return 'md:items-center md:justify-end';
  // Centred copy sits low, so the middle of the screen stays the scene's.
  return isFinal ? 'md:items-center md:justify-center' : 'md:items-end md:justify-center md:pb-[11vh]';
}

/**
 * The hero is DUYO introducing itself in two short lines, so it can be set
 * big: "Men — DUYO." is 5.9em in Inter semibold at this tracking, and each
 * breakpoint's size keeps it inside the column — 72px needs 425 of lg's 592
 * — ending well before the middle, clear of DUYO.
 */
const HERO_SIZE =
  'text-[clamp(2.4rem,11.5vw,3.1rem)] md:text-[clamp(2.9rem,5.6vw,3.6rem)] lg:text-[clamp(3.4rem,4.8vw,4.4rem)] 2xl:text-[clamp(4.4rem,4.4vw,5.4rem)]';
/** A hero set in lines runs longer ("AI ekrandan chiqadi." is 10.2em in Sora): a step smaller, so each holds one line. */
const HERO_LINES_SIZE =
  'text-[clamp(2.1rem,9.4vw,2.8rem)] md:text-[clamp(2.5rem,4.8vw,3.2rem)] lg:text-[clamp(3rem,3.9vw,3.6rem)] 2xl:text-[clamp(3.6rem,3.6vw,4.3rem)]';
/** A quotation is words spoken, not a title: set smaller and looser. */
const QUOTE_SIZE = 'text-[clamp(1.45rem,2.3vw,2.05rem)] leading-[1.28] tracking-[-0.02em]';

function headingSize(section: Section, isHero: boolean): string {
  if (section.quote) return QUOTE_SIZE;
  if (isHero) return `${section.heading.includes('\n') ? HERO_LINES_SIZE : HERO_SIZE} leading-[1.04] tracking-[-0.045em]`;
  return 'text-[clamp(1.9rem,3.3vw,2.75rem)] 2xl:text-[3.25rem] leading-[1.1] tracking-[-0.035em]';
}

function copyWidth(section: Section, isHero: boolean): string {
  if (section.layout === 'center') return 'md:max-w-[36rem] md:text-center';
  if (isHero) return 'md:w-[60%] md:max-w-[37rem] lg:w-[55%] 2xl:max-w-[44rem]';
  return 'md:w-[40%] md:max-w-[30rem] 2xl:max-w-[36rem]';
}

/**
 * What DUYO does, in three short lines under the hero's buttons: the
 * visitor learns the whole page's story before scrolling it. From tablet up
 * only — a phone has the room for the buttons and nothing more.
 */
function HeroPoints({ items }: { items: readonly string[] }) {
  return (
    <ul className="rv hero-points mt-9 hidden flex-wrap gap-x-6 gap-y-3 md:flex" style={rv(5)}>
      {items.map((p) => (
        <li key={p} className="flex items-center gap-2.5 text-[14px] font-medium 2xl:text-[15px]">
          <span className="hero-point-dot" aria-hidden="true" />
          {p}
        </li>
      ))}
    </ul>
  );
}

/**
 * Something new, one tap away, above the hero's badge: DUYO's face in a
 * ring that breathes, a lit tag, a name, an arrow — the first thing a
 * visitor's eye finds on the page. The face is the app's mascot's helmet:
 * the promo leads to DUYO as a robot.
 */
function PromoLink({ promo }: { promo: Promo }) {
  return (
    <a href={promo.href} className="rv promo mb-5" style={rv(0)}>
      <span className="promo-face" aria-hidden="true">
        <img src={faceUrl} width={28} height={28} alt="" decoding="async" draggable={false} />
      </span>
      <span className="promo-tag">{promo.tag}</span>
      <span className="promo-label">{promo.label}</span>
      <Arrow size={14} />
    </a>
  );
}
/** The foot of the hero: the page goes on. A line that draws itself downward. */
function ScrollHint() {
  return (
    <div className="scroll-hint pointer-events-none absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2.5 md:flex" aria-hidden="true">
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">{SCROLL_HINT}</span>
      <span className="scroll-hint-line" />
    </div>
  );
}

/** Under the last call to action: the way on to another page, as a button of its own. */
function NextLink({ next }: { next: NextPage }) {
  return (
    <a href={next.href} className={`rv next-link mt-4${next.wideOnly ? ' next-link--wide' : ''}`} style={rv(5)}>
      <span className="nav-new" aria-hidden="true" />
      {next.label}
      <Arrow size={14} />
    </a>
  );
}

function CtaLink({ cta, large }: { cta: Cta; large: boolean }) {
  if (cta.variant === 'primary') {
    // The final CTA spans the column on a phone, where its label would
    // otherwise wrap inside the pill at 320px.
    const size = large
      ? 'h-14 w-full justify-center px-5 text-[15.5px] gap-2 sm:w-auto sm:px-8 sm:text-[16.5px] sm:gap-2.5'
      : 'h-12 px-5 text-[15px] gap-2 sm:px-6';
    return (
      <a href={cta.href} className={`btn-primary inline-flex items-center whitespace-nowrap rounded-full font-semibold ${size}`}>
        {cta.label}
        <Arrow size={large ? 16 : 15} />
      </a>
    );
  }
  // Below 640px the scroll itself answers "how it works", and the hero's
  // row already holds download and DUYO's voice: the ghost link would take
  // a third line a small phone does not have.
  return (
    <a href={cta.href} className="btn-ghost hidden h-12 items-center gap-1.5 text-[15px] font-medium sm:inline-flex">
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

export function SectionBlock({ section, isHero, isFinal, next }: Props) {
  const { id, theme, layout, badge, heading, body, proof, points, ctas, note, promo, heroPoints } = section;
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);
  const headingId = `${id}-title`;
  const Heading = isHero ? 'h1' : 'h2';
  // svh = innerHeight with a mobile URL bar showing. The last section shares
  // its screen with the footer, except on a phone (page.css): there the
  // footer would leave the subject a sliver, so it follows a full screen.
  const minHeight = isFinal ? 'flex-1' : 'min-h-svh';

  return (
    <section
      ref={ref}
      id={id}
      data-theme={theme}
      // page.css: in the stacked layout every caption but this one is
      // pinned; a phone held sideways places the copy by its layout.
      data-final={isFinal || undefined}
      data-hero={isHero || undefined}
      data-layout={layout}
      aria-labelledby={headingId}
      className={`page-section pointer-events-none relative flex ${minHeight}`}
    >
      <div
        className={`section-row mx-auto flex w-full max-w-[1240px] items-end px-6 pb-8 pt-24 md:px-12 md:pb-0 md:pt-28 lg:px-20 2xl:max-w-[1440px] ${rowPlacement(layout, isFinal)}`}
      >
        <div className={`copy pointer-events-auto relative w-full ${copyWidth(section, isHero)}`}>
          {promo && <PromoLink promo={promo} />}
          <p
            className="rv badge mb-5 text-[11.5px] font-semibold uppercase tracking-[0.16em] lg:text-[12px] 2xl:text-[13px]"
            style={rv(0)}
            // A quotation's section is named by its badge (the h2 below), not twice.
            aria-hidden={section.quote || undefined}
          >
            {badge}
          </p>
          {section.quote ? (
            // Set as the heading, but a quotation is not a title: the
            // section's name is its badge, and the words are a blockquote.
            <>
              <h2 id={headingId} className="sr-only">
                {badge}
              </h2>
              <blockquote className={`rv heading is-quote m-0 font-display font-semibold text-balance ${headingSize(section, isHero)}`} style={rv(1)}>
                <HeadingText text={heading} bySentence={false} />
              </blockquote>
            </>
          ) : (
            <Heading
              id={headingId}
              className={`rv heading m-0 font-display font-semibold text-balance ${headingSize(section, isHero)}${heading.includes('\n') ? ' has-lines' : ''}`}
              style={rv(1)}
            >
              <HeadingText text={heading} bySentence={isHero} accent={section.accent} />
            </Heading>
          )}
          {body && (
            <p
              className={`rv body mt-5 max-w-[30rem] text-pretty text-[15.5px] leading-[1.65] md:text-[17px] lg:text-[18px] 2xl:max-w-[34rem] 2xl:text-[19px] ${layout === 'center' ? 'md:mx-auto' : ''}`}
              style={rv(2)}
            >
              <Words text={typeset(body)} />
            </p>
          )}
          {proof && <ProofGrid items={proof} />}
          {points && <Points groups={points} from={3} />}
          {ctas && (
            <div
              className={`rv cta-row mt-8 flex flex-wrap items-center gap-x-2.5 gap-y-3 sm:gap-x-6 ${layout === 'center' ? 'md:justify-center' : ''} ${isFinal ? 'md:mt-10' : ''}`}
              style={rv(3)}
            >
              {ctas.map((c, i) => (
                <Fragment key={c.label}>
                  <CtaLink cta={c} large={isFinal} />
                  {/* DUYO's voice sits right after the hero's download. */}
                  {isHero && i === 0 && <VoiceButton />}
                </Fragment>
              ))}
            </div>
          )}
          {isFinal && next && <NextLink next={next} />}
          {note && (
            <p className="rv note mt-6 max-w-[30rem] text-[12.5px] leading-[1.55]" style={rv(6)}>
              {note}
            </p>
          )}
          {isHero && <VoiceCaption />}
          {isHero && heroPoints && <HeroPoints items={heroPoints} />}
        </div>
      </div>
      {isHero && <ScrollHint />}
    </section>
  );
}
