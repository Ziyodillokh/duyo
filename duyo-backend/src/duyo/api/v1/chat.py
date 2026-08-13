"""Chat endpoint — single-turn child↔DUYO message with crisis detection."""

import asyncio
import logging
import re
import time
from dataclasses import replace as _dc_replace
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.billing.limits import check_daily_message_limit
from duyo.core.config import get_settings
from duyo.crisis.detector import CrisisCategory as L1Category
from duyo.crisis.detector import KeywordCrisisDetector
from duyo.crisis.router import get_detector
from duyo.crisis.semantic import classify as classify_l3
from duyo.models.child import AgeSegment, ChildProfile
from duyo.models.conversation import Conversation
from duyo.models.crisis_event import CrisisEvent, CrisisLevel, highest
from duyo.models.feedback import FeedbackRating, MessageFeedback
from duyo.models.message import Message, MessageRole
from duyo.models.user import User
from duyo.psychology.retriever import retrieve_for_chat as retrieve_psych_for_chat
from duyo.schemas.chat import (
    BoardFigure,
    BoardRequest,
    BoardResponse,
    BoardStep,
    ChatImage,
    ChatRequest,
    ChatResponse,
    ChatSource,
    ChildCreate,
    ChildRead,
    ChildUpdate,
    FeedbackRequest,
    FeedbackResponse,
    HintRequest,
    HintResponse,
    LessonHelpRequest,
    LessonHelpResponse,
    LessonStep,
    MemoryCandidateRead,
    QuickReply,
    SourceRef,
    TranslateRequest,
    TranslateResponse,
)
from duyo.services.crisis_l2 import classify
from duyo.services.gemini import (
    GeminiReply,
    chat_with_web_search,
    solve_lesson,
    solve_on_board,
    suggest_hint,
    translate_text,
)
from duyo.services.gemini import chat as gemini_chat
from duyo.services.goals import extract_child_insights
from duyo.services.images import search_images
from duyo.services.memory_candidates import MemoryCandidate, extract_memory_candidate
from duyo.services.personalization import (
    build_goal_context,
    build_local_memory_context,
    build_personalization_context,
    build_style_context,
)
from duyo.services.scripted import match_scripted
from duyo.services.sms import get_sms_provider
from duyo.textbook.retriever import RagRetrieval, retrieve_for_chat

router = APIRouter(prefix="/chat", tags=["chat"])


# What DUYO says when it cannot reach the model at all. Honest rather than
# evasive — a child who is told "I'm thinking" and then gets nothing learns the
# companion lies. Keyed by the child's own language, same as every other reply.
LLM_UNAVAILABLE = {
    "uz": ("Kechir, hozir javob bera olmayapman — biroz muammo bor. "
           "Bir necha daqiqadan keyin yana yozib ko'r, men shu yerdaman."),
    "ru": ("Извини, сейчас я не могу ответить — что-то не работает. "
           "Напиши мне через пару минут, я никуда не денусь."),
    "en": ("Sorry, I can't answer right now — something isn't working. "
           "Try again in a couple of minutes, I'll be here."),
}

# Uzbek Cyrillic and Russian share most of an alphabet, but each has letters
# the other never uses — the cheapest reliable way to tell them apart.
_RUSSIAN_ONLY = set("щъыэё")          # щ ъ ы э ё
_UZBEK_CYRILLIC_ONLY = set("ўқғҳ")          # ў қ ғ ҳ
_CYRILLIC = set("абвгдежзи"
                "йклмнопрс"
                "туфхцчшьюя")

# Common words in each language, checked whole. Short on purpose: this picks
# which sentence of apology to send, not a translation.
_ENGLISH_HINTS = {"the", "you", "how", "what", "why", "hello", "hi", "please",
                  "can", "is", "are", "my", "me", "do", "does", "help"}
_UZBEK_HINTS = {"va", "men", "sen", "nima", "qanday", "salom", "rahmat",
                "bugun", "yaxshi", "kerak", "bor", "yoq"}
_RUSSIAN_HINTS = {
    "привет", "как",
    "дела", "что",
    "почему", "где",
    "мне", "ты", "я",
    "спасибо",
    "помоги",
}  # привет как дела что почему где мне ты я спасибо помоги

_WORD = re.compile(r"[a-z']+")
# Built from the sets above rather than retyped, so the alphabets can't drift.
_CYR_WORD = re.compile(
    "[" + "".join(sorted(_CYRILLIC | _RUSSIAN_ONLY | _UZBEK_CYRILLIC_ONLY)) + "]+"
)


def _reply_language(message: str, profile: str) -> str:
    """Which language to apologise in.

    The child is answered in the language they wrote in, not the one set on
    their profile — a bilingual child switches mid-conversation and a reply in
    the wrong language reads as not being listened to. A heuristic is right
    here because the cost of being wrong is one apology in the wrong language;
    real replies get their language from the model, which sees the message.
    """
    text = (message or "").lower()
    letters = set(text)

    if letters & _UZBEK_CYRILLIC_ONLY:
        return "uz"
    if letters & _RUSSIAN_ONLY:
        return "ru"
    if letters & _CYRILLIC:
        # Cyrillic with no decisive letter: Russian words settle it, otherwise
        # trust the profile — a Cyrillic-writing Uzbek child stays in Uzbek.
        if set(_CYR_WORD.findall(text)) & _RUSSIAN_HINTS:
            return "ru"
        return "uz" if profile == "uz" else "ru"

    words = set(_WORD.findall(text))
    if words & _ENGLISH_HINTS and not words & _UZBEK_HINTS:
        return "en"
    if words & _UZBEK_HINTS:
        return "uz"
    return profile if profile in LLM_UNAVAILABLE else "uz"


log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Parent SMS dispatch — runs in BackgroundTasks so it never blocks the response.
# Per TZ §9.6: ABUSE_VICTIM ORANGE does NOT auto-send to parent (sending an
# abuse alert to the abuser endangers the child). Those route to the 3rd-party
# safety provider once D-002 is finalised.
# ---------------------------------------------------------------------------

_NO_AUTO_PARENT_CATEGORIES = {L1Category.ABUSE_VICTIM, L1Category.NEGLECT}

_RED_TEMPLATE = (
    "DUYO XAVF: {name} bola jiddiy xavf signal berdi. "
    "Iltimos DARHOL bog'laning. Ishonch telefon: 1142"
)
_ORANGE_TEMPLATE = (
    "DUYO: {name} bola xabarida tashvishli signallar bor. "
    "24 soat ichida bola bilan suhbat o'tkazing. Maslahat: 1142"
)


async def _dispatch_parent_alert(parent_phone: str, child_name: str, level: CrisisLevel) -> None:
    """Send SMS to the parent. Fire-and-forget — failures are logged."""
    template = _RED_TEMPLATE if level == CrisisLevel.RED else _ORANGE_TEMPLATE
    body = template.format(name=child_name)
    try:
        sms = get_sms_provider()
        await sms.send(parent_phone, body)
        log.info("Parent SMS dispatched: phone=%s level=%s child=%s", parent_phone, level.value, child_name)
    except Exception:
        log.exception("Parent SMS dispatch failed: phone=%s level=%s", parent_phone, level.value)


@router.post("/children", response_model=ChildRead, status_code=status.HTTP_201_CREATED)
async def create_child(
    payload: ChildCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChildProfile:
    """Create the child, or return the one that already matches.

    Onboarding can reach this more than once for the same child — a double
    tap, a retried request after a timeout, or a reinstall that walks the
    flow again. Each of those used to append another profile: production
    accumulated six copies of one child this way. Same parent, same name,
    same age is treated as the same child.
    """
    existing = await db.scalar(
        select(ChildProfile).where(
            ChildProfile.parent_id == current_user.id,
            func.lower(func.trim(ChildProfile.name)) == payload.name.lower(),
            ChildProfile.age == payload.age,
        )
    )
    if existing is not None:
        # Late-arriving onboarding answers still land on the existing row.
        if payload.interests:
            existing.interests = payload.interests
        if payload.mascot:
            existing.mascot = payload.mascot
        await db.commit()
        return existing

    child = ChildProfile(
        parent_id=current_user.id,
        name=payload.name,
        age=payload.age,
        age_segment=AgeSegment.from_age(payload.age),
        language=payload.language,
        interests=payload.interests,
        mascot=payload.mascot,
    )
    db.add(child)
    # Commit before returning: get_db commits only after the response is
    # serialised, so a failure there would answer 201 with an id that never
    # made it to Postgres.
    await db.commit()
    await db.refresh(child)
    return child


async def _get_owned_child(
    child_id: UUID, current_user: User, db: AsyncSession
) -> ChildProfile:
    """Fetch a child owned by current_user, or raise 404.

    Returns 404 (not 403) for another family's child so existence never leaks.
    """
    result = await db.execute(
        select(ChildProfile).where(
            ChildProfile.id == child_id,
            ChildProfile.parent_id == current_user.id,
        )
    )
    child = result.scalar_one_or_none()
    if child is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Child not found")
    return child


@router.get("/children", response_model=list[ChildRead])
async def list_children(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChildProfile]:
    result = await db.execute(
        select(ChildProfile)
        .where(ChildProfile.parent_id == current_user.id)
        .order_by(ChildProfile.created_at)
    )
    return list(result.scalars().all())


@router.get("/children/{child_id}", response_model=ChildRead)
async def get_child(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChildProfile:
    return await _get_owned_child(child_id, current_user, db)


@router.put("/children/{child_id}", response_model=ChildRead)
async def update_child(
    child_id: UUID,
    payload: ChildUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChildProfile:
    child = await _get_owned_child(child_id, current_user, db)
    if payload.name is not None:
        child.name = payload.name
    if payload.age is not None:
        child.age = payload.age
        child.age_segment = AgeSegment.from_age(payload.age)
    if payload.language is not None:
        child.language = payload.language
    if payload.interests is not None:
        child.interests = payload.interests
    if payload.mascot is not None:
        child.mascot = payload.mascot
    await db.flush()
    return child


@router.delete("/children/{child_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_child(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Erase a child profile and dependent data.

    Conversations cascade via the ORM relationship; crisis_events cascade at
    the DB level. Satisfies the parent's right to erase (TZ §8 / COPPA / GDPR-K).
    """
    child = await _get_owned_child(child_id, current_user, db)
    await db.delete(child)
    await db.flush()


@router.post("", response_model=ChatResponse)
async def chat_turn(
    payload: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    detector: KeywordCrisisDetector = Depends(get_detector),
) -> ChatResponse:
    """One chat turn: child message → Layer 1 → Layer 2 → Gemini → persist → respond."""
    # 1. Verify child belongs to caller
    child = await db.scalar(
        select(ChildProfile).where(
            ChildProfile.id == payload.child_id,
            ChildProfile.parent_id == current_user.id,
        )
    )
    if child is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Child not found")

    # Phase timings for the whole turn.
    #
    # A chat turn chains crisis screening, retrieval and a grounded
    # generation, and when the total crossed the mobile client's timeout the
    # only evidence anywhere was `POST /v1/chat 499` in nginx — the backend
    # logs nothing for a request the client abandoned, so there was no way to
    # see WHICH phase had grown. One line per turn makes that a lookup
    # instead of an investigation.
    turn_started = time.perf_counter()
    timings: dict[str, int] = {}

    def _mark(phase: str, since: float) -> float:
        timings[phase] = int((time.perf_counter() - since) * 1000)
        return time.perf_counter()

    # 1b. Enforce the subscription daily message limit (Concept §12.1).
    #     Free tier = 20 child messages/day; paid tiers unlimited. Checked
    #     BEFORE any LLM call so an over-limit turn costs nothing.
    limit_status = await check_daily_message_limit(db, current_user.id)
    if not limit_status.allowed:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Kunlik xabar chegarasi tugadi ({limit_status.used}/"
                f"{limit_status.limit}). Ko'proq suhbat uchun obunani yangilang."
            ),
        )

    # 2. Resolve or create conversation
    history: list[tuple[str, str]] = []
    conv = None
    if payload.conversation_id is not None:
        conv = await db.scalar(
            select(Conversation).where(
                Conversation.id == payload.conversation_id,
                Conversation.child_id == child.id,
            )
        )
        if conv is None:
            # The client persists conversation_id locally, so it outlives the
            # row — a wiped database, a deleted conversation, or an id created
            # under a different child profile all leave a stale one behind.
            # This used to 404 every message the child sent, with no way out
            # but reinstalling, because nothing clears the stored id. Start a
            # fresh conversation instead; the query above is already scoped to
            # this child, so another child's id misses and gets a new
            # conversation of the caller's own rather than attaching to theirs.
            log.info(
                "chat stale conversation_id=%s child=%s — starting a new one",
                payload.conversation_id, child.id,
            )

    if conv is None:
        conv = Conversation(child_id=child.id)
        db.add(conv)
        await db.flush()
    else:
        # Fetch last N messages (chronological after reverse) for multi-turn context
        max_msgs = get_settings().conversation_history_max_messages
        prior = (
            await db.scalars(
                select(Message)
                .where(Message.conversation_id == conv.id)
                .order_by(Message.created_at.desc())
                .limit(max_msgs)
            )
        ).all()
        # Chronological order (oldest first) — Gemini expects that
        history = [
            ("user" if m.role == MessageRole.CHILD else "model", m.content)
            for m in reversed(prior)
        ]

    # 3. Crisis Layer 1 (keyword) — runs synchronously, <100ms
    l1 = detector.check(payload.message)
    l1_level = CrisisLevel(l1.level.value)

    # 4. Crisis Layers 2 and 3, CONCURRENTLY.
    #
    # Both are escalate-only relative to Layer 1 — L2 clamps its answer to at
    # least `l1_level`, and L3 does the same with whatever floor it is given —
    # so running them in sequence bought nothing but latency: L3 only ever
    # used L2's answer as a floor it could not go below, and taking the max of
    # all three afterwards is the identical result. Chaining them cost a whole
    # extra model round-trip inside a request that was already exceeding the
    # client's timeout.
    #
    # The safety property is unchanged and is asserted in tests: the final
    # level is never below any individual layer's.
    _phase = time.perf_counter()
    l2, l3 = await asyncio.gather(
        classify(payload.message, l1_level),
        classify_l3(payload.message, l1_level),
    )
    final_level = highest(l1_level, l2.level, l3.level)
    _phase = _mark("crisis_l2_l3", _phase)

    # 5. Persist child message
    child_msg = Message(
        conversation_id=conv.id,
        role=MessageRole.CHILD,
        content=payload.message,
        crisis_level=final_level,
    )
    db.add(child_msg)
    await db.flush()

    # 6. Persist crisis events (one per layer that fired) — track for SMS marking
    crisis_events: list[CrisisEvent] = []
    if l1.matches:
        ce1 = CrisisEvent(
            message_id=child_msg.id,
            child_id=child.id,
            level=l1_level,
            layer=1,
            matches=[
                {"keyword": m.keyword, "category": m.category.value, "language": m.language.value}
                for m in l1.matches
            ],
        )
        db.add(ce1)
        crisis_events.append(ce1)
    if l2.confidence > 0:
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
        crisis_events.append(ce2)
    if l3.level != CrisisLevel.GREEN:
        ce3 = CrisisEvent(
            message_id=child_msg.id,
            child_id=child.id,
            level=l3.level,
            layer=3,
            matches=[{
                "keyword": l3.closest_phrase,
                "category": l3.category.value if l3.category else None,
                "language": "semantic",
                "confidence": l3.confidence,
            }],
        )
        db.add(ce3)
        crisis_events.append(ce3)

    # 7. Parent SMS dispatch policy (TZ §9.6 — DO NOT alert a parent who may be
    #    the harm source). NEGLECT carries the same risk as ABUSE_VICTIM here.
    #    L3 can flag the same categories on paraphrased text with no literal L1
    #    hit, so its category counts too — otherwise a semantic-only abuse
    #    signal would incorrectly auto-SMS the potentially-abusive parent.
    l1_categories = {m.category for m in l1.matches}
    l3_categories = {l3.category} if l3.category else set()
    flagged_categories = l1_categories | l3_categories
    is_abuse_only = bool(flagged_categories) and flagged_categories.issubset(_NO_AUTO_PARENT_CATEGORIES)

    should_notify_parent = (
        final_level == CrisisLevel.RED
        or (final_level == CrisisLevel.ORANGE and not is_abuse_only)
    )

    if should_notify_parent:
        now = datetime.now(UTC)
        for ce in crisis_events:
            ce.parent_notified = True
            ce.parent_notified_at = now
        background_tasks.add_task(
            _dispatch_parent_alert,
            current_user.phone,
            child.name,
            final_level,
        )
        log.warning(
            "CRISIS dispatched level=%s child=%s msg=%s phone=%s",
            final_level.value, child.id, child_msg.id, current_user.phone,
        )
    elif final_level in (CrisisLevel.ORANGE, CrisisLevel.RED):
        # ORANGE + abuse-only: skip parent, log for 3rd-party safety provider routing later
        log.warning(
            "CRISIS abuse-only ORANGE — NOT notifying parent (TZ §9.6). child=%s msg=%s",
            child.id, child_msg.id,
        )

    # Capture any goal the child just stated ("O'tkan Kunlarni o'qimoqchiman")
    # or progress on one ("10-betdaman"), AND fold in a style/interest signal
    # (services/style_profile.py) — ONE combined Gemini call for both, see
    # prompts.py::INSIGHT_EXTRACT_PROMPT. BackgroundTask so it costs the
    # reply nothing; a goal lands unconfirmed so DUYO never acts on its own
    # guess, and a style trait only reaches the prompt once it has repeated.
    if final_level == CrisisLevel.GREEN:
        background_tasks.add_task(extract_child_insights, child.id, payload.message)

    # Personal-memory candidate for the LOCAL, on-device store (spec §4) —
    # started here and awaited at the very end, so its Gemini call overlaps
    # the reply's instead of running after it. Awaiting it sequentially would
    # add its full latency to every GREEN turn the child waits through, for a
    # result that only feeds an optional "eslab qolaymi?" prompt.
    #
    # Unlike the goal extractor above this is NOT a BackgroundTask: those run
    # after the response is sent, and this result has to travel IN the
    # response (nothing about it is ever persisted server-side — see
    # services/memory_candidates.py). It cannot raise: every failure path in
    # extract_memory_candidate returns None.
    memory_task: asyncio.Task[MemoryCandidate | None] | None = None
    if final_level == CrisisLevel.GREEN:
        memory_task = asyncio.create_task(extract_memory_candidate(payload.message))

    # 8-9. Build the reply. Four flows:
    #   (a) action="web_search"  → skip RAG, answer from Google Search grounding
    #   (b) textbook RAG hit     → textbook answer + cite + offer web search
    #   (c) psychology RAG hit   → supportive reply grounded in the psych knowledge base
    #   (d) no RAG hit           → answer from Google Search grounding
    source: ChatSource | None = None
    quick_replies: list[QuickReply] = []
    images: list[ChatImage] = []

    # Adaptive personalization (no model retraining — see services/personalization.py):
    # a small context block derived from the child's latest cached aggregate
    # report, threaded into every LLM reply path below.
    # Joined into ONE string on purpose: chat.py already threads
    # `personalization_context` into all four LLM reply paths below, so goals,
    # the style profile and the device's own memory ride along without
    # touching either system-instruction assembly site.
    # They must NOT use the rag_context slot — psychology RAG owns that.
    _context_blocks = [
        await build_personalization_context(db, child.id),
        await build_goal_context(db, child.id),
        await build_style_context(db, child.id),
        # Device-selected, device-stored personal memory — see
        # services/memory_candidates.py's module docstring. Pure function
        # over payload.memory_context; no DB read, nothing persisted.
        build_local_memory_context(payload.memory_context),
    ]
    personalization_context = "\n\n".join(b for b in _context_blocks if b) or None
    # Sequential on purpose: these share one AsyncSession, which is not safe
    # for concurrent use. They are plain indexed reads, not the bottleneck.
    _phase = _mark("context_blocks", _phase)

    # (0) Scripted intent — instant canned reply for common greetings/thanks,
    #     skipping the LLM entirely (cost saving). Only for GREEN, non-web-search
    #     turns; real questions fall through to RAG/LLM.
    scripted_text = (
        match_scripted(payload.message, child.language.value)
        if payload.action != "web_search" and final_level == CrisisLevel.GREEN
        else None
    )

    if scripted_text is not None:
        reply = GeminiReply(
            text=scripted_text, model="scripted", latency_ms=0,
            tokens_in=0, tokens_out=0,
        )
    else:
        # Every LLM path lives inside this try. A companion that answers a
        # child with HTTP 500 is worse than one that answers honestly: quota
        # exhaustion (429), a network blip, or a missing key are all states
        # the child must never meet as an error screen. The message and its
        # crisis screening are already recorded above, so a failure here loses
        # the reply, never the safety signal.
        try:
            if payload.action == "web_search":
                # "Ha" follow-up: search the web for the ORIGINAL question
                # (action_query). Pass NO history on purpose — the history ends
                # with the literal "Ha", which makes the model reply socially
                # ("shall we talk about apples?") instead of delivering the web
                # answer. The query is self-contained.
                query = payload.action_query or payload.message
                reply = await chat_with_web_search(
                    child_message=query, age_segment=child.age_segment,
                    personalization_context=personalization_context,
                )
                source = _web_source(reply.sources)
                # A few illustrative, family-safe images for the same question.
                images = [
                    ChatImage(
                        url=img.url, title=img.title, source_url=img.source_url,
                        creator=img.creator, license=img.license,
                    )
                    for img in await search_images(query, limit=3)
                ]
            else:
                rag = await retrieve_for_chat(db, payload.message)
                if rag is not None:
                    reply = await gemini_chat(
                        child_message=payload.message, age_segment=child.age_segment,
                        history=history, rag_context=rag.context,  # type: ignore[arg-type]
                        personalization_context=personalization_context,
                    )
                    reply = _append_offer(reply)
                    source = _textbook_source(rag)
                    quick_replies = [
                        QuickReply(label="Ha", action="web_search", query=payload.message),
                        QuickReply(label="Yo'q", action="dismiss"),
                    ]
                else:
                    psych = await retrieve_psych_for_chat(
                        db, payload.message, age_segment=child.age_segment.value,
                    )
                    if psych is not None:
                        reply = await gemini_chat(
                            child_message=payload.message, age_segment=child.age_segment,
                            history=history, rag_context=psych.context,  # type: ignore[arg-type]
                            personalization_context=personalization_context,
                        )
                    else:
                        reply = await chat_with_web_search(
                            child_message=payload.message, age_segment=child.age_segment, history=history,  # type: ignore[arg-type]
                            personalization_context=personalization_context,
                        )
                        source = _web_source(reply.sources)
        except Exception:
            log.exception("chat_llm_failed child=%s", child.id)
            reply = GeminiReply(
                text=LLM_UNAVAILABLE[
                    _reply_language(payload.message, child.language.value)
                ],
                model="fallback", latency_ms=0, tokens_in=0, tokens_out=0,
            )
            source = None
            images = []
            quick_replies = []

    _phase = _mark("reply", _phase)

    # 10. Persist assistant message
    assistant_msg = Message(
        conversation_id=conv.id,
        role=MessageRole.ASSISTANT,
        content=reply.text,
        model=reply.model,
        latency_ms=reply.latency_ms,
        tokens_in=reply.tokens_in,
        tokens_out=reply.tokens_out,
        crisis_level=CrisisLevel.GREEN,
    )
    db.add(assistant_msg)
    conv.message_count = (conv.message_count or 0) + 2
    await db.flush()

    # 11. Collect the personal-memory candidate started before the reply was
    #     built. Same "child's own words, extractor only suggests" philosophy
    #     as the goal extractor, but this result is NEVER written to Postgres
    #     (see services/memory_candidates.py) — it rides back in this response
    #     only, and the device's Memory Guard plus the child's explicit
    #     consent decide whether it is kept at all, encrypted, on their own
    #     phone. GREEN-only, same gate as goal extraction: a message already
    #     flagged as crisis-relevant is not a candidate for a casual
    #     "remember this?" prompt.
    memory_candidate: MemoryCandidateRead | None = None
    if memory_task is not None:
        try:
            candidate = await memory_task
        except Exception:
            # Belt-and-braces: extract_memory_candidate swallows its own
            # failures, so reaching here means something unforeseen. A missed
            # memory prompt must never cost the child their reply.
            log.exception("memory_candidate_task_failed child=%s", child.id)
            candidate = None
        if candidate is not None:
            memory_candidate = MemoryCandidateRead(
                category=candidate.category, content=candidate.content,
            )
    _mark("memory_candidate", _phase)

    total_ms = int((time.perf_counter() - turn_started) * 1000)
    # WARNING, not INFO: the app configures no logging, so INFO never reaches
    # container output (see services/goals.py's note on the same problem).
    log.warning(
        "chat_turn_timing child=%s total_ms=%d phases=%s model=%s",
        child.id, total_ms, timings, reply.model,
    )

    return ChatResponse(
        conversation_id=conv.id,
        message_id=assistant_msg.id,
        reply=reply.text,
        crisis_level=final_level,
        model=reply.model,
        latency_ms=reply.latency_ms,
        source=source,
        quick_replies=quick_replies,
        images=images,
        memory_candidate=memory_candidate,
    )


_WEB_OFFER = "\n\nXohlasang internetdan ham qo'shimcha ma'lumot qidiraman."


def _textbook_source(rag: RagRetrieval) -> ChatSource:
    subject, grade, _ = rag.refs[0]
    pretty = subject.replace("-", " ").capitalize()
    return ChatSource(
        type="textbook",
        label=f"{grade}-sinf {pretty} darsligi",
        refs=[SourceRef(title=f"{g}-sinf {s.replace('-', ' ').capitalize()}" + (f" — {t}" if t else ""))
              for s, g, t in rag.refs],
    )


def _web_source(sources) -> ChatSource:
    return ChatSource(
        type="web",
        label="Internet",
        refs=[SourceRef(title=s.title, url=s.url) for s in sources],
    )


def _append_offer(reply):
    return _dc_replace(reply, text=reply.text + _WEB_OFFER)


@router.post("/lesson-help", response_model=LessonHelpResponse)
async def lesson_help(
    payload: LessonHelpRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LessonHelpResponse:
    """AI tutor: step-by-step solution for a child's homework question.

    Age-aware (uses the child's segment), Uzbek, child-safe. Stateless —
    nothing is persisted. Fails safe: always returns at least one step.
    """
    child = await _get_owned_child(payload.child_id, current_user, db)
    result = await solve_lesson(
        question=payload.question,
        subject=payload.subject,
        age_segment=child.age_segment,
    )
    return LessonHelpResponse(
        steps=[LessonStep(title=s["title"], detail=s["detail"]) for s in result["steps"]],
        answer=result["answer"],
    )


@router.post("/board", response_model=BoardResponse)
async def board(
    payload: BoardRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BoardResponse:
    """Chalkboard: if the child just asked a solvable problem, lay it out.

    Called per turn from the voice screen, so it fails closed — a non-problem
    utterance or any model error returns is_problem=False and the board simply
    never appears. Stateless; nothing is persisted.
    """
    child = await _get_owned_child(payload.child_id, current_user, db)
    result = await solve_on_board(
        question=payload.question,
        age_segment=child.age_segment,
    )
    fig = result.get("figure")
    return BoardResponse(
        is_problem=result["is_problem"],
        title=result["title"],
        problem=result["problem"],
        steps=[BoardStep(expr=s["expr"], note=s["note"]) for s in result["steps"]],
        answer=result["answer"],
        figure=BoardFigure(**fig) if fig else None,
    )


@router.post("/translate", response_model=TranslateResponse)
async def translate(
    payload: TranslateRequest,
    _current_user: User = Depends(get_current_user),
) -> TranslateResponse:
    """Translate a phrase into the target language (voice-screen translate button)."""
    translated = await translate_text(text=payload.text, target_lang=payload.target_lang)
    return TranslateResponse(translated=translated)


@router.post("/hint", response_model=HintResponse)
async def hint(
    payload: HintRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HintResponse:
    """Suggest a short thing the child could say next (voice-screen hint button)."""
    child = await _get_owned_child(payload.child_id, current_user, db)
    text = await suggest_hint(context=payload.context, age_segment=child.age_segment)
    return HintResponse(hint=text)


@router.post("/messages/{message_id}/feedback", response_model=FeedbackResponse)
async def rate_message(
    message_id: UUID,
    payload: FeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FeedbackResponse:
    """Record the child's 👍/👎 on a DUYO reply.

    Ratings are a HUMAN-REVIEWED dataset (see models/feedback.py) — storing one
    never changes model behaviour on its own. Re-rating the same message
    overwrites the previous vote rather than stacking rows.
    """
    child = await _get_owned_child(payload.child_id, current_user, db)

    # The message must be an assistant turn inside one of THIS child's
    # conversations — otherwise a parent could rate another family's reply.
    message = await db.scalar(
        select(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Message.id == message_id,
            Message.role == MessageRole.ASSISTANT,
            Conversation.child_id == child.id,
        )
    )
    if message is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")

    rating = FeedbackRating(payload.rating)
    existing = await db.scalar(
        select(MessageFeedback).where(
            MessageFeedback.message_id == message_id,
            MessageFeedback.child_id == child.id,
        )
    )
    if existing is None:
        db.add(MessageFeedback(
            message_id=message_id,
            child_id=child.id,
            rating=rating,
            reason=payload.reason,
        ))
    else:
        existing.rating = rating
        existing.reason = payload.reason
        # A changed vote re-opens the item for triage.
        existing.reviewed_at = None
        existing.reviewed_by = None
    await db.flush()

    return FeedbackResponse(message_id=message_id, rating=rating.value)
