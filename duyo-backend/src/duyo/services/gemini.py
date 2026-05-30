"""Gemini chat service — primary LLM (D-010 revised 2026-05-27).

Uses the official `google-genai` SDK. Picks Flash by default; the caller
can request Pro for heavier tasks. Supports multi-turn context via the
`history` parameter — pass prior child/assistant messages in chronological
order and Gemini will treat the whole conversation as one session.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Literal

from google import genai
from google.genai import types

from duyo.core.config import get_settings
from duyo.models.child import AgeSegment
from duyo.prompts import SYSTEM_PROMPTS

HistoryRole = Literal["user", "model"]


@dataclass(frozen=True)
class GeminiReply:
    text: str
    model: str
    latency_ms: int
    tokens_in: int | None
    tokens_out: int | None


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
