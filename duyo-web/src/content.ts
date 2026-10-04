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
 * Every href is live: the APK and the legal pages (which ship with this site,
 * public/*.html) were checked with a request when this was written.
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
  // Suffixes join a name directly in Uzbek: DUYOni, not DUYO'ni.
  listen: 'DUYOni tinglang',
  stop: 'To‘xtatish',
  transcript: '',
} as const;

/**
 * Three things DUYO does, under the hero's buttons — each one the section it
 * leads to says in full: it speaks Uzbek, it solves a problem step by step
 * on the board (maths, physics, chemistry), and peer messages are screened.
 */
export const HERO_POINTS = ['O‘zbek tilida gaplashadi', 'Masalalarni bosqichma-bosqich yechadi', 'Har bir xabar tekshiriladi'] as const;

/** The hint at the foot of the hero that the page goes on. */
export const SCROLL_HINT = 'Pastga aylantiring';

export const SECTIONS: Section[] = [
  {
    id: 'boshlash',
    nav: 'DUYO',
    theme: 'dark',
    layout: 'left',
    badge: '13–16 yoshlilar uchun · o‘zbek tilida',
    heading: 'Salom! Men — DUYO.',
    body: 'O‘zbek tilida gaplashadigan sun’iy intellekt hamrohingizman: darsda qiynalgan mavzularingizni tushuntiraman va maqsadingizga erishishga yordam beraman.',
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
    body: 'Matematika, fizika va kimyodan savolingizni o‘z tilingizda bering. Masala doskada bosqichma-bosqich yechiladi: faqat javob emas, yechim yo‘li ham.',
  },
  {
    id: 'xavfsizlik',
    nav: 'Xavfsizlik',
    theme: 'dark',
    layout: 'left',
    badge: 'Xavfsizlik',
    heading: 'Har bir xabar yetkazilishdan oldin tekshiriladi.',
    body: 'Xabarda telefon raqami, havola yoki xavfli so‘z topilsa, u yetkazilmaydi. Inqiroz belgilari sezilsa, ishonch telefoni raqami darhol ko‘rsatiladi.',
    proof: [
      { value: '3', label: 'mustaqil tekshiruv — har bir xabar matni uchun' },
      { value: 'Taxallus', label: 'ism va telefon o‘rniga' },
      { value: '1142', label: 'inqirozli vaziyatda ishonch telefoni' },
    ],
  },
  {
    id: 'miya',
    nav: 'Miya xaritasi',
    theme: 'dark',
    layout: 'right',
    badge: 'Miya xaritasi',
    heading: 'O‘rganganlaringiz bilim xaritasiga aylanadi.',
    body: 'Suhbatlarda o‘rgangan mavzularingiz xaritada tugunlarga aylanib, bir-biri bilan bog‘lanadi. Qancha ko‘p o‘rgansangiz, bilimlar galaktikangiz shuncha kengayadi.',
  },
  {
    id: 'maqsad',
    nav: 'Maqsadlar',
    theme: 'dark',
    layout: 'left',
    badge: 'Maqsadlar',
    heading: 'Maqsad qo‘ying — DUYO uni qadamlarga bo‘ladi.',
    body: 'Katta maqsad kichik qadamlarga ajratiladi, bajarilgan har bir qadam belgilanib boradi. Shu maqsad sari intilayotgan tengdoshlaringizni ham topasiz — taxallus ostida, xavfsiz.',
  },
  {
    id: 'yuklab',
    nav: 'Yuklab olish',
    theme: 'dark',
    layout: 'right',
    badge: 'Bepul boshlang',
    heading: 'DUYO bilan bugun tanishing.',
    body: 'Android qurilmalar uchun. Bepul tarifda kuniga 20 tagacha xabar yuborish mumkin, ulardan 10 tasigacha ovozli.',
    ctas: [{ label: 'Android uchun yuklab olish', href: APK_URL, variant: 'primary' }],
  },
];

export const FOOTER_LINKS = [
  { label: 'Maxfiylik siyosati', href: './privacy.html' },
  { label: 'Foydalanish shartlari', href: './terms.html' },
  { label: 'Hisobni o‘chirish', href: './account-deletion.html' },
  { label: 'Yordam', href: `mailto:${SUPPORT_EMAIL}` },
] as const;
