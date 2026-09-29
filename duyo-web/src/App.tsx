/**
 * DUYO — a three-section landing where the robot is built as you scroll.
 *
 * Section 1 is a head: the mind, and what DUYO is.
 * Section 2 adds the body: what keeps a child safe inside it.
 * Section 3 adds the limbs: what a child actually does with it, and the CTA.
 *
 * The design language is the brief's and stays the brief's — paper grey,
 * #EDEDED pills, gray-900 headlines, gray-400 subtext, blue-500 accents, and
 * arrows that nudge right on hover. Three sections instead of one; nothing
 * about the look changed.
 *
 * The robot is built from primitives in `three/robot.ts` rather than loaded
 * as an image. The mascot that shipped before was an AI-generated photoreal
 * render, and Google Play rejected the listing under the Impersonation policy
 * for third-party assets. It is also the only way the assembly can work: a
 * flat image cannot come apart into a head, a body and a pair of arms.
 */

import Backdrop from './Backdrop';
import RobotStage from './RobotStage';

const APK_URL = 'https://admin.duyo.uz/apk/duyo.apk';

const NAV_LINKS = ['Imkoniyatlar', 'Xavfsizlik', 'Narxlar', 'Yordam'] as const;

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
    <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">
      →
    </span>
  );
}

interface SectionProps {
  badge: string;
  heading: string;
  body: string;
  children?: React.ReactNode;
}

/**
 * One screenful. The copy stays bottom-left as the brief has it, in a narrow
 * column, so the right half of the viewport belongs to the robot.
 */
function Section({ badge, heading, body, children }: SectionProps) {
  return (
    <section className="min-h-screen flex items-end pb-10 sm:pb-16 lg:pb-20 px-6 sm:px-12 md:px-20 lg:px-28">
      <div className="max-w-xs">
        <p className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-blue-500 mb-3">
          {badge}
        </p>
        <h2 className="text-[1.5rem] sm:text-[1.75rem] leading-[1.15] font-medium text-gray-900 tracking-tight mb-3">
          {heading}
        </h2>
        <p className="text-[13px] text-gray-400 font-normal mb-3">{body}</p>
        {children}
      </div>
    </section>
  );
}

export default function App() {
  return (
    <div className="relative bg-[#f0f0ee]">
      <Backdrop />
      <RobotStage />

      {/* Fixed, because the page is three screens now and a navbar that
          scrolls away on the first one is a navbar nobody uses. */}
      <nav className="fixed top-0 inset-x-0 z-20 flex items-center justify-center pt-4 sm:pt-6 px-4 sm:px-8 gap-2 sm:gap-3">
        <a
          href="#"
          aria-label="DUYO"
          className="flex items-center justify-center rounded-full w-10 h-10 sm:w-11 sm:h-11 shrink-0"
          style={{ backgroundColor: '#EDEDED' }}
        >
          <Logo />
        </a>

        <div
          className="flex items-center gap-4 sm:gap-10 rounded-xl px-4 sm:px-8 py-2.5 sm:py-3"
          style={{ backgroundColor: '#EDEDED' }}
        >
          {NAV_LINKS.map((label) => (
            <a
              key={label}
              href="#"
              className="text-[12px] sm:text-[14px] font-medium text-gray-700 hover:text-gray-900 transition-colors duration-200 whitespace-nowrap"
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      <main className="relative z-10">
        <Section
          badge="13–17 yosh uchun, o‘zbek tilida"
          heading="O‘smirlar uchun ishonchli sun’iy intellekt hamroh."
          body="Savolingizni o‘z tilingizda bering. Javob doskada qadamma-qadam yoziladi — u baholamaydi, kulmaydi, charchamaydi."
        >
          <a
            href={APK_URL}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-blue-500 border border-blue-400 rounded-full px-5 py-2.5 hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all duration-200 group"
          >
            Ilovani yuklab olish
            <Arrow />
          </a>
        </Section>

        <Section
          badge="Xavfsizlik"
          heading="Har bir xabar yetkazilishdan oldin tekshiriladi."
          body="Xavfli belgilar aniqlansa, DUYO yordam raqamini ko‘rsatadi va ota-onaga SMS boradi. Tengdoshlar bir-birini faqat taxallus bo‘yicha ko‘radi — ism ham, telefon ham o‘tmaydi."
        />

        <Section
          badge="Harakat"
          heading="Bilish yetarli emas — qilish kerak."
          body="Maqsadingizni yozasiz, DUYO uni qadamlarga bo‘ladi. Suhbatlaringizdan bilim xaritasi o‘sadi, bir xil maqsaddagi tengdoshlar topiladi."
        >
          <a
            href={APK_URL}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-blue-500 border border-blue-400 rounded-full px-5 py-2.5 hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all duration-200 group"
          >
            Ilovani yuklab olish
            <Arrow />
          </a>
        </Section>
      </main>
    </div>
  );
}
