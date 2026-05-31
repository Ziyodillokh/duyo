# Chat: darslik javobi + ixtiyoriy internet qidiruv — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chat avval darslik (RAG) kontentidan manba keltirib javob beradi va har RAG javobida internet qidiruvni Ha/Yo'q tugmalari bilan taklif qiladi; RAG topmasa to'g'ridan-to'g'ri Gemini Google Search grounding bilan javob beradi.

**Architecture:** Backend `gemini.py`ga Google Search grounding qo'shiladi (`chat_with_web_search`), `retriever.py` darslik manbasini (`RagRetrieval`) qaytaradi, `chat.py` uch oqimni (RAG-hit / RAG-miss / action=web_search) boshqaradi. Schemas `ChatRequest`/`ChatResponse`ga `action`/`source`/`quick_replies` qo'shadi. Mobil quick-reply chiplar + manba badge render qiladi.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy async, google-genai SDK (Google Search grounding), pytest; React Native (Expo), TypeScript, zustand, react-query.

**Spec:** `duyo-docs/specs/2026-05-31-chat-web-search-followup-design.md`

---

## File Structure

**Backend (`duyo-backend/`):**
- Modify `src/duyo/services/gemini.py` — `WebSource` dataclass, `GeminiReply.sources`, `chat_with_web_search()`, `_extract_web_sources()`.
- Modify `src/duyo/schemas/chat.py` — `SourceRef`, `ChatSource`, `QuickReply`; extend `ChatRequest`, `ChatResponse`.
- Modify `src/duyo/textbook/retriever.py` — `RagRetrieval` dataclass; `retrieve_for_chat` returns it; citation instruction in `build_rag_context`.
- Modify `src/duyo/api/v1/chat.py` — wire three flows.
- Create `tests/services/test_gemini_websearch.py`, `tests/textbook/test_retriever_source.py`, `tests/api/test_chat_websearch.py`.

**Mobile (`duyo-mobile/`):**
- Modify `src/api/endpoints/chat.ts` — wire types + normalize.
- Modify `src/store/chat.ts` — `ChatMessage.source`, `ChatMessage.quickReplies`.
- Modify `src/app/(main)/(tabs)/chat.tsx` — source badge + quick-reply chips + Ha/Yo'q handlers.

---

## Task 1: Web-search grounding in gemini service

**Files:**
- Modify: `duyo-backend/src/duyo/services/gemini.py`
- Test: `duyo-backend/tests/services/test_gemini_websearch.py`

- [ ] **Step 1: Add `WebSource` + `sources` field + extractor (no behaviour change yet)**

In `gemini.py`, update imports and the dataclass block:

```python
from dataclasses import dataclass, field
```

Add after `HistoryRole = ...`:

```python
@dataclass(frozen=True)
class WebSource:
    title: str
    url: str
```

Extend `GeminiReply` (add field at the end):

```python
@dataclass(frozen=True)
class GeminiReply:
    text: str
    model: str
    latency_ms: int
    tokens_in: int | None
    tokens_out: int | None
    sources: tuple[WebSource, ...] = ()
```

Add the extractor near the bottom of the module:

```python
def _extract_web_sources(resp) -> tuple[WebSource, ...]:
    """Pull grounding URLs from a grounded Gemini response. Tolerant of any
    missing attribute (returns empty tuple) so a malformed response never
    breaks the reply."""
    out: list[WebSource] = []
    try:
        cand = resp.candidates[0]
        meta = getattr(cand, "grounding_metadata", None)
        for ch in (getattr(meta, "grounding_chunks", None) or []):
            web = getattr(ch, "web", None)
            uri = getattr(web, "uri", None) if web else None
            if uri:
                title = getattr(web, "title", None) or uri
                out.append(WebSource(title=title, url=uri))
    except (AttributeError, IndexError, TypeError):
        pass
    # de-dup by url, preserve order
    seen: set[str] = set()
    deduped = [s for s in out if not (s.url in seen or seen.add(s.url))]
    return tuple(deduped)
```

- [ ] **Step 2: Write the failing test for `_extract_web_sources`**

Create `tests/services/test_gemini_websearch.py`:

```python
from types import SimpleNamespace

from duyo.services.gemini import WebSource, _extract_web_sources


def _resp(chunks):
    web_chunks = [SimpleNamespace(web=SimpleNamespace(**c)) for c in chunks]
    cand = SimpleNamespace(grounding_metadata=SimpleNamespace(grounding_chunks=web_chunks))
    return SimpleNamespace(candidates=[cand])


def test_extract_web_sources_parses_and_dedups():
    resp = _resp([
        {"uri": "https://a.uz", "title": "A"},
        {"uri": "https://a.uz", "title": "A dup"},
        {"uri": "https://b.uz", "title": "B"},
    ])
    sources = _extract_web_sources(resp)
    assert sources == (WebSource("A", "https://a.uz"), WebSource("B", "https://b.uz"))


def test_extract_web_sources_tolerates_missing_metadata():
    assert _extract_web_sources(SimpleNamespace(candidates=[])) == ()
    assert _extract_web_sources(SimpleNamespace()) == ()
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd duyo-backend && APP_SECRET_KEY=ci_dummy_secret_at_least_16_chars .venv/bin/python -m pytest tests/services/test_gemini_websearch.py -q --no-cov`
Expected: PASS (2 tests).

- [ ] **Step 4: Add `chat_with_web_search()`**

Add to `gemini.py` after the existing `chat(...)` function:

```python
async def chat_with_web_search(
    *,
    child_message: str,
    age_segment: AgeSegment,
    history: list[tuple[HistoryRole, str]] | None = None,
) -> GeminiReply:
    """Grounded reply backed by Google Search. Same child-safe system prompt as
    `chat()`; returns web sources in `GeminiReply.sources`."""
    settings = get_settings()
    client = get_client()
    model = settings.gemini_model_primary

    thinking_cfg = (
        types.ThinkingConfig(thinking_budget=settings.gemini_thinking_budget_flash)
        if "flash" in model
        else None
    )
    contents = _build_contents(history, child_message)

    start = time.perf_counter()
    resp = await client.aio.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPTS[age_segment],
            max_output_tokens=settings.gemini_max_output_tokens,
            temperature=settings.gemini_temperature,
            thinking_config=thinking_cfg,
            tools=[types.Tool(google_search=types.GoogleSearch())],
        ),
    )
    latency_ms = int((time.perf_counter() - start) * 1000)
    usage = resp.usage_metadata
    return GeminiReply(
        text=resp.text or "",
        model=model,
        latency_ms=latency_ms,
        tokens_in=usage.prompt_token_count if usage else None,
        tokens_out=usage.candidates_token_count if usage else None,
        sources=_extract_web_sources(resp),
    )
```

- [ ] **Step 5: Write the failing test for `chat_with_web_search` (mock client)**

First, update the `_resp` helper at the top of the file so the fake response also carries `text` and `usage_metadata` (needed by `chat_with_web_search`):

```python
def _resp(chunks, text=""):
    web_chunks = [SimpleNamespace(web=SimpleNamespace(**c)) for c in chunks]
    cand = SimpleNamespace(grounding_metadata=SimpleNamespace(grounding_chunks=web_chunks))
    return SimpleNamespace(candidates=[cand], text=text, usage_metadata=None)
```

(The two earlier tests call `_resp([...])` with no text — still valid via the default.)

Append the new test:

```python
import pytest

from duyo.models.child import AgeSegment


@pytest.mark.asyncio
async def test_chat_with_web_search_returns_text_and_sources(monkeypatch):
    captured = {}

    class _FakeModels:
        async def generate_content(self, **kwargs):
            captured["config"] = kwargs["config"]
            return _resp([{"uri": "https://wikipedia.org", "title": "Wiki"}], text="javob")

    class _FakeClient:
        aio = SimpleNamespace(models=_FakeModels())

    monkeypatch.setattr("duyo.services.gemini.get_client", lambda: _FakeClient())

    from duyo.services import gemini
    reply = await gemini.chat_with_web_search(
        child_message="sitoplazma nima", age_segment=AgeSegment.EXPLORER,
    )
    assert reply.text == "javob"
    assert reply.sources[0].url == "https://wikipedia.org"
    assert captured["config"].tools, "expected google_search tool attached"
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd duyo-backend && APP_SECRET_KEY=ci_dummy_secret_at_least_16_chars .venv/bin/python -m pytest tests/services/test_gemini_websearch.py -q --no-cov`
Expected: PASS (3 tests).

- [ ] **Step 7: Lint + commit**

```bash
cd duyo-backend && .venv/bin/python -m ruff check src/duyo/services/gemini.py tests/services/test_gemini_websearch.py
git add duyo-backend/src/duyo/services/gemini.py duyo-backend/tests/services/test_gemini_websearch.py
git commit -m "feat(gemini): chat_with_web_search via Google Search grounding"
```

---

## Task 2: Chat schemas (action, source, quick_replies)

**Files:**
- Modify: `duyo-backend/src/duyo/schemas/chat.py`
- Test: `duyo-backend/tests/api/test_chat_websearch.py` (schema part)

- [ ] **Step 1: Add the new schema types**

In `schemas/chat.py`, add `Literal` to imports:

```python
from typing import Literal
```

Add after the existing imports/classes:

```python
class SourceRef(BaseModel):
    title: str
    url: str | None = None


class ChatSource(BaseModel):
    type: Literal["textbook", "web", "none"]
    label: str
    refs: list[SourceRef] = []


class QuickReply(BaseModel):
    label: str
    action: Literal["web_search", "dismiss"]
    query: str | None = None
```

Extend `ChatRequest`:

```python
class ChatRequest(BaseModel):
    child_id: UUID
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: UUID | None = None
    action: Literal["web_search"] | None = None
    action_query: str | None = Field(default=None, max_length=2000)
```

Extend `ChatResponse` (add the two new fields at the end):

```python
    source: ChatSource | None = None
    quick_replies: list[QuickReply] = []
```

- [ ] **Step 2: Write the failing test**

Create `tests/api/test_chat_websearch.py`:

```python
from duyo.schemas.chat import ChatRequest, ChatResponse, ChatSource, QuickReply, SourceRef
from duyo.models.crisis_event import CrisisLevel
from uuid import uuid4


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
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd duyo-backend && APP_SECRET_KEY=ci_dummy_secret_at_least_16_chars .venv/bin/python -m pytest tests/api/test_chat_websearch.py -q --no-cov`
Expected: PASS (2 tests).

- [ ] **Step 4: Lint + commit**

```bash
cd duyo-backend && .venv/bin/python -m ruff check src/duyo/schemas/chat.py tests/api/test_chat_websearch.py
git add duyo-backend/src/duyo/schemas/chat.py duyo-backend/tests/api/test_chat_websearch.py
git commit -m "feat(schemas): chat action + source + quick_replies"
```

---

## Task 3: Retriever returns textbook source + citation instruction

**Files:**
- Modify: `duyo-backend/src/duyo/textbook/retriever.py`
- Test: `duyo-backend/tests/textbook/test_retriever_source.py`

- [ ] **Step 1: Add `RagRetrieval` and change `retrieve_for_chat` to return it**

In `retriever.py` add to imports:

```python
from dataclasses import dataclass
```

Add after the constants:

```python
@dataclass
class RagRetrieval:
    """What chat needs from one retrieval: the prompt context block plus the
    distinct (subject, grade, topic) refs for source attribution."""
    context: str
    refs: list[tuple[str, int, str | None]]
```

Replace the body of `retrieve_for_chat` (keep signature, change return type to `RagRetrieval | None`):

```python
async def retrieve_for_chat(
    session: AsyncSession,
    child_message: str,
    *,
    grade: int | None = None,
    subject: str | None = None,
) -> RagRetrieval | None:
    """High-level helper used by the chat endpoint.

    Normalises the (possibly misspelled) child message and applies a similarity
    floor so only on-topic textbook context reaches the model. Returns the
    context block and source refs, or None when nothing relevant is found.
    """
    normalized = await _normalize_query(child_message)
    results = await search_chunks(
        session, normalized, grade=grade, subject=subject,
        limit=_DEFAULT_LIMIT, min_similarity=_CHAT_MIN_SIMILARITY,
    )
    if not results:
        log.info("rag_no_match", query=normalized[:60])
        return None

    context = build_rag_context(results)
    if context is None:
        return None
    seen: set[tuple[str, int]] = set()
    refs: list[tuple[str, int, str | None]] = []
    for chunk, _ in results:
        key = (chunk.subject, chunk.grade)
        if key in seen:
            continue
        seen.add(key)
        refs.append((chunk.subject, chunk.grade, chunk.topic))
    log.info("rag_context_built", chunks=len(results), top_score=results[0][1], query=normalized[:60])
    return RagRetrieval(context=context, refs=refs)
```

- [ ] **Step 2: Update the citation instruction in `build_rag_context`**

Replace the trailing instruction lines in `build_rag_context` (the `lines.append("Yuqoridagi darslik matniga asoslanib javob ber. ...")` block) with:

```python
    lines.append("[/DARSLIK KONTEKST]")
    lines.append("")
    lines.append(
        "Yuqoridagi darslik matniga asoslanib javob ber. Javobing boshida "
        "qaysi sinf va fan darsligidan ekanini ayt, masalan: "
        "\"6-sinf Botanika darsligiga ko'ra, ...\". "
        "Agar kontekst bolaning savoliga umuman mos kelmasa, o'z bilimingdan foydalan."
    )
```

- [ ] **Step 3: Write the failing test**

Create `tests/textbook/test_retriever_source.py`:

```python
import pytest
from types import SimpleNamespace

from duyo.textbook import retriever


def _chunk(subject, grade, topic, text="matn"):
    return SimpleNamespace(subject=subject, grade=grade, topic=topic, content_type="explanation", text=text)


@pytest.mark.asyncio
async def test_retrieve_for_chat_builds_refs(monkeypatch):
    async def fake_search(session, query, **kw):
        return [(_chunk("botanika", 6, "Hujayra"), 0.7), (_chunk("botanika", 6, "Hujayra"), 0.68)]

    monkeypatch.setattr(retriever, "_normalize_query", lambda q: _async(q))
    monkeypatch.setattr(retriever, "search_chunks", fake_search)

    result = await retriever.retrieve_for_chat(session=None, child_message="vakuol nima")
    assert result is not None
    assert result.refs == [("botanika", 6, "Hujayra")]  # deduped by (subject, grade)
    assert "DARSLIK KONTEKST" in result.context


@pytest.mark.asyncio
async def test_retrieve_for_chat_none_when_no_results(monkeypatch):
    async def fake_search(session, query, **kw):
        return []
    monkeypatch.setattr(retriever, "_normalize_query", lambda q: _async(q))
    monkeypatch.setattr(retriever, "search_chunks", fake_search)
    assert await retriever.retrieve_for_chat(session=None, child_message="qwerty") is None


async def _async(v):
    return v
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd duyo-backend && APP_SECRET_KEY=ci_dummy_secret_at_least_16_chars .venv/bin/python -m pytest tests/textbook/test_retriever_source.py -q --no-cov`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the existing retriever tests (regression)**

Run: `cd duyo-backend && APP_SECRET_KEY=ci_dummy_secret_at_least_16_chars .venv/bin/python -m pytest tests/textbook/test_retriever.py -q --no-cov`
Expected: any test calling `retrieve_for_chat` and asserting on a string must be updated to read `.context`. If a failure appears, update that assertion to use `result.context`. Re-run until PASS.

- [ ] **Step 6: Lint + commit**

```bash
cd duyo-backend && .venv/bin/python -m ruff check src/duyo/textbook/retriever.py tests/textbook/test_retriever_source.py
git add duyo-backend/src/duyo/textbook/retriever.py duyo-backend/tests/textbook/test_retriever_source.py duyo-backend/tests/textbook/test_retriever.py
git commit -m "feat(retriever): return RagRetrieval with source refs + citation instruction"
```

---

## Task 4: Wire the three flows in the chat endpoint

**Files:**
- Modify: `duyo-backend/src/duyo/api/v1/chat.py`
- Test: `duyo-backend/tests/api/test_chat_websearch.py` (flow helpers)

- [ ] **Step 1: Add imports + a pure source-builder helper**

In `chat.py` update imports:

```python
from duyo.schemas.chat import (
    ChatRequest, ChatResponse, ChildCreate, ChildRead,
    ChatSource, QuickReply, SourceRef,
)
from duyo.services.gemini import chat as gemini_chat
from duyo.services.gemini import chat_with_web_search
from duyo.textbook.retriever import retrieve_for_chat, RagRetrieval
```

Add a module-level helper (pure, easily tested) near the bottom of `chat.py`:

```python
def _textbook_source(rag: RagRetrieval) -> ChatSource:
    subject, grade, _ = rag.refs[0]
    pretty = subject.replace("-", " ").capitalize()
    return ChatSource(
        type="textbook",
        label=f"{grade}-sinf {pretty} darsligi",
        refs=[SourceRef(title=f"{g}-sinf {s.replace('-', ' ').capitalize()}" + (f" — {t}" if t else ""))
              for s, g, t in rag.refs],
    )


def _web_source(sources) -> ChatSource:
    return ChatSource(
        type="web",
        label="Internet",
        refs=[SourceRef(title=s.title, url=s.url) for s in sources],
    )


_WEB_OFFER = "\n\nXohlasang internetdan ham qo'shimcha ma'lumot qidiraman."
```

- [ ] **Step 2: Replace the RAG + reply + response block (current ~lines 208-250)**

Replace from the `# 8. RAG retrieval ...` comment through the final `return ChatResponse(...)` with:

```python
    # 8-9. Build the reply. Three flows:
    #   (a) action="web_search" → skip RAG, answer from Google Search grounding
    #   (b) RAG hit            → textbook answer + cite + offer web search
    #   (c) RAG miss           → answer from Google Search grounding
    source: ChatSource | None = None
    quick_replies: list[QuickReply] = []

    if payload.action == "web_search":
        query = payload.action_query or payload.message
        reply = await chat_with_web_search(
            child_message=query, age_segment=child.age_segment, history=history,  # type: ignore[arg-type]
        )
        source = _web_source(reply.sources)
    else:
        rag = await retrieve_for_chat(db, payload.message)
        if rag is not None:
            reply = await gemini_chat(
                child_message=payload.message, age_segment=child.age_segment,
                history=history, rag_context=rag.context,  # type: ignore[arg-type]
            )
            reply = _append_offer(reply)
            source = _textbook_source(rag)
            quick_replies = [
                QuickReply(label="Ha", action="web_search", query=payload.message),
                QuickReply(label="Yo'q", action="dismiss"),
            ]
        else:
            reply = await chat_with_web_search(
                child_message=payload.message, age_segment=child.age_segment, history=history,  # type: ignore[arg-type]
            )
            source = _web_source(reply.sources)

    # 10. Persist assistant message
    assistant_msg = Message(
        conversation_id=conv.id,
        role=MessageRole.ASSISTANT,
        content=reply.text,
        model=reply.model,
        latency_ms=reply.latency_ms,
        tokens_in=reply.tokens_in,
        tokens_out=reply.tokens_out,
        crisis_level=CrisisLevel.GREEN,
    )
    db.add(assistant_msg)
    conv.message_count = (conv.message_count or 0) + 2
    await db.flush()

    return ChatResponse(
        conversation_id=conv.id,
        message_id=assistant_msg.id,
        reply=reply.text,
        crisis_level=final_level,
        model=reply.model,
        latency_ms=reply.latency_ms,
        source=source,
        quick_replies=quick_replies,
    )
```

Add the `_append_offer` helper near `_textbook_source` (GeminiReply is frozen, so build a new one):

```python
from dataclasses import replace as _dc_replace

def _append_offer(reply):
    return _dc_replace(reply, text=reply.text + _WEB_OFFER)
```

- [ ] **Step 3: Write the failing test for `_textbook_source` + `_web_source`**

Append to `tests/api/test_chat_websearch.py`:

```python
from duyo.api.v1.chat import _textbook_source, _web_source
from duyo.textbook.retriever import RagRetrieval
from duyo.services.gemini import WebSource


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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd duyo-backend && APP_SECRET_KEY=ci_dummy_secret_at_least_16_chars .venv/bin/python -m pytest tests/api/test_chat_websearch.py -q --no-cov`
Expected: PASS (4 tests).

- [ ] **Step 5: Full backend suite (regression) + lint**

```bash
cd duyo-backend
APP_SECRET_KEY=ci_dummy_secret_at_least_16_chars .venv/bin/python -m pytest tests/ -q --no-cov
.venv/bin/python -m ruff check src/duyo/api/v1/chat.py tests/api/test_chat_websearch.py
```
Expected: all tests PASS, ruff clean.

- [ ] **Step 6: Commit**

```bash
git add duyo-backend/src/duyo/api/v1/chat.py duyo-backend/tests/api/test_chat_websearch.py
git commit -m "feat(chat): textbook citation + web-search offer + RAG-miss web fallback"
```

---

## Task 5: Mobile API types + endpoint

**Files:**
- Modify: `duyo-mobile/src/api/endpoints/chat.ts`

- [ ] **Step 1: Extend request/response types + normalize**

In `chat.ts`, replace the `ChatRequest`, `ChatResponseWire`, `ChatResponse` blocks with:

```typescript
export interface QuickReply {
  label: string;
  action: 'web_search' | 'dismiss';
  query?: string;
}

export interface SourceRef {
  title: string;
  url?: string;
}

export interface ChatSource {
  type: 'textbook' | 'web' | 'none';
  label: string;
  refs: SourceRef[];
}

export interface ChatRequest {
  child_id: string;
  message: string;
  conversation_id?: string;
  action?: 'web_search';
  action_query?: string;
}

interface ChatResponseWire {
  conversation_id: string;
  message_id: string;
  reply: string;
  crisis_level: string;
  model: string;
  latency_ms: number;
  source?: ChatSource | null;
  quick_replies?: QuickReply[];
}

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  reply: string;
  crisis_level: CrisisLevel;
  model: string;
  latency_ms: number;
  source?: ChatSource | null;
  quick_replies: QuickReply[];
}
```

Update `sendChatMessage` return mapping:

```typescript
export async function sendChatMessage(
  request: ChatRequest,
): Promise<ChatResponse> {
  const { data } = await apiClient.post<ChatResponseWire>('/chat', request);
  return {
    ...data,
    crisis_level: normalizeLevel(data.crisis_level),
    source: data.source ?? null,
    quick_replies: data.quick_replies ?? [],
  };
}
```

- [ ] **Step 2: Type-check**

Run: `cd duyo-mobile && npx tsc --noEmit`
Expected: no errors from `chat.ts` (errors may appear in `chat.tsx`/`store` until Tasks 6-7 — those are expected and fixed there).

- [ ] **Step 3: Commit**

```bash
git add duyo-mobile/src/api/endpoints/chat.ts
git commit -m "feat(mobile): chat API types for source + quick_replies + web_search action"
```

---

## Task 6: Mobile chat store — carry source + quickReplies

**Files:**
- Modify: `duyo-mobile/src/store/chat.ts`

- [ ] **Step 1: Extend `ChatMessage`**

In `store/chat.ts` add the import and fields:

```typescript
import { type CrisisLevel } from '@/api/types';
import { type ChatSource, type QuickReply } from '@/api/endpoints/chat';

export interface ChatMessage {
  id: string;
  role: 'child' | 'assistant';
  content: string;
  timestamp: number;
  crisisLevel?: CrisisLevel;
  source?: ChatSource | null;
  quickReplies?: QuickReply[];
}
```

(If `crisisLevel` is not already on the interface, keep the existing fields and only add `source` and `quickReplies`. Match the existing field list — do not remove fields.)

- [ ] **Step 2: Type-check**

Run: `cd duyo-mobile && npx tsc --noEmit`
Expected: no new errors in `store/chat.ts`.

- [ ] **Step 3: Commit**

```bash
git add duyo-mobile/src/store/chat.ts
git commit -m "feat(mobile): ChatMessage carries source + quickReplies"
```

---

## Task 7: Mobile chat UI — source badge + quick-reply chips

**Files:**
- Modify: `duyo-mobile/src/app/(main)/(tabs)/chat.tsx`

- [ ] **Step 1: Store source + quickReplies on the assistant message**

In the `send` mutation `onSuccess`, extend the `appendMessage` call:

```typescript
      appendMessage({
        id: response.message_id,
        role: 'assistant',
        content: response.reply,
        timestamp: Date.now(),
        crisisLevel: response.crisis_level,
        source: response.source ?? null,
        quickReplies: response.quick_replies ?? [],
      });
```

- [ ] **Step 2a: Make the `send` mutation accept a payload object (so it can carry the action)**

The existing `send` mutation's `mutationFn` takes `text: string`. Change it to take an object. Replace ONLY the `mutationFn` (keep `onSuccess` from Step 1 and the existing `onError`):

```typescript
    mutationFn: (vars: { text: string; action?: 'web_search'; actionQuery?: string }) => {
      if (!child) {
        return Promise.reject(new Error('child profile missing'));
      }
      return sendChatMessage({
        child_id: child.id,
        message: vars.text,
        conversation_id: conversationId ?? undefined,
        action: vars.action,
        action_query: vars.actionQuery,
      });
    },
```

- [ ] **Step 2b: Update `handleSend` to the object form**

In `handleSend`, change `send.mutate(text);` to:

```typescript
    send.mutate({ text });
```

- [ ] **Step 2c: Add the quick-reply handler**

Add this function in the component (after `handleSend`):

```typescript
  const handleQuickReply = (messageId: string, reply: QuickReply) => {
    useChatStore.getState().clearQuickReplies(messageId); // one-shot: chips vanish
    if (reply.action === 'dismiss' || !child) return;
    appendMessage({
      id: `local-${Date.now()}`,
      role: 'child',
      content: reply.label, // "Ha"
      timestamp: Date.now(),
    });
    send.mutate({ text: reply.label, action: 'web_search', actionQuery: reply.query });
  };
```

Import `QuickReply` at the top: `import { sendChatMessage, type QuickReply } from '@/api/endpoints/chat';` (merge with the existing `sendChatMessage` import).

- [ ] **Step 3: Add `clearQuickReplies` to the store**

In `store/chat.ts` `ChatState` add:

```typescript
  clearQuickReplies: (messageId: string) => void;
```

And in the store implementation:

```typescript
  clearQuickReplies: (messageId) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, quickReplies: [] } : m,
      ),
    })),
```

- [ ] **Step 4: Render the source badge + chips under the assistant bubble**

In the message renderer (where a `{ kind: 'message' }` item with `role === 'assistant'` is drawn), add below the bubble text:

```tsx
{message.source && message.source.type !== 'none' && (
  <Text style={styles.sourceBadge}>
    {message.source.type === 'textbook' ? '📚 ' : '🌐 '}
    {message.source.type === 'web'
      ? message.source.refs.map((r) => r.title).join(', ') || message.source.label
      : message.source.label}
  </Text>
)}
{!!message.quickReplies?.length && (
  <View style={styles.quickRow}>
    {message.quickReplies.map((qr) => (
      <Pressable key={qr.label} style={styles.quickChip} onPress={() => handleQuickReply(message.id, qr)}>
        <Text style={styles.quickChipText}>{qr.label}</Text>
      </Pressable>
    ))}
  </View>
)}
```

Add styles to the existing `StyleSheet.create({...})`:

```typescript
  sourceBadge: { fontSize: 12, color: '#6b7280', marginTop: 4, marginLeft: 8 },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 6, marginLeft: 8 },
  quickChip: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#e0e7ff' },
  quickChipText: { color: '#3730a3', fontWeight: '600' },
```

Ensure `Pressable`, `View`, `Text` are imported from `react-native` and `QuickReply` from `@/api/endpoints/chat`.

- [ ] **Step 5: Type-check**

Run: `cd duyo-mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add duyo-mobile/src/app/'(main)'/'(tabs)'/chat.tsx duyo-mobile/src/store/chat.ts
git commit -m "feat(mobile): render textbook/web source badge + Ha/Yo'q web-search chips"
```

---

## Task 8: Deploy + device verification

- [ ] **Step 1: Merge backend to main (triggers CI deploy)**

Open a PR for the backend commits (Tasks 1-4) and merge to `main`; the `deploy-backend.yml` workflow rebuilds + redeploys. Confirm the run is green (`gh run watch <id>`).

- [ ] **Step 2: Verify backend flows on the server (no auth needed, in-container)**

```bash
ssh duyo 'docker exec duyo-api python -c "
import asyncio
from duyo.core.database import get_session_factory
from duyo.textbook.retriever import retrieve_for_chat
from duyo.services.gemini import chat_with_web_search
from duyo.models.child import AgeSegment
async def main():
    sf=get_session_factory()
    async with sf() as s:
        rag=await retrieve_for_chat(s,\"sitoplazma nima\")
        print(\"RAG refs:\", rag.refs if rag else None)
    r=await chat_with_web_search(child_message=\"O‘zbekiston poytaxti\", age_segment=AgeSegment.EXPLORER)
    print(\"WEB sources:\", [x.url for x in r.sources][:3])
asyncio.run(main())
"'
```
Expected: RAG refs include `("botanika", 6, ...)`; WEB sources list real URLs.

- [ ] **Step 3: Rebuild + install the mobile APK**

```bash
cd duyo-mobile/android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleRelease
adb -s R5CNC18NT3B install -r app/build/outputs/apk/release/app-release.apk
adb -s R5CNC18NT3B shell am start -n uz.duyo.mobile/.MainActivity
```

- [ ] **Step 4: Manual device test**

On the Samsung, in chat:
1. Ask "Sitoplazma nima" → reply starts with "…-sinf … darsligiga ko'ra…", a 📚 source badge shows, and **Ha / Yo'q** chips appear.
2. Tap **Ha** → a web-grounded follow-up answer appears with a 🌐 sources badge; chips disappear.
3. Ask something not in any textbook (e.g. "Bugun ob-havo qanday") → answer comes directly from the web with a 🌐 badge and no chips.
4. Tap **Yo'q** on a textbook answer → chips disappear, nothing else happens.

---

## Notes / gotchas
- `GeminiReply` is a frozen dataclass; build modified copies with `dataclasses.replace`.
- Web-grounded answers still run through the existing crisis pipeline (unchanged — it executes before the reply block).
- The `/v1/textbook/search` API is untouched (no similarity floor there).
- google-genai grounding metadata lives at `resp.candidates[0].grounding_metadata.grounding_chunks[].web.{uri,title}`; the extractor tolerates any missing attribute.
- Mobile has no test runner — rely on `npx tsc --noEmit` + the manual device test.
