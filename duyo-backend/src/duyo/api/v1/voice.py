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
               "child_message_id": "...", "assistant_message_id": "...",
               "memory_candidate": {"category": "...", "content": "..."}?}
  - Text JSON {"type": "error", "message": "..."}

`memory_candidate` is present only when the child said something worth
offering to remember on a GREEN turn. It is a SUGGESTION and is never stored
server-side — the device screens it and asks the child, exactly as the text
chat path does. See services/memory_candidates.py.

JWT lives in the query string because the browser WebSocket API can't
send Authorization headers. WS close codes follow RFC 6455: 1008 for
auth/authz failures, 1011 for unexpected server errors.

Persistence + parent SMS dispatch happen on `turn_complete`. Crisis
Layer 1 runs in real time on the incremental STT stream — ORANGE/RED hits
are forwarded to the client as they happen. Layer 2 (Gemini classifier)
runs once on the full child transcript at turn end and can escalate the
level (never downgrade); an escalation is forwarded as a layer-2 crisis
event before `turn_complete`.
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
from duyo.core.config import get_settings
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
from duyo.services.crisis_l2 import classify
from duyo.services.gemini_live import GeminiVoiceSession
from duyo.services.goals import extract_child_insights
from duyo.services.memory_candidates import extract_memory_candidate
from duyo.services.personalization import (
    build_goal_context,
    build_personalization_context,
)

router = APIRouter(prefix="/chat", tags=["chat"])

#: Keeps fire-and-forget insight tasks alive: asyncio holds tasks weakly, so
#: a create_task with no reference can be garbage-collected before it runs.
_INSIGHT_TASKS: set[asyncio.Task[None]] = set()
log = logging.getLogger(__name__)


# Crisis SMS bodies come from services/sms.py — Eskiz rejects anything that
# does not match its approved template, and a rejected parent alert fails
# silently. Do not inline the text here again.


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
    body = sms_module.crisis_message(child_name, red=level == CrisisLevel.RED)
    try:
        sms = sms_module.get_sms_provider()
        accepted = await sms.send(parent_phone, body)
        if not accepted:
            # See chat.py: a 200 with a non-"waiting" status means the
            # provider took it and dropped it. Never log that as sent.
            log.error(
                "Voice parent SMS REJECTED by provider: phone=%s level=%s body=%r",
                parent_phone, level.value, body,
            )
            return
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
            (ChildProfile.parent_id == user.id) | (ChildProfile.child_user_id == user.id),
        )
    )
    if child is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="child not found")
        return

    conv: Conversation | None = None
    if conversation_id is not None:
        conv = await db.scalar(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.child_id == child.id,
            )
        )
        if conv is None:
            # The client persists conversation_id in local storage, so it
            # outlives the row: a wiped database, a deleted conversation, or an
            # id created under a different child profile all leave a stale one
            # behind. This used to close the socket, and the child saw only
            # "Aloqa uzildi" with no way out but reinstalling — the app never
            # clears the id on its own. Start a fresh conversation instead.
            #
            # This is NOT a authorization hole: the query above is already
            # scoped to this child, so an id belonging to another child simply
            # misses and gets a new conversation of the caller's own rather
            # than attaching to someone else's.
            log.info(
                "voice_ws stale conversation_id=%s child=%s — starting a new one",
                conversation_id, child.id,
            )
    if conv is None:
        conv = Conversation(child_id=child.id)
        db.add(conv)
        await db.flush()

    # 2. Build the live system prompt: base age-segment prompt + (optionally)
    #    prior conversation embedded as plain text so the model has context.
    #    Gemini Live realtime audio mode rejects client_content turns mid-
    #    session (closes WS with 1007), so we cannot stream history as
    #    structured turns — embedding inside system_instruction is the
    #    supported path. Also strips the "Salom-alik bilan boshla" line from
    #    the base prompt so the model doesn't greet on every reconnect.
    base_prompt = SYSTEM_PROMPTS[child.age_segment]
    voice_prompt = base_prompt.replace("Salom-alik bilan boshla.", "").strip()

    # Same per-child context the text path builds. Without this a child who set
    # a goal in text chat gets a DUYO with no memory of it the moment they
    # switch to voice — the inconsistency reads as the companion forgetting.
    for _block in (
        await build_personalization_context(db, child.id),
        await build_goal_context(db, child.id),
    ):
        if _block:
            voice_prompt += f"\n\n{_block}"

    # For the insight extractor at turn end — same (role, content) tuple shape
    # chat.py hands it, so a spoken "buni miyamga yozib qo'y" has a referent.
    insight_history: list[tuple[str, str]] = []
    if conversation_id is not None:
        max_msgs = get_settings().conversation_history_max_messages
        prior = (
            await db.scalars(
                select(Message)
                .where(Message.conversation_id == conv.id)
                .order_by(Message.created_at.desc())
                .limit(max_msgs)
            )
        ).all()
        insight_history = [
            ("user" if m.role == MessageRole.CHILD else "model", m.content)
            for m in reversed(prior)
            if m.content
        ]
        history_lines = [
            f"{'Bola' if m.role == MessageRole.CHILD else 'DUYO'}: {m.content}"
            for m in reversed(prior)
            if m.content
        ]
        if history_lines:
            voice_prompt += (
                "\n\nOldingi suhbat (kontekst uchun):\n"
                + "\n".join(history_lines)
                + "\n\nBu suhbatni tabiiy davom ettir. "
                "Salomlashma — siz allaqachon bola bilan suhbatdasiz."
            )

    # 3. Accept the socket — from here on the client is connected and we
    #    must answer every frame, even on error.
    await websocket.accept()
    await websocket.send_json({"type": "ready", "conversation_id": str(conv.id)})

    crisis = StreamCrisisDetector()
    full_output_text = ""
    crisis_flagged_to_client: set[CrisisLevel] = set()

    log.warning(
        "voice_ws start child=%s conv=%s prompt_len=%d history_msgs=%d",
        child.id, conv.id, len(voice_prompt),
        len([1 for ln in voice_prompt.splitlines() if ln.startswith(("Bola:", "DUYO:"))]),
    )

    try:
        async with session_factory(system_prompt=voice_prompt) as voice:
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
                event_counts: dict[str, int] = {}
                async for event in voice.events():
                    event_counts[event.kind] = event_counts.get(event.kind, 0) + 1
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
                log.warning("voice_ws gemini events conv=%s counts=%s", conv.id, event_counts)

            await asyncio.gather(pump_client_to_voice(), pump_voice_to_client())
    except Exception:
        log.exception("voice_ws error after accept")
        with contextlib.suppress(Exception):
            await websocket.send_json({"type": "error", "message": "internal_error"})
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        await db.rollback()
        return

    # 3. Crisis Layer 2 (Gemini) on the full child transcript — can ESCALATE the
    #    Layer 1 stream result (never downgrade). Then persist + dispatch SMS.
    child_text = crisis.text
    l1_level = crisis.result.level
    final_matches = crisis.result.matches

    # Personal-memory candidate from what the child SAID OUT LOUD. Started
    # here so it overlaps the Layer 2 classifier, the DB writes and any SMS
    # dispatch below, and collected just before turn_complete — a child
    # waiting on the end of their own turn should not also wait on this.
    #
    # Same contract as the text path (see services/memory_candidates.py):
    # nothing is written server-side, the result only rides back in
    # turn_complete, and the device's Memory Guard plus the child's explicit
    # yes decide whether it is ever kept. Deliberately NOT gated on the
    # crisis level yet — final_level is not known until L2 returns below, so
    # the gate is applied at collection time instead.
    memory_task = (
        asyncio.create_task(extract_memory_candidate(child_text))
        if child_text.strip()
        else None
    )

    l2 = await classify(child_text, l1_level) if child_text.strip() else None
    final_level = l2.level if l2 is not None else l1_level

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
            level=l1_level,
            layer=1,
            matches=[
                {"keyword": m.keyword, "category": m.category.value, "language": m.language.value}
                for m in final_matches
            ],
        )
        db.add(crisis_row)
    if l2 is not None and l2.confidence > 0:
        ce2 = CrisisEvent(
            message_id=child_msg.id,
            child_id=child.id,
            level=l2.level,
            layer=2,
            matches=[{
                "confidence": l2.confidence,
                "reasoning": l2.reasoning,
                "latency_ms": l2.latency_ms,
            }],
        )
        db.add(ce2)
        # Ensure parent-notify marking has a row even if L1 found nothing.
        if crisis_row is None:
            crisis_row = ce2

    assistant_msg = Message(
        conversation_id=conv.id,
        role=MessageRole.ASSISTANT,
        content=full_output_text,
        crisis_level=CrisisLevel.GREEN,
    )
    db.add(assistant_msg)
    await db.flush()
    await db.commit()

    # What the child said OUT LOUD feeds the brain map exactly like a typed
    # message: goal capture, style signal and topic notes (see chat.py's
    # add_task of extract_child_insights). A websocket has no BackgroundTasks,
    # so it is a fire-and-forget asyncio task — referenced in _INSIGHT_TASKS
    # because a bare create_task can be garbage-collected mid-flight. GREEN
    # only, mirroring the text path: a crisis turn is handled by the crisis
    # machinery, not mined for interests.
    if final_level == CrisisLevel.GREEN and child_text.strip():
        insight_task = asyncio.create_task(
            extract_child_insights(child.id, child_text, insight_history)
        )
        _INSIGHT_TASKS.add(insight_task)
        insight_task.add_done_callback(_INSIGHT_TASKS.discard)

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
        # `user` is the session holder, which for a linked child is the
        # child's own login — the alert must reach the parent's phone
        # specifically, resolved from the profile rather than the socket.
        parent_phone = (
            user.phone if child.parent_id == user.id
            else await db.scalar(select(User.phone).where(User.id == child.parent_id))
        )
        # Block turn_complete on SMS — child-safety dispatch must land before
        # we end the session. Stub is instant; Eskiz is ~200ms HTTP, dwarfed
        # by the voice turn itself.
        if parent_phone:
            await _send_parent_sms(
                parent_phone=parent_phone, child_name=child.name, level=final_level
            )

    # If Layer 2 escalated beyond what was streamed to the client, surface it now.
    if (
        final_level in (CrisisLevel.ORANGE, CrisisLevel.RED)
        and final_level not in crisis_flagged_to_client
    ):
        await websocket.send_json(
            {"type": "crisis", "level": final_level.value, "layer": 2}
        )

    # Collect the memory candidate started above. GREEN only, matching the
    # text path: a turn already flagged as crisis-relevant is not a moment to
    # ask "shall I remember that?".
    memory_candidate: dict[str, str] | None = None
    if memory_task is not None:
        if final_level == CrisisLevel.GREEN:
            try:
                candidate = await memory_task
            except Exception:
                # extract_memory_candidate swallows its own failures, so
                # reaching here is unforeseen. A missed prompt must never cost
                # the child the end of their turn.
                log.exception("voice memory candidate failed conv=%s", conv.id)
                candidate = None
            if candidate is not None:
                memory_candidate = {
                    "category": candidate.category,
                    "content": candidate.content,
                }
        else:
            # Not needed — cancel rather than leave it running past the turn.
            memory_task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await memory_task

    turn_complete: dict[str, Any] = {
        "type": "turn_complete",
        "conversation_id": str(conv.id),
        "child_message_id": str(child_msg.id),
        "assistant_message_id": str(assistant_msg.id),
    }
    if memory_candidate is not None:
        turn_complete["memory_candidate"] = memory_candidate

    await websocket.send_json(turn_complete)
    await websocket.close()
