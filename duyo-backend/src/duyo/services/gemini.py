"""Gemini chat service — primary LLM (D-010 revised 2026-05-27).

Uses the official `google-genai` SDK. Picks Flash by default; the caller
can request Pro for heavier tasks. Supports multi-turn context via the
`history` parameter — pass prior child/assistant messages in chronological
order and Gemini will treat the whole conversation as one session.
"""

from __future__ import annotations

import json
import logging
import math
import time
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Literal

from google import genai
from google.genai import types

from duyo.core.config import get_settings
from duyo.models.child import AgeSegment
from duyo.prompts import (
    BOARD_PROMPT,
    GOAL_DECOMPOSE_PROMPT,
    LESSON_HELP_PROMPT,
    SYSTEM_PROMPTS,
)

log = logging.getLogger(__name__)

HistoryRole = Literal["user", "model"]


@dataclass(frozen=True)
class WebSource:
    title: str
    url: str


@dataclass(frozen=True)
class GeminiReply:
    text: str
    model: str
    latency_ms: int
    tokens_in: int | None
    tokens_out: int | None
    sources: tuple[WebSource, ...] = field(default_factory=tuple)


@lru_cache
def get_client() -> genai.Client:
    """The shared Gemini client — with a REQUEST TIMEOUT.

    google-genai defaults to no timeout, so a request the API never answers
    waits forever, and everything awaiting it waits with it. That is not
    hypothetical here: chat turns hung past 60 seconds and nginx logged
    `POST /v1/chat 499 rt:68.4` — the child gave up, the handler was still
    waiting, and because the endpoint logs on completion it left no trace of
    itself in the backend log at all.

    Every caller in this codebase already fails safe on an exception (a crisis
    layer keeps the previous level, a chat turn answers with LLM_UNAVAILABLE),
    so turning a hang into a timeout turns an unbounded wait into a path all
    of them already handle.
    """
    settings = get_settings()
    if not settings.google_api_key:
        raise RuntimeError("GOOGLE_API_KEY is not set")
    return genai.Client(
        api_key=settings.google_api_key,
        http_options=types.HttpOptions(
            timeout=settings.gemini_request_timeout_ms,
        ),
    )


def _build_contents(
    history: list[tuple[HistoryRole, str]] | None,
    child_message: str,
) -> list[types.Content]:
    """Convert (role, text) history + current child message into Gemini Content list.

    Gemini conventions:
      - role 'user'  = child input
      - role 'model' = assistant (DUYO) response
      - first turn must be 'user', and consecutive turns must alternate
    """
    contents: list[types.Content] = []
    if history:
        for role, text in history:
            contents.append(types.Content(role=role, parts=[types.Part(text=text)]))
    contents.append(types.Content(role="user", parts=[types.Part(text=child_message)]))
    return contents


def _assemble_system_instruction(
    age_segment: AgeSegment,
    *,
    personalization_context: str | None = None,
    rag_context: str | None = None,
) -> str:
    """Base age prompt + optional personalization block + optional RAG block.

    Personalization comes first (sets tone/awareness), RAG last (most
    specific, closest to the model's attention on generation).
    """
    parts = [SYSTEM_PROMPTS[age_segment]]
    if personalization_context:
        parts.append(personalization_context)
    if rag_context:
        parts.append(rag_context)
    return "\n\n".join(parts)


async def chat(
    *,
    child_message: str,
    age_segment: AgeSegment,
    history: list[tuple[HistoryRole, str]] | None = None,
    use_pro: bool = False,
    rag_context: str | None = None,
    personalization_context: str | None = None,
) -> GeminiReply:
    """Multi-turn chat. `history` is the prior conversation in chronological order.

    Pass `history=None` (or `[]`) for the first turn of a new conversation.
    """
    settings = get_settings()
    client = get_client()
    model = settings.gemini_model_fallback if use_pro else settings.gemini_model_primary

    thinking_cfg = (
        types.ThinkingConfig(thinking_budget=settings.gemini_thinking_budget_flash)
        if "flash" in model
        else None
    )

    contents = _build_contents(history, child_message)

    system_instruction = _assemble_system_instruction(
        age_segment, personalization_context=personalization_context, rag_context=rag_context,
    )

    start = time.perf_counter()
    resp = await client.aio.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            max_output_tokens=settings.gemini_max_output_tokens,
            temperature=settings.gemini_temperature,
            thinking_config=thinking_cfg,
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
    )


async def chat_with_web_search(
    *,
    child_message: str,
    age_segment: AgeSegment,
    history: list[tuple[HistoryRole, str]] | None = None,
    personalization_context: str | None = None,
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

    base_prompt = SYSTEM_PROMPTS[age_segment]
    if personalization_context:
        base_prompt = f"{base_prompt}\n\n{personalization_context}"

    # Force web grounding: tell the model to search the internet for THIS
    # question and answer from the web (not from prior textbook context in the
    # history — otherwise it copies "...darsligiga ko'ra" citations it shouldn't).
    web_instruction = (
        f"{base_prompt}\n\n"
        "MUHIM: bu savolga javob berish uchun Google Search bilan internetdan "
        "qidir. Savolga ANIQ va to'g'ridan-to'g'ri javob ber — savol aynan "
        "nimani so'rasa, o'shanga qisqa va tushunarli javob qaytar; topilgan "
        "sahifalarni umumlashtirma yoki qayta hikoya qilma, balki ulardan "
        "savolga kerakli aniq ma'lumotni olib o'z so'zing bilan javob ber. "
        "Agar savol yil yoki sana so'rasa (masalan tarixiy voqea), ANIQ "
        "yil/sanani ayt — mavhum yoki taxminiy javob berma. "
        "Bu javob darslikdan EMAS — 'darsligiga ko'ra' kabi iboralarni "
        "ishlatma. Avvalgi suhbatdagi darslik javoblaridan nusxa olma."
    )

    start = time.perf_counter()
    resp = await client.aio.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=web_instruction,
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


#: Hard caps mirroring BOARD_PROMPT. The model is asked for short lines, but a
#: long `expr` would overflow the chalkboard, so truncation is enforced here too.
#: Board lines wrap to two lines on screen, so these are generous enough for a
#: hard multi-step problem while still stopping a runaway model.
_BOARD_EXPR_MAX = 40
_BOARD_NOTE_MAX = 90
_BOARD_MAX_STEPS = 8
#: The problem is the board's headline and may wrap to two lines, so it gets
#: more room than a step. Word problems ("V = 60 km/soat, t = 3 soat...") hit
#: the step cap mid-token and left a dangling "S =" on the board.
_BOARD_PROBLEM_MAX = 64

#: Figure limits. The client scales whatever it is given, so the only job here
#: is to reject nonsense before it reaches a device: unknown shapes, non-finite
#: coordinates, or a payload big enough to stall the render.
_FIG_MAX_ITEMS = 12
_FIG_MAX_POINTS = 80
_FIG_LABEL_MAX = 24
_FIG_TYPES = {"curve", "shape", "circle", "arrow", "label"}
#: Beyond this a coordinate is certainly a model error, not a real diagram.
_FIG_COORD_LIMIT = 1e6


def _clean_points(raw: object) -> list[list[float]]:
    """Coerce a points array to finite [x, y] pairs, dropping anything else."""
    if not isinstance(raw, list):
        return []
    out: list[list[float]] = []
    for pair in raw[:_FIG_MAX_POINTS]:
        if not isinstance(pair, list | tuple) or len(pair) != 2:
            continue
        try:
            x, y = float(pair[0]), float(pair[1])
        except (TypeError, ValueError):
            continue
        if not (math.isfinite(x) and math.isfinite(y)):
            continue
        if abs(x) > _FIG_COORD_LIMIT or abs(y) > _FIG_COORD_LIMIT:
            continue
        out.append([x, y])
    return out


def _clean_figure(raw: object) -> dict | None:
    """Validate the optional diagram. Returns None on anything malformed — the
    board still renders, just without a picture."""
    if not isinstance(raw, dict):
        return None

    items: list[dict] = []
    for item in (raw.get("items") or [])[:_FIG_MAX_ITEMS]:
        if not isinstance(item, dict):
            continue
        kind = str(item.get("type", "")).strip()
        if kind not in _FIG_TYPES:
            continue
        label = str(item.get("label", "")).strip()[:_FIG_LABEL_MAX]

        if kind == "circle":
            try:
                cx, cy, r = (
                    float(item.get("cx", 0)),
                    float(item.get("cy", 0)),
                    float(item.get("r", 0)),
                )
            except (TypeError, ValueError):
                continue
            if not all(map(math.isfinite, (cx, cy, r))) or r <= 0:
                continue
            items.append({"type": kind, "cx": cx, "cy": cy, "r": r, "label": label,
                          "points": []})
            continue

        points = _clean_points(item.get("points"))
        # A curve needs a segment, an arrow needs exactly a start and an end,
        # a label needs somewhere to sit.
        if kind == "arrow" and len(points) != 2:
            continue
        if kind == "label" and len(points) != 1:
            continue
        if kind in {"curve", "shape"} and len(points) < 2:
            continue
        items.append({"type": kind, "points": points, "label": label,
                      "cx": None, "cy": None, "r": None})

    if not items:
        return None
    return {
        "caption": str(raw.get("caption", "")).strip()[:60],
        "axes": bool(raw.get("axes")),
        "items": items,
    }

#: Returned whenever the utterance is not a solvable problem, or on any error —
#: the board simply stays hidden, the conversation is never interrupted.
_NO_BOARD: dict = {
    "is_problem": False,
    "title": "",
    "problem": "",
    "steps": [],
    "answer": "",
    "figure": None,
}


async def solve_on_board(*, question: str, age_segment: AgeSegment) -> dict:
    """Decide whether `question` is a solvable problem and, if so, lay it out
    for the chalkboard.

    Returns {"is_problem", "title", "problem", "steps": [{"expr","note"}],
    "answer"}. Fails closed: any error (or a non-problem utterance) yields
    is_problem=False so the caller just doesn't show a board.
    """
    if not question.strip():
        return dict(_NO_BOARD)

    settings = get_settings()
    client = get_client()
    try:
        resp = await client.aio.models.generate_content(
            model=settings.gemini_model_primary,
            contents=f"Bola aytdi: {question}",
            config=types.GenerateContentConfig(
                system_instruction=f"{SYSTEM_PROMPTS[age_segment]}\n\n{BOARD_PROMPT}",
                max_output_tokens=800,
                temperature=0.2,  # deterministic — arithmetic must not wander
                thinking_config=types.ThinkingConfig(
                    thinking_budget=settings.gemini_thinking_budget_flash
                ),
                response_mime_type="application/json",
            ),
        )
        data = json.loads((resp.text or "").strip())
        if not data.get("is_problem"):
            return dict(_NO_BOARD)

        steps: list[dict[str, str]] = []
        for s in data.get("steps") or []:
            expr = str(s.get("expr", "")).strip()[:_BOARD_EXPR_MAX]
            if not expr:
                continue
            # Chemistry answers in particular came back with the balanced
            # equation repeated verbatim; the same line twice reads as a bug.
            if steps and steps[-1]["expr"] == expr:
                continue
            steps.append(
                {"expr": expr, "note": str(s.get("note", "")).strip()[:_BOARD_NOTE_MAX]}
            )
            if len(steps) == _BOARD_MAX_STEPS:
                break

        problem = str(data.get("problem", "")).strip()[:_BOARD_PROBLEM_MAX]
        # A board with nothing written on it is worse than no board at all.
        if not steps or not problem:
            return dict(_NO_BOARD)

        return {
            "is_problem": True,
            "title": str(data.get("title", "")).strip()[:40],
            "problem": problem,
            "steps": steps,
            "answer": str(data.get("answer", "")).strip()[:_BOARD_EXPR_MAX],
            "figure": _clean_figure(data.get("figure")),
        }
    except Exception:  # never interrupt the conversation over a board
        return dict(_NO_BOARD)


async def solve_lesson(
    *,
    question: str,
    subject: str,
    age_segment: AgeSegment,
) -> dict:
    """Step-by-step tutor answer for a homework question (lesson-help).

    Returns {"steps": [{"title","detail"}], "answer": str, "available": bool}.

    Fails safe, and says so: `available` is False when this is the outage
    text rather than a real solution, so the screen can render it as a calm
    notice instead of dressing an apology up as "DUYO yechimi".

    EVERYTHING that can raise lives inside the try — `get_client()` included.
    It was above it, and with no GOOGLE_API_KEY configured it raises
    RuntimeError before the try is ever entered: POST /v1/chat/lesson-help
    answered a child with a raw Python traceback and HTTP 500. The main chat
    path (api/v1/chat.py, LLM_UNAVAILABLE) has always degraded gracefully
    here; this now matches it.
    """
    settings = get_settings()
    payload = (
        f"Fan: {subject}\nSavol: {question}\n\n"
        "Yuqoridagi qoidalar bo'yicha bosqichma-bosqich yech va JSON qaytar."
    )
    try:
        client = get_client()
        model = settings.gemini_model_primary
        resp = await client.aio.models.generate_content(
            model=model,
            contents=payload,
            config=types.GenerateContentConfig(
                system_instruction=f"{SYSTEM_PROMPTS[age_segment]}\n\n{LESSON_HELP_PROMPT}",
                max_output_tokens=900,
                temperature=0.3,
                thinking_config=types.ThinkingConfig(
                    thinking_budget=settings.gemini_thinking_budget_flash
                ),
                response_mime_type="application/json",
            ),
        )
        data = json.loads((resp.text or "").strip())
        steps = [
            {"title": str(s.get("title", ""))[:80], "detail": str(s.get("detail", ""))[:600]}
            for s in (data.get("steps") or [])
            if s.get("detail")
        ][:6]
        answer = str(data.get("answer", ""))[:400]
        if not steps:
            raise ValueError("no steps")
        return {"steps": steps, "answer": answer, "available": True}
    except Exception:  # never break the lesson screen
        # Logged, because a permanently-down key looks identical to a lucky
        # child seeing the notice once — and the endpoint itself now answers
        # 200, so nothing else records the outage.
        log.exception("solve_lesson_failed subject=%s", subject)
        return {
            # Honest, not evasive: the old text ("savolni aniqroq yozib
            # yuborsang") blamed the CHILD for a server-side outage, so they
            # would rewrite a perfectly good question and fail again.
            "steps": [{
                "title": "Hozir yordam berolmayman",
                "detail": (
                    "Kechir, hozir yechimni tayyorlay olmayapman — biroz muammo bor. "
                    "Bir necha daqiqadan keyin yana urinib ko'r, men shu yerdaman."
                ),
            }],
            "answer": "",
            "available": False,
        }


async def decompose_goal(
    *,
    goal_title: str,
    age_segment: AgeSegment,
) -> list[dict[str, str]]:
    """Break a child's goal into an ordered path of 3-6 concrete steps.

    Returns [{"title","detail"}, ...] — the steps that will become linked
    notes in the child's brain map. Unlike solve_lesson this fails to an EMPTY
    list, never a placeholder: a goal-path is written straight into the
    child's private graph, so "nothing" is the correct output on any doubt or
    error — a filler node the child never asked for is worse than no node.
    """
    if len(goal_title.strip()) < 3:
        return []
    settings = get_settings()
    client = get_client()
    try:
        resp = await client.aio.models.generate_content(
            model=settings.gemini_model_primary,
            contents=f"Bolaning maqsadi: {goal_title}",
            config=types.GenerateContentConfig(
                system_instruction=f"{SYSTEM_PROMPTS[age_segment]}\n\n{GOAL_DECOMPOSE_PROMPT}",
                max_output_tokens=700,
                temperature=0.4,  # a little room to phrase steps naturally
                thinking_config=types.ThinkingConfig(
                    thinking_budget=settings.gemini_thinking_budget_flash
                ),
                response_mime_type="application/json",
            ),
        )
        data = json.loads((resp.text or "").strip())
        steps = [
            {"title": " ".join(str(s.get("title", "")).split())[:35],
             "detail": str(s.get("detail", "")).strip()[:400]}
            for s in (data.get("steps") or [])
            if str(s.get("title", "")).strip() and str(s.get("detail", "")).strip()
        ][:6]
        return steps
    except Exception:
        # Fail to nothing — see the docstring. A goal simply stays un-mapped.
        return []