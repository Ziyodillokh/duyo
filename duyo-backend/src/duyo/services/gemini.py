"""Gemini chat service — primary LLM (D-010 revised 2026-05-27).

Uses the official `google-genai` SDK. Picks Flash by default; the caller
can request Pro for heavier tasks. Supports multi-turn context via the
`history` parameter — pass prior child/assistant messages in chronological
order and Gemini will treat the whole conversation as one session.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Literal

from google import genai
from google.genai import types

from duyo.core.config import get_settings
from duyo.models.child import AgeSegment
from duyo.prompts import SYSTEM_PROMPTS

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
    settings = get_settings()
    if not settings.google_api_key:
        raise RuntimeError("GOOGLE_API_KEY is not set")
    return genai.Client(api_key=settings.google_api_key)


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


async def chat(
    *,
    child_message: str,
    age_segment: AgeSegment,
    history: list[tuple[HistoryRole, str]] | None = None,
    use_pro: bool = False,
    rag_context: str | None = None,
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

    base_prompt = SYSTEM_PROMPTS[age_segment]
    system_instruction = (
        f"{base_prompt}\n\n{rag_context}" if rag_context else base_prompt
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

    # Force web grounding: tell the model to search the internet for THIS
    # question and answer from the web (not from prior textbook context in the
    # history — otherwise it copies "...darsligiga ko'ra" citations it shouldn't).
    web_instruction = (
        f"{SYSTEM_PROMPTS[age_segment]}\n\n"
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
