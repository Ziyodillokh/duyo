"""Resolve a child's own words for a goal onto a curated catalogue key.

WHY THIS EXISTS
---------------
`match_key` is the only axis two children are ever compared on (models/goal.py),
and until now it was set in exactly one place: when the child tapped a chip in
the catalogue picker. Every other route to a goal — typing it freely, or the
conversation extractor in services/goals.py — left it NULL, and a goal with a
NULL key can never match anybody.

Production showed the cost precisely: three discoverable 14-year-olds each had
a Naruto goal, and none of them could see the others, because only one of the
three had ever come through the picker. A fourth child had typed "O'tkan
kunlarni o'qish" while `book_otkan_kunlar` sat in the catalogue unused.

This module closes that gap WITHOUT giving up the curation gate. It never
invents a key: it can only select one a human already published
(`matchable AND active`), so the set of goals children can be connected over
stays exactly as reviewed. What changes is that a child no longer has to
phrase their goal the way the picker does in order to be counted.

WHY NOT AN LLM
--------------
services/social.py's docstring already sets the rule for this surface:
"Matching is plain SQL, never an LLM — an LLM matcher would be directly
prompt-injectable." The same applies here, more sharply: this function decides
which children get connected to each other, from text a child writes. A model
that can be talked into returning `exam_ielts` for "ignore previous
instructions" is not acceptable in that position. Everything below is
deterministic, offline, and unit-testable against real titles.

PRECISION OVER RECALL
---------------------
A missed match costs a child a suggestion they never knew about. A WRONG match
introduces two children to each other over a goal they do not share — on a
child-safety surface. So the threshold is set high, a grade mismatch is a hard
veto, and anything ambiguous returns None and simply stays unmatched.
"""

from __future__ import annotations

import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.models.goal import GoalCatalog

# --- tokenizing -------------------------------------------------------------

# Uzbek writes o' / g' with any of four apostrophe glyphs depending on the
# keyboard; normalising them to one means "o'tkan", "o‘tkan" and "oʻtkan" are
# the same word rather than three.
_APOSTROPHES = "‘’ʻʼ`´"
_ASCII_APOSTROPHE = "'"

# Latin + Cyrillic + digits + the (normalised) apostrophe. Deliberately not
# \w, which is ASCII-only in Python's `str` patterns for the ranges we care
# about being explicit over.
_WORD_RE = re.compile(r"[a-z0-9Ѐ-ӿ']+")

# Words too common to carry meaning in a goal title, in the three shipped
# languages. Without these, "har kuni kitob o'qish" and "har kuni sport
# qilish" would look similar purely on "har"/"kuni".
_STOPWORDS = frozenset({
    # Uzbek. "har" earns its place: it is the only shared word between
    # "Har kuni kitob o'qish" and "Har kuni sport qilish", so keeping it
    # makes two unrelated habits look alike.
    "har",
    "va", "bilan", "uchun", "ham", "men", "meni", "mening", "bu", "shu",
    "yoki", "lekin", "juda", "bir", "qilish", "qilmoqchiman", "boshlamoqchiman",
    "istayman", "xohlayman", "kerak", "haqida", "boyicha", "bo'yicha",
    # Russian
    "и", "в", "на", "для", "с", "по", "что", "как",
    # English
    "the", "a", "an", "and", "or", "for", "with", "to", "of", "my", "want",
})

_MIN_TOKEN_LEN = 3

#: Two tokens sharing this many leading characters are treated as one word.
#: Uzbek is agglutinative ("kunlar" → "kunlarni") and Russian fusional
#: ("математика" → "математику"); a COMMON prefix handles both, where "does
#: one start with the other" only handles the first.
_MIN_STEM = 5


def _normalise(text: str) -> str:
    # Apostrophes are folded BEFORE Unicode normalisation, not after: NFKC
    # decomposes U+00B4 ACUTE ACCENT into a space plus a combining mark, so
    # normalising first turns "o´tkan" into "o tkan" and loses the leading
    # letter to the minimum-length filter. Folding first keeps all four
    # glyphs as one word.
    folded = text
    for glyph in _APOSTROPHES:
        folded = folded.replace(glyph, _ASCII_APOSTROPHE)
    return unicodedata.normalize("NFKC", folded).casefold()


def tokenize(text: str) -> list[str]:
    """Significant, de-duplicated words, in first-seen order."""
    seen: dict[str, None] = {}
    for word in _WORD_RE.findall(_normalise(text)):
        stripped = word.strip(_ASCII_APOSTROPHE)
        if len(stripped) < _MIN_TOKEN_LEN or stripped in _STOPWORDS:
            continue
        seen.setdefault(stripped, None)
    return list(seen)


def _same_word(a: str, b: str) -> bool:
    if a == b:
        return True
    if len(a) < _MIN_STEM or len(b) < _MIN_STEM:
        return False
    shared = 0
    # strict=False on purpose: comparing a common PREFIX, so the shorter word
    # ending first is the normal case, not a mismatch.
    for x, y in zip(a, b, strict=False):
        if x != y:
            break
        shared += 1
    return shared >= _MIN_STEM


def _covers(needles: list[str], haystack: list[str]) -> int:
    return sum(1 for n in needles if any(_same_word(n, h) for h in haystack))


# --- grade veto -------------------------------------------------------------

# "6-sinf", "6 sinf", "6-класс". A grade number is the difference between
# "6-sinf matematika" and "9-sinf matematika", which share every other word —
# so when both sides name one and they disagree, no score can rescue it.
_GRADE_RE = re.compile(r"(\d{1,2})\s*-?\s*(?:sinf|синф|класс|klass)")


def _stated_grade(text: str) -> int | None:
    m = _GRADE_RE.search(_normalise(text))
    return int(m.group(1)) if m else None


def _catalog_grade(entry: GoalCatalog) -> int | None:
    """The grade a catalogue entry targets — structured field first, title second."""
    ref = entry.target_ref or {}
    grade = ref.get("grade")
    if isinstance(grade, int):
        return grade
    if isinstance(grade, str) and grade.isdigit():
        return int(grade)
    return _stated_grade(entry.title)


# --- scoring ----------------------------------------------------------------

#: Weight on "how much of the CATALOGUE title did the child name". Weighted
#: above the reverse because a child writes a sentence ("naruto animesini
#: to'liq ko'rib chiqmoqchiman") around a title that is two words: rewarding
#: the sentence for its length would let any long goal match anything.
_COVERAGE_WEIGHT = 0.6
_PRECISION_WEIGHT = 0.4

#: Tuned against the real titles in production (see tests). Below this the
#: goal simply stays unmatched, which is the safe outcome.
_THRESHOLD = 0.45


def score_title(child_title: str, entry: GoalCatalog) -> float:
    """0.0-1.0 similarity between a child's wording and a catalogue entry."""
    child_tokens = tokenize(child_title)
    entry_tokens = tokenize(entry.title)
    if not child_tokens or not entry_tokens:
        return 0.0

    child_grade = _stated_grade(child_title)
    entry_grade = _catalog_grade(entry)
    if child_grade is not None and entry_grade is not None and child_grade != entry_grade:
        return 0.0  # hard veto — see _GRADE_RE

    coverage = _covers(entry_tokens, child_tokens) / len(entry_tokens)
    precision = _covers(child_tokens, entry_tokens) / len(child_tokens)
    return coverage * _COVERAGE_WEIGHT + precision * _PRECISION_WEIGHT


async def resolve_match_key(
    session: AsyncSession, title: str, age: int | None = None
) -> str | None:
    """Best catalogue key for `title`, or None when nothing is clearly right.

    Only PUBLISHED entries are considered (`matchable AND active`) — this
    function widens who gets matched, never what they can be matched over.
    `age` applies the entry's own age band, so a 10-year-old writing
    "ingliz tiliga tayyorlanaman" is not filed under the 14+ IELTS goal.
    """
    if not title or not title.strip():
        return None

    stmt = select(GoalCatalog).where(
        GoalCatalog.matchable.is_(True),
        GoalCatalog.active.is_(True),
    )
    if age is not None:
        stmt = stmt.where(GoalCatalog.age_min <= age, GoalCatalog.age_max >= age)

    entries = (await session.execute(stmt)).scalars().all()

    best_key: str | None = None
    best_score = 0.0
    runner_up = 0.0
    for entry in entries:
        value = score_title(title, entry)
        if value > best_score:
            best_score, runner_up, best_key = value, best_score, entry.match_key
        elif value > runner_up:
            runner_up = value

    if best_score < _THRESHOLD:
        return None
    # A near-tie means the wording does not actually distinguish the two
    # entries (e.g. two grades of the same subject with no grade stated).
    # Connecting children over a coin-flip is worse than not connecting them.
    if best_score - runner_up < 0.05:
        return None
    return best_key
