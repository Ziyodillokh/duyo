"""Grow the child's brain map from conversation — Obsidian, written by talking.

When a chat turn carries a real learning topic (the third signal of
INSIGHT_EXTRACT_PROMPT), this module turns it into a knowledge note in the
child's graph: a new topic gets a note with the facts discussed, and a topic
the child RETURNS to gets its existing note ENRICHED — new facts appended,
new [[links]] merged — so the map deepens with every conversation instead of
resetting.

Boundaries that keep this safe and honest:

- DUYO only ever edits notes it created itself (source=chat_topic). A child's
  `manual` note is their own writing — api/v1/note.py promises "the child
  reads back exactly what they wrote" — and a goal-path step is written once.
  A topic that collides with such a title is simply skipped.
- Everything lands only in this child's private graph; nothing is shared.
- Facts are deduplicated case-insensitively, and an already-rich note stops
  growing (soft cap) rather than scrolling forever.
- Fails to nothing, silently: a missed topic costs one node; a wrong or
  duplicated one costs the child's trust in their own map.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from duyo.core.database import get_session_factory
from duyo.models.note import ChildNote, NoteSource
from duyo.services.notes import extract_links

log = structlog.get_logger(__name__)

_TITLE_MAX = 60
_FACT_MAX = 200
_MAX_FACTS = 3
_MAX_RELATED = 2
#: Past this, a topic note is rich enough — appending more would turn a map
#: node into a scroll. The child can always write their own note beside it.
_BODY_SOFT_CAP = 4000
#: A chatty child could mint a node per conversation forever; the map should
#: stay a map, not a landfill. Manual notes are never counted or capped.
_MAX_TOPIC_NOTES = 80
_RELATED_LABEL = "O'xshash:"


#: Characters with syntax meaning in a note body. `[ ] #` build links/tags;
#: `|` is EXCLUDED by the [[link]] regex (notes.py _LINK), so a name carrying
#: it would render as permanently dead literal text — and worse, an
#: unparseable link never lands in extract_links, so enrichment would re-append
#: it on every return to the topic.
_SYNTAX_CHARS = "[]#|"
#: A sentence-shaped title ("Dinozavrlar.") and its bare retelling
#: ("Dinozavrlar") must collapse onto ONE note, or "returning enriches"
#: silently becomes "returning duplicates".
_TRAILING_PUNCT = ".,:;!?…"


def _clean_name(raw: object, cap: int) -> str:
    """Whitespace-normalised, punctuation-trimmed node name. '' when unusable.

    `raw or ''` first: JSON null arrives as Python None, and str(None) is the
    literal 'None' — which would otherwise pass every length check and mint a
    note titled 'None' or a [[None]] link.
    """
    name = " ".join(str(raw or "").split())[:cap].rstrip(_TRAILING_PUNCT).strip()
    return "" if any(ch in name for ch in _SYNTAX_CHARS) else name


def _clean_topic(raw: object) -> dict[str, Any] | None:
    """Validated {title, facts, related, tag} out of model output, or None.

    Model output is untrusted in shape (not just content): every field is
    re-typed, clamped and bounded here so nothing downstream needs to care.
    """
    if not isinstance(raw, dict):
        return None
    title = _clean_name(raw.get("title"), _TITLE_MAX)
    if len(title) < 3 or len(title.split()) > 4:
        return None

    facts = []
    for item in raw.get("facts") or []:
        if not item:
            continue
        # Facts are prose, not names: link/tag syntax is stripped rather than
        # the whole fact dropped — the model wrapping a word in [[...]] must
        # not let it inject nodes into the child's graph.
        fact = str(item).translate(str.maketrans("", "", _SYNTAX_CHARS))
        fact = " ".join(fact.split()).strip()[:_FACT_MAX]
        if len(fact) >= 5:
            facts.append(fact)
        if len(facts) >= _MAX_FACTS:
            break
    if not facts:
        return None  # a topic with nothing said about it is not knowledge

    related = []
    seen_related = {title.casefold()}
    for item in raw.get("related") or []:
        name = _clean_name(item, _TITLE_MAX)
        if len(name) >= 3 and name.casefold() not in seen_related:
            related.append(name)
            seen_related.add(name.casefold())
        if len(related) >= _MAX_RELATED:
            break

    tag_words = str(raw.get("tag") or "").strip().lower().split()
    tag_word = tag_words[0] if tag_words else ""
    if not tag_word.isalpha() or len(tag_word) > 20:
        tag_word = "mavzu"

    return {"title": title, "facts": facts, "related": related, "tag": tag_word}


def _format_new_body(facts: list[str], related: list[str], tag: str) -> str:
    lines = [f"• {fact}" for fact in facts]
    if related:
        lines += ["", f"{_RELATED_LABEL} " + " · ".join(f"[[{r}]]" for r in related)]
    lines += ["", f"#{tag}"]
    return "\n".join(lines)


def _enrich_body(body: str, facts: list[str], related: list[str]) -> str | None:
    """`body` with the genuinely-new facts/links folded in, or None for no-op.

    New facts land after the last existing bullet, so the note reads as one
    growing list; new links merge into the existing related-line (or add one).
    Substring dedup, case-insensitive: re-telling the same fact changes nothing.
    """
    body_cf = body.casefold()
    new_facts = [f for f in facts if f.casefold() not in body_cf]
    linked_cf = {link.casefold() for link in extract_links(body)}
    new_links = [r for r in related if r.casefold() not in linked_cf]
    if not new_facts and not new_links:
        return None
    if len(body) > _BODY_SOFT_CAP:
        return None

    lines = body.split("\n")
    # Insertion point for facts: right after the final existing bullet, else
    # before the tail (related line / tag line / end).
    last_bullet = max((i for i, ln in enumerate(lines) if ln.startswith("• ")), default=-1)
    if last_bullet >= 0:
        insert_at = last_bullet + 1
    else:
        insert_at = next(
            (i for i, ln in enumerate(lines)
             if ln.startswith(_RELATED_LABEL) or ln.startswith("#")),
            len(lines),
        )
    lines[insert_at:insert_at] = [f"• {fact}" for fact in new_facts]

    if new_links:
        addition = " · ".join(f"[[{r}]]" for r in new_links)
        for i, line in enumerate(lines):
            if line.startswith(_RELATED_LABEL):
                lines[i] = f"{line} · {addition}"
                break
        else:
            tag_at = next(
                (i for i, ln in enumerate(lines) if ln.startswith("#")), len(lines)
            )
            lines[tag_at:tag_at] = [f"{_RELATED_LABEL} {addition}", ""]

    return "\n".join(lines)


async def capture_topic(child_id: UUID, raw_topic: object) -> None:
    """Create or enrich the topic note for one chat turn. Never raises."""
    topic = _clean_topic(raw_topic)
    if topic is None:
        return
    try:
        session_factory = get_session_factory()
        async with session_factory() as session:
            existing = await session.scalar(
                select(ChildNote).where(
                    ChildNote.child_id == child_id,
                    func.lower(ChildNote.title) == topic["title"].lower(),
                )
            )

            if existing is not None:
                if existing.source is not NoteSource.CHAT_TOPIC:
                    # The child's own note (or a goal step) owns this title.
                    return
                new_body = _enrich_body(existing.body, topic["facts"], topic["related"])
                if new_body is None:
                    return
                existing.body = new_body
                await session.commit()
                log.info("topic_note_enriched", child=str(child_id), title=topic["title"])
                return

            topic_count = await session.scalar(
                select(func.count(ChildNote.id)).where(
                    ChildNote.child_id == child_id,
                    ChildNote.source == NoteSource.CHAT_TOPIC,
                )
            )
            if (topic_count or 0) >= _MAX_TOPIC_NOTES:
                return

            session.add(
                ChildNote(
                    child_id=child_id,
                    title=topic["title"],
                    body=_format_new_body(topic["facts"], topic["related"], topic["tag"]),
                    source=NoteSource.CHAT_TOPIC,
                    colour=None,  # the #tag colours the node (galaxy-layout)
                )
            )
            try:
                await session.commit()
            except IntegrityError:
                # Concurrent turn created it first — next mention enriches it.
                await session.rollback()
                return
            log.info("topic_note_created", child=str(child_id), title=topic["title"])
    except Exception:
        log.exception("topic_capture_failed", child=str(child_id))
