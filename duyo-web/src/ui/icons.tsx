/** The site's small marks: DUYO's logo and the arrow its links carry. */
import markUrl from '../assets/duyo-mark.png';

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
