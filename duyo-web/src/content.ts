/**
 * Every word on the page, and every place a control goes.
 *
 * Each claim here was checked against the product's code before it was
 * written, because a landing page for a children's app is a promise to a
 * parent. Where it says three checks, screen_peer_message runs three
 * independent checks on the text of every peer message (a voice note's
 * transcript included). A peer sees a PeerCard, which carries a handle in
 * place of the child's name and phone — "in place of", not "never reaches":
 * a child can still type a number in pieces, and the screen misses it.
 * Where it says 20 messages of which up to 10 spoken, that is what any order
 * of use is guaranteed: billing/limits.py counts spoken turns inside the
 * daily 20 and caps them at 10. Change a number here only after changing it
 * in the server.
 *
 * What is NOT promised, on purpose. An SMS to a parent in a crisis: no
 * parent account exists yet, so services/crisis_notify.py finds no adult
 * separate from the child and sends nothing — the child gets the crisis
 * screen with the 1142 helpline, and that is what the copy says. A board
 * for every subject: BOARD_PROMPT answers is_problem=false for anything but
 * a maths, physics or chemistry problem. That nothing gets through: the peer
 * screen blocks links and +998 or nine-digit numbers but not a street
 * address or a number typed in pieces, so the copy names what it finds and
 * says what happens when it does.
 *
 * Every href is live — verified with a HEAD request when this was written.
 */

export type Theme = 'light' | 'dark';

/** Where the copy sits. The 3D subject takes the opposite side. */
export type Layout = 'left' | 'right' | 'center';

export interface Proof {
  value: string;
  label: string;
}

export interface Cta {
  label: string;
  href: string;
  variant: 'primary' | 'ghost';
}

export interface Section {
  id: string;
  /** Label in the navbar and the section rail. */
  nav: string;
  /** Background under this section — the text colour follows it. */
  theme: Theme;
  layout: Layout;
  badge: string;
  heading: string;
  body: string;
  proof?: Proof[];
  ctas?: Cta[];
}

export const APK_URL = 'https://admin.duyo.uz/apk/duyo.apk';
export const SUPPORT_EMAIL = 'duyosupport@gmail.com';

/**
 * DUYO's own voice, introducing itself in the hero. The recording is the
 * owner's: drop it at public/audio/duyo-salom.mp3 (an mp3, under ~1 MB).
 * Fill in `transcript` too: it is the recording's text alternative, shown
 * as captions while DUYO talks.
 * Until the file is there the listen button stays hidden and DUYO simply
 * does not talk — the page never shows a control that does nothing. If the
 * words are put in `transcript`, they are shown as captions while it plays.
 */
export const DUYO_VOICE = {
  src: './audio/duyo-salom.mp3',
  listen: 'DUYO’ni tinglang',
  stop: 'To‘xtatish',
  transcript: '',
} as const;

export const SECTIONS: Section[] = [
  {
    id: 'boshlash',
    nav: 'DUYO',
    theme: 'dark',
    layout: 'left',
    badge: '13–16 yosh uchun · o‘zbek tilida',
    heading: 'Salom! Men — DUYO.',
    body: 'O‘zbek tilidagi AI hamrohingizman: savollaringizga qadamma-qadam javob beraman, maqsadingizni qadamlarga bo‘laman.',
    ctas: [
      { label: 'Ilovani yuklab olish', href: APK_URL, variant: 'primary' },
      { label: 'Qanday ishlaydi', href: '#savol', variant: 'ghost' },
    ],
  },
  {
    id: 'savol',
    nav: 'Suhbat',
    theme: 'dark',
    layout: 'right',
    badge: 'Dars yordami',
    heading: 'Savol bering. DUYO qadamma-qadam tushuntiradi.',
    body: 'Matematika, fizika, kimyo — o‘z tilingizda so‘rang. Masala doskada bosqichma-bosqich yechiladi: faqat natija emas, yo‘li ham.',
  },
  {
    id: 'xavfsizlik',
    nav: 'Xavfsizlik',
    theme: 'dark',
    layout: 'left',
    badge: 'Xavfsizlik',
    heading: 'Har bir xabar yetkazilishdan oldin tekshiriladi.',
    body: 'Telefon raqami, havola yoki xavfli so‘z topilsa — xabar yetib bormaydi. Inqiroz belgilari aniqlansa, ishonch telefoni raqami darhol ko‘rsatiladi.',
    proof: [
      { value: '3', label: 'mustaqil tekshiruv — har bir xabar matnida' },
      { value: 'Taxallus', label: 'ism va telefon o‘rniga' },
      { value: '1142', label: 'inqiroz holatida ishonch telefoni' },
    ],
  },
  {
    id: 'miya',
    nav: 'Miya xaritasi',
    theme: 'dark',
    layout: 'right',
    badge: 'Miya xaritasi',
    heading: 'O‘rganganlaringiz bilim xaritasiga aylanadi.',
    body: 'Suhbatda o‘rgangan mavzularingiz o‘zi tugunga aylanadi va bir-biriga bog‘lanadi. Qancha ko‘p o‘rgansangiz, galaktika shuncha o‘sadi.',
  },
  {
    id: 'maqsad',
    nav: 'Maqsadlar',
    theme: 'dark',
    layout: 'left',
    badge: 'Maqsadlar',
    heading: 'Maqsad qo‘ying — DUYO uni qadamlarga bo‘ladi.',
    body: 'Katta maqsad kichik qadamlarga ajraladi, har biri belgilab boriladi. Bir xil maqsaddagi tengdoshlarni topasiz — taxallus bilan, xavfsiz.',
  },
  {
    id: 'yuklab',
    nav: 'Yuklab olish',
    theme: 'dark',
    layout: 'right',
    badge: 'Bepul boshlang',
    heading: 'DUYO bilan bugun tanishing.',
    body: 'Android uchun. Bepul rejada kuniga 20 ta xabar — ulardan 10 tasigacha ovozli.',
    ctas: [{ label: 'Android uchun yuklab olish', href: APK_URL, variant: 'primary' }],
  },
];

export const FOOTER_LINKS = [
  { label: 'Maxfiylik siyosati', href: 'https://duyo.uz/privacy.html' },
  { label: 'Foydalanish shartlari', href: 'https://duyo.uz/terms.html' },
  { label: 'Hisobni o‘chirish', href: 'https://duyo.uz/account-deletion.html' },
  { label: 'Yordam', href: `mailto:${SUPPORT_EMAIL}` },
] as const;
