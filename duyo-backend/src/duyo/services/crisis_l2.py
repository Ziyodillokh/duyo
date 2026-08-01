"""Crisis Detection Layer 2 — Gemini Flash classifier (context-aware).

Runs AFTER Layer 1 (keyword) on the child message. Layer 1 catches direct
keyword hits; Layer 2 catches subtle / coded / metaphorical risk that
keywords miss. Defaults to a conservative "if in doubt, escalate" stance
because false negatives are far costlier than false positives here.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass

from google.genai import types

from duyo.core.config import get_settings
from duyo.models.crisis_event import CrisisLevel
from duyo.prompts import CRISIS_LAYER2_PROMPT
from duyo.services.gemini import get_client

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Layer2Result:
    level: CrisisLevel
    confidence: float
    reasoning: str
    latency_ms: int


async def classify(child_message: str, layer1_level: CrisisLevel) -> Layer2Result:
    """Classify `child_message` for crisis risk via Gemini Flash.

    `layer1_level` is passed for context — Layer 2 can choose to escalate
    above it but should never silently downgrade unless very confident.
    """
    settings = get_settings()

    user_payload = (
        f"Bola xabari: {child_message!r}\n"
        f"Layer 1 keyword detector natijasi: {layer1_level.value}\n\n"
        "Bu xabarni baholang va JSON formatda javob bering."
    )

    start = time.perf_counter()
    try:
        # Inside the try on purpose: get_client() raises when GOOGLE_API_KEY is
        # missing or the SDK rejects it. Constructed above, that raise escaped
        # this handler and 500'd the whole chat turn — defeating the fail-safe
        # this function documents. Every other Gemini caller (dtm, language,
        # reports, guidance) already builds the client inside its try.
        client = get_client()
        resp = await client.aio.models.generate_content(
            model=settings.gemini_model_primary,
            contents=user_payload,
            config=types.GenerateContentConfig(
                system_instruction=CRISIS_LAYER2_PROMPT,
                max_output_tokens=400,
                temperature=0.2,  # deterministic for safety classifier
                thinking_config=types.ThinkingConfig(
                    thinking_budget=settings.gemini_thinking_budget_flash
                ),
                response_mime_type="application/json",
            ),
        )
    except Exception as exc:
        # On any LLM error, fail SAFE — preserve Layer 1 result, never downgrade.
        log.exception("Crisis Layer 2 failed; falling back to Layer 1 level")
        return Layer2Result(
            level=layer1_level,
            confidence=0.0,
            reasoning=f"layer2_error: {exc}",
            latency_ms=int((time.perf_counter() - start) * 1000),
        )

    latency_ms = int((time.perf_counter() - start) * 1000)
    raw = (resp.text or "").strip()

    try:
        data = json.loads(raw)
        level = CrisisLevel(data.get("level", layer1_level.value))
        confidence = float(data.get("confidence", 0.0))
        reasoning = str(data.get("reasoning", ""))[:500]
    except (ValueError, json.JSONDecodeError) as exc:
        log.warning("Layer 2 returned non-JSON: %r; raw=%r", exc, raw[:200])
        return Layer2Result(
            level=layer1_level,
            confidence=0.0,
            reasoning=f"layer2_parse_error: {exc}",
            latency_ms=latency_ms,
        )

    # Safety policy: never silently downgrade below Layer 1.
    if _level_rank(level) < _level_rank(layer1_level):
        log.info(
            "Layer 2 would downgrade %s → %s; keeping Layer 1 level",
            layer1_level.value, level.value,
        )
        level = layer1_level

    return Layer2Result(level=level, confidence=confidence, reasoning=reasoning, latency_ms=latency_ms)


_RANK = {CrisisLevel.GREEN: 0, CrisisLevel.YELLOW: 1, CrisisLevel.ORANGE: 2, CrisisLevel.RED: 3}


def _level_rank(level: CrisisLevel) -> int:
    return _RANK[level]
