/**
 * The DUYO robot, as it appears on the landing page and in the mobile app.
 *
 * Rendered from public/duyo-logo.png rather than an icon-font glyph so the
 * three web surfaces carry the same mark; the file itself comes out of the
 * mobile app's v2 mascot render (see duyo-landing/assets/img/make-logo.py).
 * Decorative — every place it appears already names DUYO in text beside it.
 */
export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <img
      src="/duyo-logo.png"
      alt=""
      aria-hidden="true"
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
