"""Every numeric-sequence puzzle's answer must follow a nameable rule.

82 items were written by hand. A wrong answer there is worse than a missing
puzzle: the child reasons correctly and is told they're wrong. This walks the
catalogue and re-derives each answer from the sequence itself, so a typo in a
new item fails the build instead of reaching a child.

Word problems and odd-one-out items can't be checked this way and are skipped;
they're reviewed by reading, which is why every entry carries its rule in
`explanation`.
"""

from __future__ import annotations

import re
from itertools import pairwise

from duyo.services import puzzles

# "2, 4, 6, 8, ?" — at least three terms before the blank.
_SEQ = re.compile(r"^\s*(-?\d+(?:\s*,\s*-?\d+){2,})\s*,\s*\?")

_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61]


def _terms(text: str) -> list[int] | None:
    m = _SEQ.match(text)
    return [int(x) for x in m.group(1).split(",")] if m else None


def _const(xs: list[float]) -> bool:
    return len(set(xs)) == 1


def _matches_a_rule(seq: list[int], nxt: int) -> bool:
    """True if `nxt` continues `seq` under any rule the catalogue actually uses."""
    diffs = [b - a for a, b in pairwise(seq)]

    # a(n+1) = a(n) + d
    if _const(diffs) and nxt == seq[-1] + diffs[0]:
        return True

    # a(n+1) = a(n) * r
    if all(a != 0 for a in seq):
        ratios = [b / a for a, b in pairwise(seq)]
        if _const(ratios) and nxt == seq[-1] * ratios[0]:
            return True
        # ratio itself grows by a constant step (1,2,6,24 -> x2,x3,x4)
        if len(ratios) >= 2:
            rd = [b - a for a, b in pairwise(ratios)]
            if _const(rd) and nxt == seq[-1] * (ratios[-1] + rd[0]):
                return True

    if len(diffs) >= 2:
        # differences form their own arithmetic run
        dd = [b - a for a, b in pairwise(diffs)]
        if _const(dd) and nxt == seq[-1] + diffs[-1] + dd[0]:
            return True
        # differences double / triple
        if all(a != 0 for a in diffs):
            dr = [b / a for a, b in pairwise(diffs)]
            if _const(dr) and nxt == seq[-1] + diffs[-1] * dr[0]:
                return True
        # differences alternate with period 2 (1,2,4,5,7,8 -> +1,+2,+1,+2)
        if len(diffs) >= 3:
            odd, even = diffs[0::2], diffs[1::2]
            if _const(odd) and _const(even) and nxt == seq[-1] + diffs[-2]:
                return True
        # differences walk the primes (1,3,6,11,18 -> +2,+3,+5,+7)
        if diffs == _PRIMES[: len(diffs)] and nxt == seq[-1] + _PRIMES[len(diffs)]:
            return True

    # a(n+1) = k*a(n) + c, solved from the tail then checked over the whole run
    if len(seq) >= 3 and seq[-2] != seq[-3]:
        k = (seq[-1] - seq[-2]) / (seq[-2] - seq[-3])
        c = seq[-1] - k * seq[-2]
        fits = all(abs(b - (k * a + c)) < 1e-9 for a, b in pairwise(seq))
        if fits and abs(nxt - (k * seq[-1] + c)) < 1e-9:
            return True

    # Fibonacci-like
    fib = all(a + b == c for a, b, c in zip(seq, seq[1:], seq[2:], strict=False))
    if len(seq) >= 3 and fib and nxt == seq[-1] + seq[-2]:
        return True

    # the primes themselves
    if seq == _PRIMES[: len(seq)] and nxt == _PRIMES[len(seq)]:
        return True

    # perfect powers whose roots follow an arithmetic run
    for power in (2, 3):
        roots = [round(abs(v) ** (1 / power)) for v in seq]
        if all(r**power == v for r, v in zip(roots, seq, strict=True)):
            rd = [b - a for a, b in pairwise(roots)]
            if _const(rd) and nxt == (roots[-1] + rd[0]) ** power:
                return True
            rdd = [b - a for a, b in pairwise(rd)] if len(rd) >= 2 else []
            if rdd and _const(rdd) and nxt == (roots[-1] + rd[-1] + rdd[0]) ** power:
                return True

    return False


def test_every_sequence_answer_is_derivable():
    unexplained: list[str] = []
    checked = 0

    for puzzle in puzzles.PUZZLES:
        seq = _terms(puzzle.text)
        if seq is None:
            continue  # word problem / odd-one-out — reviewed by reading
        checked += 1
        answer = puzzle.choices[puzzle.correct_index]
        try:
            nxt = int(answer)
        except ValueError:
            unexplained.append(f"{puzzle.puzzle_id}: answer {answer!r} is not a number")
            continue
        if not _matches_a_rule(seq, nxt):
            unexplained.append(
                f"{puzzle.puzzle_id}: {puzzle.text.strip()} -> {nxt} "
                f"({puzzle.explanation})"
            )

    assert checked >= 35, f"only {checked} sequences found — did the regex stop matching?"
    assert not unexplained, "sequence answers that follow no known rule:\n" + "\n".join(
        unexplained
    )


def test_the_checker_rejects_a_wrong_answer():
    """Guard the guard: a broken sequence must actually fail."""
    assert _matches_a_rule([2, 4, 6, 8], 10)
    assert not _matches_a_rule([2, 4, 6, 8], 11)
    assert _matches_a_rule([1, 1, 2, 3, 5, 8], 13)
    assert not _matches_a_rule([1, 1, 2, 3, 5, 8], 14)
