"""Combining crisis layers can only ever escalate.

Layers 2 and 3 used to be chained — L3 received L2's answer as a floor it
could not go below — which cost a full extra model round-trip inside a request
that was already crossing the mobile client's timeout. They now run
concurrently and their answers are combined with `highest`.

That is only safe because every layer is escalate-only relative to Layer 1, so
"chain them" and "take the maximum" produce the same level. These tests pin
that equivalence, because the failure mode is silent: a downgrade here means a
child in danger is classified as safe and no parent is ever texted.
"""

from __future__ import annotations

import itertools

import pytest

from duyo.models.crisis_event import CrisisLevel, highest, severity

LEVELS = list(CrisisLevel)


def test_severity_is_the_documented_ladder():
    assert [severity(level) for level in
            (CrisisLevel.GREEN, CrisisLevel.YELLOW, CrisisLevel.ORANGE, CrisisLevel.RED)] == [0, 1, 2, 3]


@pytest.mark.parametrize("level", LEVELS)
def test_a_single_level_is_its_own_maximum(level):
    assert highest(level) is level


@pytest.mark.parametrize(("a", "b"), list(itertools.product(LEVELS, repeat=2)))
def test_combining_two_levels_never_downgrades_either(a, b):
    result = highest(a, b)
    assert severity(result) >= severity(a)
    assert severity(result) >= severity(b)


@pytest.mark.parametrize(("a", "b", "c"), list(itertools.product(LEVELS, repeat=3)))
def test_combining_three_levels_never_downgrades_any(a, b, c):
    """The exact shape chat_turn uses: highest(l1, l2, l3)."""
    result = highest(a, b, c)
    for level in (a, b, c):
        assert severity(result) >= severity(level)


@pytest.mark.parametrize(("a", "b", "c"), list(itertools.product(LEVELS, repeat=3)))
def test_parallel_combination_equals_the_old_chained_result(a, b, c):
    """`highest(l1, l2, l3)` == chaining each layer as a floor.

    The old code ran classify(msg, l1) then classify_l3(msg, l2.level), each
    clamping to the floor it was given. Simulated here as successive maxima —
    which is what the concurrent version must reproduce exactly.
    """
    chained_l2 = a if severity(b) < severity(a) else b        # L2 clamped to L1
    chained_l3 = chained_l2 if severity(c) < severity(chained_l2) else c  # L3 clamped to L2
    assert highest(a, b, c) is chained_l3


def test_order_does_not_matter():
    """Concurrency means the layers can finish in any order."""
    for combo in itertools.permutations(
        [CrisisLevel.GREEN, CrisisLevel.ORANGE, CrisisLevel.YELLOW]
    ):
        assert highest(*combo) is CrisisLevel.ORANGE


def test_red_always_wins():
    for combo in itertools.product(LEVELS, repeat=2):
        assert highest(CrisisLevel.RED, *combo) is CrisisLevel.RED
