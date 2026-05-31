from uuid import uuid4

from duyo.models.crisis_event import CrisisLevel
from duyo.schemas.chat import ChatRequest, ChatResponse, ChatSource, QuickReply, SourceRef


def test_chat_request_accepts_web_search_action():
    req = ChatRequest(child_id=uuid4(), message="Ha", action="web_search", action_query="sitoplazma nima")
    assert req.action == "web_search"
    assert req.action_query == "sitoplazma nima"


def test_chat_response_carries_source_and_quick_replies():
    resp = ChatResponse(
        conversation_id=uuid4(), message_id=uuid4(), reply="x",
        crisis_level=CrisisLevel.GREEN, model="m", latency_ms=1,
        source=ChatSource(type="textbook", label="6-sinf Botanika darsligi",
                          refs=[SourceRef(title="Botanika 6")]),
        quick_replies=[QuickReply(label="Ha", action="web_search", query="sitoplazma nima")],
    )
    assert resp.source.type == "textbook"
    assert resp.quick_replies[0].action == "web_search"
