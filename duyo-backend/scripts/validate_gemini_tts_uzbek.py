"""Quick POC: Gemini 2.5 TTS o'zbek tilini qanchalik yaxshi yozadi?

3 ta yosh segmentidan kelgan namunalarni audio'ga aylantirib, .wav fayllarni
./tts_samples/ ga saqlaydi. Sen quloq solib sifatni baholaysan:
- Talaffuz to'g'rimi? ("o'", "g'", "x", "ch" tovushlari)
- Urg'u tabiiymi?
- Sur'at va ohang bolaga mosmi?

Usage:
    set -a; source .env; set +a
    .venv/bin/python scripts/validate_gemini_tts_uzbek.py
"""

from __future__ import annotations

import os
import sys
import time
import wave
from pathlib import Path

try:
    from google import genai
    from google.genai import types
except ImportError:
    sys.exit("Install google-genai first: pip install google-genai")


# Bir nechta voice variant — birinchi sinovda har segmentda kontrast ko'rsatish.
# Gemini Prebuilt voices: Zephyr/Puck/Charon/Kore/Fenrir/Leda/Aoede/Orus etc.
SAMPLES = [
    {
        "id": "tts_junior",
        "voice": "Leda",  # youthful
        "text": (
            "Salom! Men Duyo. Bugun maktabda nima qiziq narsa o'rganding? "
            "Menga aytib ber, men ham bilishni xohlayman."
        ),
    },
    {
        "id": "tts_explorer",
        "voice": "Kore",  # balanced
        "text": (
            "Matematika qiyin tuyulishi mumkin, lekin har bir teorema o'z mantiqiga ega. "
            "Pifagor teoremasi to'g'ri burchakli uchburchak uchun: a kvadrat ortiqcha b kvadrat "
            "teng c kvadrat. Bu kvadratlarning yig'indisi gipotenuza kvadratiga teng degani."
        ),
    },
    {
        "id": "tts_companion",
        "voice": "Charon",  # informative
        "text": (
            "Kasb tanlash — bu hayotiy muhim qaror. Avval o'zingni bilishing kerak: "
            "qaysi fanlar seni qiziqtiradi, qaysi ish turlari kuchli tomonlaringga mos keladi. "
            "Ota-onang yoki o'qituvching bilan maslahatlashish foydali bo'lishi mumkin."
        ),
    },
]

MODEL = "gemini-2.5-flash-preview-tts"
OUT_DIR = Path(__file__).parent.parent / "tts_samples"


def save_wav(path: Path, pcm_data: bytes, channels: int = 1, rate: int = 24_000, width: int = 2) -> None:
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(channels)
        wav.setsampwidth(width)
        wav.setframerate(rate)
        wav.writeframes(pcm_data)


def run_sample(client: genai.Client, sample: dict) -> dict:
    print(f"\n=== {sample['id']} | voice={sample['voice']} ===")
    print(f"Text ({len(sample['text'])} chars): {sample['text'][:90]}...")

    start = time.perf_counter()
    try:
        resp = client.models.generate_content(
            model=MODEL,
            contents=sample["text"],
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=sample["voice"],
                        )
                    )
                ),
            ),
        )
        latency_ms = (time.perf_counter() - start) * 1000
    except Exception as exc:
        print(f"  ERROR: {exc}")
        return {"id": sample["id"], "error": str(exc)}

    # Extract PCM bytes from response
    audio_part = resp.candidates[0].content.parts[0]
    pcm_data = audio_part.inline_data.data
    out_path = OUT_DIR / f"{sample['id']}_{sample['voice']}.wav"
    save_wav(out_path, pcm_data)

    duration_sec = len(pcm_data) / (24_000 * 2)
    print(f"  ✓ {out_path.name}  ({len(pcm_data)} bytes, {duration_sec:.1f}s audio, {latency_ms:.0f}ms gen)")
    return {
        "id": sample["id"],
        "voice": sample["voice"],
        "file": str(out_path),
        "bytes": len(pcm_data),
        "duration_sec": round(duration_sec, 1),
        "latency_ms": round(latency_ms, 1),
    }


def main() -> int:
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        sys.exit("GOOGLE_API_KEY not set in .env")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    client = genai.Client(api_key=api_key)

    print(f"Model: {MODEL}")
    print(f"Output dir: {OUT_DIR}\n")

    results = [run_sample(client, s) for s in SAMPLES]
    print("\n" + "=" * 60)
    print("Tayyor. Audio fayllarni quloq solish uchun:")
    print(f"  open {OUT_DIR}/")
    print("\nBaholash savollari:")
    print("  1. 'o'', 'g'', 'x', 'ch' tovushlari to'g'rimi?")
    print("  2. Urg'u tabiiy joyga tushadimi?")
    print("  3. Sur'at bola uchun mosmi (juda tez emas)?")
    print("  4. Ohang neytral va do'stonami (sun'iy emas)?")
    print("  5. Yosh segmentiga voice mosmi?")
    return 0


if __name__ == "__main__":
    sys.exit(main())
