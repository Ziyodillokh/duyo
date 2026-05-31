from uuid import uuid4

from duyo.api.v1.chat import _textbook_source, _web_source
from duyo.models.crisis_event import CrisisLevel
from duyo.schemas.chat import ChatRequest, ChatResponse, ChatSource, QuickReply, SourceRef
from duyo.services.gemini import WebSource
from duyo.textbook.retriever import RagRetrieval


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


def test_textbook_source_label_and_refs():
    rag = RagRetrieval(context="...", refs=[("botanika", 6, "Hujayra"), ("tarix", 6, None)])
    src = _textbook_source(rag)
    assert src.type == "textbook"
    assert src.label == "6-sinf Botanika darsligi"
    assert src.refs[0].title == "6-sinf Botanika — Hujayra"
    assert src.refs[1].title == "6-sinf Tarix"


def test_web_source_maps_urls():
    src = _web_source((WebSource("Wiki", "https://wikipedia.org"),))
    assert src.type == "web"
    assert src.refs[0].url == "https://wikipedia.org"
