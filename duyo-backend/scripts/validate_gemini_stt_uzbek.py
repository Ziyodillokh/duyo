"""Quick POC: Gemini 2.5 Flash STT (audio → matn) o'zbek tilini qanchalik yaxshi tushunadi?

Circular test: TTS bilan yaratilgan 3 ta audio fayl (tts_samples/) ni qaytadan
matnga aylantirib, asl matn bilan taqqoslaymiz. Bu STT layer'ning sifat
ko'rsatkichi (WER — Word Error Rate).

Usage:
    # Avval validate_gemini_tts_uzbek.py ishga tushiring (audio fayllar yaratish)
    set -a; source .env; set +a
    .venv/bin/python scripts/validate_gemini_stt_uzbek.py
"""

from __future__ import annotations

import os
import sys
import time
from difflib import SequenceMatcher
from pathlib import Path

try:
    from google import genai
    from google.genai import types
except ImportError:
    sys.exit("Install google-genai first: pip install google-genai")


# Asl matnlar (TTS skript bilan bir xil)
GROUND_TRUTH = {
    "tts_junior_Leda.wav": (
        "Salom! Men Duyo. Bugun maktabda nima qiziq narsa o'rganding? "
        "Menga aytib ber, men ham bilishni xohlayman."
    ),
    "tts_explorer_Kore.wav": (
        "Matematika qiyin tuyulishi mumkin, lekin har bir teorema o'z mantiqiga ega. "
        "Pifagor teoremasi to'g'ri burchakli uchburchak uchun: a kvadrat ortiqcha b kvadrat "
        "teng c kvadrat. Bu kvadratlarning yig'indisi gipotenuza kvadratiga teng degani."
    ),
    "tts_companion_Charon.wav": (
        "Kasb tanlash — bu hayotiy muhim qaror. Avval o'zingni bilishing kerak: "
        "qaysi fanlar seni qiziqtiradi, qaysi ish turlari kuchli tomonlaringga mos keladi. "
        "Ota-onang yoki o'qituvching bilan maslahatlashish foydali bo'lishi mumkin."
    ),
}

MODEL = "gemini-2.5-flash"
AUDIO_DIR = Path(__file__).parent.parent / "tts_samples"


def similarity(a: str, b: str) -> float:
    """Token-level similarity 0-1 (rough WER inverse)."""
    return SequenceMatcher(None, a.lower().split(), b.lower().split()).ratio()


def transcribe(client: genai.Client, audio_path: Path) -> tuple[str, float]:
    audio_bytes = audio_path.read_bytes()
    start = time.perf_counter()
    resp = client.models.generate_content(
        model=MODEL,
        contents=[
            types.Part.from_bytes(data=audio_bytes, mime_type="audio/wav"),
            "Bu audio o'zbek tilida. Aniq transkripsiya qil (so'zlarni bir xil ko'rinishda yoz, hech narsa qo'shma, izoh berma). Faqat asl matn.",
        ],
        config=types.GenerateContentConfig(
            max_output_tokens=2000,
            temperature=0.0,
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        ),
    )
    latency_ms = (time.perf_counter() - start) * 1000
    return (resp.text or "").strip(), latency_ms


def main() -> int:
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        sys.exit("GOOGLE_API_KEY not set in .env")

    if not AUDIO_DIR.exists():
        sys.exit(f"Audio dir yo'q: {AUDIO_DIR}. Avval validate_gemini_tts_uzbek.py ishga tushiring.")

    client = genai.Client(api_key=api_key)

    print(f"Model: {MODEL} (audio understanding)")
    print(f"Audio dir: {AUDIO_DIR}\n")

    print(f"{'File':<35} {'Sim':<6} {'Latency':<10}")
    print("-" * 60)
    for filename, truth in GROUND_TRUTH.items():
        audio_path = AUDIO_DIR / filename
        if not audio_path.exists():
            print(f"  {filename}: missing")
            continue
        try:
            transcript, latency_ms = transcribe(client, audio_path)
        except Exception as exc:
            print(f"  {filename}: ERROR {exc}")
            continue
        sim = similarity(truth, transcript)
        print(f"{filename:<35} {sim:.2f}   {latency_ms:.0f}ms")
        print(f"  ASL:    {truth}")
        print(f"  STT:    {transcript}")
        print()

    print("\nQayta eslatma — similarity:")
    print("  0.95-1.00 → A'lo (commercial)")
    print("  0.85-0.95 → Yaxshi (production'ga mos)")
    print("  0.70-0.85 → O'rta (sinash davom)")
    print("  <0.70    → Yomon (boshqa STT kerak)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
