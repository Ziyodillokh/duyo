"""A stale conversation_id must not lock a child out — and must not become a hole.

The mobile client persists conversation_id in local storage, so it outlives the
row: a wiped database, a deleted conversation, or an id created under a
different child profile all leave a stale one behind. Both endpoints used to
reject it outright (chat 404, voice close 1008 → HTTP 403), and since nothing
in the app clears the stored id, the child was locked out until reinstall.

They now fall back to starting a fresh conversation. The risk that introduces
is attaching to someone else's conversation, so what matters most is that the
lookup stays scoped to the calling child — asserted here against the real
source, not a copy of it.
"""

import inspect
import re

from duyo.api.v1 import chat as chat_api
from duyo.api.v1 import voice as voice_api


def _resolve_block(source: str, marker: str) -> str:
    """The conversation lookup plus the lines around it."""
    start = source.index(marker)
    return source[start : start + 900]


def test_chat_scopes_the_lookup_to_the_calling_child():
    block = _resolve_block(
        inspect.getsource(chat_api.chat_turn), "payload.conversation_id is not None"
    )
    assert "Conversation.child_id == child.id" in block


def test_voice_scopes_the_lookup_to_the_calling_child():
    block = _resolve_block(
        inspect.getsource(voice_api.voice_ws), "conversation_id is not None"
    )
    assert "Conversation.child_id == child.id" in block


def test_neither_endpoint_rejects_an_unknown_conversation():
    """The behaviour change itself: no error path is left on a missed lookup."""
    for source in (
        inspect.getsource(chat_api.chat_turn),
        inspect.getsource(voice_api.voice_ws),
    ):
        block = _resolve_block(source, "conversation_id is not None")
        assert not re.search(r"Conversation not found|conversation not found", block)
        # ...and a new conversation is created instead.
        assert "Conversation(child_id=child.id)" in source
