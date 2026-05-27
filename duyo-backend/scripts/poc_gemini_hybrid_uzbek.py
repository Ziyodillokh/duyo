"""POC: Gemini Hybrid Pipeline — STT + Chat + TTS (batch, alohida modellar).

Live 3.1 single-stack bilan side-by-side solishtirish uchun:
  1. STT:  gemini-2.5-flash (audio understanding, batch)
  2. Chat: gemini-2.5-flash (text in → text out)
  3. TTS:  gemini-2.5-flash-preview-tts (Leda voice, Junior segment)

Input: tts_samples/tts_junior_Leda.wav (Live POC bilan bir xil)
Output: live_poc_out/hybrid_response.wav + hybrid_metrics.json

Usage:
    set -a; source .env; set +a
    .venv/bin/python scripts/poc_gemini_hybrid_uzbek.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
import wave
from dataclasses import asdict, dataclass
from pathlib import Path

try:
    from google import genai
    from google.genai import types
except ImportError:
    sys.exit("Install google-genai first: pip install google-genai")


STT_MODEL = "gemini-2.5-flash"
CHAT_MODEL = "gemini-2.5-flash"
TTS_MODEL = "gemini-2.5-flash-preview-tts"
TTS_VOICE = "Leda"
OUTPUT_SAMPLE_RATE = 24_000

SCRIPT_DIR = Path(__file__).parent
TTS_DIR = SCRIPT_DIR.parent / "tts_samples"
INPUT_WAV = TTS_DIR / "tts_junior_Leda.wav"
OUT_DIR = SCRIPT_DIR.parent / "live_poc_out"
OUT_AUDIO = OUT_DIR / "hybrid_response.wav"
OUT_METRICS = OUT_DIR / "hybrid_metrics.json"

SYSTEM_PROMPT = (
    "Sen DUYO — 7-10 yoshli o'zbek bolasi uchun do'st. "
    "Bolaga toza, sof o'zbek tilida javob ber. "
    "Qisqa va iliq jumla, savolga aniq javob."
)


@dataclass
class HybridMetrics:
    stt_model: str = STT_MODEL
    chat_model: str = CHAT_MODEL
    tts_model: str = TTS_MODEL
    tts_voice: str = TTS_VOICE
    input_audio_bytes: int = 0
    stt_latency_ms: int = 0
    stt_text: str = ""
    stt_tokens_in: int = 0
    stt_tokens_out: int = 0
    chat_latency_ms: int = 0
    chat_text: str = ""
    chat_tokens_in: int = 0
    chat_tokens_out: int = 0
    tts_latency_ms: int = 0
    tts_audio_bytes: int = 0
    tts_audio_duration_ms: int = 0
    total_latency_ms: int = 0
    first_audio_byte_ms: int = 0
    error: str | None = None


def write_wav(path: Path, pcm: bytes, sample_rate: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)


async def step_stt(client: genai.Client, audio_bytes: bytes, m: HybridMetrics) -> str:
    start = time.perf_counter()
    resp = await client.aio.models.generate_content(
        model=STT_MODEL,
        contents=[
            types.Part.from_bytes(data=audio_bytes, mime_type="audio/wav"),
            "Bu audio o'zbek tilida. Aniq transkripsiya qil "
            "(so'zlarni bir xil ko'rinishda yoz, izoh berma). Faqat asl matn.",
        ],
        config=types.GenerateContentConfig(
            max_output_tokens=2000,
            temperature=0.0,
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        ),
    )
    m.stt_latency_ms = int((time.perf_counter() - start) * 1000)
    m.stt_text = (resp.text or "").strip()
    if resp.usage_metadata:
        m.stt_tokens_in = resp.usage_metadata.prompt_token_count or 0
        m.stt_tokens_out = resp.usage_metadata.candidates_token_count or 0
    print(f"[STT  {m.stt_latency_ms:>5} ms] {m.stt_text!r}")
    return m.stt_text


async def step_chat(client: genai.Client, child_text: str, m: HybridMetrics) -> str:
    start = time.perf_counter()
    resp = await client.aio.models.generate_content(
        model=CHAT_MODEL,
        contents=[types.Content(role="user", parts=[types.Part(text=child_text)])],
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            max_output_tokens=400,
            temperature=0.7,
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        ),
    )
    m.chat_latency_ms = int((time.perf_counter() - start) * 1000)
    m.chat_text = (resp.text or "").strip()
    if resp.usage_metadata:
        m.chat_tokens_in = resp.usage_metadata.prompt_token_count or 0
        m.chat_tokens_out = resp.usage_metadata.candidates_token_count or 0
    print(f"[CHAT {m.chat_latency_ms:>5} ms] {m.chat_text!r}")
    return m.chat_text


def _clean_for_tts(text: str) -> str:
    """Emoji va boshqa non-speech belgilarni olib tashlaydi."""
    return "".join(c for c in text if c.isprintable() and ord(c) < 0x2700).strip()


async def step_tts(client: genai.Client, text: str, m: HybridMetrics) -> bytes:
    speak_text = _clean_for_tts(text)
    start = time.perf_counter()
    resp = await client.aio.models.generate_content(
        model=TTS_MODEL,
        contents=f"Quyidagi o'zbek matnni iliq, do'stona ohangda o'qi:\n\n{speak_text}",
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=TTS_VOICE)
                )
            ),
        ),
    )
    m.tts_latency_ms = int((time.perf_counter() - start) * 1000)
    audio_part = resp.candidates[0].content.parts[0]
    pcm = audio_part.inline_data.data
    m.tts_audio_bytes = len(pcm)
    m.tts_audio_duration_ms = (len(pcm) // 2) * 1000 // OUTPUT_SAMPLE_RATE
    print(
        f"[TTS  {m.tts_latency_ms:>5} ms] {m.tts_audio_bytes:,} bytes "
        f"({m.tts_audio_duration_ms} ms audio)"
    )
    return pcm


async def main_async() -> int:
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: GOOGLE_API_KEY not set", file=sys.stderr)
        return 1

    if not INPUT_WAV.exists():
        print(f"ERROR: input WAV yo'q: {INPUT_WAV}", file=sys.stderr)
        return 1

    audio_bytes = INPUT_WAV.read_bytes()
    m = HybridMetrics(input_audio_bytes=len(audio_bytes))
    client = genai.Client(api_key=api_key)

    t0 = time.perf_counter()
    try:
        stt_text = await step_stt(client, audio_bytes, m)
        if not stt_text:
            raise RuntimeError("STT bo'sh natija qaytardi")
        chat_text = await step_chat(client, stt_text, m)
        if not chat_text:
            raise RuntimeError("Chat bo'sh natija qaytardi")
        # TTFB metric — STT + chat + start of TTS (TTS is non-streaming here,
        # so TTFB = full pipeline. For streaming TTS, would be different.)
        pcm = await step_tts(client, chat_text, m)
    except Exception as e:
        m.error = f"{type(e).__name__}: {e}"
        print(f"\nERROR: {m.error}", file=sys.stderr)
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        OUT_METRICS.write_text(json.dumps(asdict(m), ensure_ascii=False, indent=2))
        return 2

    m.total_latency_ms = int((time.perf_counter() - t0) * 1000)
    m.first_audio_byte_ms = m.total_latency_ms  # batch TTS — first byte = end of pipeline

    write_wav(OUT_AUDIO, pcm, OUTPUT_SAMPLE_RATE)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_METRICS.write_text(json.dumps(asdict(m), ensure_ascii=False, indent=2))

    print(f"\nAudio out: {OUT_AUDIO}")
    print(f"Metrics:   {OUT_METRICS}")

    print("\n--- HYBRID BAHO ---")
    print(f"  STT:   {m.stt_latency_ms:>5} ms")
    print(f"  Chat:  {m.chat_latency_ms:>5} ms")
    print(f"  TTS:   {m.tts_latency_ms:>5} ms")
    print(f"  TOTAL: {m.total_latency_ms:>5} ms  (= TTFB, batch)")
    total_in = m.stt_tokens_in + m.chat_tokens_in
    total_out = m.stt_tokens_out + m.chat_tokens_out
    print(f"  Tokens in:  {total_in:>5} (STT {m.stt_tokens_in} + Chat {m.chat_tokens_in})")
    print(f"  Tokens out: {total_out:>5} (STT {m.stt_tokens_out} + Chat {m.chat_tokens_out})")
    return 0


def main() -> int:
    return asyncio.run(main_async())


if __name__ == "__main__":
    sys.exit(main())
