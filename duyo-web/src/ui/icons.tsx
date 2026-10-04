/** The site's small marks: DUYO's logo and the arrow its links carry. */
import markUrl from '../assets/duyo-mark.png';
import type { IconName } from '../content';

/**
 * The app's own mark — the gradient D holding a knowledge graph — taken from
 * the app icon's adaptive layer (duyo-mobile/assets/images), so the site and
 * the launcher show the same thing. Its counter is transparent, so it sits
 * on the light pill and the dark glass pill alike.
 */
export function Logo({ size = 22 }: { size?: number }) {
  return <img src={markUrl} width={size} height={size} alt="" decoding="async" draggable={false} />;
}

/** A drawn arrow, so it sits on the text's optical centre in every font. */
export function Arrow({ size = 14 }: { size?: number }) {
  return (
    <svg
      className="arrow"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Line drawings on a 24-unit grid, stroked in the current colour (ui/Points.tsx; the robot page's hologram labels draw them too). */
export const ICONS: Record<IconName, string> = {
  projector: 'M5 7h14a2.5 2.5 0 0 1 2.5 2.5v5.5a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 15V9.5A2.5 2.5 0 0 1 5 7zM18.25 12.25a2.75 2.75 0 1 1-5.5 0 2.75 2.75 0 0 1 5.5 0zM6 10.5h4M6 13.5h2.5M6 17.5v2M18 17.5v2',
  mic: 'M12 2.75a3.5 3.5 0 0 1 3.5 3.5v4.5a3.5 3.5 0 0 1-7 0v-4.5A3.5 3.5 0 0 1 12 2.75zM5 11a7 7 0 0 0 14 0M12 18v3.25',
  sync: 'M19.5 9.5A8 8 0 0 0 5.2 7.4L4 8.75M4 4.5v4.25h4.25M4.5 14.5a8 8 0 0 0 14.3 2.1l1.2-1.35M20 19.5v-4.25h-4.25',
  planet: 'M17.5 12a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0zM7.3 15.6C4.1 17.4 2.2 18 1.9 17.4c-.6-1 3.4-4.4 8.9-7.5s10.6-4.8 11.2-3.8c.3.6-.9 1.8-3.3 3.4',
  books: 'M4.5 4h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM10.5 4h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM15.6 5.3l3.1-.8a1 1 0 0 1 1.2.7l3.5 13.2-4 1.1L16 6.5',
  wave: 'M2.5 12h2.25l2-5 3.5 10.5 3-8 2 4.5h2.25l1.25-2.5 1.25 2.5H21.5',
  chat: 'M4.5 19.5V6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5V14a2.5 2.5 0 0 1-2.5 2.5H8.25zM8.5 8.75h7M8.5 12h4.5',
  robot: 'M8 8h8a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-4a4 4 0 0 1 4-4zM12 8V4.75M13.25 3.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0zM9 13.5V15M15 13.5V15M2 13v3M22 13v3',
  compact: 'M9.5 7.5h5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zM3 8.5V5.5A2.5 2.5 0 0 1 5.5 3h3M21 8.5V5.5A2.5 2.5 0 0 0 18.5 3h-3M3 15.5v3A2.5 2.5 0 0 0 5.5 21h3M21 15.5v3a2.5 2.5 0 0 1-2.5 2.5h-3',
  play: 'M5.75 4.5h12.5a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H5.75a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3zM10 9.25v5.5l4.75-2.75z',
  flag: 'M5 21.5V3.5M5 4h12.5l-2.5 4.25 2.5 4.25H5',
  apps: 'M5.5 3.5h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zM15.5 3.5h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zM5.5 13.5h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zM15.5 13.5h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z',
  wall: 'M2.5 4.5h19M4.5 4.5v10a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-10M12 16v3.5M8.5 21h7',
  spark: 'M12 2.75 14 9l6.25 2-6.25 2L12 19.25 10 13l-6.25-2L10 9zM19 17.5v4M17 19.5h4',
};

/** One of the copy's drawings, sized by its container (page.css .tile). */
export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}
