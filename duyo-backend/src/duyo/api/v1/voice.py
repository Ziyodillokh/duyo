"""Voice mode WebSocket endpoint — /v1/chat/voice.

The mobile client opens one WebSocket per turn:

    wss://api.duyo.uz/v1/chat/voice?token=<JWT>&child_id=<UUID>&conversation_id=<UUID|opt>

Client → server frames:
  - Binary  : one PCM audio chunk (16000Hz mono 16-bit)
  - Text "END_TURN" : signal that the user finished speaking

Server → client frames:
  - Text JSON {"type": "ready", "conversation_id": "..."}
  - Binary             : response audio chunk (24000Hz mono 16-bit)
  - Text JSON {"type": "input_transcript", "text": "..."}    (incremental)
  - Text JSON {"type": "output_transcript", "text": "..."}   (incremental)
  - Text JSON {"type": "crisis", "level": "RED|ORANGE", "layer": 1}
  - Text JSON {"type": "turn_complete", "conversation_id": "...",
               "child_message_id": "...", "assistant_message_id": "..."}
  - Text JSON {"type": "error", "message": "..."}

JWT lives in the query string because the browser WebSocket API can't
send Authorization headers. WS close codes follow RFC 6455: 1008 for
auth/authz failures, 1011 for unexpected server errors.

Persistence + parent SMS dispatch happen on `turn_complete`. Crisis
Layer 1 runs in real time on the incremental STT stream — RED hits are
forwarded to the client as they happen. Layer 2 is deferred to a
follow-up commit; this commit ships Layer 1 only.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import Callable
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_db
from duyo.core.security import decode_token
from duyo.crisis.detector import CrisisCategory as L1Category
from duyo.crisis.stream import StreamCrisisDetector
from duyo.models.child import ChildProfile
from duyo.models.conversation import Conversation
from duyo.models.crisis_event import CrisisEvent, CrisisLevel
from duyo.models.message import Message, MessageRole
from duyo.models.user import User
from duyo.prompts import SYSTEM_PROMPTS
from duyo.services import sms as sms_module
from duyo.services.gemini_live import GeminiVoiceSession

router = APIRouter(prefix="/chat", tags=["chat"])
log = logging.getLogger(__name__)


_RED_TEMPLATE = (
    "DUYO XAVF: {name} bola jiddiy xavf signal berdi. "
    "Iltimos DARHOL bog'laning. Ishonch telefon: 1142"
)
_ORANGE_TEMPLATE = (
    "DUYO: {name} bola xabarida tashvishli signallar bor. "
    "24 soat ichida bola bilan suhbat o'tkazing. Maslahat: 1142"
)


# Voice session factory is a FastAPI dependency so tests can swap it out
# without monkey-patching imports.
VoiceSessionFactory = Callable[..., Any]


def get_voice_session_factory() -> VoiceSessionFactory:
    return GeminiVoiceSession


async def _authenticate(token: str, db: AsyncSession) -> User | None:
    """Decode token → resolve User. Returns None on any failure."""
    try:
        claims = decode_token(token, expected_type="access")
        user_id = UUID(claims["sub"])
    except (ValueError, KeyError):
        return None
    return await db.scalar(select(User).where(User.id == user_id))


async def _send_parent_sms(parent_phone: str, child_name: str, level: CrisisLevel) -> None:
    template = _RED_TEMPLATE if level == CrisisLevel.RED else _ORANGE_TEMPLATE
    body = template.format(name=child_name)
    try:
        sms = sms_module.get_sms_provider()
        await sms.send(parent_phone, body)
        log.info("Voice parent SMS dispatched phone=%s level=%s", parent_phone, level.value)
    except Exception:
        log.exception("Voice parent SMS dispatch failed phone=%s", parent_phone)


@router.websocket("/voice")
async def voice_ws(
    websocket: WebSocket,
    token: str = Query(...),
    child_id: UUID = Query(...),
    conversation_id: UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    session_factory: VoiceSessionFactory = Depends(get_voice_session_factory),
) -> None:
    # 1. Auth + authorization happen BEFORE accept() so we can close with a
    #    proper code and the client sees the failure.
    user = await _authenticate(token, db)
    if user is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="unauthorized")
        return

    child = await db.scalar(
        select(ChildProfile).where(
            ChildProfile.id == child_id,
            ChildProfile.parent_id == user.id,
        )
    )
    if child is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="child not found")
        return

    conv: Conversation
    if conversation_id is None:
        conv = Conversation(child_id=child.id)
        db.add(conv)
        await db.flush()
    else:
        existing = await db.scalar(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.child_id == child.id,
            )
        )
        if existing is None:
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION, reason="conversation not found"
            )
            return
        conv = existing

    # 2. Accept the socket — from here on the client is connected and we
    #    must answer every frame, even on error.
    await websocket.accept()
    await websocket.send_json({"type": "ready", "conversation_id": str(conv.id)})

    crisis = StreamCrisisDetector()
    full_output_text = ""
    crisis_flagged_to_client: set[CrisisLevel] = set()

    try:
        async with session_factory(system_prompt=SYSTEM_PROMPTS[child.age_segment]) as voice:
            await voice.start_activity()

            async def pump_client_to_voice() -> None:
                """Reads from client until END_TURN, forwards audio to Gemini."""
                while True:
                    try:
                        message = await websocket.receive()
                    except WebSocketDisconnect:
                        return
                    if message.get("type") == "websocket.disconnect":
                        return
                    if (chunk := message.get("bytes")) is not None:
                        await voice.send_audio(chunk)
                        continue
                    if message.get("text") == "END_TURN":
                        await voice.end_activity()
                        return

            async def pump_voice_to_client() -> None:
                """Forwards Gemini events to the client and feeds the crisis stream."""
                nonlocal full_output_text
                async for event in voice.events():
                    if event.kind == "audio":
                        await websocket.send_bytes(event.audio_data)
                    elif event.kind == "input_tr":
                        crisis.feed(event.text)
                        await websocket.send_json(
                            {"type": "input_transcript", "text": event.text}
                        )
                        level = crisis.result.level
                        if (
                            level in (CrisisLevel.ORANGE, CrisisLevel.RED)
                            and level not in crisis_flagged_to_client
                        ):
                            crisis_flagged_to_client.add(level)
                            await websocket.send_json(
                                {"type": "crisis", "level": level.value, "layer": 1}
                            )
                    elif event.kind == "output_tr":
                        full_output_text += event.text
                        await websocket.send_json(
                            {"type": "output_transcript", "text": event.text}
                        )
                    # gen_complete / turn_complete close the iterator — no client emit.

            await asyncio.gather(pump_client_to_voice(), pump_voice_to_client())
    except Exception:
        log.exception("voice_ws error after accept")
        with contextlib.suppress(Exception):
            await websocket.send_json({"type": "error", "message": "internal_error"})
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        await db.rollback()
        return

    # 3. Persist messages + crisis events, then dispatch parent SMS.
    child_text = crisis.text
    final_level = crisis.result.level
    final_matches = crisis.result.matches

    child_msg = Message(
        conversation_id=conv.id,
        role=MessageRole.CHILD,
        content=child_text,
        crisis_level=final_level,
    )
    db.add(child_msg)
    await db.flush()

    crisis_row: CrisisEvent | None = None
    if final_matches:
        crisis_row = CrisisEvent(
            message_id=child_msg.id,
            child_id=child.id,
            level=final_level,
            layer=1,
            matches=[
                {"keyword": m.keyword, "category": m.category.value, "language": m.language.value}
                for m in final_matches
            ],
        )
        db.add(crisis_row)

    assistant_msg = Message(
        conversation_id=conv.id,
        role=MessageRole.ASSISTANT,
        content=full_output_text,
        crisis_level=CrisisLevel.GREEN,
    )
    db.add(assistant_msg)
    await db.flush()
    await db.commit()

    # Parent SMS — abuse-only ORANGE is NOT sent to the parent (TZ §9.6).
    categories = {m.category for m in final_matches}
    is_abuse_only = bool(categories) and categories.issubset({L1Category.ABUSE_VICTIM})
    should_notify = (
        final_level == CrisisLevel.RED
        or (final_level == CrisisLevel.ORANGE and not is_abuse_only)
    )
    if should_notify:
        if crisis_row is not None:
            crisis_row.parent_notified = True
        # Block turn_complete on SMS — child-safety dispatch must land before
        # we end the session. Stub is instant; Eskiz is ~200ms HTTP, dwarfed
        # by the voice turn itself.
        await _send_parent_sms(
            parent_phone=user.phone, child_name=child.name, level=final_level
        )

    await websocket.send_json(
        {
            "type": "turn_complete",
            "conversation_id": str(conv.id),
            "child_message_id": str(child_msg.id),
            "assistant_message_id": str(assistant_msg.id),
        }
    )
    await websocket.close()
