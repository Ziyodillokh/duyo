"""Chat topics → knowledge notes that GROW: create once, enrich on return.

Pure helpers (_clean_topic, _format_new_body, _enrich_body) are tested
directly; capture_topic's orchestration runs against a fake session (repo
convention). The properties that matter: DUYO never edits a note it did not
write, re-told facts change nothing, and a failure never raises into the
chat pipeline.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from uuid import uuid4

from duyo.models.note import ChildNote, NoteSource
from duyo.services import topic_notes as mod
from duyo.services.notes import extract_links, extract_tags
from duyo.services.topic_notes import (
    _clean_topic,
    _enrich_body,
    _format_new_body,
    capture_topic,
)


def _run(coro):
    # asyncio.run, not get_event_loop() — see test_goal_paths.py.
    return asyncio.run(coro)


def _topic(**over):
    base = {
        "title": "Dinozavrlar",
        "facts": ["T-rex go'shtxo'r bo'lgan."],
        "related": ["Qazilmalar"],
        "tag": "tabiat",
    }
    base.update(over)
    return base


# ── _clean_topic ─────────────────────────────────────────────────────────────

def test_clean_accepts_a_real_topic():
    out = _clean_topic(_topic())
    assert out == {
        "title": "Dinozavrlar",
        "facts": ["T-rex go'shtxo'r bo'lgan."],
        "related": ["Qazilmalar"],
        "tag": "tabiat",
    }


def test_clean_rejects_null_junk_and_factless_topics():
    assert _clean_topic(None) is None
    assert _clean_topic("Dinozavrlar") is None
    assert _clean_topic(_topic(title="ab")) is None            # too short
    assert _clean_topic(_topic(facts=[])) is None              # nothing said
    assert _clean_topic(_topic(facts=["hm"])) is None          # too thin
    assert _clean_topic(_topic(title="To'rt so'z emas bu sarlavha uzun")) is None


def test_clean_strips_titles_that_would_break_link_or_tag_syntax():
    assert _clean_topic(_topic(title="Kosmos [[x]]")) is None
    assert _clean_topic(_topic(title="#kosmos")) is None
    out = _clean_topic(_topic(related=["[[Buzuq]]", "Sayyoralar"]))
    assert out is not None
    assert out["related"] == ["Sayyoralar"]


def test_clean_rejects_the_pipe_the_link_regex_excludes():
    """[[A | B]] never parses (notes.py _LINK excludes |), so a pipe-bearing
    name would be dead literal text that enrichment re-appends forever."""
    assert _clean_topic(_topic(title="Fizika | Kimyo")) is None
    out = _clean_topic(_topic(related=["Fizika | Kimyo", "Sayyoralar"]))
    assert out["related"] == ["Sayyoralar"]


def test_clean_never_turns_json_null_into_the_string_none():
    """str(None) == 'None' passes every length check — a note titled 'None',
    a [[None]] link and a #none tag hub, all from one null field."""
    assert _clean_topic(_topic(title=None)) is None
    assert _clean_topic(_topic(facts=[None]))is None
    out = _clean_topic(_topic(related=[None], tag=None))
    assert out["related"] == []
    assert out["tag"] == "mavzu"


def test_clean_trims_trailing_punctuation_so_retellings_collapse():
    """'Dinozavrlar.' and 'Dinozavrlar' must be ONE note, or returning to a
    topic duplicates it instead of enriching it."""
    assert _clean_topic(_topic(title="Dinozavrlar."))["title"] == "Dinozavrlar"
    out = _clean_topic(_topic(related=["Qazilmalar…"]))
    assert out["related"] == ["Qazilmalar"]


def test_clean_strips_link_and_tag_syntax_out_of_facts():
    """Facts are prose; the model wrapping a word in [[...]] or #tag must not
    inject nodes into the child's graph."""
    out = _clean_topic(_topic(facts=["T-rex [[Qazilmalar]] ichida #tarix topilgan."]))
    assert out["facts"] == ["T-rex Qazilmalar ichida tarix topilgan."]
    body = _format_new_body(out["facts"], [], out["tag"])
    assert extract_links(body) == []
    assert extract_tags(body) == ["tabiat"]


def test_clean_dedupes_related_and_never_links_a_topic_to_itself():
    out = _clean_topic(_topic(related=["Qazilmalar", "qazilmalar", "Dinozavrlar"]))
    assert out["related"] == ["Qazilmalar"]


def test_clean_falls_back_to_a_safe_tag():
    assert _clean_topic(_topic(tag="ikki so'z"))["tag"] == "ikki"
    assert _clean_topic(_topic(tag="#123"))["tag"] == "mavzu"
    assert _clean_topic(_topic(tag=""))["tag"] == "mavzu"


def test_clean_caps_facts_and_related():
    out = _clean_topic(_topic(
        facts=[f"Fakt raqami {i} haqida gap." for i in range(6)],
        related=["A-mavzu", "B-mavzu", "C-mavzu"],
    ))
    assert len(out["facts"]) == 3
    assert len(out["related"]) == 2


# ── body building and enrichment ─────────────────────────────────────────────

def test_new_body_parses_back_as_links_and_tag():
    body = _format_new_body(
        ["T-rex go'shtxo'r bo'lgan.", "Ular 66 mln yil oldin yo'q bo'lgan."],
        ["Qazilmalar"], "tabiat",
    )
    assert extract_links(body) == ["Qazilmalar"]
    assert extract_tags(body) == ["tabiat"]
    assert body.count("• ") == 2


def test_enrich_appends_only_new_facts_after_existing_bullets():
    body = _format_new_body(["Eski fakt shu yerda."], [], "tabiat")
    out = _enrich_body(body, ["Eski fakt shu yerda.", "Yangi fakt keldi."], [])
    assert out is not None
    assert out.count("Eski fakt") == 1          # dedup — not repeated
    assert "Yangi fakt keldi." in out
    lines = out.split("\n")
    bullets = [ln for ln in lines if ln.startswith("• ")]
    assert bullets == ["• Eski fakt shu yerda.", "• Yangi fakt keldi."]
    assert extract_tags(out) == ["tabiat"]       # tag line survives at the end


def test_enrich_merges_new_links_into_the_related_line():
    body = _format_new_body(["Bir fakt bor."], ["Qazilmalar"], "tabiat")
    out = _enrich_body(body, [], ["Qazilmalar", "Sayyoralar"])
    assert out is not None
    assert extract_links(out) == ["Qazilmalar", "Sayyoralar"]
    assert out.count(mod._RELATED_LABEL) == 1    # merged, not a second line


def test_enrich_adds_a_related_line_when_there_was_none():
    body = _format_new_body(["Bir fakt bor."], [], "tabiat")
    out = _enrich_body(body, [], ["Sayyoralar"])
    assert out is not None
    assert extract_links(out) == ["Sayyoralar"]
    assert extract_tags(out) == ["tabiat"]


def test_enrich_is_a_noop_when_nothing_is_new():
    body = _format_new_body(["Bir fakt bor."], ["Qazilmalar"], "tabiat")
    assert _enrich_body(body, ["bir fakt bor."], ["qazilmalar"]) is None  # case-insensitive


def test_enrich_stops_at_the_soft_cap():
    body = _format_new_body(["x" * 150 for _ in range(3)], [], "tabiat")
    fat = body + "\n" + "\n".join(f"• to'ldiruvchi {i} " + "y" * 150 for i in range(30))
    assert len(fat) > mod._BODY_SOFT_CAP
    assert _enrich_body(fat, ["Mutlaqo yangi fakt."], []) is None


# ── capture_topic orchestration ──────────────────────────────────────────────

@dataclass
class _FakeSession:
    existing: ChildNote | None = None
    topic_count: int = 0
    added: list = field(default_factory=list)
    committed: int = 0

    async def scalar(self, stmt, *_a, **_kw):
        # select(func.count(...)) labels its column count/count_1;
        # select(ChildNote) names it after the entity.
        name = str(stmt.column_descriptions[0].get("name", "")).lower()
        if name.startswith("count"):
            return self.topic_count
        return self.existing

    def add(self, note):
        self.added.append(note)

    async def commit(self):
        self.committed += 1

    async def rollback(self):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False


def _install(monkeypatch, session):
    monkeypatch.setattr(mod, "get_session_factory", lambda: (lambda: session))


def _note(source: NoteSource, body: str) -> ChildNote:
    note = ChildNote(child_id=uuid4(), title="Dinozavrlar", body=body)
    note.source = source
    return note


def test_a_new_topic_becomes_a_chat_topic_note(monkeypatch):
    session = _FakeSession(existing=None)
    _install(monkeypatch, session)

    _run(capture_topic(uuid4(), _topic()))

    assert len(session.added) == 1
    note = session.added[0]
    assert note.source is NoteSource.CHAT_TOPIC
    assert note.title == "Dinozavrlar"
    assert "T-rex" in note.body
    assert session.committed == 1


def test_returning_to_a_topic_enriches_duyos_own_note(monkeypatch):
    existing = _note(NoteSource.CHAT_TOPIC, _format_new_body(["Eski fakt."], [], "tabiat"))
    session = _FakeSession(existing=existing)
    _install(monkeypatch, session)

    _run(capture_topic(uuid4(), _topic(facts=["Yangi fakt keldi."])))

    assert "Yangi fakt keldi." in existing.body
    assert session.added == []                   # enriched, not duplicated
    assert session.committed == 1


def test_a_childs_manual_note_is_never_edited(monkeypatch):
    body = "Bu mening o'z yozuvim."
    existing = _note(NoteSource.MANUAL, body)
    session = _FakeSession(existing=existing)
    _install(monkeypatch, session)

    _run(capture_topic(uuid4(), _topic()))

    assert existing.body == body                 # untouched, byte for byte
    assert session.added == []
    assert session.committed == 0


def test_a_goal_path_step_is_never_edited(monkeypatch):
    existing = _note(NoteSource.GOAL_PATH, "qadam matni")
    session = _FakeSession(existing=existing)
    _install(monkeypatch, session)

    _run(capture_topic(uuid4(), _topic()))

    assert existing.body == "qadam matni"
    assert session.committed == 0


def test_the_topic_note_cap_stops_new_notes_not_enrichment(monkeypatch):
    session = _FakeSession(existing=None, topic_count=mod._MAX_TOPIC_NOTES)
    _install(monkeypatch, session)

    _run(capture_topic(uuid4(), _topic()))

    assert session.added == []
    assert session.committed == 0


def test_garbage_from_the_model_writes_nothing(monkeypatch):
    session = _FakeSession()
    _install(monkeypatch, session)

    _run(capture_topic(uuid4(), None))
    _run(capture_topic(uuid4(), {"title": "x"}))

    assert session.added == []
    assert session.committed == 0


def test_a_failure_never_raises_into_the_chat_pipeline(monkeypatch):
    def _boom():
        raise RuntimeError("db down")

    monkeypatch.setattr(mod, "get_session_factory", _boom)
    _run(capture_topic(uuid4(), _topic()))       # must not raise
