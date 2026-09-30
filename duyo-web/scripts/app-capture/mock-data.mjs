// Demo data for the DUYO screen capture. Every value here is invented: no real
// child, account, token or phone number. Shapes mirror the wire types in
// duyo-mobile/src/api/endpoints/* and the backend's schemas.

export const CHILD_ID = '0b6f3c1e-5d7a-4c2e-9a41-7e2f10c0d314';
export const USER_ID = 'a4d2e7c9-1f38-4b6a-8c55-2e9d7b1f6a02';
/** The child's own peer handle. Never the real name: peers see pseudonyms. */
export const MY_HANDLE = 'Shunqor-17';

/** 2026-09-29 (a Tuesday), Tashkent afternoon. */
export const DAY = '2026-09-29';
export const at = (hhmm) => `${DAY}T${hhmm}:00+05:00`;

/**
 * The phone's clock in each capture, in the order the site shows them, so the
 * status bar the site draws reads forward through the film. Each screen's own
 * timestamps sit just before its clock.
 */
export const CLOCK = { chat: '16:40', safety: '16:52', map: '16:54', goals: '16:56', home: '16:58' };

export const CHILD = {
  id: CHILD_ID,
  name: 'Sardor',
  age: 14,
  age_segment: 'companion',
  language: 'uz',
  interests: ['matematika', 'kitoblar', 'fizika'],
  mascot: 'duyo',
  photo_url: null,
};

// ── Chat (section 0) ────────────────────────────────────────────────────────

export const QUESTION = '2x² + 5x + 3 = 0 tenglamani yechib ber';

export const CHAT_REPLY = "Zo'r misol! Bu kvadrat tenglama — uni diskriminant orqali yechamiz 👇";

// POST /chat/board — the fields services/gemini.py::solve_on_board returns.
export const BOARD = {
  is_problem: true,
  title: 'Kvadrat tenglama',
  problem: '2x² + 5x + 3 = 0',
  steps: [
    { expr: 'a = 2, b = 5, c = 3', note: 'Koeffitsiyentlarni aniqlaymiz' },
    { expr: 'D = b² − 4ac = 25 − 24 = 1', note: 'D > 0 — ikkita ildiz bor' },
    { expr: 'x₁ = (−5 + 1) / 4 = −1', note: '' },
    { expr: 'x₂ = (−5 − 1) / 4 = −1,5', note: '' },
  ],
  answer: 'x₁ = −1, x₂ = −1,5',
  figure: null,
};

export const PLANS = [
  {
    key: 'free', name: 'Bepul', price_monthly: 0, price_yearly: 0,
    daily_message_limit: 20, ai_turns_per_day: 10, languages: 3, voice: true,
    max_children: 1, features: [],
  },
  {
    key: 'standart', name: 'Standart', price_monthly: 29000, price_yearly: 290000,
    daily_message_limit: 100, ai_turns_per_day: 50, languages: 3, voice: true,
    max_children: 2, features: [],
  },
];

export const SUBSCRIPTION = {
  tier: 'free', status: 'active', provider: null, started_at: null, expires_at: null,
};

// ── Home (section 4) ────────────────────────────────────────────────────────

export const BALLS = {
  balance: 1250, level: 4, level_name: 'Izlanuvchi',
  current_threshold: 1000, next_threshold: 2000, balls_to_next: 750,
};
export const TAMAGOCHI = { energy: 82, joy: 88, learning: 76, health: 86 };
export const STREAK = { current_streak: 6, longest_streak: 11, last_active_date: DAY };

// The real catalogue, duyo-backend/src/duyo/gamification/achievements.py.
const ach = (key, name, emoji, earned) => ({ key, name, emoji, earned });
export const ACHIEVEMENTS = [
  ach('first_chat', 'Birinchi suhbat', '🎯', true),
  ach('curious', 'Qiziquvchi', '🧠', true),
  ach('explorer', 'Izlanuvchi', '🚀', false),
  ach('streak_3', '3 kunlik seriya', '🔥', true),
  ach('streak_7', '7 kunlik seriya', '⭐', false),
  ach('level_up', 'Daraja oshish', '📈', true),
  ach('duyo_dust', "DUYO do'sti", '💛', false),
];

// ── Goals (section 3) ───────────────────────────────────────────────────────

export const GOAL_TITLE = "O'tkan kunlar romanini o'qib tugatish";
export const GOAL_STEPS = [
  '1–5 boblar', '6–10 boblar', '11–15 boblar', 'Qisqacha tahlil yozish',
];
/**
 * Progress is counted in the unit the goal extractor gives a book, chapters
 * (prompts.py: unit_label "bet|bob|dars|kun"), against the 15 chapters DUYO's
 * step plan above covers. It is independent of the goal-path notes, as in the
 * backend: goal_paths.py writes notes and never touches current_unit.
 */
export const GOAL_UNIT = 'bob';
export const GOAL_TOTAL = 15;

export function goal(current) {
  return {
    id: '5f0b2d8e-3c41-4e7a-b9d2-6a1c8e4f7b03',
    child_id: CHILD_ID,
    kind: 'book',
    title: GOAL_TITLE,
    match_key: 'book_otkan_kunlar',
    target_ref: null,
    status: 'active',
    source: 'child_stated',
    confirmed_at: at('15:10'),
    unit_label: GOAL_UNIT,
    current_unit: current,
    total_units: GOAL_TOTAL,
    // api/v1/goals.py rounds to one decimal.
    progress_pct: Math.round((current / GOAL_TOTAL) * 1000) / 10,
    last_progress_at: at('16:30'),
    target_date: null,
    created_at: '2026-09-21T18:05:00+05:00',
  };
}

export const GOAL_SIGNAL = [
  { match_key: 'book_otkan_kunlar', title: GOAL_TITLE, count: 7 },
];

const peer = (n, name, badge = null) => ({
  child_id: `c0ffee00-0000-4000-8000-00000000000${n}`,
  display_name: name,
  age_segment: 'companion',
  badge,
});
export const PEERS = {
  lochin: peer(1, 'Lochin-58'),
  yulduz: peer(2, 'Yulduz-73'),
  burgut: peer(3, 'Burgut-42', 'streak_3'),
  kamalak: peer(4, 'Kamalak-26'),
  bulut: peer(5, 'Bulut-91'),
};

export const HANDLE_SUGGESTIONS = { suggestions: ['Shunqor-17', 'Qoplon-64', 'Tulpor-35'] };

export const SOCIAL_SETTINGS = { display_name: MY_HANDLE, discoverable: true };

export const GOAL_MATES = [PEERS.lochin, PEERS.yulduz, PEERS.burgut].map((p) => ({
  peer: p, match_key: 'book_otkan_kunlar', shared_goal: GOAL_TITLE,
}));

// ── Safety (section 1) ──────────────────────────────────────────────────────

export const GROUP_KEY = 'kitoblar:companion';

const CATEGORY_LABELS = [
  ['it', 'IT & Code'], ['til', "Til o'rganish"], ['talim', "Ta'lim"],
  ['kitoblar', 'Kitoblar'], ['sport', 'Sport'], ['sayohat', 'Sayohat'],
  ['ijod', 'Ijodkorlik'], ['rivoj', "O'zini rivojlantirish"],
];
export const GROUPS = CATEGORY_LABELS.map(([category, label], i) => ({
  key: `${category}:companion`,
  category,
  label,
  members: category === 'kitoblar' ? 14 : 6 + i,
  joined: category === 'kitoblar',
}));

export const GROUP_MEMBERS = Object.values(PEERS);

let seq = 0;
const gm = (who, hhmm, body) => {
  seq += 1;
  const mine = who === null;
  return {
    id: `9a7c0000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    seq,
    body,
    sender_name: mine ? MY_HANDLE : who.display_name,
    sender_child_id: mine ? CHILD_ID : who.child_id,
    mine,
    created_at: at(hhmm),
    media_url: null,
    media_kind: null,
    media_duration_ms: null,
  };
};
export const GROUP_MESSAGES = [
  gm(PEERS.yulduz, '16:42', "Salom hammaga! Kim «O'tkan kunlar»ni o'qiyapti? 📖"),
  gm(PEERS.lochin, '16:44', 'Men! 9-bobga yetdim'),
  gm(PEERS.lochin, '16:44', "Otabek bilan Kumush sahnasi juda ta'sirli ekan"),
  gm(PEERS.burgut, '16:47', "Men ham boshladim, har kuni bittadan bob o'qiyapman"),
  gm(null, '16:49', 'Men 11-bobdaman. Hafta oxirigacha tugatamizmi?'),
  gm(PEERS.yulduz, '16:50', 'Kelishdik! Kim birinchi tugatsa, qisqacha tahlil yozadi ✍️'),
  gm(PEERS.burgut, '16:51', '👍'),
];

/** The message the child tries to send in state 2 — contact details. All
 *  zeros, so it is nobody's number: the server stops it on the word "raqam"
 *  (social.py), not on the digits, so the refusal is the same. */
export const BLOCKED_DRAFT = 'Raqamim: 90 000 00 00';

/** Verbatim from duyo-backend/src/duyo/api/v1/social.py `_REFUSALS["contact_info"]`. */
export const CONTACT_REFUSAL =
  'Bu xabar yuborilmadi. Xavfsizlik uchun telefon raqami, manzil yoki ' +
  "boshqa ilovadagi profilni almashish mumkin emas.";

// ── Brain map (section 2) ───────────────────────────────────────────────────

const TOPICS_FEW = [
  ['Matematika', 'Algebra va geometriya. Bugun [[Kvadrat tenglama]]ni o\'rgandim. #matematika'],
  ['Kvadrat tenglama', 'ax² + bx + c = 0. Diskriminant: D = b² − 4ac. #matematika'],
  ['Fizika', 'Harakat, kuch va energiya. #fizika'],
  ['Adabiyot', "Abdulla Qodiriy — [[O'tkan kunlar]]. #adabiyot"],
  ["O'tkan kunlar", 'Otabek va Kumush haqidagi roman. #adabiyot'],
];

const TOPICS_MORE = [
  ...TOPICS_FEW,
  ['Parabola', 'y = ax² grafigi. [[Kvadrat tenglama]] bilan bog\'liq. #matematika'],
  ['Gravitatsiya', "Yer hamma narsani o'ziga tortadi. [[Fizika]] #fizika"],
  ['Geologiya', 'Yer haqidagi fan: [[Yer tuzilishi]], [[Vulqonlar]]. #geologiya'],
  ['Vulqonlar', 'Magma yer yuzasiga otilib chiqadi. [[Yer tuzilishi]] #geologiya'],
  ['Yer tuzilishi', "Po'st, mantiya va yadro. #geologiya"],
  ['Qodiriy', "Abdulla Qodiriy — o'zbek romanchiligining asoschisi. [[O'tkan kunlar]] #adabiyot"],
];

/** The goal path services/goal_paths.py writes: hub -> 1-qadam -> ... -> hub. */
function goalPathNotes() {
  const steps = GOAL_STEPS.map((s, i) => `${i + 1}-qadam: ${s}`);
  const hub = [GOAL_TITLE, `🎯 Maqsad. Bu yerdan boshla: [[${steps[0]}]]\n\n#maqsad`, '#FDC700'];
  const details = [
    "O'tkan kunlar romanining dastlabki 5 bobini o'qi, qahramonlarni yozib bor.",
    "6–10 boblarni o'qi: Otabek va Kumush taqdiri qanday o'zgaradi?",
    "11–15 boblarni o'qib, voqealar rivojini kuzat.",
    "Romandan olgan taassurotlaringni qisqacha yozib chiq.",
  ];
  const rest = steps.map((title, i) => {
    const last = i + 1 >= steps.length;
    const next = last ? GOAL_TITLE : steps[i + 1];
    const label = last ? 'Yakuniy maqsad' : 'Keyingi qadam';
    return [title, `${details[i]}\n\n${label}: [[${next}]]\n\n#maqsad`, '#FDC700'];
  });
  return [hub, ...rest];
}

export function brainNotes(level) {
  const base = level >= 2 ? [...TOPICS_MORE, ...goalPathNotes()] : TOPICS_FEW;
  return base.map(([title, body, colour], i) => ({
    id: `b7a10000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    title,
    body,
    colour: colour ?? null,
    created_at: at(`1${Math.min(5, i % 6)}:0${i % 10}`),
    updated_at: at(`16:${String(30 - i).padStart(2, '0')}`),
  }));
}
