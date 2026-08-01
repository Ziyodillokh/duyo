"""Puzzle catalogue + reasoning band.

The band is deliberately coarse and non-clinical; these tests pin that it stays
a plain-language label and never turns into a score.
"""

import random

from duyo.models.child import AgeSegment
from duyo.services import puzzles

# ── Catalogue integrity ──────────────────────────────────────────────────────

def test_ids_are_unique():
    ids = [p.puzzle_id for p in puzzles.PUZZLES]
    assert len(ids) == len(set(ids))


def test_every_puzzle_is_well_formed():
    for p in puzzles.PUZZLES:
        assert p.text.strip(), p.puzzle_id
        assert len(p.choices) >= 2, p.puzzle_id
        assert 0 <= p.correct_index < len(p.choices), p.puzzle_id
        assert p.explanation.strip(), p.puzzle_id
        assert 1 <= p.difficulty <= 3, p.puzzle_id
        assert p.segments, p.puzzle_id


def test_every_segment_has_puzzles():
    for segment in AgeSegment:
        assert puzzles.for_segment(segment), segment


def test_junior_gets_no_hard_puzzles():
    """The youngest segment should not be handed level-3 items."""
    for p in puzzles.for_segment(AgeSegment.JUNIOR):
        assert p.difficulty <= 2, p.puzzle_id


# ── Selection ────────────────────────────────────────────────────────────────

def test_pick_next_skips_seen():
    seg = AgeSegment.EXPLORER
    seen = {p.puzzle_id for p in puzzles.for_segment(seg)}
    assert puzzles.pick_next(seg, seen) is None


def test_pick_next_returns_easiest_remaining():
    seg = AgeSegment.EXPLORER
    picked = puzzles.pick_next(seg, set(), rng=random.Random(0))
    assert picked is not None
    lowest = min(p.difficulty for p in puzzles.for_segment(seg))
    assert picked.difficulty == lowest


def test_pick_next_only_returns_age_appropriate():
    seg = AgeSegment.JUNIOR
    for _ in range(20):
        p = puzzles.pick_next(seg, set(), rng=random.Random())
        assert p is not None and seg in p.segments


# ── Reasoning band ───────────────────────────────────────────────────────────

def test_band_is_empty_below_the_minimum_sample():
    assert puzzles.reasoning_band(3, 3, 2.0) == ""
    assert puzzles.reasoning_band(0, puzzles.MIN_ATTEMPTS_FOR_BAND - 1, 1.0) == ""


def test_band_reflects_performance():
    n = puzzles.MIN_ATTEMPTS_FOR_BAND + 5
    assert puzzles.reasoning_band(n, n, 2.0) == "yuqori"
    assert puzzles.reasoning_band(0, n, 2.0) == "rivojlanmoqda"


def test_harder_puzzles_weigh_more_at_the_same_ratio():
    n = 10
    easy = puzzles.reasoning_band(6, n, 1.0)
    hard = puzzles.reasoning_band(6, n, 3.0)
    order = ["rivojlanmoqda", "o'rta", "yuqori"]
    assert order.index(hard) >= order.index(easy)


def test_band_is_a_word_not_a_score():
    """Regression guard: the band must never become an IQ-like number."""
    n = puzzles.MIN_ATTEMPTS_FOR_BAND + 1
    for correct in range(n + 1):
        band = puzzles.reasoning_band(correct, n, 2.0)
        assert band in ("", "yuqori", "o'rta", "rivojlanmoqda")
        assert not any(ch.isdigit() for ch in band)


# ── Presentation order ───────────────────────────────────────────────────────

def test_choices_are_unique_within_a_puzzle():
    """Two identical options would make a puzzle unanswerable."""
    for p in puzzles.PUZZLES:
        assert len(set(p.choices)) == len(p.choices), p.puzzle_id


def test_presented_order_is_stable():
    """/next and /answer derive the permutation separately — it must match."""
    for p in puzzles.PUZZLES:
        first = puzzles.presented(p)
        second = puzzles.presented(p)
        assert first == second, p.puzzle_id


def test_presented_keeps_pointing_at_the_right_answer():
    for p in puzzles.PUZZLES:
        choices, index = puzzles.presented(p)
        assert choices[index] == p.choices[p.correct_index], p.puzzle_id
        assert sorted(choices) == sorted(p.choices), p.puzzle_id


def test_answer_is_not_always_the_first_option():
    """Regression: the catalogue lists the answer first, so without the shuffle
    every puzzle answered 'A' and a child could win by never reading."""
    positions = {puzzles.presented(p)[1] for p in puzzles.PUZZLES}
    assert len(positions) > 1
    first_count = sum(1 for p in puzzles.PUZZLES if puzzles.presented(p)[1] == 0)
    assert first_count < len(puzzles.PUZZLES) * 0.5


# ── Catalogue depth ──────────────────────────────────────────────────────────

def test_catalogue_is_deep_enough_to_last():
    """One puzzle per 4 chat turns: a shallow segment runs dry in days."""
    floors = {AgeSegment.JUNIOR: 30, AgeSegment.EXPLORER: 45, AgeSegment.COMPANION: 55}
    for segment, floor in floors.items():
        assert len(puzzles.for_segment(segment)) >= floor, segment
