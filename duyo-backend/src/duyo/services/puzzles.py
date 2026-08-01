"""Logic puzzles shown on the chalkboard between chat turns.

Code-defined catalogue, like `gamification/levels.py` and `services/scripted.py`
— no table, no LLM call, no per-question cost. Only the child's ATTEMPTS are
stored (models/puzzle.py), so adding or fixing an item is a code change and
never a data migration.

Item sources: classic folk brain-teasers that belong to no one (the apples, the
cats-and-mice, the diggers) plus sequences written for DUYO. Nothing here is
transcribed from a third-party test bank — see duyo-docs/decisions.md D-004,
which keeps the beta on public-domain and original content only.

NOT a psychometric instrument. Results feed the report's "reasoning" signal as
a rough band (see analysis/reports.py); they are never an IQ score, and the
parent-facing wording must stay non-clinical.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

from duyo.models.child import AgeSegment


@dataclass(frozen=True)
class Puzzle:
    puzzle_id: str
    text: str
    choices: tuple[str, ...]
    correct_index: int
    explanation: str
    # 1 easy … 3 hard. Feeds the reasoning band: a child answering level-3
    # items is doing something different from one answering level-1 items.
    difficulty: int
    segments: tuple[AgeSegment, ...]


_ALL: tuple[AgeSegment, ...] = (
    AgeSegment.JUNIOR,
    AgeSegment.EXPLORER,
    AgeSegment.COMPANION,
)
_OLDER: tuple[AgeSegment, ...] = (AgeSegment.EXPLORER, AgeSegment.COMPANION)
_TEEN: tuple[AgeSegment, ...] = (AgeSegment.COMPANION,)


PUZZLES: tuple[Puzzle, ...] = (
    # ── Classic brain-teasers (folk, no owner) ───────────────────────────────
    Puzzle(
        "apples", "5 ta olma bor edi. 2 tasini olding. Sende nechta olma bor?",
        ("2 ta", "3 ta", "5 ta", "7 ta"), 0,
        "Sen olgan olmalar sende — ya'ni 2 ta. Qolgan 3 tasi hali savatda.",
        1, _ALL,
    ),
    Puzzle(
        "cats_mice",
        "3 ta mushuk 3 ta sichqonni 3 daqiqada tutadi. 100 ta mushuk 100 ta "
        "sichqonni qancha vaqtda tutadi?",
        ("3 daqiqa", "100 daqiqa", "33 daqiqa", "1 daqiqa"), 0,
        "Har mushuk bitta sichqonni 3 daqiqada tutadi. Mushuk ham, sichqon ham "
        "ko'paysa, vaqt o'zgarmaydi.",
        2, _ALL,
    ),
    Puzzle(
        "diggers",
        "1 kishi 1 daqiqada 1 teshik qazsa, 10 kishi 10 ta teshikni necha "
        "daqiqada qazadi?",
        ("1 daqiqa", "10 daqiqa", "100 daqiqa", "5 daqiqa"), 0,
        "Har kishi o'z teshigini bir vaqtda qazadi — hammasi 1 daqiqa.",
        2, _ALL,
    ),
    Puzzle(
        "sisters",
        "6 ta qizning har birida bitta ukasi bor. Jami nechta bola bor?",
        ("7 ta", "12 ta", "6 ta", "13 ta"), 0,
        "Uka hamma qizlarga umumiy — 6 qiz + 1 uka = 7 ta.",
        2, _ALL,
    ),
    Puzzle(
        "lilies",
        "Ko'ldagi nilufarlar soni har kuni ikki barobar ortadi. Ko'lni to'liq "
        "qoplashga 48 kun kerak. Yarmini qoplashga necha kun kerak?",
        ("47 kun", "24 kun", "46 kun", "12 kun"), 0,
        "Oxirgi kuni ikki barobar oshadi — 47-kuni yarmi, 48-kuni hammasi.",
        3, _OLDER,
    ),
    Puzzle(
        "machines",
        "5 ta mashina 5 daqiqada 5 ta detal yasaydi. 100 ta mashina 100 ta "
        "detalni qancha vaqtda yasaydi?",
        ("5 daqiqa", "100 daqiqa", "20 daqiqa", "1 daqiqa"), 0,
        "Har mashina bitta detalni 5 daqiqada yasaydi — son oshsa ham vaqt o'sha.",
        3, _OLDER,
    ),
    Puzzle(
        "weekday",
        "Bugun chorshanba bo'lsa, 100 kundan keyin qaysi kun bo'ladi?",
        ("Juma", "Chorshanba", "Shanba", "Payshanba"), 0,
        "100 ni 7 ga bo'lsak qoldiq 2 — chorshanbadan 2 kun keyin juma.",
        3, _OLDER,
    ),
    # ── Odd one out ──────────────────────────────────────────────────────────
    Puzzle(
        "odd_fruit", "Qaysi biri ortiqcha? Olma, shaftoli, pomidor, nok, gilos",
        ("Pomidor", "Nok", "Gilos", "Olma"), 0,
        "Qolganlari meva, pomidor esa sabzavot.",
        1, _ALL,
    ),
    Puzzle(
        "odd_shape", "Qaysi biri ortiqcha? Kvadrat, uchburchak, doira, to'rtburchak",
        ("Doira", "Kvadrat", "Uchburchak", "To'rtburchak"), 0,
        "Qolganlarining burchagi bor, doiraning yo'q.",
        1, _ALL,
    ),
    # ── Number sequences (mathematical facts, written for DUYO) ──────────────
    Puzzle(
        "seq_odd", "1, 3, 5, 7, ? — ketma-ketlikni davom ettir.",
        ("9", "8", "10", "11"), 0,
        "Har safar 2 qo'shiladi — toq sonlar.",
        1, _ALL,
    ),
    Puzzle(
        "seq_plus7", "16, 23, 30, 37, ?",
        ("44", "42", "45", "40"), 0,
        "Har qadamda 7 qo'shiladi.",
        1, _ALL,
    ),
    Puzzle(
        "seq_squares", "121, 144, 169, 196, ?",
        ("225", "216", "221", "230"), 0,
        "Bular kvadratlar: 11², 12², 13², 14² — keyingisi 15² = 225.",
        2, _OLDER,
    ),
    Puzzle(
        "seq_double_plus", "2, 5, 8, 11, ?",
        ("14", "12", "13", "16"), 0,
        "Har qadamda 3 qo'shiladi.",
        1, _ALL,
    ),
    Puzzle(
        "seq_x3", "1, 3, 9, 27, 81, ?",
        ("243", "162", "216", "250"), 0,
        "Har son 3 ga ko'paytiriladi.",
        2, _OLDER,
    ),
    Puzzle(
        "seq_minus", "40, 30, 22, 16, ?",
        ("12", "10", "14", "11"), 0,
        "Ayirmalar kamayadi: -10, -8, -6, keyin -4 → 12.",
        3, _OLDER,
    ),
    Puzzle(
        "seq_fib_like", "1, 3, 6, 11, 18, ?",
        ("29", "24", "27", "25"), 0,
        "Ayirmalar 2, 3, 5, 7 — tub sonlar. Keyingisi +11 → 29.",
        3, _TEEN,
    ),
    Puzzle(
        "seq_x2_plus", "2, 5, 11, 23, 47, ?",
        ("95", "94", "96", "91"), 0,
        "Har safar ikki barobar + 1: 47×2+1 = 95.",
        3, _TEEN,
    ),
    Puzzle(
        "seq_halves", "225, 100, 36, 9, ?",
        ("1", "0", "3", "4"), 0,
        "Bular kvadratlar: 15², 10², 6², 3² — asoslar 15, 10, 6, 3, keyin 1.",
        3, _TEEN,
    ),
    # ── Everyday reasoning ───────────────────────────────────────────────────
    Puzzle(
        "age_gap",
        "Meri 16 yoshda. U akasidan 4 marta katta. Maryam undan ikki barobar "
        "katta bo'lsa, Maryam necha yoshda?",
        ("32", "20", "24", "28"), 0,
        "Maryam Meridan ikki barobar katta: 16 × 2 = 32.",
        2, _OLDER,
    ),
    Puzzle(
        "fractions", "Qaysi kasr eng katta? 3/5, 5/8, 1/2, 4/7",
        ("5/8", "3/5", "4/7", "1/2"), 0,
        "5/8 = 0.625, 3/5 = 0.6, 4/7 ≈ 0.571, 1/2 = 0.5.",
        3, _OLDER,
    ),
    Puzzle(
        "date_back", "Bugun 5-mart bo'lsa, 3 kun oldin qaysi sana edi?",
        ("2-mart", "3-mart", "1-mart", "4-mart"), 0,
        "5 - 3 = 2 → 2-mart.",
        1, _ALL,
    ),

    # ── Junior: counting and simple steps ────────────────────────────────────
    Puzzle("seq_j_plus2", "2, 4, 6, 8, ?", ("10", "9", "12", "11"), 0,
           "Har safar 2 qo'shiladi.", 1, _ALL),
    Puzzle("seq_j_plus5", "5, 10, 15, 20, ?", ("25", "22", "30", "24"), 0,
           "Har safar 5 qo'shiladi.", 1, _ALL),
    Puzzle("seq_j_plus10", "10, 20, 30, 40, ?", ("50", "45", "60", "41"), 0,
           "Har safar 10 qo'shiladi.", 1, _ALL),
    Puzzle("seq_j_plus3", "3, 6, 9, 12, ?", ("15", "14", "18", "13"), 0,
           "Uchtalab sanaymiz: 12 + 3 = 15.", 1, _ALL),
    Puzzle("seq_j_minus2", "20, 18, 16, 14, ?", ("12", "13", "10", "15"), 0,
           "Har safar 2 ayiriladi.", 1, _ALL),
    Puzzle("seq_j_minus10", "100, 90, 80, 70, ?", ("60", "65", "50", "69"), 0,
           "Har safar 10 ayiriladi.", 1, _ALL),
    Puzzle("seq_j_double", "1, 2, 4, 8, ?", ("16", "12", "10", "14"), 0,
           "Har son ikki barobar oshadi.", 1, _ALL),
    Puzzle("seq_j_double2", "2, 4, 8, 16, ?", ("32", "24", "20", "18"), 0,
           "Har son ikki barobar oshadi: 16 × 2 = 32.", 1, _ALL),
    Puzzle("seq_j_down", "9, 8, 7, 6, ?", ("5", "4", "6", "3"), 0,
           "Bittalab kamayadi.", 1, _ALL),
    Puzzle("seq_j_plus4", "4, 8, 12, 16, ?", ("20", "18", "24", "22"), 0,
           "Har safar 4 qo'shiladi.", 1, _ALL),

    Puzzle("odd_animal", "Qaysi biri ortiqcha? Mushuk, it, ot, stol",
           ("Stol", "Mushuk", "It", "Ot"), 0,
           "Qolganlari hayvon, stol esa buyum.", 1, _ALL),
    Puzzle("odd_colour", "Qaysi biri ortiqcha? Qizil, ko'k, yashil, katta",
           ("Katta", "Qizil", "Ko'k", "Yashil"), 0,
           "Qolganlari rang, «katta» esa o'lcham.", 1, _ALL),
    Puzzle("odd_transport", "Qaysi biri ortiqcha? Avtobus, mashina, poyezd, daraxt",
           ("Daraxt", "Avtobus", "Mashina", "Poyezd"), 0,
           "Qolganlari transport, daraxt esa o'simlik.", 1, _ALL),
    Puzzle("odd_body", "Qaysi biri ortiqcha? Bosh, qo'l, oyoq, non",
           ("Non", "Bosh", "Qo'l", "Oyoq"), 0,
           "Qolganlari tana a'zosi, non esa ovqat.", 1, _ALL),
    Puzzle("odd_bird", "Qaysi biri ortiqcha? Chumchuq, burgut, kaptar, baliq",
           ("Baliq", "Chumchuq", "Burgut", "Kaptar"), 0,
           "Qolganlari qush, baliq suvda yashaydi.", 1, _ALL),

    Puzzle("week_days", "Bir haftada necha kun bor?",
           ("7", "5", "10", "12"), 0, "Dushanbadan yakshanbagacha — 7 kun.", 1, _ALL),
    Puzzle("year_months", "Bir yilda necha oy bor?",
           ("12", "10", "7", "24"), 0, "Yanvardan dekabrgacha — 12 oy.", 1, _ALL),
    Puzzle("birds_branch",
           "Shoxda 3 ta qush o'tiribdi. Bittasi uchib ketdi. Nechta qoldi?",
           ("2 ta", "3 ta", "1 ta", "4 ta"), 0, "3 - 1 = 2.", 1, _ALL),
    Puzzle("tomorrow_thu", "Ertaga payshanba bo'lsa, bugun qaysi kun?",
           ("Chorshanba", "Juma", "Seshanba", "Payshanba"), 0,
           "Payshanbadan bir kun oldin — chorshanba.", 1, _ALL),
    Puzzle("candies", "4 ta konfeting bor edi, 1 tasini yeding. Nechta qoldi?",
           ("3 ta", "4 ta", "2 ta", "5 ta"), 0, "4 - 1 = 3.", 1, _ALL),
    Puzzle("pencils", "3 ta qalaming bor, yana 2 ta sotib olding. Nechta bo'ldi?",
           ("5 ta", "6 ta", "4 ta", "23 ta"), 0, "3 + 2 = 5.", 1, _ALL),
    Puzzle("apples_give", "10 ta olmang bor, 4 tasini berding. Nechta qoldi?",
           ("6 ta", "5 ta", "14 ta", "7 ta"), 0, "10 - 4 = 6.", 1, _ALL),
    Puzzle("legs_cats", "2 ta mushukning jami nechta oyog'i bor?",
           ("8 ta", "4 ta", "6 ta", "10 ta"), 0, "Har mushukda 4 ta: 4 × 2 = 8.", 1, _ALL),
    Puzzle("half_ten", "10 ning yarmi nechchi?",
           ("5", "2", "20", "15"), 0, "10 ÷ 2 = 5.", 1, _ALL),
    Puzzle("biggest_num", "Qaysi son eng katta? 17, 71, 27, 7",
           ("71", "27", "17", "7"), 0, "71 — yetmish bir.", 1, _ALL),

    # ── Explorer: patterns and reasoning ─────────────────────────────────────
    Puzzle("seq_e_squares", "1, 4, 9, 16, ?", ("25", "20", "24", "36"), 0,
           "Kvadratlar: 1², 2², 3², 4², keyingisi 5² = 25.", 2, _OLDER),
    Puzzle("seq_e_sq_desc", "81, 64, 49, 36, ?", ("25", "24", "16", "30"), 0,
           "Kvadratlar teskari: 9², 8², 7², 6², keyingisi 5² = 25.", 2, _OLDER),
    Puzzle("seq_e_x2", "5, 10, 20, 40, ?", ("80", "60", "70", "50"), 0,
           "Har son ikki barobar oshadi.", 2, _OLDER),
    Puzzle("seq_e_half", "64, 32, 16, 8, ?", ("4", "2", "6", "0"), 0,
           "Har son ikkiga bo'linadi.", 2, _OLDER),
    Puzzle("seq_e_fib", "1, 1, 2, 3, 5, 8, ?", ("13", "11", "12", "16"), 0,
           "Har son oldingi ikkitasining yig'indisi: 5 + 8 = 13.", 2, _OLDER),
    Puzzle("seq_e_primes", "2, 3, 5, 7, 11, ?", ("13", "12", "14", "15"), 0,
           "Tub sonlar ketma-ketligi.", 2, _OLDER),
    Puzzle("seq_e_tri", "2, 6, 12, 20, ?", ("30", "28", "24", "32"), 0,
           "Ayirmalar 4, 6, 8 — keyingisi +10 → 30.", 2, _OLDER),
    Puzzle("seq_e_minus_grow", "10, 9, 7, 4, ?", ("0", "1", "2", "3"), 0,
           "Ayirmalar o'sadi: -1, -2, -3, keyin -4 → 0.", 2, _OLDER),
    Puzzle("seq_e_plus3", "1, 4, 7, 10, ?", ("13", "12", "14", "11"), 0,
           "Har safar 3 qo'shiladi.", 1, _OLDER),
    Puzzle("seq_e_x2_1", "1, 3, 7, 15, ?", ("31", "30", "23", "28"), 0,
           "Har safar ikki barobar + 1: 15 × 2 + 1 = 31.", 2, _OLDER),
    Puzzle("seq_e_alt", "1, 2, 4, 5, 7, 8, ?", ("10", "9", "11", "12"), 0,
           "Navbat bilan +1 va +2 qo'shiladi: 8 + 2 = 10.", 2, _OLDER),
    Puzzle("seq_e_x10", "3, 30, 300, ?", ("3000", "900", "600", "330"), 0,
           "Har safar 10 ga ko'paytiriladi.", 1, _OLDER),

    Puzzle("analogy_swim", "Qush : uchmoq = baliq : ?",
           ("Suzmoq", "Yugurmoq", "Sakramoq", "Emaklamoq"), 0,
           "Qush uchadi, baliq suzadi.", 2, _OLDER),
    Puzzle("analogy_moon", "Kun : quyosh = tun : ?",
           ("Oy", "Bulut", "Yomg'ir", "Shamol"), 0,
           "Kunduzi quyosh, kechasi oy ko'rinadi.", 2, _OLDER),
    Puzzle("analogy_glove", "Oyoq : poyabzal = qo'l : ?",
           ("Qo'lqop", "Shapka", "Ko'ylak", "Sharf"), 0,
           "Oyoqqa poyabzal, qo'lga qo'lqop kiyiladi.", 2, _OLDER),
    Puzzle("analogy_teacher", "Shifokor : kasalxona = o'qituvchi : ?",
           ("Maktab", "Do'kon", "Bog'", "Zavod"), 0,
           "Shifokor kasalxonada, o'qituvchi maktabda ishlaydi.", 2, _OLDER),

    Puzzle("book_pages",
           "Kitob 24 betdan iborat. Kuniga 6 bet o'qisang, necha kunda tugatasan?",
           ("4 kun", "6 kun", "3 kun", "5 kun"), 0, "24 ÷ 6 = 4.", 2, _OLDER),
    Puzzle("pencil_price",
           "3 ta qalam 15 000 so'm. 5 ta qalam qancha turadi?",
           ("25 000", "20 000", "30 000", "18 000"), 0,
           "Bitta qalam 5 000; 5 × 5 000 = 25 000.", 2, _OLDER),
    Puzzle("train_speed",
           "Poyezd 2 soatda 120 km yuradi. Xuddi shu tezlikda 3 soatda qancha yuradi?",
           ("180 km", "150 km", "240 km", "160 km"), 0,
           "Soatiga 60 km; 60 × 3 = 180.", 2, _OLDER),
    Puzzle("sum_diff",
           "Ikki sonning yig'indisi 20, ayirmasi 4. Kattasi nechchi?",
           ("12", "16", "10", "14"), 0,
           "(20 + 4) ÷ 2 = 12, kichigi 8.", 3, _OLDER),
    Puzzle("clock_angle_easy",
           "Soat 3:00 da soat va daqiqa millari orasidagi burchak nechchi gradus?",
           ("90°", "45°", "120°", "60°"), 0,
           "Har soat 30° — 3 soat × 30° = 90°.", 3, _OLDER),

    # ── Companion: harder structure ──────────────────────────────────────────
    Puzzle("seq_c_fact", "1, 2, 6, 24, 120, ?", ("720", "600", "480", "840"), 0,
           "Har safar keyingi songa ko'paytiriladi: 120 × 6 = 720.", 3, _TEEN),
    Puzzle("seq_c_cubes", "1, 8, 27, 64, ?", ("125", "100", "128", "81"), 0,
           "Kublar: 1³, 2³, 3³, 4³, keyingisi 5³ = 125.", 3, _TEEN),
    Puzzle("seq_c_x2plus1", "3, 7, 15, 31, ?", ("63", "62", "47", "57"), 0,
           "Har safar ikki barobar + 1: 31 × 2 + 1 = 63.", 3, _TEEN),
    Puzzle("seq_c_nsq1", "0, 3, 8, 15, 24, ?", ("35", "33", "30", "48"), 0,
           "n² - 1 ketma-ketligi: 6² - 1 = 35.", 3, _TEEN),
    Puzzle("seq_c_x3", "2, 6, 18, 54, ?", ("162", "108", "150", "216"), 0,
           "Har son 3 ga ko'paytiriladi.", 2, _TEEN),
    Puzzle("seq_c_growmul", "2, 4, 12, 48, ?", ("240", "144", "96", "192"), 0,
           "Ko'paytuvchi o'sadi: ×2, ×3, ×4, keyin ×5 → 240.", 3, _TEEN),
    Puzzle("seq_c_x2plus2", "1, 4, 10, 22, 46, ?", ("94", "92", "88", "70"), 0,
           "Har safar ikki barobar + 2: 46 × 2 + 2 = 94.", 3, _TEEN),
    Puzzle("seq_c_dbl_sub", "100, 96, 88, 72, ?", ("40", "56", "48", "64"), 0,
           "Ayirmalar ikki barobar oshadi: -4, -8, -16, keyin -32 → 40.", 3, _TEEN),
    Puzzle("seq_c_addgrow", "12, 15, 21, 33, ?", ("57", "45", "51", "63"), 0,
           "Qo'shiluvchi ikki barobar oshadi: +3, +6, +12, keyin +24 → 57.", 3, _TEEN),
    Puzzle("seq_c_x7", "7, 14, 28, 56, ?", ("112", "98", "84", "126"), 0,
           "Har son ikki barobar oshadi.", 2, _TEEN),

    Puzzle("discount_back",
           "Do'kon narxni 20% pasaytirdi. Dastlabki narxga qaytish uchun "
           "necha foiz oshirish kerak?",
           ("25%", "20%", "30%", "22%"), 0,
           "100 → 80. 80 dan 100 ga qaytish uchun 20/80 = 25% oshirish kerak.",
           3, _TEEN),
    Puzzle("workers_days",
           "4 ta ishchi ishni 6 kunda tugatadi. 3 ta ishchi necha kunda tugatadi?",
           ("8 kun", "6 kun", "9 kun", "4.5 kun"), 0,
           "Jami ish 24 ishchi-kun; 24 ÷ 3 = 8.", 3, _TEEN),
    Puzzle("average_five",
           "Beshta sonning o'rtachasi 10. Ularning yig'indisi nechchi?",
           ("50", "15", "10", "25"), 0, "O'rtacha × son soni = 10 × 5 = 50.", 2, _TEEN),
    Puzzle("percent_of",
           "200 ning 15 foizi nechchi?",
           ("30", "15", "35", "20"), 0, "200 × 0.15 = 30.", 2, _TEEN),
    Puzzle("ratio_split",
           "60 ta olma 2:3 nisbatda bo'linadi. Kattaroq ulush nechta?",
           ("36 ta", "30 ta", "24 ta", "40 ta"), 0,
           "Jami 5 ulush; 60 ÷ 5 = 12; katta ulush 3 × 12 = 36.", 3, _TEEN),
)

_BY_ID: dict[str, Puzzle] = {p.puzzle_id: p for p in PUZZLES}


def get(puzzle_id: str) -> Puzzle | None:
    return _BY_ID.get(puzzle_id)


def presented(puzzle: Puzzle) -> tuple[tuple[str, ...], int]:
    """Choices in display order, with the correct answer's index in that order.

    Every entry above lists the correct choice first — it keeps the catalogue
    readable and reviewable — which would make "always pick A" a winning
    strategy and hollow out the whole feature. So the order is shuffled before
    the child sees it.

    The shuffle is seeded with the puzzle_id, so it is stable: /next and
    /answer derive the same permutation without storing it, and a given puzzle
    always looks the same to everyone (a child comparing with a friend sees no
    contradiction).
    """
    rng = random.Random(puzzle.puzzle_id)
    order = list(range(len(puzzle.choices)))
    rng.shuffle(order)
    return tuple(puzzle.choices[i] for i in order), order.index(puzzle.correct_index)


def for_segment(segment: AgeSegment) -> list[Puzzle]:
    return [p for p in PUZZLES if segment in p.segments]


def pick_next(
    segment: AgeSegment,
    seen_ids: set[str],
    *,
    rng: random.Random | None = None,
) -> Puzzle | None:
    """An age-appropriate puzzle the child hasn't answered yet.

    Returns None once the catalogue is exhausted — the caller simply doesn't
    show a puzzle rather than repeating one.
    """
    pool = [p for p in for_segment(segment) if p.puzzle_id not in seen_ids]
    if not pool:
        return None
    # Easier items first so the first encounter is a win, then random within
    # the lowest remaining difficulty.
    lowest = min(p.difficulty for p in pool)
    candidates = [p for p in pool if p.difficulty == lowest]
    return (rng or random).choice(candidates)


# ---------------------------------------------------------------------------
# Reasoning band — deterministic, non-clinical
# ---------------------------------------------------------------------------

# Deliberately three coarse bands with plain-language names. This is a rough
# read on how the child is doing with the puzzles, NOT a score: the catalogue
# is small, self-selected and unvalidated, so anything finer would imply a
# precision that does not exist.
_BANDS: list[tuple[float, str]] = [
    (0.75, "yuqori"),
    (0.45, "o'rta"),
    (0.0, "rivojlanmoqda"),
]

# Below this many answers the sample is too small to say anything at all.
MIN_ATTEMPTS_FOR_BAND = 5


def reasoning_band(correct: int, total: int, avg_difficulty: float) -> str:
    """Plain-language band from puzzle results, or "" when data is too thin."""
    if total < MIN_ATTEMPTS_FOR_BAND:
        return ""
    ratio = correct / total
    # Harder items count for more: the same ratio on level-3 puzzles is a
    # stronger signal than on level-1 ones.
    adjusted = min(1.0, ratio * (0.8 + 0.2 * avg_difficulty))
    for threshold, name in _BANDS:
        if adjusted >= threshold:
            return name
    return "rivojlanmoqda"
