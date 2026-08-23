"""Voice and video notes — transcription, so the safety screen still applies.

A room of children screens every text message through `screen_peer_message`:
peer-harm, contact details, Layer-1 crisis. A voice clip would walk straight
past all three, because none of them can read audio. The same sentence that is
blocked when typed cannot be allowed merely because it was spoken.

So a note is transcribed FIRST and the existing text screen runs on the
transcript. The transcript is then stored as the message body, which means the
moderation decision stays auditable after the fact and a child who cannot play
the clip can still read what was said.

Transcription failing is not a reason to deliver. A clip nobody has read is
exactly the thing this module exists to prevent, so a failure REFUSES the
note. That is the opposite of `crisis_l2`, which fails open onto a Layer 1
verdict it already has — here there is no prior verdict to fall back to.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

from google.genai import types

from duyo.core.config import get_settings
from duyo.services.gemini import get_client

log = logging.getLogger(__name__)

#: Long enough for the clips the composer can produce (60 s audio, 30 s video)
#: and short enough that a runaway response cannot become a wall of text.
_MAX_TOKENS = 700

_PROMPT = (
    "Siz audio/video yozuvni matnga o'giradigan xizmatsiz.\n"
    "Faqat eshitilgan so'zlarni yozing — izoh, tarjima yoki xulosa qo'shmang.\n"
    "Yozuv o'zbek, rus yoki ingliz tilida bo'lishi mumkin; qaysi tilda "
    "aytilgan bo'lsa, o'sha tilda yozing.\n"
    "Agar hech qanday nutq eshitilmasa, bo'sh javob qaytaring."
)


@dataclass(frozen=True)
class Transcription:
    text: str
    ok: bool
    #: Set when ok is False — for the log and the moderation record, never
    #: shown to the child verbatim.
    error: str | None
    latency_ms: int


async def transcribe(data: bytes, content_type: str) -> Transcription:
    """Best-effort speech-to-text over a clip's audio track.

    Gemini reads audio and video inline, so this reuses the LLM the app
    already depends on rather than adding a second vendor.
    """
    settings = get_settings()
    start = time.perf_counter()
    try:
        # Built inside the try for the same reason crisis_l2 does it: a missing
        # GOOGLE_API_KEY raises here, and an escape would 500 the send instead
        # of refusing it.
        client = get_client()
        resp = await client.aio.models.generate_content(
            model=settings.gemini_model_primary,
            contents=[
                types.Part.from_bytes(data=data, mime_type=content_type),
                types.Part.from_text(text="Ushbu yozuvni matnga o'giring."),
            ],
            config=types.GenerateContentConfig(
                system_instruction=_PROMPT,
                max_output_tokens=_MAX_TOKENS,
                # A transcript is a transcription, not a creative act.
                temperature=0.0,
            ),
        )
    except Exception as exc:
        log.exception("Note transcription failed")
        return Transcription(
            text="",
            ok=False,
            error=str(exc),
            latency_ms=int((time.perf_counter() - start) * 1000),
        )

    return Transcription(
        text=(resp.text or "").strip(),
        ok=True,
        error=None,
        latency_ms=int((time.perf_counter() - start) * 1000),
    )


__all__ = ["Transcription", "transcribe"]
