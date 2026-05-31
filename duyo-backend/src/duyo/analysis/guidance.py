"""Parent guidance — actionable advice derived from the report (Concept §5).

Hybrid source (current → future):
  - NOW: Gemini's own pedagogy knowledge, conditioned on the AGGREGATE report
    sections (mood/topics/activity/safety) and the child's age.
  - LATER: a pedagogical-content RAG layer can be injected via `rag_context`
    without changing the call site — the hook is already here.

Privacy: input is the aggregate report only (no raw child messages), so the
§11.3 contract is preserved upstream. Fails SAFE → empty guidance, never raises.
"""

from __future__ import annotations

import json
import logging

from google.genai import types

from duyo.core.config import get_settings
from duyo.prompts import PARENT_GUIDANCE_PROMPT
from duyo.services.gemini import get_client

log = logging.getLogger(__name__)

_EMPTY_GUIDANCE = {"tips": [], "focus": ""}


def _build_payload(age: int, sections: dict, rag_context: str | None) -> str:
    """Render the aggregate report into a compact prompt payload.

    Only aggregates are included — never raw message text.
    """
    mood = sections.get("mood", {})
    activity = sections.get("activity", {})
    safety = sections.get("safety", {})
    lines = [
        f"Bola yoshi: {age}",
        f"Kayfiyat yo'nalishi: {mood.get('mood_trend', 'noma\\'lum')}",
        f"Kayfiyat xulosasi: {mood.get('mood_summary', '')}",
        f"Mavzular: {', '.join(mood.get('topics', [])) or 'yo\\'q'}",
        f"Stress signali: {mood.get('stress_signals', '') or 'yo\\'q'}",
        f"Faol kunlar: {activity.get('active_days', 0)}/{activity.get('window_days', 10)}",
        f"Xabarlar soni: {activity.get('total_messages', 0)}",
        f"Tashvishli signallar soni: {safety.get('concerning_count', 0)}",
    ]
    payload = "\n".join(lines)
    if rag_context:
        payload += f"\n\n[PEDAGOGIK MANBA]\n{rag_context}\n[/PEDAGOGIK MANBA]"
    payload += "\n\nYuqoridagi hisobotga asoslanib, maslahatlarni JSON formatda ber."
    return payload


async def build_guidance(
    age: int, sections: dict, *, rag_context: str | None = None
) -> dict:
    """Generate parent guidance from the aggregate report. Never raises.

    Returns {"tips": [...], "focus": "..."}. Empty on any failure or when the
    window has too little activity to advise on.
    """
    activity = sections.get("activity", {})
    if int(activity.get("total_messages", 0)) < 3:
        return _EMPTY_GUIDANCE

    settings = get_settings()
    try:
        client = get_client()
        resp = await client.aio.models.generate_content(
            model=settings.gemini_model_primary,
            contents=_build_payload(age, sections, rag_context),
            config=types.GenerateContentConfig(
                system_instruction=PARENT_GUIDANCE_PROMPT,
                max_output_tokens=500,
                temperature=0.5,
                thinking_config=types.ThinkingConfig(
                    thinking_budget=settings.gemini_thinking_budget_flash
                ),
                response_mime_type="application/json",
            ),
        )
        data = json.loads((resp.text or "").strip())
        return {
            "tips": [str(t)[:300] for t in (data.get("tips") or [])][:4],
            "focus": str(data.get("focus", ""))[:200],
        }
    except Exception:
        log.exception("Parent guidance generation failed; returning empty")
        return _EMPTY_GUIDANCE
