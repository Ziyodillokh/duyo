"""Chat wire contract for local-first personal memory.

Two fields cross the device/server boundary, and both are meant to be
transient: `ChatRequest.memory_context` (what the DEVICE selected from its own
encrypted store as relevant to this one message) and
`ChatResponse.memory_candidate` (what the extractor suggests the device might
offer to remember). Neither is ever written to Postgres — see
services/memory_candidates.py. These tests pin the shape and, more
importantly, the caps: the device already narrows hundreds of memories down
to a handful, and this is the backstop against a buggy client shipping the
whole store on every turn.
"""

import inspect
from uuid import uuid4

import pytest
from pydantic import ValidationError

from duyo.models.crisis_event import CrisisLevel
from duyo.schemas.chat import (
    MAX_MEMORY_CONTEXT_ITEMS,
    ChatRequest,
    ChatResponse,
    MemoryCandidateRead,
)

# Mirrors memory-db.ts's MEMORY_CATEGORIES. "goals" is deliberately absent —
# goals have their own table, extractor and confirmation flow.
CATEGORIES = ["profile", "preferences", "interests", "learning", "research", "notes"]


# --- request -----------------------------------------------------------------


def test_memory_context_is_optional():
    """Every existing client predates this field and must keep working."""
    req = ChatRequest(child_id=uuid4(), message="salom")
    assert req.memory_context is None


def test_memory_context_accepts_device_selected_lines():
    req = ChatRequest(
        child_id=uuid4(),
        message="Algebrani tushuntirib ber",
        memory_context=["Bola algebra bo'yicha qiynaladi"],
    )
    assert req.memory_context == ["Bola algebra bo'yicha qiynaladi"]


def test_memory_context_accepts_exactly_the_cap():
    req = ChatRequest(
        child_id=uuid4(),
        message="salom",
        memory_context=[f"fakt {i}" for i in range(MAX_MEMORY_CONTEXT_ITEMS)],
    )
    assert len(req.memory_context) == MAX_MEMORY_CONTEXT_ITEMS


def test_memory_context_rejects_more_than_the_cap():
    """A client shipping its whole memory store is rejected, not truncated."""
    with pytest.raises(ValidationError):
        ChatRequest(
            child_id=uuid4(),
            message="salom",
            memory_context=[f"fakt {i}" for i in range(MAX_MEMORY_CONTEXT_ITEMS + 1)],
        )


def test_memory_context_rejects_an_essay_per_line():
    """Per-line cap, so the prompt budget cannot be blown by one long line."""
    with pytest.raises(ValidationError):
        ChatRequest(child_id=uuid4(), message="salom", memory_context=["x" * 5000])


# --- response ----------------------------------------------------------------


def test_response_carries_no_candidate_by_default():
    """Most turns hold nothing worth remembering; the field stays absent."""
    resp = ChatResponse(
        conversation_id=uuid4(), message_id=uuid4(), reply="salom",
        crisis_level=CrisisLevel.GREEN, model="m", latency_ms=1,
    )
    assert resp.memory_candidate is None


def test_response_carries_a_candidate_when_there_is_one():
    resp = ChatResponse(
        conversation_id=uuid4(), message_id=uuid4(), reply="Zo'r-ku!",
        crisis_level=CrisisLevel.GREEN, model="m", latency_ms=1,
        memory_candidate=MemoryCandidateRead(
            category="research",
            content="Bola AI agentlar bo'yicha ilmiy ish qilmoqda",
        ),
    )
    assert resp.memory_candidate.category == "research"


@pytest.mark.parametrize("category", CATEGORIES)
def test_every_device_category_is_valid_on_the_wire(category):
    assert MemoryCandidateRead(category=category, content="fakt").category == category


def test_goals_is_not_a_memory_category():
    """Goals are their own subsystem — never smuggled in as a memory."""
    with pytest.raises(ValidationError):
        MemoryCandidateRead(category="goals", content="kitob o'qish")


def test_an_invented_category_is_rejected():
    with pytest.raises(ValidationError):
        MemoryCandidateRead(category="medical", content="...")


# --- handler wiring ----------------------------------------------------------
# Asserted against the real source rather than a mock, matching
# test_stale_conversation.py: chat_turn needs so much mocking that a
# fake-session test would mostly assert the mock. These pin the properties a
# refactor could quietly break.


def _chat_turn_source() -> str:
    from duyo.api.v1 import chat as chat_api

    return inspect.getsource(chat_api.chat_turn)


def test_extraction_is_gated_on_a_green_turn():
    """A crisis-flagged message is never a candidate for "remember this?".

    The child is being routed to the crisis screen; interrupting that with a
    memory prompt would be grotesque, and the message itself is exactly what
    must NOT be casually retained.
    """
    source = _chat_turn_source()
    # Anchored on the call itself, not the name — the name also appears in the
    # comment above it and in its own annotation.
    start = source.index("asyncio.create_task(extract_memory_candidate")
    # Walk back over the assignment/comment lines to the nearest control flow.
    lines = [ln.strip() for ln in source[:start].split("\n") if ln.strip()]
    gate = next(
        ln for ln in reversed(lines)
        if ln.startswith(("if ", "elif ", "else", "for ", "while ", "try", "except"))
    )
    assert gate == "if final_level == CrisisLevel.GREEN:"


def test_extraction_starts_before_the_reply_and_is_awaited_after():
    """Concurrency, not sequence.

    The extractor only needs payload.message, so it overlaps the reply's own
    Gemini call. Awaiting it after the reply instead would add its full
    latency to every GREEN turn the child sits waiting through.
    """
    source = _chat_turn_source()
    created = source.index("asyncio.create_task(extract_memory_candidate")
    reply_built = source.index("scripted_text = (")
    awaited = source.index("await memory_task")
    assert created < reply_built < awaited


def test_the_candidate_is_never_persisted():
    """It rides back in the response only — no row, no cache, no background write."""
    source = _chat_turn_source()
    # Everything from the await to the return statement.
    tail = source[source.index("await memory_task"):]
    for persist in ("db.add(", "session.add(", "background_tasks.add_task", "commit("):
        assert persist not in tail, f"{persist} must not run on the candidate path"


def test_device_memory_rides_the_personalization_slot_not_rag():
    """rag_context is owned by the textbook/psychology retrievers.

    Putting device memory there would silently displace a textbook citation
    on any turn that had both.
    """
    source = _chat_turn_source()
    block = source[source.index("_context_blocks = ["):source.index("personalization_context = ")]
    assert "build_local_memory_context(payload.memory_context)" in block
