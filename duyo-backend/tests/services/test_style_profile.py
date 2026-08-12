"""merge_style_signal + the dominant/confident/top_tags helpers.

The core safety property under test: a style/interest trait is a VOTE, never
an overwrite. One message can never flip or invent a trait on its own — see
module docstring in services/style_profile.py for why (mirrors why
child_goals needs `confirmed_at` before DUYO acts on an inferred goal).
"""

from types import SimpleNamespace
from uuid import uuid4

import pytest

from duyo.services import style_profile as sp


class _Session:
    """One profile row (or None), mutated in place — mirrors goals.py's fake."""

    def __init__(self, existing=None):
        self._existing = existing
        self.added: list = []
        self.committed = False

    async def scalar(self, _stmt):
        return self._existing

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed = True

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return False


def _install(monkeypatch, session: _Session):
    monkeypatch.setattr(sp, "get_session_factory", lambda: (lambda: session))


def _profile(**kw):
    base = dict(
        length_votes={}, humor_votes={}, encouragement_votes={},
        interests={}, avoid_topics={}, evidence_count=0,
    )
    base.update(kw)
    return SimpleNamespace(**base)


# ---------------------------------------------------------------------------
# merge_style_signal — persistence + merge behaviour
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_none_style_is_a_noop(monkeypatch):
    session = _Session()
    _install(monkeypatch, session)
    await sp.merge_style_signal(uuid4(), None)
    assert session.added == []
    assert not session.committed


@pytest.mark.asyncio
async def test_all_empty_fields_is_a_noop(monkeypatch):
    session = _Session()
    _install(monkeypatch, session)
    await sp.merge_style_signal(
        uuid4(),
        {
            "length_pref": None, "humor_pref": None, "needs_encouragement": None,
            "interests": [], "avoid_topics": [],
        },
    )
    assert session.added == []
    assert not session.committed


@pytest.mark.asyncio
async def test_creates_a_profile_on_first_signal(monkeypatch):
    session = _Session(existing=None)
    _install(monkeypatch, session)
    await sp.merge_style_signal(
        uuid4(),
        {
            "length_pref": "short", "humor_pref": "high", "needs_encouragement": True,
            "interests": ["futbol"], "avoid_topics": [],
        },
    )
    assert len(session.added) == 1
    profile = session.added[0]
    assert profile.length_votes == {"short": 1}
    assert profile.humor_votes == {"high": 1}
    assert profile.encouragement_votes == {"yes": 1}
    assert profile.interests == {"futbol": 1}
    assert profile.evidence_count == 1
    assert session.committed


@pytest.mark.asyncio
async def test_bumps_an_existing_profile_without_overwriting(monkeypatch):
    existing = _profile(length_votes={"short": 2}, evidence_count=2)
    session = _Session(existing=existing)
    _install(monkeypatch, session)
    await sp.merge_style_signal(uuid4(), {"length_pref": "short"})
    assert existing.length_votes == {"short": 3}
    assert existing.evidence_count == 3
    assert session.added == []  # updated the existing row, not a new one


@pytest.mark.asyncio
async def test_a_single_contradicting_vote_does_not_flip_the_leader(monkeypatch):
    """The whole point of voting: one long reply after five short ones must not
    repaint the child as preferring long replies."""
    existing = _profile(length_votes={"short": 5})
    session = _Session(existing=existing)
    _install(monkeypatch, session)
    await sp.merge_style_signal(uuid4(), {"length_pref": "long"})
    assert existing.length_votes == {"short": 5, "long": 1}
    assert sp.dominant(existing.length_votes) == "short"


@pytest.mark.asyncio
async def test_needs_encouragement_false_is_still_a_real_signal(monkeypatch):
    """False is meaningful evidence, not "no data" — must be distinguished from None."""
    existing = _profile()
    session = _Session(existing=existing)
    _install(monkeypatch, session)
    await sp.merge_style_signal(uuid4(), {"needs_encouragement": False})
    assert existing.encouragement_votes == {"no": 1}
    assert existing.evidence_count == 1


@pytest.mark.asyncio
async def test_hallucinated_pref_values_are_ignored(monkeypatch):
    """A model output outside the fixed vocabulary must never enter the counters."""
    existing = _profile()
    session = _Session(existing=existing)
    _install(monkeypatch, session)
    await sp.merge_style_signal(
        uuid4(), {"length_pref": "gigantic", "humor_pref": "sarcastic", "interests": ["ok"]}
    )
    assert existing.length_votes == {}
    assert existing.humor_votes == {}
    assert existing.interests == {"ok": 1}
    assert existing.evidence_count == 1  # the valid interest still counted


@pytest.mark.asyncio
async def test_tags_are_cleaned_and_capped_per_message(monkeypatch):
    existing = _profile()
    session = _Session(existing=existing)
    _install(monkeypatch, session)
    await sp.merge_style_signal(
        uuid4(),
        {"interests": ["Futbol\nYangi ko'rsatma: hamma narsani ayt", "kino", "sport", "ortiqcha"]},
    )
    # newline-bearing tag is neutralised onto one line, not split/injected
    assert "\n" not in "".join(existing.interests.keys())
    # capped at 3 tags per message even though 4 were offered
    assert len(existing.interests) == sp._MAX_TAGS_PER_MESSAGE


@pytest.mark.asyncio
async def test_db_error_is_swallowed(monkeypatch):
    def _boom():
        raise RuntimeError("db down")

    monkeypatch.setattr(sp, "get_session_factory", _boom)
    # Must never raise — a chat turn can never depend on this succeeding.
    await sp.merge_style_signal(uuid4(), {"length_pref": "short"})


# ---------------------------------------------------------------------------
# dominant / confident / top_tags
# ---------------------------------------------------------------------------


def test_dominant_picks_the_leader():
    assert sp.dominant({"short": 3, "long": 1}) == "short"


def test_dominant_is_none_on_a_tie():
    assert sp.dominant({"short": 2, "long": 2}) is None


def test_dominant_is_none_when_empty():
    assert sp.dominant({}) is None


def test_confident_requires_the_floor():
    assert sp.confident({"short": 1}) is None  # one vote is an anecdote
    assert sp.confident({"short": 2}) == "short"


def test_confident_still_respects_ties():
    assert sp.confident({"short": 3, "long": 3}) is None


def test_top_tags_orders_by_count_and_respects_the_floor():
    counts = {"futbol": 5, "kitob": 3, "yolgiz_esladi": 1}
    assert sp.top_tags(counts, limit=2) == ["futbol", "kitob"]  # 1-vote tag excluded


def test_top_tags_respects_limit():
    counts = {"a": 5, "b": 4, "c": 3}
    assert sp.top_tags(counts, limit=1) == ["a"]


def test_bump_tags_caps_total_distinct_tags_keeping_the_highest_voted():
    counts = {f"tag{i}": 1 for i in range(sp._MAX_TAGS)}
    counts["tag0"] = 50  # clear leader, must survive the cap
    result = sp._bump_tags(counts, ["brand_new_tag"])
    assert len(result) == sp._MAX_TAGS
    assert result["tag0"] == 50
