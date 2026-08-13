"""Goal title → catalogue key resolution.

The corpus below is not invented: the "real production titles" are the exact
strings children had typed in the live database, and the catalogue is the 0022
seed. Three discoverable children each had a Naruto goal and none could see
the others, because only one had come through the picker — these tests pin the
behaviour that fixes that, and the negative cases that must keep it safe.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from duyo.services.goal_matching import (
    resolve_match_key,
    score_title,
    tokenize,
)


def _entry(match_key: str, title: str, *, target_ref=None, age_min=7, age_max=16,
           matchable=True, active=True):
    """A GoalCatalog stand-in — score_title only reads these fields."""
    return SimpleNamespace(
        match_key=match_key, title=title, target_ref=target_ref,
        age_min=age_min, age_max=age_max, matchable=matchable, active=active,
    )


# The 0022 seed, trimmed to the entries these tests exercise.
CATALOG = [
    _entry("book_otkan_kunlar", "Abdulla Qodiriy — O'tkan Kunlar", age_min=12),
    _entry("book_mehrobdan_chayon", "Abdulla Qodiriy — Mehrobdan Chayon", age_min=13),
    _entry("book_kecha_va_kunduz", "Cho'lpon — Kecha va Kunduz", age_min=13),
    _entry("habit_har_kuni_kitob", "Har kuni kitob o'qish"),
    _entry("habit_har_kuni_sport", "Har kuni sport qilish"),
    _entry("skill_dasturlash", "Dasturlashni o'rganish", age_min=10),
    _entry("skill_ingliz_gapirish", "Ingliz tilida erkin gaplashish"),
    _entry("exam_ielts", "IELTS imtihoniga tayyorgarlik", age_min=14),
    _entry("exam_dtm_matematika", "DTM: Matematikaga tayyorgarlik", age_min=14),
    _entry("textbook_matematika_6", "6-sinf matematika darsligi",
           target_ref={"subject": "matematika", "grade": 6}, age_min=11, age_max=12),
    _entry("textbook_matematika_9", "9-sinf matematika darsligi",
           target_ref={"subject": "matematika", "grade": 9}, age_min=14, age_max=15),
    _entry("textbook_fizika_7", "7-sinf fizika darsligi",
           target_ref={"subject": "fizika", "grade": 7}, age_min=12, age_max=13),
    _entry("test-naruto", "Naruto animesi"),
]


class _FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows


class _FakeSession:
    """Applies the same filters resolve_match_key puts in SQL."""

    def __init__(self, catalog, age=None):
        self.catalog = catalog
        self.age = age

    async def execute(self, _stmt):
        rows = [e for e in self.catalog if e.matchable and e.active]
        if self.age is not None:
            rows = [e for e in rows if e.age_min <= self.age <= e.age_max]
        return _FakeResult(rows)


def _resolve(title: str, age: int | None = None, catalog=None) -> str | None:
    return asyncio.run(
        resolve_match_key(_FakeSession(catalog or CATALOG, age), title, age)
    )


# --- tokenizer --------------------------------------------------------------


def test_tokenizer_normalises_the_four_uzbek_apostrophes():
    """A keyboard difference must not make two children's goals different."""
    variants = ["o'tkan kunlar", "o‘tkan kunlar", "oʻtkan kunlar", "o´tkan kunlar"]
    tokenised = {tuple(tokenize(v)) for v in variants}
    assert len(tokenised) == 1, tokenised


def test_tokenizer_drops_stopwords_and_short_words():
    assert "har" not in tokenize("Har kuni kitob o'qish")
    assert "kitob" in tokenize("Har kuni kitob o'qish")


def test_tokenizer_handles_cyrillic():
    assert tokenize("математика дарслиги") == ["математика", "дарслиги"]


# --- the real production titles ---------------------------------------------


@pytest.mark.parametrize(
    ("typed", "expected"),
    [
        # All three Naruto children, in their own words.
        ("Naruto", "test-naruto"),
        ("Naruto animesini korish", "test-naruto"),
        ("naruto animesini toliq korib chiqmoqchiman", "test-naruto"),
        # Typed while the catalogue entry sat unused.
        ("O'tkan kunlarni o'qish", "book_otkan_kunlar"),
        # Wording that differs from the catalogue phrasing.
        ("har kuni kitob o'qmoqchiman", "habit_har_kuni_kitob"),
        ("dasturlashni organmoqchiman", "skill_dasturlash"),
        ("IELTS ga tayyorlanaman", "exam_ielts"),
    ],
)
def test_real_titles_resolve(typed, expected):
    assert _resolve(typed) == expected


@pytest.mark.parametrize(
    "typed",
    [
        "Alisher Navoiy",       # a poet, not a catalogue goal
        "futbol o'ynash",       # nothing like it in the catalogue
        "Naruto",               # (guarded separately below when unpublished)
    ],
)
def test_unknown_goals_stay_unmatched(typed):
    catalog = [e for e in CATALOG if e.match_key != "test-naruto"] if typed == "Naruto" else CATALOG
    assert _resolve(typed, catalog=catalog) is None


# --- the veto and the tie-break ---------------------------------------------


def test_a_different_grade_is_never_matched():
    """"6-sinf fizika" must not be filed under the 7-sinf entry.

    Every other word is shared, so only the grade distinguishes them — this
    is the case that made a naive scorer wrong.
    """
    assert _resolve("6-sinf fizikani tugatmoqchiman") is None


def test_the_right_grade_still_matches():
    assert _resolve("6-sinf matematika darsligini tugataman") == "textbook_matematika_6"


def test_an_ambiguous_subject_without_a_grade_is_refused():
    """"matematika darsligi" fits grades 6 and 9 equally — a coin flip.

    Connecting two children over a guess is worse than not connecting them.
    """
    assert _resolve("matematika darsligi") is None


def test_two_books_by_the_same_author_do_not_collide():
    """Both entries carry "Abdulla Qodiriy"; the title has to decide."""
    assert _resolve("O'tkan kunlar") == "book_otkan_kunlar"
    assert _resolve("Mehrobdan chayonni o'qiyapman") == "book_mehrobdan_chayon"


# --- the curation gate ------------------------------------------------------


def test_an_unreviewed_entry_is_never_selected():
    """matchable=False is the human publish gate; widening recall must not
    widen WHAT children can be connected over."""
    catalog = [_entry("secret_goal", "Naruto animesi", matchable=False)]
    assert _resolve("Naruto animesi", catalog=catalog) is None


def test_a_retired_entry_is_never_selected():
    catalog = [_entry("old_goal", "Naruto animesi", active=False)]
    assert _resolve("Naruto animesi", catalog=catalog) is None


def test_age_band_is_respected():
    """A 10-year-old writing about English is not filed under 14+ IELTS."""
    assert _resolve("IELTS ga tayyorlanaman", age=10) is None
    assert _resolve("IELTS ga tayyorlanaman", age=15) == "exam_ielts"


def test_blank_title_returns_none():
    assert _resolve("") is None
    assert _resolve("    ") is None


# --- scoring sanity ---------------------------------------------------------


def test_exact_title_scores_top():
    entry = _entry("k", "Har kuni kitob o'qish")
    assert score_title("Har kuni kitob o'qish", entry) == pytest.approx(1.0)


def test_a_long_sentence_is_not_rewarded_for_its_length():
    """Coverage of the catalogue title is weighted above the reverse."""
    entry = _entry("k", "Naruto animesi")
    padded = "men bugun juda charchadim lekin naruto animesi haqida gapiraman"
    assert score_title(padded, entry) < score_title("Naruto animesi", entry)


def test_unrelated_text_scores_zero():
    assert score_title("futbol o'ynash", _entry("k", "IELTS imtihoniga tayyorgarlik")) == 0.0
