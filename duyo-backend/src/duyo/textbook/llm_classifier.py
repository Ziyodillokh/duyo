"""Gemini Flash metadata classifier for textbook chunks.

Uses few-shot prompting (3 examples) rather than a long rule list.
Returns a validated ChunkMetadata; raises ValueError on JSON parse failure.

Batch usage: for offline ingestion call classify_batch() to amortize
client initialization cost. Real-time RAG retrieval does not use this module.
"""

from __future__ import annotations

import json
import re
from typing import Any

from google import genai
from google.genai import types

from duyo.core.config import get_settings
from duyo.textbook.schema import (
    ChunkMetadata,
    Confidence,
    ContentType,
    Difficulty,
    DocumentMeta,
    Language,
    Script,
)
from duyo.textbook.taxonomy import find_topic_id

# ---------------------------------------------------------------------------
# Few-shot examples — shown to the model before the chunk to classify
# ---------------------------------------------------------------------------

_FEW_SHOT: list[dict[str, str]] = [
    {
        "chunk": "Ta'rif: Kasrning surati va maxraji deyiladi. Masalan, 3/4 kasr – suratlari 3, maxraji 4.",
        "output": json.dumps({
            "chapter": "Oddiy kasrlar",
            "topic": "Kasrga kirish",
            "subtopic": "Surat va maxraj",
            "content_type": "definition",
            "difficulty": "easy",
            "has_formula": True,
            "has_table": False,
            "has_image": False,
            "confidence": {"content_type": 0.97, "topic": 0.80, "difficulty": 0.85},
        }, ensure_ascii=False),
    },
    {
        "chunk": "Mashq 14. Quyidagi kasrlarni qo'shing:\na) 1/4 + 2/4\nb) 3/7 + 2/7\nv) 5/9 + 1/9",
        "output": json.dumps({
            "chapter": "Bir xil maxrajli kasrlar",
            "topic": "Bir xil maxrajli kasrlarni qo'shish",
            "subtopic": None,
            "content_type": "exercise",
            "difficulty": "easy",
            "has_formula": True,
            "has_table": False,
            "has_image": False,
            "confidence": {"content_type": 0.98, "topic": 0.88, "difficulty": 0.82},
        }, ensure_ascii=False),
    },
    {
        "chunk": (
            "1-misol. 3/8 + 5/8 ni hisoblang.\n"
            "Yechish: Suratlari qo'shiladi, maxraj o'zgarmaydi.\n"
            "3/8 + 5/8 = (3+5)/8 = 8/8 = 1.\n"
            "Javob: 1."
        ),
        "output": json.dumps({
            "chapter": "Bir xil maxrajli kasrlar",
            "topic": "Bir xil maxrajli kasrlarni qo'shish",
            "subtopic": "Qo'shish qoidasi",
            "content_type": "worked_solution",
            "difficulty": "easy",
            "has_formula": True,
            "has_table": False,
            "has_image": False,
            "confidence": {"content_type": 0.96, "topic": 0.90, "difficulty": 0.88},
        }, ensure_ascii=False),
    },
]

_SYSTEM_PROMPT = """\
Siz DUYO ta'lim platformasi uchun darslik matnlarini tahlil qiluvchi metadata\
 classifier'sisiz. DUYO 7-16 yoshli bolalar uchun AI tutor.

Sizga darslikdan olingan matn parchasi va hujjat metadata'si beriladi.
Faqat JSON qaytaring. Izoh yoki tushuntirish yozmang.

Ruxsat etilgan content_type qiymatlari:
  definition, rule, explanation, example, worked_solution, exercise, quiz

Ruxsat etilgan difficulty qiymatlari:
  easy, medium, hard, unknown

Qoidalar:
1. Matn "Ta'rif:" yoki "deb ataladi" bilan boshlansa → definition.
2. Matn "Qoida:" yoki "teorema" bilan boshlansa → rule.
3. Matn tushuntirish yoki nazariya bo'lsa → explanation.
4. Matn "Masalan:" bilan boshlanib, yechim ketma-ketligisiz bo'lsa → example.
5. Matn "Yechish:" va bosqichli yechim bo'lsa → worked_solution.
6. Matn "Hisoblang", "Toping", "Mashq" kabi topshiriq bo'lsa → exercise.
7. Matn A/B/C/D variantli savol bo'lsa → quiz.
8. topic maydoni: eng yaqin mavzu nomini yozing. Agar noma'lum bo'lsa null.
9. confidence: o'z ishonchingizni 0.0–1.0 oralig'ida bering.\
"""

_SCHEMA = {
    "chapter": "string|null",
    "topic": "string|null",
    "subtopic": "string|null",
    "content_type": "definition|rule|explanation|example|worked_solution|exercise|quiz",
    "difficulty": "easy|medium|hard|unknown",
    "has_formula": "bool",
    "has_table": "bool",
    "has_image": "bool",
    "confidence": {
        "content_type": "float 0-1",
        "topic": "float 0-1",
        "difficulty": "float 0-1",
    },
}


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

def _build_prompt(chunk: str, doc_meta: DocumentMeta, rule_hint: str | None) -> str:
    lines: list[str] = []

    lines.append(f"Hujjat metadata:\n"
                 f"  fan={doc_meta.subject}, sinf={doc_meta.grade}, "
                 f"til={doc_meta.language}, yozuv={doc_meta.script}")

    if rule_hint:
        lines.append(f"Rule-based hint (past confidence): {rule_hint}")

    # Few-shot
    lines.append("\n--- Misollar ---")
    for ex in _FEW_SHOT:
        lines.append(f"\nMatn:\n{ex['chunk']}\nJSON:\n{ex['output']}")

    lines.append(f"\n--- Siz tahlil qiling ---")
    lines.append(f"Matn:\n{chunk}")
    lines.append(f"\nJSON sxemasi:\n{json.dumps(_SCHEMA, ensure_ascii=False)}")
    lines.append("\nJSON:")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# JSON extraction + validation
# ---------------------------------------------------------------------------

_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


def _extract_json(raw: str) -> dict[str, Any]:
    """Extract first JSON object from a possibly messy LLM response."""
    match = _JSON_RE.search(raw)
    if not match:
        raise ValueError(f"No JSON object found in LLM response: {raw[:200]!r}")
    return json.loads(match.group())


def _parse_response(data: dict[str, Any], doc_meta: DocumentMeta) -> ChunkMetadata:
    """Validate and convert raw dict → ChunkMetadata."""
    raw_topic: str | None = data.get("topic")
    topic_id, topic_conf = find_topic_id(raw_topic or "")

    raw_ct = data.get("content_type", "explanation")
    try:
        content_type = ContentType(raw_ct)
    except ValueError:
        content_type = ContentType.EXPLANATION

    raw_diff = data.get("difficulty", "unknown")
    try:
        difficulty = Difficulty(raw_diff)
    except ValueError:
        difficulty = Difficulty.UNKNOWN

    raw_conf = data.get("confidence", {})
    conf_ct = float(raw_conf.get("content_type", 0.5))
    # If taxonomy matched with higher confidence, use that
    conf_topic = max(float(raw_conf.get("topic", 0.5)), topic_conf)
    conf_diff = float(raw_conf.get("difficulty", 0.5))

    return ChunkMetadata(
        subject=doc_meta.subject,
        grade=doc_meta.grade,
        language=doc_meta.language,
        script=doc_meta.script,
        source_path=doc_meta.source_path,
        chapter=data.get("chapter"),
        topic=raw_topic,
        topic_id=topic_id,
        subtopic=data.get("subtopic"),
        content_type=content_type,
        difficulty=difficulty,
        has_formula=bool(data.get("has_formula", False)),
        has_table=bool(data.get("has_table", False)),
        has_image=bool(data.get("has_image", False)),
        confidence=Confidence(
            content_type=min(conf_ct, 1.0),
            topic=min(conf_topic, 1.0),
            difficulty=min(conf_diff, 1.0),
        ),
        classified_by="llm",
        needs_review=conf_ct < 0.70,
    )


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

async def classify(
    chunk: str,
    doc_meta: DocumentMeta,
    *,
    client: genai.Client | None = None,
    rule_hint: str | None = None,
) -> ChunkMetadata:
    """Classify a single chunk via Gemini Flash.

    Args:
        chunk: Raw text of the chunk.
        doc_meta: Document-level metadata (subject, grade, language, script).
        client: Optional pre-built genai.Client (reuse across calls).
        rule_hint: Optional content_type hint from the rule classifier.

    Returns:
        ChunkMetadata with classified fields.

    Raises:
        ValueError: If the LLM returns unparseable JSON.
        RuntimeError: If GOOGLE_API_KEY is not configured.
    """
    settings = get_settings()
    if client is None:
        if not settings.google_api_key:
            raise RuntimeError("GOOGLE_API_KEY is not set")
        client = genai.Client(api_key=settings.google_api_key)

    prompt = _build_prompt(chunk, doc_meta, rule_hint)

    resp = await client.aio.models.generate_content(
        model=settings.gemini_model_primary,
        contents=[types.Content(role="user", parts=[types.Part(text=prompt)])],
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM_PROMPT,
            max_output_tokens=512,
            temperature=0.1,  # low temp for deterministic metadata extraction
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        ),
    )

    raw = resp.text or ""
    data = _extract_json(raw)
    return _parse_response(data, doc_meta)


async def classify_batch(
    chunks: list[str],
    doc_meta: DocumentMeta,
    *,
    rule_hints: list[str | None] | None = None,
) -> list[ChunkMetadata]:
    """Classify multiple chunks, sharing a single Gemini client.

    Processes sequentially to avoid rate limits. For large batches (1000+),
    consider using Gemini Batch API when available.
    """
    settings = get_settings()
    if not settings.google_api_key:
        raise RuntimeError("GOOGLE_API_KEY is not set")
    client = genai.Client(api_key=settings.google_api_key)

    hints = rule_hints or [None] * len(chunks)
    results: list[ChunkMetadata] = []

    for chunk, hint in zip(chunks, hints, strict=True):
        meta = await classify(chunk, doc_meta, client=client, rule_hint=hint)
        results.append(meta)

    return results
