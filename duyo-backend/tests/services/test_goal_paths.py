"""Goal → brain-map path: a detected goal becomes linked notes in the graph.

The path builder is pure and tested directly. The service that writes it is
exercised with a fake session (repo convention) — what matters is that it is
idempotent by goal_id, writes nothing when the model returns no steps, and
that the notes it writes are correctly linked, tagged and marked.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from uuid import uuid4

from duyo.models.child import AgeSegment
from duyo.models.note import ChildNote, NoteSource
from duyo.services import goal_paths as mod
from duyo.services.goal_paths import GOAL_COLOUR, GOAL_TAG, _build_path_notes, _uniquify
from duyo.services.notes import extract_links, extract_tags


def _run(coro):
    # asyncio.run, not get_event_loop(): earlier test files close their loop,
    # and inheriting a closed loop is a RuntimeError only when the whole suite
    # runs together — the classic "passes alone, fails in the suite".
    return asyncio.run(coro)


# ── the pure path builder ────────────────────────────────────────────────────

def _steps(n):
    return [{"title": f"Qadam{i}", "detail": f"Nima qilish {i}."} for i in range(1, n + 1)]


def test_builds_a_hub_plus_one_note_per_step():
    notes = _build_path_notes(uuid4(), uuid4(), "Maqsadim", _steps(4), set())
    assert len(notes) == 5  # hub + 4 steps
    assert notes[0].title == "Maqsadim"


def test_every_note_is_marked_as_a_goal_path_step():
    goal_id = uuid4()
    notes = _build_path_notes(uuid4(), goal_id, "Maqsadim", _steps(3), set())
    for n in notes:
        assert n.source is NoteSource.GOAL_PATH
        assert n.goal_id == goal_id
        assert n.colour == GOAL_COLOUR
        assert GOAL_TAG.lstrip("#") in extract_tags(n.body)


def test_notes_form_a_connected_chain_hub_to_steps_to_hub():
    notes = _build_path_notes(uuid4(), uuid4(), "Maqsadim", _steps(3), set())
    by_title = {n.title: n for n in notes}
    hub, *steps = notes

    # hub -> step 1
    assert extract_links(hub.body) == [steps[0].title]
    # each step -> next step
    for i in range(len(steps) - 1):
        assert extract_links(steps[i].body) == [steps[i + 1].title]
    # last step -> back to the hub (the destination)
    assert extract_links(steps[-1].body) == [hub.title]
    # every [[link]] resolves to a note that exists in the cluster
    for n in notes:
        for link in extract_links(n.body):
            assert link in by_title


def test_step_titles_encode_order():
    notes = _build_path_notes(uuid4(), uuid4(), "Maqsadim", _steps(3), set())
    steps = notes[1:]
    assert steps[0].title.startswith("1-qadam:")
    assert steps[1].title.startswith("2-qadam:")
    assert steps[2].title.startswith("3-qadam:")


def test_titles_are_uniquified_against_existing_notes():
    taken = {"Maqsadim"}  # the child already has a note with the goal's title
    notes = _build_path_notes(uuid4(), uuid4(), "Maqsadim", _steps(2), taken)
    titles = [n.title for n in notes]
    assert len(titles) == len(set(titles))          # no internal collisions
    assert "Maqsadim" not in titles or titles[0] != "Maqsadim"  # hub was suffixed
    # and every link still resolves (bodies use the FINAL titles)
    by_title = {n.title for n in notes}
    for n in notes:
        for link in extract_links(n.body):
            assert link in by_title


def test_uniquify_suffixes_on_collision():
    taken = {"X"}
    assert _uniquify("X", taken) == "X (2)"
    assert _uniquify("X", taken) == "X (3)"
    assert _uniquify("Y", taken) == "Y"


# ── the service orchestration (fake session) ─────────────────────────────────

@dataclass
class _FakeSession:
    already: object | None = None          # ChildNote.id idempotency answer
    age: object | None = AgeSegment.EXPLORER
    titles: list = field(default_factory=list)
    added: list = field(default_factory=list)
    committed: int = 0

    async def scalar(self, stmt, *_a, **_kw):
        desc = stmt.column_descriptions[0]
        if desc["entity"] is ChildNote:      # select(ChildNote.id) idempotency
            return self.already
        return self.age                       # select(ChildProfile.age_segment)

    async def scalars(self, _stmt, *_a, **_kw):
        class _R:
            def __init__(self, rows): self._rows = rows
            def all(self): return self._rows
        return _R(self.titles)

    def add_all(self, notes):
        self.added.extend(notes)

    async def commit(self):
        self.committed += 1

    async def rollback(self):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False


def _factory(session):
    def make():
        return session
    return make


def _async(value):
    async def _fn(*_a, **_kw):
        return value
    return _fn


def test_writes_a_path_when_a_goal_is_decomposed(monkeypatch):
    session = _FakeSession(already=None, titles=["Boshqa qayd"])
    monkeypatch.setattr(mod, "get_session_factory", lambda: _factory(session))
    monkeypatch.setattr(mod, "decompose_goal", _async(_steps(3)))

    _run(mod.decompose_goal_into_notes(uuid4(), uuid4(), "Matematika"))

    assert session.committed == 1
    assert len(session.added) == 4  # hub + 3
    assert all(n.source is NoteSource.GOAL_PATH for n in session.added)


def test_is_idempotent_when_the_goal_is_already_mapped(monkeypatch):
    session = _FakeSession(already=uuid4())  # a note with this goal_id exists
    called = {"llm": False}

    async def _should_not_run(*_a, **_kw):
        called["llm"] = True
        return _steps(3)

    monkeypatch.setattr(mod, "get_session_factory", lambda: _factory(session))
    monkeypatch.setattr(mod, "decompose_goal", _should_not_run)

    _run(mod.decompose_goal_into_notes(uuid4(), uuid4(), "Matematika"))

    assert called["llm"] is False   # never even asked the model
    assert session.added == []
    assert session.committed == 0


def test_writes_nothing_when_the_model_returns_no_steps(monkeypatch):
    session = _FakeSession(already=None)
    monkeypatch.setattr(mod, "get_session_factory", lambda: _factory(session))
    monkeypatch.setattr(mod, "decompose_goal", _async([]))

    _run(mod.decompose_goal_into_notes(uuid4(), uuid4(), "juda noaniq"))

    assert session.added == []
    assert session.committed == 0


def test_a_failure_never_raises_into_the_caller(monkeypatch):
    """The background goal-extraction task must never be broken by this."""
    def _boom():
        raise RuntimeError("db down")

    monkeypatch.setattr(mod, "get_session_factory", _boom)
    # Must not raise.
    _run(mod.decompose_goal_into_notes(uuid4(), uuid4(), "Matematika"))
