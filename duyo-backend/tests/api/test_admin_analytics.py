"""Analytics retention cohort matrix assembly (pure helper)."""

from duyo.api.v1.admin_modules import _build_cohort_matrix


def test_cohort_matrix_basic_retention():
    sizes = {"2026-05-04": 10, "2026-05-11": 4}
    # (cohort, week_offset, active_users)
    buckets = [
        ("2026-05-04", 0, 10),  # week 0: all active
        ("2026-05-04", 1, 5),   # week 1: half
        ("2026-05-04", 3, 2),
        ("2026-05-11", 0, 4),
        ("2026-05-11", 1, 1),
    ]
    rows = _build_cohort_matrix(sizes, buckets, max_weeks=3)
    # newest cohort first
    assert [r["cohort"] for r in rows] == ["2026-05-11", "2026-05-04"]
    older = next(r for r in rows if r["cohort"] == "2026-05-04")
    assert older["size"] == 10
    assert older["retention"] == [1.0, 0.5, 0.0, 0.2]  # wk2 missing → 0
    newer = next(r for r in rows if r["cohort"] == "2026-05-11")
    assert newer["retention"] == [1.0, 0.25, 0.0, 0.0]


def test_cohort_matrix_zero_size_safe():
    rows = _build_cohort_matrix({"2026-05-04": 0}, [], max_weeks=2)
    assert rows[0]["retention"] == [0.0, 0.0, 0.0]


def test_cohort_matrix_empty():
    assert _build_cohort_matrix({}, [], max_weeks=4) == []
