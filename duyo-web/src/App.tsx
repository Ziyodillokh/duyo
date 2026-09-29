/**
 * DUYO — a three-section landing where the robot is built as you scroll.
 *
 *   1  head     what DUYO is
 *   2  + body   what keeps a child safe inside it
 *   3  + limbs  what a child does with it, and the download
 *
 * Every control on this page goes somewhere. The nav anchors scroll to the
 * three sections, the rail on the right jumps between them and shows where
 * you are, and every call to action points at the live APK. The first pass
 * shipped `href="#"` on all of them, which is a mock, not a site.
 *
 * The robot is authored as geometry in `three/robot.ts`, not loaded as an
 * image: the mascot that shipped before was an AI-generated photoreal render
 * and Google Play rejected the store listing under the Impersonation policy
 * for third-party assets. It is also the only way the assembly can work — a
 * flat image cannot come apart into a head, a body and a pair of limbs.
 */

import { Suspense, lazy, useEffect, useState } from 'react';
import Backdrop from './Backdrop';

// three.js is ~180KB gzipped — more than the rest of the page put together.
// Split out, the copy and the backdrop paint immediately and the robot
// arrives a moment later, which is the right order: nobody is reading the
// headline through the model.
const RobotStage = lazy(() => import('./RobotStage'));

const APK_URL = 'https://admin.duyo.uz/apk/duyo.apk';

interface SectionDef {
  id: string;
  nav: string;
  badge: string;
  heading: string;
  body: string;
  cta: string;
}

const SECTIONS: SectionDef[] = [
  {
    id: 'imkoniyatlar',
    nav: 'Imkoniyatlar',
    badge: '13–17 yosh uchun, o‘zbek tilida',
    heading: 'O‘smirlar uchun ishonchli sun’iy intellekt hamroh.',
    body: 'Savolingizni o‘z tilingizda bering. Javob doskada qadamma-qadam yoziladi — u baholamaydi, kulmaydi, charchamaydi.',
    cta: 'Ilovani yuklab olish',
  },
  {
    id: 'xavfsizlik',
    nav: 'Xavfsizlik',
    badge: 'Xavfsizlik',
    heading: 'Har bir xabar yetkazilishdan oldin tekshiriladi.',
    body: 'Xavfli belgilar aniqlansa, DUYO yordam raqamini ko‘rsatadi va ota-onaga SMS boradi. Tengdoshlar bir-birini faqat taxallus bo‘yicha ko‘radi — ism ham, telefon ham o‘tmaydi.',
    cta: 'Ilovani yuklab olish',
  },
  {
    id: 'maqsadlar',
    nav: 'Maqsadlar',
    badge: 'Harakat',
    heading: 'Bilish yetarli emas — qilish kerak.',
    body: 'Maqsadingizni yozasiz, DUYO uni qadamlarga bo‘ladi. Suhbatlaringizdan bilim xaritasi o‘sadi, bir xil maqsaddagi tengdoshlar topiladi.',
    cta: 'Ilovani yuklab olish',
  },
];

/** DUYO's D, drawn to the brief's 18×18 / 256-viewBox / grey-fill spec. */
function Logo() {
  return (
    <svg width="18" height="18" viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path
        fill="rgb(84, 84, 84)"
        d="M 24 20 L 120 20 C 192 20 236 66 236 128 C 236 190 192 236 120 236 L 24 236 Z M 70 66 L 70 190 L 120 190 C 162 190 190 166 190 128 C 190 90 162 66 120 66 Z"
      />
      <circle cx="122" cy="94" r="15" fill="rgb(84, 84, 84)" />
      <circle cx="166" cy="128" r="12" fill="rgb(84, 84, 84)" />
      <circle cx="122" cy="162" r="12" fill="rgb(84, 84, 84)" />
      <path
        stroke="rgb(84, 84, 84)"
        strokeWidth="8"
        strokeLinecap="round"
        d="M 122 94 L 140 128 L 166 128 M 140 128 L 122 162"
      />
    </svg>
  );
}

function Arrow() {
  return (
    <span
      aria-hidden="true"
      className="inline-block transition-transform duration-200 group-hover:translate-x-0.5"
    >
      →
    </span>
  );
}

/** Which section fills most of the viewport right now. */
function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    const seen = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.intersectionRatio);
        // Most-visible wins. Picking "the first one intersecting" instead
        // makes the marker flip a section early on every scroll.
        let best = ids[0];
        let bestRatio = -1;
        for (const id of ids) {
          const r = seen.get(id) ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            best = id;
          }
        }
        setActive(best);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [ids]);

  return active;
}

/** How far down the page we are, 0–1, for the progress bar. */
function useScrollProgress(): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    const read = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    read();
    window.addEventListener('scroll', read, { passive: true });
    window.addEventListener('resize', read, { passive: true });
    return () => {
      window.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, []);
  return p;
}

export default function App() {
  const ids = SECTIONS.map((s) => s.id);
  const active = useActiveSection(ids);
  const progress = useScrollProgress();

  return (
    <div className="relative bg-[#f0f0ee]">
      <Backdrop />
      <Suspense fallback={null}>
        <RobotStage />
      </Suspense>

      {/* Reading position. Three screens with no indicator is three screens a
          visitor does not know they are in the middle of. */}
      <div
        className="fixed top-0 inset-x-0 z-30 h-[2px] bg-blue-500/80 origin-left transition-transform duration-150"
        style={{ transform: `scaleX(${progress})` }}
        role="presentation"
      />

      <nav
        aria-label="Asosiy"
        className="fixed top-0 inset-x-0 z-20 flex items-center justify-center pt-4 sm:pt-6 px-4 sm:px-8 gap-2 sm:gap-3"
      >
        <a
          href="#imkoniyatlar"
          aria-label="DUYO — boshiga"
          className="flex items-center justify-center rounded-full w-10 h-10 sm:w-11 sm:h-11 shrink-0 transition-shadow duration-200 hover:shadow-md"
          style={{ backgroundColor: '#EDEDED' }}
        >
          <Logo />
        </a>

        <div
          className="flex items-center gap-4 sm:gap-8 rounded-xl px-4 sm:px-7 py-2.5 sm:py-3"
          style={{ backgroundColor: '#EDEDED' }}
        >
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={active === s.id ? 'true' : undefined}
              className={`text-[12px] sm:text-[14px] font-medium transition-colors duration-200 whitespace-nowrap ${
                active === s.id ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {s.nav}
            </a>
          ))}
          <a
            href={APK_URL}
            className="hidden sm:inline-flex items-center gap-1.5 text-[14px] font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200 group"
          >
            Yuklab olish
            <Arrow />
          </a>
        </div>
      </nav>

      {/* Section rail. Jumps, and shows where you are — the same information
          the progress bar carries, in the form you can act on. */}
      <div className="hidden md:flex fixed right-6 lg:right-9 top-1/2 -translate-y-1/2 z-20 flex-col gap-3">
        {SECTIONS.map((s, i) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-label={`${i + 1}. ${s.nav}`}
            aria-current={active === s.id ? 'true' : undefined}
            className="group flex items-center justify-end gap-2"
          >
            <span className="text-[11px] font-medium text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {s.nav}
            </span>
            <span
              className={`block rounded-full transition-all duration-300 ${
                active === s.id
                  ? 'w-2.5 h-6 bg-blue-500'
                  : 'w-2.5 h-2.5 bg-gray-400/45 group-hover:bg-gray-500'
              }`}
            />
          </a>
        ))}
      </div>

      <main className="relative z-10">
        {SECTIONS.map((s) => (
          <section
            key={s.id}
            id={s.id}
            aria-label={s.nav}
            className="min-h-screen flex items-end pb-12 sm:pb-16 lg:pb-24 px-6 sm:px-12 md:px-20 lg:px-28"
          >
            <div className="max-w-xs">
              <p className="text-[11.5px] font-semibold tracking-wide text-blue-500 mb-3">
                {s.badge}
              </p>
              <h2 className="text-[1.5rem] sm:text-[1.75rem] leading-[1.15] font-semibold text-gray-900 tracking-[-0.02em] mb-3 text-balance">
                {s.heading}
              </h2>
              <p className="text-[13px] leading-relaxed text-gray-500 mb-4">{s.body}</p>
              <a
                href={APK_URL}
                className="inline-flex items-center gap-2 text-[13px] font-medium text-blue-600 border border-blue-400 rounded-full px-5 py-2.5 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-200 group"
              >
                {s.cta}
                <Arrow />
              </a>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
