/**
 * The robot page's words: the DUYO Robot concept deck (owner's PDF, six
 * slides), one slide to a section, in its order and in its words. Only
 * three things are the site's own: "Neo Miya" spelled as the app spells it
 * (the deck has "Neo Miyya"), suffixes joined to the name as on the rest of
 * the site ("DUYOning"), and the closing note that this is a concept — the
 * robot cannot be bought, so the page's one action is the app.
 */

import { APK_URL, SUPPORT_EMAIL } from '../content';
import type { Section } from '../content';
import type { FooterLink } from '../ui/Footer';
import type { NavConfig } from '../ui/Navbar';

export const ROBOT_SECTIONS: Section[] = [
  {
    id: 'robot',
    nav: 'DUYO Robot',
    theme: 'dark',
    layout: 'left',
    badge: 'DUYO Robot · Konsept · 2026',
    heading: 'DUYO Robot —\nAI ekrandan chiqadi.',
    accent: true,
    body: 'DUYOning sun’iy intellekti jismoniy robotda: bola bilan suhbatlashadi, o‘rgatadi va bilimni devorga olib chiqadi.',
    points: [
      {
        style: 'chips',
        // Each is said again, in full, under "Imkoniyatlar".
        optional: true,
        items: [
          { icon: 'projector', title: '4K proyektor' },
          { icon: 'mic', title: 'Ovozli boshqaruv' },
          { icon: 'sync', title: 'Ilova bilan sinxron' },
        ],
      },
    ],
    ctas: [{ label: 'Konseptni ko‘rish', href: '#proyeksiya', variant: 'primary' }],
  },
  {
    id: 'proyeksiya',
    nav: 'Proyeksiya',
    theme: 'dark',
    layout: 'left',
    badge: 'Konsept',
    heading: 'Ekrandagi hamroh —\njonli hamrohga aylanadi.',
    accent: true,
    body: 'Keyingi bosqich — DUYOning sun’iy intellekti jismoniy robotda. Robot bola bilan suhbatlashadi, o‘rgatadi va 4K proyektor orqali bilimni devorga olib chiqadi.',
    points: [
      {
        style: 'chips',
        // The body says it; the scene shows it.
        optional: true,
        items: [
          { icon: 'planet', title: 'Neo Miya devorda' },
          { icon: 'books', title: 'Kitob va videolar' },
          { icon: 'wave', title: 'Ovoz va harakat' },
        ],
      },
    ],
  },
  {
    id: 'imkoniyatlar',
    nav: 'Imkoniyatlar',
    theme: 'dark',
    layout: 'right',
    badge: 'Imkoniyatlar',
    heading: 'Robot nima\nqila oladi?',
    accent: true,
    points: [
      {
        style: 'grid',
        items: [
          { icon: 'projector', title: 'O‘rnatilgan 4K proyektor', text: 'Istalgan devorni katta ekranga aylantiradi.' },
          { icon: 'robot', title: 'Onlayn AI hamroh', text: 'Ilovadagi AI imkoniyatlari — endi ovoz orqali.' },
          { icon: 'planet', title: 'Neo Miya devorda', text: 'Bolaning fikrlar koinoti katta ekranda.' },
          { icon: 'books', title: 'Interaktiv ta’lim', text: 'Elektron kitoblar, darsliklar va videolar.' },
          { icon: 'wave', title: 'Ovoz va harakat', text: 'Robot so‘z bilan ham, harakat bilan ham javob beradi.' },
          { icon: 'compact', title: 'Ixcham dizayn', text: 'Kichik va yengil — istalgan xonaga mos.' },
        ],
      },
    ],
  },
  {
    id: 'qanday',
    nav: 'Qanday ishlaydi',
    theme: 'dark',
    layout: 'left',
    badge: 'Ilova + robot',
    heading: 'Bola aytadi —\nrobot ko‘rsatadi.',
    accent: true,
    points: [
      {
        style: 'steps',
        items: [
          { icon: 'chat', title: 'Bola so‘raydi', text: '«Shu darslikni och»' },
          { icon: 'sync', title: 'DUYO tushunadi', text: 'Ilova va robot real vaqtda sinxron' },
          { icon: 'projector', title: 'Devorda paydo bo‘ladi', text: '4K proyeksiya — darhol' },
        ],
      },
      {
        style: 'chips',
        label: 'Devorda nimalar ko‘rinadi',
        // The hologram shows these four on a wide screen; a short one keeps
        // the steps and lets this go.
        optional: true,
        items: [
          { icon: 'planet', title: 'Neo Miya koinoti' },
          { icon: 'books', title: 'Kitob va darsliklar' },
          { icon: 'play', title: 'Yoshga mos videolar' },
          { icon: 'flag', title: 'Rejalar va maqsadlar' },
        ],
      },
    ],
  },
  {
    id: 'ishtirokchi',
    nav: 'Ishtirokchi',
    theme: 'dark',
    layout: 'right',
    badge: 'Interaktivlik',
    heading: 'Tinglovchi emas —\nishtirokchi.',
    accent: true,
    body: 'DUYO Robot bolani ekran oldidagi kuzatuvchidan o‘rganish jarayonining faol ishtirokchisiga aylantiradi.',
    points: [
      {
        style: 'grid',
        items: [
          { icon: 'mic', title: 'Ovoz bilan boshqaruv', text: 'Bola tugma bosmaydi — so‘raydi, robot bajaradi.' },
          { icon: 'chat', title: 'Jonli muloqot', text: 'Robot ovoz va harakat bilan javob beradi — suhbat tabiiy kechadi.' },
          { icon: 'wall', title: 'Katta ekranda o‘rganish', text: 'Kitob, video va masalalar devorda — birgalikda ko‘rish mumkin.' },
          { icon: 'spark', title: 'Faol o‘rganish', text: 'Bola so‘raydi, ko‘radi, takrorlaydi — bilim mustahkamlanadi.' },
        ],
      },
    ],
  },
  {
    id: 'yakun',
    nav: 'Yakun',
    theme: 'dark',
    layout: 'left',
    badge: 'Yakuniy fikr',
    heading: '«DUYO Robot — bola bilan birga o‘ylaydigan, o‘rgatadigan va bilimni ko‘rinadigan qiladigan hamroh.»',
    quote: true,
    points: [
      {
        style: 'layers',
        label: 'Uch qatlam — bitta ekotizim',
        // The quote says what the robot is; a short screen keeps it and the download.
        optional: true,
        items: [
          { icon: 'apps', title: 'DUYO ilovasi', text: 'Maqsad, suhbat va Neo Miya — telefonda.' },
          { icon: 'robot', title: 'DUYO Robot', text: 'Ovoz, harakat va hamrohlik — xonada.', lead: true },
          { icon: 'projector', title: 'Proyeksiya', text: 'Rejalar, darsliklar va koinot — devorda.' },
        ],
      },
    ],
    ctas: [{ label: 'Ilovani yuklab olish', href: APK_URL, variant: 'primary' }],
    note: 'DUYO Robot — konsept. Tasvirlar va imkoniyatlar yakuniy mahsulotdan farq qilishi mumkin.',
  },
];

export const ROBOT_NAV: NavConfig = {
  logo: { href: '../', label: 'DUYO — bosh sahifa' },
  link: { href: '../', label: 'Bosh sahifa', wideOnly: true },
  cta: { href: APK_URL, label: 'Yuklab olish' },
};

/** The site's footer, from this page's folder. */
export const ROBOT_FOOTER: FooterLink[] = [
  { label: 'Bosh sahifa', href: '../' },
  { label: 'Maxfiylik siyosati', href: '../privacy.html' },
  { label: 'Foydalanish shartlari', href: '../terms.html' },
  { label: 'Hisobni o‘chirish', href: '../account-deletion.html' },
  { label: 'Yordam', href: `mailto:${SUPPORT_EMAIL}` },
];

/** Under the download: back to the app's own page (on a phone, the footer's first link does it). */
export const ROBOT_NEXT = { href: '../', label: 'DUYO ilovasi bilan tanishing', wideOnly: true };

/** What DUYO says in the participant section, in a bubble beside its head. */
export const ROBOT_SAYS = 'Salom! Bugun nimani o‘rganamiz?';

/** The four things the hologram shows, around it (the deck's "devorda nimalar ko‘rinadi"). */
export const HOLO_CARDS = [
  { icon: 'planet', label: 'Neo Miya koinoti' },
  { icon: 'books', label: 'Kitob va darsliklar' },
  { icon: 'play', label: 'Yoshga mos videolar' },
  { icon: 'flag', label: 'Rejalar va maqsadlar' },
] as const;
