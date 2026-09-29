/**
 * DUYO — one hero page.
 *
 * Structure follows the brief it was built from: a fullscreen background, a
 * centred two-pill navbar, and a bottom-left stack of badge → headline →
 * subtext → CTA, with arrows that nudge right on hover.
 *
 * Two deliberate departures:
 *
 * 1. The background is a shader, not the hosted .mp4 the brief named. That
 *    file belongs to another company's product page, and DUYO was rejected
 *    from Google Play under the Impersonation policy days ago for third-party
 *    assets. See GalaxyCanvas.tsx.
 *
 * 2. The palette is inverted from the brief's paper-grey. DUYO's galaxy is
 *    dark, so the pills are glass over it rather than solid #EDEDED, and the
 *    type is light. Everything else — the sizes, the spacing, the hover
 *    behaviour — is as specified.
 *
 * Every claim on this page is one the product can back: the age range is the
 * one the server enforces, and the download link is the live APK.
 */

import { ArrowRight } from 'lucide-react';
import GalaxyCanvas from './GalaxyCanvas';

const APK_URL = 'https://admin.duyo.uz/apk/duyo.apk';

const NAV_LINKS = ['Imkoniyatlar', 'Xavfsizlik', 'Narxlar', 'Yordam'] as const;

/** The DUYO monogram: the logo's squircle D with its three-node mark. */
function Logo() {
  return (
    <svg width="18" height="18" viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path
        fill="rgb(236, 242, 255)"
        d="M 28 16 L 128 16 C 196 16 240 62 240 128 C 240 194 196 240 128 240 L 28 240 Z M 74 62 L 74 194 L 128 194 C 169 194 194 168 194 128 C 194 88 169 62 128 62 Z"
      />
      <circle cx="120" cy="92" r="17" fill="rgb(56, 189, 248)" />
      <circle cx="166" cy="128" r="14" fill="rgb(139, 92, 246)" />
      <circle cx="120" cy="164" r="14" fill="rgb(37, 99, 235)" />
      <path
        stroke="rgb(236, 242, 255)"
        strokeOpacity="0.75"
        strokeWidth="9"
        strokeLinecap="round"
        d="M 120 92 L 138 128 L 166 128 M 138 128 L 120 164"
      />
      <circle cx="138" cy="128" r="12" fill="rgb(255, 199, 0)" />
    </svg>
  );
}

/** The trailing arrow, shared by the badge and the CTA. */
function Arrow() {
  return (
    <ArrowRight
      size={14}
      strokeWidth={2.25}
      className="inline-block transition-transform duration-200 group-hover:translate-x-0.5"
      aria-hidden="true"
    />
  );
}

export default function App() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070B1A]">
      {/* Painted first so the page still reads if WebGL is unavailable or
          refused — the canvas draws over it when it can. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(120%_85%_at_68%_18%,#1E2A6B_0%,#0C1330_45%,#070B1A_100%)]"
      />
      <GalaxyCanvas />

      {/* A floor of shade under the copy. The galaxy is brightest top-right,
          the text sits bottom-left, and this keeps the two from meeting. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_top,rgba(7,11,26,0.92)_0%,rgba(7,11,26,0.45)_38%,transparent_70%)]"
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <nav className="flex items-center justify-center pt-4 sm:pt-6 px-4 sm:px-8 gap-2 sm:gap-3">
          <a
            href="#"
            aria-label="DUYO"
            className="flex items-center justify-center rounded-full w-10 h-10 sm:w-11 sm:h-11 shrink-0 border border-white/12 backdrop-blur-md transition-colors duration-200 hover:border-white/25"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
          >
            <Logo />
          </a>

          {/* Spacing is the brief's, unchanged. Measured at 390px the four
              Uzbek labels land at 363px against a 390px viewport with no
              horizontal scroll, so there is nothing here to work around.
              `whitespace-nowrap` is the only addition: a label that wrapped
              mid-word would break the pill's height, and Uzbek has longer
              words than the English this was sized for. */}
          <div
            className="flex items-center gap-4 sm:gap-10 rounded-xl px-4 sm:px-8 py-2.5 sm:py-3 border border-white/12 backdrop-blur-md"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
          >
            {NAV_LINKS.map((label) => (
              <a
                key={label}
                href="#"
                className="text-[12px] sm:text-[14px] font-medium text-white/65 hover:text-white transition-colors duration-200 whitespace-nowrap"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>

        <main className="flex-1 flex items-end pb-10 sm:pb-16 lg:pb-20 px-6 sm:px-12 md:px-20 lg:px-28">
          <div className="max-w-xs">
            <a
              href="#"
              className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#FFC700] hover:text-[#FFD84D] transition-colors mb-3 group"
            >
              13–17 yosh uchun, o‘zbek tilida
              <Arrow />
            </a>

            <h1 className="text-[1.5rem] sm:text-[1.75rem] leading-[1.15] font-medium text-white tracking-tight mb-3 text-balance">
              O‘smirlar uchun ishonchli sun’iy intellekt hamroh.
            </h1>

            <p className="text-[13px] text-white/45 font-normal mb-3">
              Suhbat, dars yordami va maqsadlar — bir joyda.
            </p>

            <a
              href={APK_URL}
              className="inline-flex items-center gap-2 text-[13px] font-medium text-[#5B96F9] border border-[#5B96F9]/55 rounded-full px-5 py-2.5 hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] transition-all duration-200 group"
            >
              Ilovani yuklab olish
              <Arrow />
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}
