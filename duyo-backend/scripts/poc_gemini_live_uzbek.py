"""POC: Gemini Live API — real-time bidirectional audio (Bosqich B oldidan).

Savollar:
  1. Mac (Uzbekistan) → Google Live API ulanishi ishlaydimi?
  2. Latency: connect, time-to-first-audio-byte, total round-trip
  3. Gemini Live o'zbek tilini real-time stream'da tushunadimi?
  4. Audio output sifat: tabiiymi, Junior segment'ga mosmi (Leda)?

Test usuli (circular):
  - `tts_samples/tts_junior_Leda.wav` (24000Hz, Gemini TTS bilan yaratilgan)
    "bola gapi" sifatida ishlatiladi
  - 16000Hz'ga resample (Live API input talab)
  - 320ms (5120 sample) chunklarda real-time pacing bilan yuboriladi
  - Response audio (24000Hz PCM) yig'iladi va WAV ga yoziladi
  - Latency metrikalar log qilinadi

Usage:
    set -a; source .env; set +a
    .venv/bin/python scripts/poc_gemini_live_uzbek.py
"""

from __future__ import annotations

import asyncio
import audioop
import json
import os
import sys
import time
import wave
from dataclasses import asdict, dataclass, field
from pathlib import Path

try:
    from google import genai
    from google.genai import types
except ImportError:
    sys.exit("Install google-genai first: pip install google-genai")


MODEL = os.environ.get("LIVE_MODEL", "gemini-2.5-flash-native-audio-latest")
INPUT_SAMPLE_RATE = 16_000
OUTPUT_SAMPLE_RATE = 24_000
CHUNK_MS = 320
VOICE = "Leda"  # Junior segment — TTS POC dan tasdiqlangan

SCRIPT_DIR = Path(__file__).parent
TTS_DIR = SCRIPT_DIR.parent / "tts_samples"
INPUT_WAV = TTS_DIR / "tts_junior_Leda.wav"
OUT_DIR = SCRIPT_DIR.parent / "live_poc_out"
_safe_model = MODEL.replace("/", "_").replace(":", "_")
OUT_AUDIO = OUT_DIR / f"live_response_{_safe_model}.wav"
OUT_METRICS = OUT_DIR / f"live_metrics_{_safe_model}.json"

SYSTEM_PROMPT = (
    "Sen DUYO — 7-10 yoshli o'zbek bolasi uchun do'st. "
    "Bolaga toza, sof o'zbek tilida javob ber. "
    "Qisqa va iliq jumla, savolga aniq javob."
)


@dataclass
class Metrics:
    model: str = MODEL
    voice: str = VOICE
    input_sample_rate: int = INPUT_SAMPLE_RATE
    output_sample_rate: int = OUTPUT_SAMPLE_RATE
    input_duration_ms: int = 0
    input_chunks_sent: int = 0
    connect_ms: int = 0
    first_audio_byte_ms: int = 0
    first_text_ms: int = 0
    total_response_ms: int = 0
    response_audio_bytes: int = 0
    response_audio_duration_ms: int = 0
    response_text: str = ""
    error: str | None = None
    interim_text: list[str] = field(default_factory=list)


def load_pcm_16k_mono(wav_path: Path) -> tuple[bytes, int]:
    """WAV faylni o'qib, mono 16-bit PCM @ 16000Hz ga aylantiradi."""
    with wave.open(str(wav_path), "rb") as wf:
        sample_rate = wf.getframerate()
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)

    if sampwidth != 2:
        raise RuntimeError(f"16-bit PCM kutilgan, lekin {sampwidth*8}-bit topildi")

    if n_channels == 2:
        raw = audioop.tomono(raw, sampwidth, 1.0, 1.0)

    if sample_rate != INPUT_SAMPLE_RATE:
        raw, _ = audioop.ratecv(
            raw, sampwidth, 1, sample_rate, INPUT_SAMPLE_RATE, None
        )

    duration_ms = (len(raw) // 2) * 1000 // INPUT_SAMPLE_RATE
    return raw, duration_ms


def write_wav(path: Path, pcm: bytes, sample_rate: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)


async def run_poc(client: genai.Client, pcm: bytes, metrics: Metrics) -> bytes:
    """Live session ochib audio yuboradi va audio response qaytaradi."""
    chunk_size = INPUT_SAMPLE_RATE * 2 * CHUNK_MS // 1000  # bytes per chunk
    chunks = [pcm[i : i + chunk_size] for i in range(0, len(pcm), chunk_size)]

    # Native-audio model uchun voice_config qo'llab-quvvatlanmaydi.
    # Avtomatik VAD'ni o'chiramiz va explicit activity_start/end bilan boshqaramiz —
    # aks holda TTS audiosidagi tabiiy pauzalar "turn end" deb noto'g'ri interpretatsiya qilinadi.
    config = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        system_instruction=types.Content(parts=[types.Part(text=SYSTEM_PROMPT)]),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(disabled=True),
        ),
    )

    response_audio = bytearray()
    interim_text_parts: list[str] = []

    t_connect_start = time.perf_counter()
    async with client.aio.live.connect(model=MODEL, config=config) as session:
        metrics.connect_ms = int((time.perf_counter() - t_connect_start) * 1000)
        print(f"[{metrics.connect_ms:>5} ms] connected")

        async def sender() -> None:
            # Manual VAD: activity_start → chunks → activity_end
            await session.send_realtime_input(activity_start=types.ActivityStart())
            for i, chunk in enumerate(chunks):
                await session.send_realtime_input(
                    audio=types.Blob(
                        data=chunk,
                        mime_type=f"audio/pcm;rate={INPUT_SAMPLE_RATE}",
                    )
                )
                metrics.input_chunks_sent += 1
                # Real-time pacing — mic kabi simulyatsiya
                await asyncio.sleep(CHUNK_MS / 1000)
            await session.send_realtime_input(activity_end=types.ActivityEnd())
            print(f"[{int((time.perf_counter() - t_send_start) * 1000):>5} ms] "
                  f"sent {metrics.input_chunks_sent} chunks, activity_end")

        t_send_start = time.perf_counter()
        send_task = asyncio.create_task(sender())

        stt_buffer: list[str] = []
        out_tr_buffer: list[str] = []

        try:
            async for msg in session.receive():
                now_ms = int((time.perf_counter() - t_send_start) * 1000)
                sc = msg.server_content

                if msg.data is not None and len(msg.data) > 0:
                    if metrics.first_audio_byte_ms == 0:
                        metrics.first_audio_byte_ms = now_ms
                        print(f"[{now_ms:>5} ms] first audio byte")
                    response_audio.extend(msg.data)

                if msg.text is not None and msg.text:
                    if metrics.first_text_ms == 0:
                        metrics.first_text_ms = now_ms
                    interim_text_parts.append(msg.text)

                if sc is not None:
                    in_tr = getattr(sc, "input_transcription", None)
                    if in_tr is not None and in_tr.text:
                        stt_buffer.append(in_tr.text)

                    out_tr = getattr(sc, "output_transcription", None)
                    if out_tr is not None and out_tr.text:
                        out_tr_buffer.append(out_tr.text)

                    if getattr(sc, "generation_complete", False):
                        print(f"[{now_ms:>5} ms] generation_complete")
                    if getattr(sc, "turn_complete", False):
                        metrics.total_response_ms = now_ms
                        print(f"[{now_ms:>5} ms] turn_complete")
                        break
        finally:
            if stt_buffer:
                stt_full = "".join(stt_buffer).strip()
                metrics.interim_text.append(f"STT: {stt_full}")
                print(f"  STT: {stt_full}")
            if out_tr_buffer:
                out_full = "".join(out_tr_buffer).strip()
                metrics.interim_text.append(f"TTS: {out_full}")
                print(f"  TTS: {out_full}")
            await send_task

    metrics.response_text = "".join(interim_text_parts).strip()
    metrics.response_audio_bytes = len(response_audio)
    metrics.response_audio_duration_ms = (
        (len(response_audio) // 2) * 1000 // OUTPUT_SAMPLE_RATE
    )
    return bytes(response_audio)


async def main_async() -> int:
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: GOOGLE_API_KEY not set in .env", file=sys.stderr)
        return 1

    if not INPUT_WAV.exists():
        print(f"ERROR: input WAV yo'q: {INPUT_WAV}", file=sys.stderr)
        print("Avval scripts/validate_gemini_tts_uzbek.py ishga tushiring.", file=sys.stderr)
        return 1

    print(f"Input:  {INPUT_WAV}")
    pcm_in, duration_ms = load_pcm_16k_mono(INPUT_WAV)
    print(f"  PCM   {len(pcm_in):,} bytes, {duration_ms} ms @ {INPUT_SAMPLE_RATE} Hz mono")

    metrics = Metrics(input_duration_ms=duration_ms)
    client = genai.Client(api_key=api_key)

    t0 = time.perf_counter()
    try:
        pcm_out = await run_poc(client, pcm_in, metrics)
    except Exception as e:
        metrics.error = f"{type(e).__name__}: {e}"
        print(f"\nERROR: {metrics.error}", file=sys.stderr)
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        OUT_METRICS.write_text(json.dumps(asdict(metrics), ensure_ascii=False, indent=2))
        return 2

    total_ms = int((time.perf_counter() - t0) * 1000)
    print(f"\n[OK] total wall time: {total_ms} ms")

    if pcm_out:
        write_wav(OUT_AUDIO, pcm_out, OUTPUT_SAMPLE_RATE)
        print(f"Audio out: {OUT_AUDIO} ({metrics.response_audio_duration_ms} ms)")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_METRICS.write_text(json.dumps(asdict(metrics), ensure_ascii=False, indent=2))
    print(f"Metrics:   {OUT_METRICS}")

    print("\n--- BAHO ---")
    print(f"  connect:           {metrics.connect_ms:>5} ms")
    print(f"  first audio byte:  {metrics.first_audio_byte_ms:>5} ms (audio_stream_end'dan keyin)")
    print(f"  turn_complete:     {metrics.total_response_ms:>5} ms")
    print(f"  response audio:    {metrics.response_audio_duration_ms:>5} ms ({metrics.response_audio_bytes:,} bytes)")
    if metrics.response_text:
        print(f"  text (qisman):     {metrics.response_text[:200]}")

    # Gate qiymatlari (Bosqich B SLA reja)
    print("\n--- GATE (Bosqich B SLA) ---")
    fab = metrics.first_audio_byte_ms
    print(f"  first audio byte <2000 ms:  {'PASS' if 0 < fab < 2000 else 'FAIL'} ({fab} ms)")
    print(f"  connect <1500 ms:           {'PASS' if 0 < metrics.connect_ms < 1500 else 'FAIL'} ({metrics.connect_ms} ms)")
    return 0


def main() -> int:
    return asyncio.run(main_async())


if __name__ == "__main__":
    sys.exit(main())
