"""Validate Google Gemini quality in Uzbek across age segments.

Mirrors `validate_claude_uzbek.py` exactly — same 16 scenarios, same system
prompts. Runs against Gemini 2.5 Pro AND Gemini 2.5 Flash so we can compare
quality vs price tier in one shot. Lets us judge whether Google replaces
Anthropic for DUYO's LLM layer (D-010 reconsideration).

Usage:
    # Get API key at https://aistudio.google.com/app/apikey
    # Add to .env:  GOOGLE_API_KEY=...
    set -a; source .env; set +a
    .venv/bin/python scripts/validate_gemini_uzbek.py
"""

from __future__ import annotations

import json
import os
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

try:
    from google import genai
    from google.genai import types
except ImportError:
    sys.exit("Install google-genai first: pip install google-genai")


AgeSegment = Literal["junior", "explorer", "companion"]


@dataclass(frozen=True)
class Scenario:
    id: str
    age_segment: AgeSegment
    child_message: str
    notes: str


STORYTELLING_RULE = (
    "Agar bola ertak, hikoya, she'r yoki qo'shiq so'rasa — uni BOSHIDAN "
    "OXIRIGACHA, bir javobda to'liq ayt. Bo'laklarga bo'lma, "
    "\"davom etaymi?\" deb so'rama, oldin aniqlashtiruvchi savol berma. "
    "Bola mavzu aytmagan bo'lsa, o'zing mos mavzu tanlab ayt. "
    "Qisqa gaplar qoidasi gapning uzunligiga tegishli — hikoyaning "
    "to'liqligiga emas."
)

_AGE_PROMPTS: dict[AgeSegment, str] = {
    "junior": (
        "Sen DUYO — 7-10 yoshli bola uchun do'st AI virtual yordamchisan. "
        "Oddiy va qisqa gaplarda gapirasan (5-10 so'z). "
        "O'zbek tilida javob ber. Yumshoq, do'stona ohang. "
        "Hech qachon bosim qilma. Salom-alik bilan boshla."
    ),
    "explorer": (
        "Sen DUYO — 11-13 yoshli bola uchun AI do'stsan. "
        "Maktab darslari, hobbi, do'stlar haqida suhbatlasha olasan. "
        "O'zbek tilida javob ber. Qiziqarli savollar ber. "
        "Yumshoq hazil ishlatish mumkin."
    ),
    "companion": (
        "Sen DUYO — 14-16 yoshli o'smir uchun AI yordamchisan. "
        "Jiddiy mavzular, kasb tanlash, DTM tayyorgarlik bo'yicha gapirasan. "
        "O'zbek tilida javob ber. Bola sifatida emas, kattalardek munosabatda bo'l. "
        "Avval bola so'raganini bajar, refleksiv savolni keyin ber."
    ),
}

SYSTEM_PROMPTS: dict[AgeSegment, str] = {
    segment: f"{prompt}\n\n{STORYTELLING_RULE}"
    for segment, prompt in _AGE_PROMPTS.items()
}


SCENARIOS: list[Scenario] = [
    Scenario("J01", "junior", "Salom DUYO!", "salomlashish, oddiy"),
    Scenario("J02", "junior", "Bugun maktabda 5 oldim!", "xursandlikni qo'llab-quvvatlash"),
    Scenario("J03", "junior", "Charchadim", "emotsiya tushunish"),
    Scenario("J04", "junior", "Ertak aytib ber", "kreativ vazifa"),
    Scenario("J05", "junior", "2+3 nechi?", "oddiy matematika"),
    Scenario("J06", "junior", "Tinchi oyim bilan urishdim", "emotsiya, oddiy maslahat"),
    Scenario("E01", "explorer", "Matematikadan kontrolnaya bor, qo'rqyapman", "stress + maktab"),
    Scenario("E02", "explorer", "Pythagor teoremasini tushuntir", "akademik yordam"),
    Scenario("E03", "explorer", "Do'stim meni ranjitdi", "ijtimoiy munosabat"),
    Scenario(
        "E04", "explorer",
        "Code switching test: bugun school'da test bo'ldi, but I failed",
        "code-switching uz/en",
    ),
    Scenario("E05", "explorer", "Sport bilan shug'ullansam yaxshi bo'larmidi?", "sog'liq, motivatsiya"),
    Scenario("C01", "companion", "DTM'ga matematika qanday tayyorlanish kerak?", "akademik strategiya"),
    Scenario("C02", "companion", "Kasb tanlashda qanday yondashish kerak?", "kelajak, refleksiya"),
    Scenario("C03", "companion", "Ota-onam meni tushunmaydi", "emotsional, jiddiy"),
    Scenario("C04", "companion", "IELTS speaking'da nima haqida gapirsam yaxshi?", "ingliz tili tayyorgarlik"),
    Scenario(
        "C05", "companion",
        "Kelajak haqida o'ylasam tashvishlanaman",
        "anxiety — Layer 1 GREEN, baholaymiz",
    ),
]


MODELS = ["gemini-2.5-pro", "gemini-2.5-flash"]


def run_scenario(client: genai.Client, model: str, scenario: Scenario) -> dict:
    """Run a single scenario against a single model and return Claude-shaped result."""
    print(f"\n=== {scenario.id} [{scenario.age_segment}] | {model} ===")
    print(f"Test: {scenario.notes}")
    print(f"Child: {scenario.child_message}")

    start = time.perf_counter()
    try:
        # Gemini 2.5 has reasoning tokens that count against max_output_tokens.
        # Pro reasoning is always-on; Flash can set thinking_budget=0 to disable.
        # We give Pro a large budget (it spends ~1-2k tokens thinking) and
        # disable thinking on Flash to mirror Anthropic Haiku's behavior.
        thinking_cfg = (
            types.ThinkingConfig(thinking_budget=0)
            if "flash" in model
            else None
        )
        resp = client.models.generate_content(
            model=model,
            contents=scenario.child_message,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPTS[scenario.age_segment],
                max_output_tokens=2000,
                temperature=0.7,
                thinking_config=thinking_cfg,
            ),
        )
        latency_ms = (time.perf_counter() - start) * 1000
        response_text = resp.text or ""
        usage = {
            "input_tokens": resp.usage_metadata.prompt_token_count if resp.usage_metadata else None,
            "output_tokens": resp.usage_metadata.candidates_token_count if resp.usage_metadata else None,
        }
    except Exception as exc:
        print(f"  ERROR: {exc}")
        return {"model": model, **asdict(scenario), "error": str(exc)}

    print(f"DUYO ({latency_ms:.0f}ms): {response_text}")
    return {
        "model": model,
        **asdict(scenario),
        "response": response_text,
        "latency_ms": round(latency_ms, 1),
        "usage": usage,
    }


def main() -> int:
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        sys.exit(
            "GOOGLE_API_KEY not set. Get one at https://aistudio.google.com/app/apikey "
            "and add to .env"
        )

    client = genai.Client(api_key=api_key)
    results = []
    for model in MODELS:
        print(f"\n{'#' * 60}\n# MODEL: {model}\n{'#' * 60}")
        for sc in SCENARIOS:
            results.append(run_scenario(client, model, sc))

    out = Path(__file__).parent.parent / "gemini_uzbek_validation.json"
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(f"\nSaved to {out}")
    print(f"\nTotal scenarios: {len(results)} ({len(MODELS)} models × {len(SCENARIOS)} scenarios)")
    print("\nNext step: open the JSON file and rate each model 1-5 for:")
    print("  - Fluency / Age-appropriateness / Cultural fit / Safety")
    print("Then compare with claude_uzbek_validation.json side-by-side.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
