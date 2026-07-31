"""Gemini chat service — primary LLM (D-010 revised 2026-05-27).

Uses the official `google-genai` SDK. Picks Flash by default; the caller
can request Pro for heavier tasks. Supports multi-turn context via the
`history` parameter — pass prior child/assistant messages in chronological
order and Gemini will treat the whole conversation as one session.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Literal

from google import genai
from google.genai import types

from duyo.core.config import get_settings
from duyo.models.child import AgeSegment
from duyo.prompts import BOARD_PROMPT, LESSON_HELP_PROMPT, SYSTEM_PROMPTS

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


#: Hard caps mirroring BOARD_PROMPT. The model is asked for short lines, but a
#: long `expr` would overflow the chalkboard, so truncation is enforced here too.
_BOARD_EXPR_MAX = 32
_BOARD_NOTE_MAX = 60
_BOARD_MAX_STEPS = 5
#: The problem is the board's headline and may wrap to two lines, so it gets
#: more room than a step. Word problems ("V = 60 km/soat, t = 3 soat...") hit
#: the step cap mid-token and left a dangling "S =" on the board.
_BOARD_PROBLEM_MAX = 48

#: Returned whenever the utterance is not a solvable problem, or on any error —
#: the board simply stays hidden, the conversation is never interrupted.
_NO_BOARD: dict = {
    "is_problem": False,
    "title": "",
    "problem": "",
    "steps": [],
    "answer": "",
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

        steps = [
            {
                "expr": str(s.get("expr", "")).strip()[:_BOARD_EXPR_MAX],
                "note": str(s.get("note", "")).strip()[:_BOARD_NOTE_MAX],
            }
            for s in (data.get("steps") or [])
            if str(s.get("expr", "")).strip()
        ][:_BOARD_MAX_STEPS]

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

    Returns {"steps": [{"title","detail"}], "answer": str}. Fails safe: on any
    error returns a single gentle step so the screen always renders something.
    """
    settings = get_settings()
    client = get_client()
    model = settings.gemini_model_primary
    payload = (
        f"Fan: {subject}\nSavol: {question}\n\n"
        "Yuqoridagi qoidalar bo'yicha bosqichma-bosqich yech va JSON qaytar."
    )
    try:
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
        return {"steps": steps, "answer": answer}
    except Exception:  # never break the lesson screen
        return {
            "steps": [{
                "title": "Qayta urinib ko'r",
                "detail": "Savolni biroz aniqroq yozib yuborsang, qadam-baqadam tushuntiraman.",
            }],
            "answer": "",
        }


async def translate_text(*, text: str, target_lang: str) -> str:
    """Translate `text` into target_lang (uz/ru/en). Returns original on error."""
    if not text.strip():
        return text
    names = {"uz": "o'zbek", "ru": "rus", "en": "ingliz"}
    lang_name = names.get(target_lang, "o'zbek")
    settings = get_settings()
    client = get_client()
    try:
        resp = await client.aio.models.generate_content(
            model=settings.gemini_model_primary,
            contents=f"Quyidagi matnni {lang_name} tiliga tarjima qil. FAQAT tarjimani qaytar:\n\n{text}",
            config=types.GenerateContentConfig(
                max_output_tokens=600,
                temperature=0.2,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        return (resp.text or "").strip() or text
    except Exception:  # never break the UI
        return text


async def suggest_hint(*, context: str, age_segment: AgeSegment) -> str:
    """Suggest a short thing the child could say/ask next. Empty on error."""
    settings = get_settings()
    client = get_client()
    ctx = f"\nOxirgi gap: {context}" if context.strip() else ""
    try:
        resp = await client.aio.models.generate_content(
            model=settings.gemini_model_primary,
            contents=(
                "Bola DUYO bilan suhbatlashyapti va nima deyishni bilmayapti."
                f"{ctx}\n\nUnga BITTA qisqa, sodda taklif ber — u shuni aytishi/"
                "so'rashi mumkin. FAQAT taklif jumlasini qaytar (tirnoqsiz)."
            ),
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPTS[age_segment],
                max_output_tokens=80,
                temperature=0.7,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        return (resp.text or "").strip()[:160]
    except Exception:
        return ""
