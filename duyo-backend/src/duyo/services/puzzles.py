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
)

_BY_ID: dict[str, Puzzle] = {p.puzzle_id: p for p in PUZZLES}


def get(puzzle_id: str) -> Puzzle | None:
    return _BY_ID.get(puzzle_id)


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
